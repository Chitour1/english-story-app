// assets/js/common.js
// لافتة موحّدة + محاولة تجديد صامت في كل صفحة

(function () {
  const { APP_BASE } = window.APP_CONFIG || {};
  const base = (APP_BASE || "/").replace(/\/+$/, "");

  function buildUrl(page) { return `${base}/${page}`; }
  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function ensureBanner() {
    if (document.getElementById("global-signin-banner")) return;

    const el = document.createElement("div");
    el.id = "global-signin-banner";
    el.dir = "rtl";
    el.style.cssText =
      "position:sticky;top:0;z-index:40;background:#fff7ed;border-bottom:1px solid #fed7aa;" +
      "padding:.6rem .9rem;display:none;font-family:'Cairo',sans-serif";
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
        <span style="color:#7c2d12;font-weight:700">
          لست مُسجّلًا في Google — تقدّمك لن يُحفَظ على Google Drive.
        </span>
        <button id="__signin" style="background:#d97706;color:#fff;border:none;border-radius:.6rem;
                padding:.45rem .9rem;cursor:pointer;font-weight:700">
          تسجيل الدخول لحفظ التقدّم
        </button>
        <button id="__close" style="background:transparent;border:none;color:#7c2d12;cursor:pointer;font-weight:700">
          إغلاق
        </button>
      </div>
    `;
    document.body.prepend(el);

    el.querySelector("#__close")?.addEventListener("click", () => hideBanner());
    el.querySelector("#__signin")?.addEventListener("click", async () => {
      try {
        await window.Auth.signInInteractive();
        hideBanner();
      } catch (e) {
        alert("تعذّر تسجيل الدخول إلى Google.");
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

  async function refreshState() {
    try {
      // محاولة صامتة
      await window.Auth.ensureAccessToken({ interactiveIfNeeded: false });
      hideBanner();
    } catch {
      // لا توكن صالح + لا نريد نافذة: نظهر اللافتة فقط
      if (window.Auth.isSignedIn()) hideBanner();
      else showBanner();
    }
  }

  onReady(async () => {
    ensureBanner();
    try { await window.Auth.init(); } catch {}
    await refreshState();

    // إعادة المحاولة عند رجوع التبويب للنشاط
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshState();
    });

    // دعم روابط data-nav
    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const page = el.getAttribute("data-nav");
        if (page) window.location.href = buildUrl(page);
      });
    });
  });
})();
