// assets/js/common.js
// توجيه الروابط + لافتة تسجيل الدخول الموحّدة + محاولة تجديد التوكن بصمت

(function () {
  const { APP_BASE, PAGES, STORAGE } = window.APP_CONFIG || {};
  const HAS_CONSENT_KEY = (STORAGE?.PREFIX || "english_story_app__") + "google_has_consent";

  // ======== أدوات مساعدة بسيطة ========
  function buildUrl(page) {
    const base = (window.APP_CONFIG?.APP_BASE || "/").replace(/\/+$/, "");
    return `${base}/${page}`;
  }
  function navTo(page) { window.location.href = buildUrl(page); }
  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  function lsGet(k, d = "") { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

  // ======== لافتة تسجيل الدخول (موحّدة لكل الصفحات) ========
  function ensureBannerExists() {
    if (document.getElementById("global-signin-banner")) return;

    const bar = document.createElement("div");
    bar.id = "global-signin-banner";
    bar.dir = "rtl";
    bar.style.cssText =
      "position:sticky;top:0;z-index:50;background:#fff5e6;border-bottom:1px solid #f4d4a4;" +
      "padding:.6rem .9rem;font-family:'Cairo',sans-serif;display:none;";

    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:.75rem;justify-content:flex-start;flex-wrap:wrap">
        <span style="color:#7c2d12;font-weight:700">لست مُسجّلًا في Google — تقدّمك لن يُحفَظ على Google Drive.</span>
        <button id="signin-drive-btn"
                style="background:#d97706;color:white;border:none;border-radius:.5rem;
                       padding:.45rem .9rem;cursor:pointer;font-weight:700">
          تسجيل الدخول لحفظ التقدّم
        </button>
        <button id="banner-close"
                style="background:transparent;border:none;color:#7c2d12;cursor:pointer;font-weight:700">
          إغلاق
        </button>
      </div>
    `;
    document.body.prepend(bar);

    // أزرار
    bar.querySelector("#banner-close")?.addEventListener("click", () => hideBanner());
    bar.querySelector("#signin-drive-btn")?.addEventListener("click", async () => {
      try {
        // إجبار طلب الموافقة أول مرة فقط
        lsSet(HAS_CONSENT_KEY, "0");
        await window.Auth.signInInteractive();
        hideBanner();
      } catch (e) {
        alert("تعذّر تسجيل الدخول إلى Google: " + (e?.message || e));
      }
    });
  }

  function showBanner() {
    const el = document.getElementById("global-signin-banner");
    if (el) el.style.display = "block";
  }
  function hideBanner() {
    const el = document.getElementById("global-signin-banner");
    if (el) el.style.display = "none";
  }

  // محاولة صامتة لتجديد التوكن إذا سبق منح الموافقة
  async function refreshBannerState() {
    try {
      if (window.Auth.hasValidToken()) {
        hideBanner();
        return;
      }
      const hasConsent = lsGet(HAS_CONSENT_KEY, "0") === "1";
      if (hasConsent) {
        await window.Auth.ensureAccessToken(); // صامت
        hideBanner();
      } else {
        showBanner();
      }
    } catch {
      // لو فشل التجديد الصامت نظهر اللافتة فقط
      showBanner();
    }
  }

  // ======== تفعيل عام عند فتح أي صفحة ========
  onReady(async () => {
    // توجيه جميع العناصر التي عليها data-nav
    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const page = el.getAttribute("data-nav");
        if (page) navTo(page);
      });
    });

    // تفعيل Google Auth
    try { window.Auth.init(); } catch {}

    // إنشاء اللافتة مرة واحدة ثم ضبط حالتها
    ensureBannerExists();
    await refreshBannerState();

    // نجعل الدالة متاحة عند الحاجة لإعادة التقييم
    window.GlobalAuth = { refreshBannerState };
  });

  // ======== روابط أساسية جاهزة للاستعمال في HTML إن احتجت ========
  window.goto = window.goto || navTo;
  window.buildUrl = window.buildUrl || buildUrl;
})();
