/* ==========================================================================
   NORTHSIDE · Ana sayfa kart destesi
   Bölümler ([data-kart]) dosya kartları gibi üst üste biner: aşağı kaydırınca
   alttaki kart yukarı kayar ve üsttekini örter; örtülen kart hafifçe küçülüp
   kararır. Her kartın üstünde numaralı bir dosya sekmesi, sağda da numaralı
   yuvarlak noktalardan oluşan dikey bir sayı doğrusu vardır.
   JavaScript yoksa sayfa eski düz haliyle çalışır (sınıf "kartli" eklenmez).
   ========================================================================== */
(() => {
  "use strict";
  const kartlar = [...document.querySelectorAll("[data-kart]")];
  if (kartlar.length < 2 || !("ResizeObserver" in window) || !(window.CSS && CSS.supports("position", "sticky"))) return;

  const kok = document.documentElement;
  const header = document.querySelector("[data-header]");
  const azHareket = window.matchMedia("(prefers-reduced-motion: reduce)");
  const SEKME = 44;                                   // kartın üstündeki sekme için bırakılan boşluk (px)
  const no = (i) => String(i).padStart(2, "0");
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dil = (k) => (k.dataset.kartDil ? ` lang="${esc(k.dataset.kartDil)}"` : "");   // "Booking" büyük harfte "BOOKİNG" olmasın

  kok.classList.add("kartli");

  /* ---------- Kartlar, sekmeler ve konum işaretleri ---------- */
  const izler = kartlar.map((k, i) => {
    k.classList.add("kart");
    k.style.setProperty("--sira", String(i));
    const iz = document.createElement("div");      // kartın akıştaki gerçek yeri (yapışkan kart kendi yerini kaybettiği için)
    iz.className = "kart-iz";
    iz.setAttribute("aria-hidden", "true");
    k.before(iz);
    if (i > 0) {
      const s = document.createElement("a");
      s.className = "kart-sekme mono";
      s.href = "#" + k.id;
      s.tabIndex = -1;                               // klavye ve ekran okuyucu için sağdaki sayı doğrusu var
      s.setAttribute("aria-hidden", "true");
      s.innerHTML = `<b>${no(i)}</b><span${dil(k)}>${esc(k.dataset.kart)}</span>`;
      k.prepend(s);
    }
    return iz;
  });

  /* ---------- Sağdaki sayı doğrusu ---------- */
  const dogru = document.createElement("nav");
  dogru.className = "sayi-dogrusu";
  dogru.setAttribute("aria-label", "Sayfa bölümleri");
  dogru.innerHTML = `<span class="sd-cizgi" aria-hidden="true"><span class="sd-dolu"></span></span>
    <ol>${kartlar.map((k, i) => `<li><a href="#${k.id}" data-sd="${i}">
      <span class="sd-no mono" aria-hidden="true">${no(i)}</span>
      <span class="sd-ad mono"${dil(k)}>${esc(k.dataset.kart)}</span></a></li>`).join("")}</ol>`;
  document.body.append(dogru);
  const noktalar = [...dogru.querySelectorAll("[data-sd]")];

  /* ---------- Ölçüm ---------- */
  let H = 0, ust = 0, duraklar = [];                // duraklar[i]: i. kartın yerine oturduğu kaydırma konumu
  function olc() {
    H = window.innerHeight;
    ust = Math.round((header ? Math.max(0, header.getBoundingClientRect().bottom) : 0) + SEKME);
    kok.style.setProperty("--kart-ust", ust + "px");
    kartlar.forEach((k, i) => {
      // Ekrandan uzun kart, sonu görünene kadar normal kayar; ondan sonra yapışır ve sıradaki kart üstüne biner.
      const tepe = i === 0 ? Math.min(0, H - k.offsetHeight) : Math.min(ust, H - k.offsetHeight);
      k.style.top = tepe + "px";
    });
    duraklar = izler.map((iz, i) => Math.max(0, iz.getBoundingClientRect().top + window.scrollY - (i === 0 ? 0 : ust)));
    guncelle();
  }

  /* ---------- Kaydırınca ---------- */
  let aktif = -1;
  function guncelle() {
    const y = window.scrollY;
    // Örtülme: sıradaki kart ekranın altından girip yerine oturana kadar öndeki kart geri çekilir.
    for (let i = 1; i < kartlar.length; i++) {
      const t = kartlar[i].getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, (H - t) / Math.max(1, H - ust)));
      const onceki = kartlar[i - 1];
      onceki.style.setProperty("--geri", p.toFixed(3));
      onceki.dataset.ortulu = String(p > 0.995);
    }
    // Sayı doğrusundaki konum (0 … kart sayısı-1, ara değerli)
    const son = duraklar.length - 1;
    let konum = 0;
    for (let i = 0; i < son; i++) {
      if (y >= duraklar[i + 1]) { konum = i + 1; continue; }
      if (y >= duraklar[i]) konum = i + (y - duraklar[i]) / Math.max(1, duraklar[i + 1] - duraklar[i]);
      break;
    }
    // Sayfanın sonuna gelindiyse son kart etkin sayılır (son kart kısa olabilir)
    if (window.innerHeight + y >= document.documentElement.scrollHeight - 2) konum = son;
    dogru.style.setProperty("--dolu", (konum / son).toFixed(4));
    const yeni = Math.min(son, Math.round(konum));
    if (yeni !== aktif) {
      aktif = yeni;
      noktalar.forEach((a, i) => {
        a.dataset.durum = i < aktif ? "gecti" : i === aktif ? "aktif" : "sonra";
        if (i === aktif) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
      kartlar.forEach((k, i) => k.classList.toggle("is-aktif", i === aktif));
    }
  }

  let bekliyor = false;
  const istek = (fn) => () => { if (bekliyor) return; bekliyor = true; requestAnimationFrame(() => { bekliyor = false; fn(); }); };
  window.addEventListener("scroll", istek(guncelle), { passive: true });
  window.addEventListener("resize", istek(olc));
  const ro = new ResizeObserver(istek(olc));         // etkinlikler veritabanından gelince kart boyu değişir
  kartlar.forEach((k) => ro.observe(k));
  if (header) ro.observe(header);

  /* ---------- Bölüme git (menü, sekme, sayı doğrusu) ---------- */
  function git(i, anlik) {
    window.scrollTo({ top: duraklar[i], behavior: anlik || azHareket.matches ? "auto" : "smooth" });
    const baslik = kartlar[i].querySelector("h1, h2");
    if (baslik && !anlik) {
      if (!baslik.hasAttribute("tabindex")) baslik.setAttribute("tabindex", "-1");
      baslik.focus({ preventScroll: true });
    }
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const hedef = a.getAttribute("href");
    const i = kartlar.findIndex((k) => "#" + k.id === hedef);
    if (i < 0) return;
    e.preventDefault();
    git(i);
    history.replaceState(null, "", i === 0 ? location.pathname + location.search : hedef);
  });

  /* ---------- Kart içeriği görünür olunca hafifçe yukarı kayarak gelir ---------- */
  if ("IntersectionObserver" in window && !azHareket.matches) {
    const io = new IntersectionObserver((girdiler) => {
      girdiler.forEach((g) => { if (g.isIntersecting) { g.target.classList.add("gorundu"); io.unobserve(g.target); } });
    }, { threshold: 0.12 });
    kartlar.forEach((k) => io.observe(k));
  } else {
    kartlar.forEach((k) => k.classList.add("gorundu"));
  }

  /* ---------- Başlangıç ---------- */
  olc();
  const ilk = kartlar.findIndex((k) => location.hash && "#" + k.id === location.hash);
  if (ilk > 0) {
    // Başka sayfadan /#etkinlikler gibi bir bağlantıyla gelindiyse doğru karta otur
    requestAnimationFrame(() => { olc(); git(ilk, true); });
    window.addEventListener("load", () => { olc(); git(ilk, true); }, { once: true });
  }
  window.addEventListener("load", olc, { once: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(olc);
})();
