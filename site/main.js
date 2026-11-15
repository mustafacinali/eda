/* ==========================================================================
   NORTHSIDE · site ayarları
   İletişim bilgilerini sadece bu bloktan değiştirin.
   ========================================================================== */
const CONFIG = {
  email: "booking@northside.tr",
  instagram: "northside.tr",   // @ işareti olmadan
  whatsapp: "",                // Ülke koduyla, boşluksuz: "905XXXXXXXXX". Boş kalırsa WhatsApp butonları gizlenir.
};

(() => {
  "use strict";

  /* ---------- İletişim bilgilerini sayfaya yerleştir ---------- */
  const igUrl = `https://www.instagram.com/${CONFIG.instagram}/`;
  document.querySelectorAll("[data-instagram]").forEach((a) => { a.href = igUrl; });
  document.querySelectorAll("[data-instagram-label]").forEach((a) => { a.textContent = `@${CONFIG.instagram}`; });

  document.querySelectorAll("[data-email]").forEach((a) => {
    a.href = `mailto:${CONFIG.email}`;
    a.textContent = CONFIG.email;
  });
  document.querySelectorAll("[data-booking-mail]").forEach((a) => {
    const who = a.getAttribute("data-booking-mail");
    a.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent(`Booking: ${who}`)}`;
  });

  if (CONFIG.whatsapp) {
    document.querySelectorAll("[data-requires='whatsapp']").forEach((el) => { el.hidden = false; });
    document.querySelectorAll("[data-whatsapp-link]").forEach((a) => { a.href = `https://wa.me/${CONFIG.whatsapp}`; });
  }

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Üst bar ---------- */
  const header = document.querySelector("[data-header]");
  const onScroll = () => {
    if (header) header.dataset.scrolled = String(window.scrollY > 8);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Üst bar: giriş yapan üyeye bilet QR butonu ---------- */
  const uyeVar = !!(window.NS && window.NS.uye && window.NS.uye.jeton());
  document.querySelectorAll("[data-bilet-qr]").forEach((a) => { a.hidden = !uyeVar; });
  document.querySelectorAll("[data-hesap-ikon]").forEach((a) => {
    const o = uyeVar ? window.NS.uye.oku() : null;
    const etiket = uyeVar ? `Hesabım${o && o.ad ? " · " + o.ad : ""}` : "Giriş yap";
    a.setAttribute("aria-label", etiket);
    a.title = etiket;
    a.dataset.girisli = String(uyeVar);
  });

  /* ---------- Hero tanıtım videosu ---------- */
  const video = document.querySelector("[data-hero-video]");
  if (video && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const dikey = window.matchMedia("(max-aspect-ratio: 1/1)").matches;
    const kaynak = dikey ? video.dataset.dikey : video.dataset.yatay;
    if (kaynak) {
      video.src = kaynak;
      video.addEventListener("playing", () => video.classList.add("oynuyor"), { once: true });
      video.play().catch(() => { /* otomatik oynatma engellendiyse dalgalar kalır */ });
    }
  }

  /* ---------- Booking formu ---------- */
  const form = document.querySelector("[data-booking-form]");
  if (form) {
    const durum = form.querySelector("[data-form-status]");
    const yaz = (metin, tur) => { if (durum) { durum.textContent = metin; durum.dataset.tur = tur || ""; } };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const get = (k) => String(data.get(k) || "").trim();
      if (get("site")) return;                                    // bot tuzağı
      const topic = get("konu");
      const eposta = get("eposta"), telefon = get("telefon");
      if (!form.reportValidity()) return;
      if (!eposta && !telefon) { yaz("E-posta ya da telefondan en az birini yazın.", "hata"); form.querySelector("#f-email").focus(); return; }

      const via = e.submitter && e.submitter.dataset.send;
      if (via === "whatsapp" && CONFIG.whatsapp) {
        const lines = [`Konu: ${topic}`, `Ad soyad: ${get("ad")}`];
        if (get("tarih")) lines.push(`Tarih: ${get("tarih")}`);
        if (get("sehir")) lines.push(`Şehir: ${get("sehir")}`);
        lines.push("", get("mesaj"));
        window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener");
        return;
      }

      const dugme = form.querySelector("[data-send='kaydet']");
      dugme.disabled = true;
      yaz("Gönderiliyor…");
      try {
        await window.NS.rest("ns_talep", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            konu: topic, ad: get("ad"), eposta: eposta || null, telefon: telefon || null,
            tarih: get("tarih") || null, sehir: get("sehir") || null, mesaj: get("mesaj"),
          }),
        });
        form.reset();
        yaz("Talebiniz bize ulaştı. En kısa sürede dönüş yapacağız.", "tamam");
      } catch {
        yaz(`Gönderilemedi. Lütfen tekrar deneyin ya da ${CONFIG.email} adresine yazın.`, "hata");
      } finally {
        dugme.disabled = false;
      }
    });
  }

  /* ---------- Etkinlikler (veritabanından) ---------- */
  const liste = document.querySelector("[data-events]");
  if (liste && window.NS) {
    const NS = window.NS;
    const simdi = new Date(Date.now() - 6 * 3600e3).toISOString();      // başlamış etkinlik 6 saat daha listede kalır
    NS.rest(`ns_etkinlik?select=id,slug,baslik,seri,ozel_konuk,mekan,sehir,baslangic,kapi_acilis,durum&baslangic=gte.${encodeURIComponent(simdi)}&order=baslangic.asc&limit=12`)
      .then((etkinlikler) => {
        if (!Array.isArray(etkinlikler) || !etkinlikler.length) return;   // "yakında" kartı kalır
        liste.innerHTML = etkinlikler.map((e) => {
          const iptal = e.durum === "iptal";
          const bilgi = [e.ozel_konuk ? `Özel konuk: <strong>${NS.esc(e.ozel_konuk)}</strong>` : "",
            [e.mekan, e.sehir].filter(Boolean).map(NS.esc).join(", "),
            e.kapi_acilis ? `Kapı ${NS.saat(e.kapi_acilis)}` : `Saat ${NS.saat(e.baslangic)}`].filter(Boolean).join(" · ");
          return `<li class="event${iptal ? " event--iptal" : ""}">
            <div class="event-date mono"><span class="event-day">${NS.gun(e.baslangic)}</span>
              <span class="event-month">${NS.ayKisa(e.baslangic)} · ${NS.haftaGunu(e.baslangic)}</span></div>
            <div class="event-body">
              ${e.seri ? `<p class="event-series mono" lang="en">${NS.esc(e.seri)}</p>` : ""}
              <h3 class="event-title">${NS.esc(e.baslik)}</h3>
              <p class="event-info">${bilgi}</p>
            </div>
            ${iptal ? `<span class="event-badge mono">İptal edildi</span>`
              : `<a class="btn btn-primary event-cta" href="/bilet/?e=${encodeURIComponent(e.slug)}">Bilet al</a>`}
          </li>`;
        }).join("");
      })
      .catch(() => { /* bağlantı yoksa "yakında" kartı kalır */ });
  }

  /* ---------- Hero: Karadeniz dalgaları ---------- */
  const canvas = document.querySelector("[data-sea]");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const hero = canvas.closest("section");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ACCENT = "134, 242, 210";
  const FG = "233, 238, 236";

  let w = 0, h = 0, dpr = 1, lines = 0, running = false, visible = true, last = 0, raf = 0;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lines = w < 760 ? 20 : 30;
  };

  const draw = (time) => {
    const t = time / 1000;
    ctx.clearRect(0, 0, w, h);
    const horizon = h * 0.34;
    const accentLine = Math.round(lines * 0.58);
    const step = w < 760 ? 8 : 6;

    for (let i = 0; i < lines; i++) {
      const p = i / (lines - 1);                  // 0 = ufuk, 1 = ön
      const y0 = horizon + (h - horizon) * Math.pow(p, 1.7);
      const amp = 1.5 + 22 * p * p;
      const f1 = 0.0105 * (1.5 - p);
      const f2 = 0.0042 * (1.6 - p);
      const isAccent = i === accentLine;
      const alpha = isAccent ? 0.75 : 0.04 + 0.3 * p;

      ctx.beginPath();
      for (let x = -step; x <= w + step; x += step) {
        const y =
          y0 +
          Math.sin(x * f1 + t * 0.55 + i * 0.7) * amp * 0.6 +
          Math.sin(x * f2 - t * 0.35 + i * 1.9) * amp;
        if (x === -step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${isAccent ? ACCENT : FG}, ${alpha})`;
      ctx.lineWidth = isAccent ? 1.4 : 1;
      ctx.stroke();
    }
  };

  const loop = (time) => {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (time - last < 33) return;                  // ~30 fps yeterli
    if (hero && hero.dataset.ortulu === "true") return;   // kart destesinde üstü tamamen örtüldüyse çizme
    last = time;
    draw(time);
  };

  const start = () => {
    if (running || reduceMotion || !visible || document.hidden) return;
    running = true;
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  resize();
  draw(performance.now());

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); draw(performance.now()); }, 120);
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visible ? start() : stop();
    }).observe(canvas);
  }
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  start();
})();
