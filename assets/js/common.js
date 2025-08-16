// assets/js/common.js
// شريط تنبيه إن لم نكن مُسجّلين + ينتظر نتيجة Auth.silent() بدلاً من التخمين فقط.

(function () {
  const CFG   = window.APP_CONFIG || {};
  const PAGES = CFG.PAGES || {};
  const BANNER_ID = "__esa_auth_banner";

  const $ = (s,r=document)=> r.querySelector(s);
  const build = (p)=> window.buildUrl ? buildUrl(p) : p;

  function showBanner() {
    if (document.getElementById(BANNER_ID)) return;
    const bar = document.createElement("div");
    bar.id = BANNER_ID;
    bar.dir = "rtl";
    bar.className = "fixed top-0 inset-x-0 z-50 bg-amber-50 border-b border-amber-200 text-amber-900";
    bar.innerHTML = `
      <div class="container mx-auto max-w-5xl px-4 py-2 text-sm flex items-center justify-between gap-3">
        <div>لست مُسجّلًا في Google — <strong>تقدّمك لن يُحفَظ على Google Drive</strong>.</div>
        <div class="flex items-center gap-2">
          <button id="esa-auth-btn" class="bg-amber-600 hover:bg-amber-700 text-white rounded-md px-3 py-1">
            تسجيل الدخول لحفظ التقدّم
          </button>
          <button id="esa-auth-close" class="px-2 py-1">إغلاق</button>
        </div>
      </div>`;
    document.body.appendChild(bar);
    $("#esa-auth-close").onclick = () => bar.remove();
    $("#esa-auth-btn").onclick = () => { window.location.href = build(PAGES.INDEX || "index.html"); };
  }

  async function guard() {
    try { await window.Auth?.ready?.(); } catch {}
    // جرّب صامت
    try { await window.Auth?.silent?.(); } catch {}
    // قرار نهائي
    const ok = !!(window.Auth?.isSignedIn?.() );
    if (!ok) showBanner();
  }

  window.EsaCommon = { guard };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", guard);
  } else {
    guard();
  }
})();
