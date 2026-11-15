/* NORTHSIDE · alıcının bilet sayfası (/biletim/?s=<sipariş>&k=<erişim anahtarı>)
   Sipariş ve biletler ns-odeme görevinden erişim anahtarıyla okunur; her bilet için QR kod çizilir. */
(() => {
  "use strict";
  const NS = window.NS;
  const $ = (s) => document.querySelector(s);
  const p = new URLSearchParams(location.search);
  const s = p.get("s") || "", k = p.get("k") || "";

  const uyari = (metin, tur) => { const u = $("[data-uyari]"); u.textContent = metin; u.dataset.tur = tur || ""; u.hidden = !metin; };
  const bitir = () => { $("[data-yukleniyor]").hidden = true; };

  const DURUM = { gecerli: "Geçerli", kullanildi: "Kullanıldı", iptal: "İptal" };
  const kodBicim = (kod) => kod.length === 10 ? kod.slice(0, 5) + " " + kod.slice(5) : kod;

  function qrSvg(metin) {
    if (typeof window.qrcode !== "function") return "";
    const qr = window.qrcode(0, "M");
    qr.addData(metin);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }

  async function yukle() {
    if (!s || !k) { bitir(); uyari("Bilet bağlantısı eksik. Ödeme sonrası açılan sayfanın bağlantısını kullanın."); return; }
    const j = await NS.odeme({ islem: "biletler", s, k });
    bitir();
    if (!j.ok) { uyari(j.mesaj || "Bilet bulunamadı."); return; }
    const { siparis: o, etkinlik: e, biletler } = j;

    $("[data-kod]").textContent = o.kod;
    $("[data-sahip]").textContent = `${o.ad} ${o.soyad}`;
    $("[data-tutar]").textContent = NS.tl(o.toplam);
    $("[data-baslik]").textContent = e ? e.baslik : "Northside";
    const yer = e ? [e.mekan, e.sehir].filter(Boolean).join(", ") : "";
    const tarih = e ? `${NS.tamTarih(e.baslangic)}, ${NS.saat(e.baslangic)}` : "";
    $("[data-alt]").textContent = [tarih, yer, e && e.kapi_acilis ? `Kapı ${NS.saat(e.kapi_acilis)}` : ""].filter(Boolean).join(" · ");

    if (o.durum === "odendi" && window.NSOlcum) window.NSOlcum.satinAlma(o);

    if (o.durum === "bekliyor") {
      $("[data-kicker]").textContent = "Ödeme bekleniyor";
      uyari("Ödemeniz henüz onaylanmadı. Ödemeyi tamamladıysanız birkaç dakika sonra bu sayfayı yenileyin.", "bilgi");
      $("[data-not]").hidden = true;
    } else if (o.durum === "basarisiz") {
      $("[data-kicker]").textContent = "Ödeme tamamlanmadı";
      uyari("Bu siparişin ödemesi tamamlanmadı, bilet oluşmadı.");
      $("[data-not]").hidden = true;
    } else if (o.durum === "iptal" || o.durum === "iade") {
      $("[data-kicker]").textContent = o.durum === "iade" ? "İade edildi" : "İptal edildi";
      uyari(o.durum === "iade" ? "Bu siparişin ücreti iade edildi; biletler geçersiz." : "Bu sipariş iptal edildi; biletler geçersiz.");
    } else if (e && e.durum === "iptal") {
      uyari("Etkinlik iptal edildi. Ücret iadesi için sipariş kodunuzla bize yazın.");
    }

    $("[data-biletler]").innerHTML = (biletler || []).map((b, i) => `
      <article class="bilet-kart" data-durum="${NS.esc(b.durum)}" aria-label="Bilet ${i + 1}">
        <div class="bilet-kart-ust">
          <img src="/assets/logo-dark.svg" alt="NORTHSIDE" width="124" height="14">
          <span class="bilet-kart-durum" data-durum="${NS.esc(b.durum)}">${DURUM[b.durum] || NS.esc(b.durum)}</span>
        </div>
        <div>
          <h2 class="bilet-kart-baslik">${NS.esc(e ? e.baslik : "Northside")}</h2>
          <p class="bilet-kart-alt">${NS.esc(b.tur_ad)}${b.kisi_sayisi > 1 ? ` · ${b.kisi_sayisi} kişilik` : ""}${tarih ? " · " + NS.esc(tarih) : ""}</p>
        </div>
        <div class="bilet-qr" role="img" aria-label="QR kod ${NS.esc(b.kod)}">${qrSvg(b.kod)}</div>
        <p class="bilet-kod">${NS.esc(kodBicim(b.kod))}</p>
      </article>`).join("");

    $("[data-icerik]").hidden = false;
  }

  $("[data-kopyala]").addEventListener("click", async () => {
    const d = $("[data-kopya-durum]");
    try { await navigator.clipboard.writeText(location.href); d.textContent = "Bağlantı kopyalandı."; }
    catch { d.textContent = "Kopyalanamadı. Adres çubuğundaki bağlantıyı kaydedin."; }
  });

  yukle().catch(() => { bitir(); uyari("Biletler yüklenemedi. Bağlantınızı kontrol edip sayfayı yenileyin."); });
})();
