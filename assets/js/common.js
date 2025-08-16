// assets/js/common.js
// شريط التنبيه + تسجيل الدخول مباشرةً من أي صفحة + إخفاء الشريط بعد النجاح.

(function () {
  const CFG   = window.APP_CONFIG || {};
  const PAGES = CFG.PAGES || {};
  const BANNER_ID = "__esa_auth_banner";

  const $ = (s,r=document)=> r.querySelector(s);

  function ensureBanner() {
    if (document.getElementById(BANNER_ID)) return document.getElementById(BANNER_ID);

    const bar = document.createElement("div");
    bar.id = BANNER_ID;
    bar.dir = "rtl";
    bar.className = "fixed top-0 inset-x-0 z-50 bg-amber-50 border-b border-amber-200 text-amber-900";
    bar.innerHTML = `
      <div class="container mx-auto max-w-5xl px-4 py-2 text-sm flex items-center justify-between gap-3">
        <div id="esa-auth-text">لست مُسجّلًا في Google — <strong>تقدّمك لن يُحفَظ على Google Drive</strong>.</div>
        <div class="flex items-center gap-2">
          <button id="esa-auth-btn" class="bg-amber-600 hover:bg-amber-700 text-white rounded-md px-3 py-1">
            تسجيل الدخول لحفظ التقدّم
          </button>
          <button id="esa-auth-close" class="px-2 py-1">إغلاق</button>
        </div>
      </div>`;
    document.body.appendChild(bar);

    $("#esa-auth-close").onclick = () => bar.remove();

    $("#esa-auth-btn").onclick = async () => {
      const btn = $("#esa-auth-btn");
      const txt = $("#esa-auth-text");
      try {
        btn.disabled = true;
        btn.textContent = "جاري تسجيل الدخول…";
        await window.Auth?.ready?.();
        const ok = await window.Auth?.signInInteractive?.();
        if (ok) {
          txt.textContent = "تم تسجيل الدخول. تتمّ المزامنة…";
          try { await window.Auth?.loadFromDrive?.(); } catch {}
          bar.remove();
        } else {
          btn.disabled = false;
          btn.textContent = "تسجيل الدخول لحفظ التقدّم";
          alert("تعذّر تسجيل الدخول. تأكّد من السماح بالنوافذ المنبثقة ومن اختيار الحساب.");
        }
      } catch {
        btn.disabled = false;
        btn.textContent = "تسجيل الدخول لحفظ التقدّم";
        alert("حدث خطأ غير متوقّع أثناء تسجيل الدخول.");
      }
    };

    return bar;
  }

  async function guard() {
    try { await window.Auth?.ready?.(); } catch {}
    try { await window.Auth?.silent?.(); } catch {}
    const ok = !!(window.Auth?.isSignedIn?.());
    if (!ok) ensureBanner();
    else {
      const ex = document.getElementById(BANNER_ID);
      if (ex) ex.remove();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", guard);
  } else {
    guard();
  }
})();
