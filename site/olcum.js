/* NORTHSIDE · duyuru bandı, çerez onayı ve ölçüm (GA4, Google Ads, Meta Pixel)
   Kimlikler yönetim panelinden girilir (ns_ayar 'site'). Etiketler yalnızca ziyaretçi "Kabul et" derse yüklenir.
   Satış adımları: NSOlcum.odemeBasladi(toplam) bilet sayfasında, NSOlcum.satinAlma(siparis) bilet sayfasında (bir kez). */
window.NSOlcum = (() => {
  "use strict";
  const NS = window.NS;
  const IZIN = "ns-cerez";
  const kuyruk = [];
  let ayar = {}, hazir = false, reddedildi = false;

  const oku = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const yaz = (k, v) => { try { localStorage.setItem(k, v); } catch { /* özel pencere */ } };
  const betik = (src) => { const s = document.createElement("script"); s.async = true; s.src = src; document.head.appendChild(s); };

  function etiketleriYukle() {
    if (hazir) return;
    if (ayar.ga4 || ayar.ads) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      if (ayar.ga4) window.gtag("config", ayar.ga4);
      if (ayar.ads) window.gtag("config", ayar.ads);
      betik("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ayar.ga4 || ayar.ads));
    }
    if (ayar.meta_pixel) {
      /* Meta Pixel resmi yükleyicisi (kısaltılmış) */
      const f = window, n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
      betik("https://connect.facebook.net/en_US/fbevents.js");
      window.fbq("init", ayar.meta_pixel);
      window.fbq("track", "PageView");
    }
    hazir = true;
    while (kuyruk.length) kuyruk.shift()();
  }

  function onayBandi() {
    const b = document.createElement("div");
    b.className = "cerez";
    b.setAttribute("role", "dialog");
    b.setAttribute("aria-label", "Çerez tercihi");
    b.innerHTML = `<p>Ziyaretinizi ölçmek ve reklamlarımızı iyileştirmek için çerez kullanıyoruz. <a href="/kvkk.html">Ayrıntılar</a></p>
      <div class="cerez-dugmeler"><button type="button" class="btn btn-ghost btn-cerez" data-c="hayir">Reddet</button><button type="button" class="btn btn-primary btn-cerez" data-c="evet">Kabul et</button></div>`;
    b.addEventListener("click", (e) => {
      const d = e.target.closest("[data-c]");
      if (!d) return;
      yaz(IZIN, d.dataset.c);
      b.remove();
      if (d.dataset.c === "evet") etiketleriYukle(); else { reddedildi = true; kuyruk.length = 0; }
    });
    document.body.appendChild(b);
  }

  function duyuru() {
    if (!ayar.duyuru) return;
    try { if (sessionStorage.getItem("ns-duyuru-kapali") === ayar.duyuru) return; } catch { /* boş */ }
    const d = document.createElement("div");
    d.className = "duyuru";
    const metin = NS.esc(ayar.duyuru);
    const bag = ayar.duyuru_link && /^(\/|https:\/\/)/.test(ayar.duyuru_link) ? ayar.duyuru_link : "";
    d.innerHTML = `${bag ? `<a href="${NS.esc(bag)}">${metin} <span aria-hidden="true">→</span></a>` : `<span>${metin}</span>`}
      <button type="button" aria-label="Duyuruyu kapat" data-kapat>×</button>`;
    d.querySelector("[data-kapat]").addEventListener("click", () => {
      d.remove(); document.body.classList.remove("duyurulu");
      try { sessionStorage.setItem("ns-duyuru-kapali", ayar.duyuru); } catch { /* boş */ }
    });
    document.body.prepend(d);
    document.body.classList.add("duyurulu");
  }

  /* Ölçüm olayını etiketler hazırsa hemen, değilse onaydan sonra gönderir; reddedildiyse hiç göndermez */
  function gonder(is) { if (reddedildi) return; hazir ? is() : kuyruk.push(is); }

  if (NS) {
    NS.rest("ns_ayar?anahtar=eq.site&select=deger").then((r) => {
      ayar = (r && r[0] && r[0].deger) || {};
      duyuru();
      if (!(ayar.ga4 || ayar.ads || ayar.meta_pixel)) { reddedildi = true; return; }
      const izin = oku(IZIN);
      if (izin === "evet") etiketleriYukle();
      else if (izin === "hayir") reddedildi = true;
      else onayBandi();
    }).catch(() => { reddedildi = true; });
  }

  return {
    odemeBasladi(toplam) {
      gonder(() => {
        if (window.gtag) window.gtag("event", "begin_checkout", { value: Number(toplam) || 0, currency: "TRY" });
        if (window.fbq) window.fbq("track", "InitiateCheckout", { value: Number(toplam) || 0, currency: "TRY" });
      });
    },
    satinAlma(s) {
      const anahtar = "ns-olcum-" + s.kod;
      if (oku(anahtar)) return;                      // aynı sipariş bir kez sayılır
      gonder(() => {
        yaz(anahtar, "1");
        const deger = Number(s.toplam) || 0;
        const items = (s.kalemler || []).map((k) => ({ item_id: k.tur_id, item_name: k.ad, quantity: k.adet, price: Number(k.birim) }));
        if (window.gtag) {
          window.gtag("event", "purchase", { transaction_id: s.kod, value: deger, currency: "TRY", items });
          if (ayar.ads && ayar.ads_donusum) window.gtag("event", "conversion", { send_to: `${ayar.ads}/${ayar.ads_donusum}`, value: deger, currency: "TRY", transaction_id: s.kod });
        }
        if (window.fbq) window.fbq("track", "Purchase", { value: deger, currency: "TRY" }, { eventID: s.kod });
      });
    },
  };
})();
