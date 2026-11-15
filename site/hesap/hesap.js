/* NORTHSIDE · Hesabım (/hesap/): giriş, üye olma, puan bakiyesi, biletler, mağaza siparişleri, profil ve şifre.
   Giriş sonrası ?d=/yol ile gelinen sayfaya dönülür (yalnızca site içi yollar). */
(() => {
  "use strict";
  const NS = window.NS, U = NS.uye;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = NS.esc, tl = NS.tl;
  const p = new URLSearchParams(location.search);
  const donusYolu = (() => { const d = p.get("d") || ""; return /^\/(?!\/)[\w\-./?=&%]*$/.test(d) ? d : ""; })();
  const sayi = (n) => new Intl.NumberFormat("tr-TR").format(Number(n) || 0);
  const tarih = (iso) => new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
  const mesaj = (el, m, tur) => { el.textContent = m || ""; el.dataset.tur = tur || ""; };
  const uyari = (m, tur) => { const u = $("[data-uyari]"); u.textContent = m; u.dataset.tur = tur || ""; u.hidden = !m; };

  const DURUM = {
    odendi: "Ödendi", iptal: "İptal", iade: "İade", hazirlaniyor: "Hazırlanıyor", kargoda: "Kargoda", teslim: "Teslim edildi",
  };
  const TUR = { kazanc: "Kazanıldı", harcama: "Harcandı", iade: "Geri verildi", geri_alma: "Geri alındı", duzeltme: "Düzeltme" };

  function girisGoster() {
    $("[data-yukleniyor]").hidden = true;
    $("[data-giris-alan]").hidden = false;
    $("[data-hesap-alan]").hidden = true;
    NS.rest("ns_ayar?anahtar=eq.site&select=deger").then((r) => {
      const o = r && r[0] && r[0].deger && r[0].deger.puan_oran;
      if (o) $("[data-oran]").textContent = "%" + o;
    }).catch(() => {});
  }

  function sekme(ad) {
    $$("[data-hs]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.hs === ad)));
    $("[data-form-giris]").hidden = ad !== "giris";
    $("[data-form-kayit]").hidden = ad !== "kayit";
  }
  $$("[data-hs]").forEach((b) => b.addEventListener("click", () => sekme(b.dataset.hs)));

  function girisTamam(j) {
    U.kaydet(j.jeton, j.uye);
    U.baglantilariGuncelle();
    if (donusYolu) { location.href = donusYolu; return; }
    yukle();
  }

  $("[data-form-giris]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = $("[data-giris-durum]");
    if (!e.currentTarget.reportValidity()) return;
    mesaj(d, "Giriş yapılıyor…");
    const j = await U.istek({ islem: "giris", eposta: $("#g-eposta").value.trim(), sifre: $("#g-sifre").value });
    if (!j.ok) { mesaj(d, j.mesaj, "hata"); return; }
    girisTamam(j);
  });

  $("[data-form-kayit]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = $("[data-kayit-durum]");
    if (!e.currentTarget.reportValidity()) return;
    mesaj(d, "Üyeliğin oluşturuluyor…");
    const j = await U.istek({
      islem: "kayit", ad: $("#k-ad").value.trim(), soyad: $("#k-soyad").value.trim(), eposta: $("#k-eposta").value.trim(),
      telefon: $("#k-telefon").value.trim(), sifre: $("#k-sifre").value, kvkk: $("#k-kvkk").checked, pazarlama: $("#k-pazarlama").checked,
    });
    if (!j.ok) { mesaj(d, j.mesaj, "hata"); if (j.hata === "eposta_kayitli") { sekme("giris"); $("#g-eposta").value = $("#k-eposta").value; } return; }
    girisTamam(j);
  });

  function bolumAc(ad) {
    $$("[data-bolum-ac]").forEach((b) => b.setAttribute("aria-current", b.dataset.bolumAc === ad ? "page" : "false"));
    $$("[data-hb]").forEach((b) => { b.hidden = b.dataset.hb !== ad; });
  }
  $$("[data-bolum-ac]").forEach((b) => b.addEventListener("click", () => { bolumAc(b.dataset.bolumAc); history.replaceState(null, "", location.pathname + location.search + "#" + b.dataset.bolumAc); }));

  function qr(metin) {
    if (typeof window.qrcode !== "function") return "";
    const q = window.qrcode(0, "M"); q.addData(metin); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }

  function ciz(d) {
    $("[data-ad]").textContent = `${d.uye.ad} ${d.uye.soyad}`;
    $("[data-bakiye]").textContent = sayi(d.bakiye);
    $("[data-puan-alt]").textContent = `${sayi(d.bakiye)} TL değerinde. Her alışverişte ödediğin tutarın %${d.puan_oran}'i puan olarak eklenir.`;

    $("[data-hb='biletler']").innerHTML = d.biletler.length ? `<ul class="hesap-liste">${d.biletler.map((s) => {
      const e = s.ns_etkinlik || {};
      return `<li class="hesap-satir">
        <div><p class="hesap-satir-baslik">${esc(e.baslik || "Etkinlik")}</p>
          <p class="hesap-satir-alt">${e.baslangic ? esc(NS.tamTarih(e.baslangic)) + " · " : ""}${s.bilet_adedi} bilet · ${esc(s.kod)}${s.puan_kazanilan ? ` · +${sayi(s.puan_kazanilan)} puan` : ""}</p></div>
        <div class="hesap-satir-sag"><span class="cip-site" data-d="${esc(s.durum)}">${esc(DURUM[s.durum] || s.durum)}</span>
          ${s.durum === "odendi" ? `<a class="btn btn-primary btn-kucuk-site" href="/biletim/?s=${s.id}&k=${s.erisim}">Biletler</a>` : ""}</div>
      </li>`;
    }).join("")}</ul>` : `<p class="hesap-bos">Henüz biletin yok. <a href="/#etkinlikler">Yaklaşan etkinliklere bak</a>.</p>`;

    $("[data-hb='siparisler']").innerHTML = d.magaza.length ? `<ul class="hesap-liste">${d.magaza.map((m) => `
      <li class="hesap-satir">
        <div><p class="hesap-satir-baslik">${(m.kalemler || []).map((k) => `${esc(k.ad)} × ${k.adet}`).join(", ")}</p>
          <p class="hesap-satir-alt">${esc(tarih(m.olusturma))} · ${esc(m.kod)} · ${m.teslim === "kargo" ? "Kargo" : "Etkinlikte teslim"}${m.kargo_takip ? ` · takip: ${esc(m.kargo_takip)}` : ""}</p></div>
        <div class="hesap-satir-sag"><span class="cip-site" data-d="${esc(m.durum)}">${esc(DURUM[m.durum] || m.durum)}</span></div>
        ${m.teslim === "etkinlik" && m.teslim_kodu && ["odendi", "hazirlaniyor"].includes(m.durum) ? `
          <div class="hesap-teslim"><div class="bilet-qr">${qr(m.teslim_kodu)}</div>
          <p>Etkinlikte bu kodu Northside standında göster, ürünün teslim edilsin.<br><span class="mono">${esc(m.teslim_kodu.slice(0, 5) + " " + m.teslim_kodu.slice(5))}</span></p></div>` : ""}
      </li>`).join("")}</ul>` : `<p class="hesap-bos">Mağaza siparişin yok. <a href="/magaza/">Mağazaya göz at</a>.</p>`;

    $("[data-hb='puan']").innerHTML = d.hareketler.length ? `<ul class="hesap-liste">${d.hareketler.map((h) => `
      <li class="hesap-satir"><div><p class="hesap-satir-baslik">${esc(TUR[h.tur] || h.tur)}</p><p class="hesap-satir-alt">${esc(h.aciklama || "")} · ${esc(tarih(h.olusturma))}</p></div>
      <div class="hesap-satir-sag"><span class="puan-hareket ${h.puan > 0 ? "arti" : "eksi"}">${h.puan > 0 ? "+" : ""}${sayi(h.puan)}</span></div></li>`).join("")}</ul>`
      : `<p class="hesap-bos">Henüz puan hareketin yok. İlk biletinle puan kazanmaya başla.</p>`;

    $("#p-ad").value = d.uye.ad; $("#p-soyad").value = d.uye.soyad; $("#p-eposta").value = d.uye.eposta;
    $("#p-telefon").value = d.uye.telefon || ""; $("#p-pazarlama").checked = !!d.uye.pazarlama;
  }

  async function yukle() {
    if (!U.jeton()) { girisGoster(); return; }
    const d = await U.istek({ islem: "ben", jeton: U.jeton() });
    if (!d.ok) { if (d.hata === "oturum") uyari(d.mesaj); girisGoster(); return; }
    U.kaydet(U.jeton(), d.uye);
    U.baglantilariGuncelle();
    ciz(d);
    $("[data-yukleniyor]").hidden = true;
    $("[data-giris-alan]").hidden = true;
    $("[data-hesap-alan]").hidden = false;
    const ilk = (location.hash || "").replace("#", "");
    bolumAc(["biletler", "siparisler", "puan", "profil"].includes(ilk) ? ilk : "biletler");
    if (p.get("magaza")) uyari(`Siparişin alındı (${p.get("magaza")}). Durumunu aşağıdan takip edebilirsin.`, "bilgi");
  }

  $("[data-cikis]").addEventListener("click", () => { U.cikis(); U.baglantilariGuncelle(); location.href = "/hesap/"; });

  $("[data-form-profil]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = $("[data-profil-durum]");
    if (!e.currentTarget.reportValidity()) return;
    const j = await U.istek({ islem: "guncelle", jeton: U.jeton(), ad: $("#p-ad").value.trim(), soyad: $("#p-soyad").value.trim(), telefon: $("#p-telefon").value.trim(), pazarlama: $("#p-pazarlama").checked });
    if (!j.ok) { mesaj(d, j.mesaj, "hata"); return; }
    U.kaydet(U.jeton(), j.uye); U.baglantilariGuncelle();
    $("[data-ad]").textContent = `${j.uye.ad} ${j.uye.soyad}`;
    mesaj(d, "Kaydedildi.", "tamam");
  });

  $("[data-form-sifre]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = $("[data-sifre-durum]");
    if (!e.currentTarget.reportValidity()) return;
    const j = await U.istek({ islem: "sifre", jeton: U.jeton(), eski: $("#s-eski").value, yeni: $("#s-yeni").value });
    if (!j.ok) { mesaj(d, j.mesaj, "hata"); return; }
    U.kaydet(j.jeton, U.oku());
    e.currentTarget.reset();
    mesaj(d, "Şifren değişti. Diğer cihazlardaki oturumlar kapandı.", "tamam");
  });

  yukle();
})();
