/* ==========================================================================
   NORTHSIDE · ortak yardımcılar (etkinlikler, bilet satışı, booking formu)
   Veritabanı Collapssi'nin Supabase projesindedir (ns_ tabloları). Buradaki
   anahtar herkese açık "publishable" anahtardır; gizli anahtar asla buraya konmaz.
   ========================================================================== */
window.NS = (() => {
  "use strict";
  const SB_URL = "https://zalgmjuoiddptlxvhwnd.supabase.co";
  const SB_KEY = "sb_publishable_FAByKdPZx0f5YDYra6wymA_xSMfcTak";
  const FN = SB_URL + "/functions/v1/ns-odeme";
  const TZ = "Europe/Istanbul";

  async function rest(yol, secenek = {}) {
    const r = await fetch(SB_URL + "/rest/v1/" + yol, {
      ...secenek,
      headers: { apikey: SB_KEY, "Content-Type": "application/json", ...(secenek.headers || {}) },
    });
    if (!r.ok) {
      let m = "";
      try { m = (await r.json()).message || ""; } catch { /* boş */ }
      throw new Error(m || "HTTP " + r.status);
    }
    return r.status === 204 || r.headers.get("content-length") === "0" ? null : r.json();
  }

  async function odeme(govde) {
    let j = null;
    try {
      const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", apikey: SB_KEY }, body: JSON.stringify(govde) });
      j = await r.json();
    } catch { /* ağ hatası ya da boş gövde */ }
    return j || { ok: false, hata: "sunucu", mesaj: "Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin." };
  }

  /* Üye oturumu: jeton tarayıcıda saklanır (ns-uye görevinin verdiği imzalı jeton). */
  const UYE_FN = SB_URL + "/functions/v1/ns-uye";
  const UYE_ANAHTAR = "ns-uye";
  const uye = {
    oku() { try { return JSON.parse(localStorage.getItem(UYE_ANAHTAR) || "null"); } catch { return null; } },
    jeton() { const o = uye.oku(); return o && o.jeton ? o.jeton : ""; },
    kaydet(jeton, bilgi) { try { localStorage.setItem(UYE_ANAHTAR, JSON.stringify({ jeton, ad: bilgi?.ad || "" })); } catch { /* özel pencere */ } },
    cikis() { try { localStorage.removeItem(UYE_ANAHTAR); } catch { /* boş */ } },
    async istek(govde) {
      let j = null;
      try {
        const r = await fetch(UYE_FN, { method: "POST", headers: { "Content-Type": "application/json", apikey: SB_KEY }, body: JSON.stringify(govde) });
        j = await r.json();
      } catch { /* ağ hatası */ }
      j = j || { ok: false, hata: "sunucu", mesaj: "Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin." };
      if (j.hata === "oturum") uye.cikis();
      return j;
    },
    /* Hesabım bağlantılarında üyenin adını gösterir */
    baglantilariGuncelle() {
      const o = uye.oku();
      document.querySelectorAll("[data-hesap-link]").forEach((a) => { a.textContent = o && o.ad ? o.ad : "Giriş"; });
    },
  };
  document.addEventListener("DOMContentLoaded", () => uye.baglantilariGuncelle());

  const tlBicim = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 });
  const tl = (n) => tlBicim.format(Number(n) || 0);

  const bicim = (secenek) => new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, ...secenek });
  const gun = (iso) => bicim({ day: "2-digit" }).format(new Date(iso));
  const ayKisa = (iso) => bicim({ month: "short" }).format(new Date(iso)).replace(".", "").toLocaleUpperCase("tr-TR");
  const haftaGunu = (iso) => bicim({ weekday: "long" }).format(new Date(iso)).toLocaleUpperCase("tr-TR");
  const saat = (iso) => bicim({ hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const tamTarih = (iso) => bicim({ day: "numeric", month: "long", year: "numeric", weekday: "long" }).format(new Date(iso));

  /* Metni HTML'e güvenli koyar */
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* Blog yazıları için küçük ve güvenli biçim çevirici. Önce bütün metin kaçırılır, sonra yalnızca şu biçimler açılır:
     ## Ara başlık · ### Küçük başlık · - madde · > alıntı · **kalın** · *eğik* · [yazı](https://...) · ![açıklama](https://...)
     Boş satır paragrafı ayırır. Bağlantılar yalnızca https:// ya da / ile başlayabilir. */
  function md(metin) {
    const satirIci = (s) => s
      .replace(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
      .replace(/\[([^\]]+)\]\(((?:https:\/\/|\/)[^\s)]*)\)/g, (_, y, u) => `<a href="${u}"${u.startsWith("/") ? "" : ' target="_blank" rel="noopener"'}>${y}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    return esc(metin).replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean).map((b) => {
      if (b.startsWith("### ")) return `<h3>${satirIci(b.slice(4))}</h3>`;
      if (b.startsWith("## ")) return `<h2>${satirIci(b.slice(3))}</h2>`;
      const satirlar = b.split("\n");
      if (satirlar.every((s) => /^[-•] /.test(s))) return `<ul>${satirlar.map((s) => `<li>${satirIci(s.slice(2))}</li>`).join("")}</ul>`;
      if (satirlar.every((s) => s.startsWith("&gt; "))) return `<blockquote>${satirIci(satirlar.map((s) => s.slice(5)).join("<br>"))}</blockquote>`;
      if (/^!\[[^\]]*\]\(https:\/\/[^\s)]+\)$/.test(b)) return `<figure>${satirIci(b)}</figure>`;
      return `<p>${satirIci(satirlar.join("<br>"))}</p>`;
    }).join("\n");
  }

  return { SB_URL, SB_KEY, FN, rest, odeme, uye, tl, gun, ayKisa, haftaGunu, saat, tamTarih, esc, md };
})();
