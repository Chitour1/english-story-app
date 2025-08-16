// assets/js/common.js
// يعتمد على: window.APP_CONFIG, window.STATE, window.UI, window.AUTH (اختياري)
// يوفّر الواجهة العامة: window.ROUTER + دوال مساعدة

(function () {
  const CFG = window.APP_CONFIG;
  const PAGES = CFG.PAGES;

  // ========= أدوات عامة =========
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  function fileFromPathname() {
    // يستخرج اسم الملف من المسار الحالي
    const path = (location.pathname || "").replace(/\/+$/, "");
    const last = path.split("/").filter(Boolean).pop() || "";
    if (!last) return PAGES.INDEX;
    if (!/\.(html?)$/i.test(last)) return PAGES.INDEX;
    return last;
  }

  function is(pageName) {
    return fileFromPathname().toLowerCase() === String(pageName).toLowerCase();
  }

  function go(pageName) {
    // استعمال buildUrl من config.js لضمان المسار الصحيح على GitHub Pages
    location.href = window.buildUrl(pageName);
  }

  function hardReplace(pageName) {
    location.replace(window.buildUrl(pageName));
  }

  function ensureBaseOnLinks(root = document) {
    // يضيف APP_BASE لرابط أي <a data-nav> تلقائياً
    qsa('a[data-nav]', root).forEach(a => {
      const to = a.getAttribute('data-nav');
      if (!to) return;
      a.href = window.buildUrl(to);
    });
  }

  // ========= حراس التنقّل (Guards) =========
  function requireAuth() {
    // إذا AUTH غير مفعّل نُعتبر الحالة غير مسجّل الدخول (ملفات main-* تُظهر زر الدخول)
    try { return !!(window.AUTH && window.AUTH.isLoggedIn && window.AUTH.isLoggedIn()); }
    catch { return false; }
  }

  function requireApiKey() {
    const key = window.STATE?.getApiKey?.() || "";
    return !!key.trim();
  }

  function guardFor(page) {
    // يحدد ما يلزم قبل دخول الصفحة
    switch (page) {
      case PAGES.INDEX:
        return { needAuth: false, needKey: false };
      case PAGES.KEY:
        return { needAuth: true, needKey: false };
      case PAGES.LEVELS:
        return { needAuth: true, needKey: true };
      case PAGES.A1:
        return { needAuth: true, needKey: true };
      default:
        return { needAuth: false, needKey: false };
    }
  }

  function enforceGuards() {
    const page = fileFromPathname();
    const g = guardFor(page);

    // تحقق الدخول
    if (g.needAuth && !requireAuth()) {
      // لم يُسجّل الدخول → أعده لصفحة الدخول
      hardReplace(PAGES.INDEX);
      return false;
    }

    // تحقق مفتاح Gemini
    if (g.needKey && !requireApiKey()) {
      hardReplace(PAGES.KEY);
      return false;
    }

    return true;
  }

  // ========= تحسينات GitHub Pages =========
  function fixDirectAccess() {
    // إذا فتح المستخدم رابطًا بدون اسم ملف (مثل .../english-story-app/)
    // نضمن أنه يؤدي لـ index.html
    const path = location.pathname;
    const base = CFG.APP_BASE.replace(/\/+$/, "");
    if (path === base || path === base + "/") {
      // اتركه كما هو: GitHub Pages سيقدّم index.html
      return;
    }
    // لا شيء إضافي هنا؛ 404.html سيتكفّل بإرجاع المستخدم إلى الصفحة المطلوبة داخل المسار.
  }

  // ========= شريط قانوني افتراضي (اختياري) =========
  function ensureLegalBar() {
    try {
      window.UI?.ensureLegalBar?.({
        termsUrl: "https://chitour1.github.io/englishstory/terms.html",
        privacyUrl: "https://chitour1.github.io/englishstory/privacy.html",
        year: new Date().getFullYear(),
        brand: "© قصتي اللغوية"
      });
    } catch {}
  }

  // ========= نقاط الربط العامة =========
  async function initCommon() {
    // تفعيل ربط الروابط ذات data-nav
    ensureBaseOnLinks();

    // محاولة تهيئة AUTH إن وجد (لا يخطئ لو غير موجود)
    try { await window.AUTH?.init?.(); } catch {}

    // فحص الحراس الخاصة بالصفحة الحالية
    enforceGuards();

    // شريط قانوني موحّد (اختياري)
    ensureLegalBar();

    // مستمع عام لتغيّر الحالة (اختياري)
    document.addEventListener("state:changed", () => {
      // يمكن لصفحات main-* أن تعتمد عليه لتحديث الواجهة
    });

    // تحسينات GitHub Pages
    fixDirectAccess();

    // روابط تُبنى تلقائيًا عند الإنشاء الديناميكي
    const mo = new MutationObserver(() => ensureBaseOnLinks());
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // واجهة عامة
  window.ROUTER = {
    is,
    go,
    hardReplace,
    current: fileFromPathname,
    enforceGuards,
    guardFor,
    ensureBaseOnLinks,
  };

  // شغّل عند تحميل DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCommon);
  } else {
    initCommon();
  }
})();
