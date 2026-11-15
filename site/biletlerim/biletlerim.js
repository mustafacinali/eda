/* NORTHSIDE · Biletlerim (/biletlerim/)
   Giriş yapmış üyenin ödenmiş bütün biletlerini QR kodlarıyla tek sayfada gösterir.
   Üye bilgisi ns-uye görevinden ("ben"), her siparişin biletleri ns-odeme görevinden ("biletler") okunur.
   Giriş yoksa /hesap/ sayfasına gönderir; girişten sonra buraya geri döner. */
(() => {
  "use strict";
  const NS = window.NS;
  const U = NS.uye;
  const $ = (s) => document.querySelector(s);
  const esc = NS.esc;

  const uyari = (metin, tur) => { const u = $("[data-uyari]"); u.textContent = metin; u.dataset.tur = tur || ""; u.hidden = !metin; };
  const bitir = () => { $("[data-yukleniyor]").hidden = true; };
  const DURUM = { gecerli: "Geçerli", kullanildi: "Kullanıldı", iptal: "İptal" };
  const kodBicim = (kod) => kod.length === 10 ? kod.slice(0, 5) + " " + kod.slice(5) : kod;

  function qrSvg(metin) {
    if (typeof window.qrcode !== "function") return "";
    const q = window.qrcode(0, "M"); q.addData(metin); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }

  function blok(j) {
    const { etkinlik: e, biletler } = j;
    const tarih = e ? `${NS.tamTarih(e.baslangic)}, ${NS.saat(e.baslangic)}` : "";
    const yer = e ? [e.mekan, e.sehir].filter(Boolean).join(", ") : "";
    const alt = [tarih, yer, e && e.kapi_acilis ? `Kapı ${NS.saat(e.kapi_acilis)}` : ""].filter(Boolean).join(" · ");
    const iptal = e && e.durum === "iptal";
    return `<section class="biletlerim-etkinlik">
      <h2>${esc(e ? e.baslik : "Northside")}</h2>
      <p>${esc(alt)}${iptal ? " · <strong>Etkinlik iptal edildi</strong>" : ""}</p>
      <div class="biletler">${(biletler || []).map((b, i) => `
        <article class="bilet-kart" data-durum="${esc(b.durum)}" aria-label="Bilet ${i + 1}">
          <div class="bilet-kart-ust">
            <img src="/assets/logo-dark.svg" alt="NORTHSIDE" width="124" height="14">
            <span class="bilet-kart-durum" data-durum="${esc(b.durum)}">${DURUM[b.durum] || esc(b.durum)}</span>
          </div>
          <div>
            <h3 class="bilet-kart-baslik">${esc(e ? e.baslik : "Northside")}</h3>
            <p class="bilet-kart-alt">${esc(b.tur_ad)}${b.kisi_sayisi > 1 ? ` · ${b.kisi_sayisi} kişilik` : ""}${tarih ? " · " + esc(tarih) : ""}</p>
          </div>
          <div class="bilet-qr" role="img" aria-label="QR kod ${esc(b.kod)}">${qrSvg(b.kod)}</div>
          <p class="bilet-kod">${esc(kodBicim(b.kod))}</p>
        </article>`).join("")}</div>
    </section>`;
  }

  async function yukle() {
    if (!U.jeton()) { location.replace("/hesap/?d=" + encodeURIComponent("/biletlerim/")); return; }
    const d = await U.istek({ islem: "ben", jeton: U.jeton() });
    if (!d.ok) { location.replace("/hesap/?d=" + encodeURIComponent("/biletlerim/")); return; }
    U.kaydet(U.jeton(), d.uye);
    U.baglantilariGuncelle();

    const odenmis = (d.biletler || []).filter((s) => s.durum === "odendi" && s.erisim);
    const sonuclar = (await Promise.all(odenmis.map((s) => NS.odeme({ islem: "biletler", s: s.id, k: s.erisim }))))
      .filter((j) => j && j.ok && j.siparis && j.siparis.durum === "odendi");

    const sinir = Date.now() - 6 * 3600e3;          // başlamış etkinlik 6 saat daha "yaklaşan"da kalır
    const zaman = (j) => (j.etkinlik && j.etkinlik.baslangic ? new Date(j.etkinlik.baslangic).getTime() : 0);
    const yaklasan = sonuclar.filter((j) => zaman(j) >= sinir).sort((a, b) => zaman(a) - zaman(b));
    const gecmis = sonuclar.filter((j) => zaman(j) < sinir).sort((a, b) => zaman(b) - zaman(a));

    bitir();
    $("[data-yaklasan]").innerHTML = yaklasan.length ? yaklasan.map(blok).join("")
      : `<p class="hesap-bos">Yaklaşan bir etkinlik için biletin yok. <a href="/#etkinlikler">Etkinliklere bak</a>.</p>`;
    if (gecmis.length) { $("[data-gecmis]").innerHTML = gecmis.map(blok).join(""); $("[data-gecmis-alan]").hidden = false; }
    $("[data-icerik]").hidden = false;
  }

  yukle().catch(() => { bitir(); uyari("Biletler yüklenemedi. Bağlantını kontrol edip sayfayı yenile."); });
})();
