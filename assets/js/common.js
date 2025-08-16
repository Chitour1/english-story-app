// assets/js/common.js
// شيفرة مساعدة مشتركة لجميع الصفحات — بلا أي إعادة توجيه قسرية.
// تعرض شريط تنبيه فقط إذا "على الأرجح" لست مسجلاً في Google.
// تعتمد على: sessionStorage/localStorage وعلامة توكن gapi إن وُجدت.

(function () {
  const CFG    = window.APP_CONFIG || {};
  const PAGES  = CFG.PAGES || {};
  const STORE  = CFG.STORAGE || {};

  const BANNER_ID = "__esa_auth_banner";

  const $ = (s, r = document) => r.querySelector(s);
  const build = (p) => (window.buildUrl ? buildUrl(p) : p);

  function showAuthBanner() {
    if (document.getElementById(BANNER_ID)) return;
    const bar = document.createElement("div");
    bar.id = BANNER_ID;
    bar.dir = "rtl";
    bar.className =
      "fixed top-0 inset-x-0 z-50 bg-amber-50 border-b border-amber-200 text-amber-900";
    bar.innerHTML = `
      <div class="container mx-auto max-w-5xl px-4 py-2 text-sm flex items-center justify-between gap-3">
        <div>لست مُسجّلًا في Google حاليًا — <strong>تقدّمك لن يُحفَظ على Google Drive</strong>.</div>
        <div class="flex items-center gap-2">
          <button id="esa-auth-btn" class="bg-amber-600 hover:bg-amber-700 text-white rounded-md px-3 py-1">
            تسجيل الدخول لحفظ التقدّم
          </button>
          <button id="esa-auth-close" class="px-2 py-1">إغلاق</button>
        </div>
      </div>`;
    document.body.appendChild(bar);
    $("#esa-auth-close").onclick = () => bar.remove();
    $("#esa-auth-btn").onclick = () => {
      window.location.href = build(PAGES.INDEX || "index.html");
    };
  }

  async function isProbablySignedIn() {
    // 1) علامة نضعها بعد نجاح الدخول في الصفحة الرئيسية
    if (sessionStorage.getItem("__esa_google_ok") === "1") return true;
    if (localStorage.getItem("__esa_google_ok") === "1") return true;

    // 2) إن كان لدينا ملف Drive محفوظ سابقًا
    if (localStorage.getItem(STORE.DRIVE_FILE_ID)) return true;

    // 3) إن كانت مكتبة gapi محمّلة ولدينا توكن فعّال
    try {
      if (window.gapi?.client?.getToken?.()) return true;
    } catch (_) {}

    return false;
  }

  async function guard() {
    // لا نُعيد التوجيه مطلقًا. فقط نُظهر شريط التنبيه عند الحاجة.
    const ok = await isProbablySignedIn();
    if (!ok) showAuthBanner();
  }

  // helpers صغيرة إن احتاجتها صفحات أخرى
  window.EsaCommon = { guard };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", guard);
  } else {
    guard();
  }
})();
