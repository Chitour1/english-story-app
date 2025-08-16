// assets/js/main-login.js
// يجعل تسجيل الدخول يتم مرة واحدة، ثم ينتقل للصفحة التالية بعد التأكد أن التوكن محفوظ

(function () {
  const { PAGES, STORAGE } = window.APP_CONFIG || {};

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  function hasApiKey() {
    try { return !!localStorage.getItem(STORAGE.API_KEY); } catch { return false; }
  }
  function setBusy(el, busy, txtBusy = "جارٍ المعالجة…") {
    if (!el) return;
    el.disabled = !!busy;
    const orig = el.getAttribute("data-orig") || el.textContent;
    if (!el.getAttribute("data-orig")) el.setAttribute("data-orig", orig);
    el.textContent = busy ? txtBusy : orig;
  }

  // تنقّل آمن بعد ضمان وجود توكن (ولو بالصمت)
  async function gotoAfterEnsured(page) {
    try {
      // جرّب تجديد صامت أولاً (لا نوافذ)
      await window.Auth.ensureAccessToken({ interactiveIfNeeded: false });
    } catch {
      // إن لم نملك موافقة/توكن صالح، نطلب نافذة لمرة واحدة فقط
      try { await window.Auth.signInInteractive(); }
      catch { /* لو رفض المستخدم، نسمح بالانتقال وستظهر اللافتة هناك */ }
    }
    try { window.GlobalAuth?.refreshBannerState?.(); } catch {}
    window.goto(page);
  }

  onReady(async () => {
    try { await window.Auth.init(); } catch {}

    // محاولة صامتة عند فتح الصفحة لإخفاء اللافتة فوراً إن أمكن
    try { await window.Auth.ensureAccessToken({ interactiveIfNeeded: false }); } catch {}
    try { window.GlobalAuth?.refreshBannerState?.(); } catch {}

    // زر تسجيل الدخول (نحاول بعد النجاح الانتقال تلقائياً للخطوة التالية)
    const signinBtn =
      document.getElementById("signin-btn") ||
      document.getElementById("google-signin-btn") ||
      document.querySelector('[data-action="google-signin"]');

    if (signinBtn) {
      signinBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        setBusy(signinBtn, true, "يتم تسجيل الدخول…");
        try {
          await window.Auth.signInInteractive();
          // بعد نجاح الدخول: إن كان هناك مفتاح Gemini مخزّن نذهب للمستويات، وإلا صفحة المفتاح
          const next = hasApiKey() ? PAGES.LEVELS : PAGES.KEY;
          try { window.GlobalAuth?.refreshBannerState?.(); } catch {}
          window.goto(next);
        } catch (err) {
          alert("تعذّر تسجيل الدخول إلى Google. جرّب مجدداً.");
        } finally {
          setBusy(signinBtn, false);
        }
      });
    }

    // أي زر/رابط يؤدي إلى key.html — نضمن التوكن قبل الانتقال
    const goKeyEls = [
      ...document.querySelectorAll('[data-nav="key.html"], a[href$="key.html"], #go-key')
    ];
    goKeyEls.forEach((el) => {
      el.addEventListener("click", async (e) => {
        e.preventDefault();
        setBusy(el, true, "جارٍ الانتقال…");
        await gotoAfterEnsured(PAGES.KEY);
      });
    });

    // لو لديك زر "ابدأ" يذهب مباشرة للمستويات إذا كان المفتاح موجود
    const startEls = [
      ...document.querySelectorAll('[data-action="start"], #start-btn, #continue-btn')
    ];
    startEls.forEach((el) => {
      el.addEventListener("click", async (e) => {
        e.preventDefault();
        const target = hasApiKey() ? PAGES.LEVELS : PAGES.KEY;
        setBusy(el, true, "جارٍ الانتقال…");
        await gotoAfterEnsured(target);
      });
    });
  });
})();
