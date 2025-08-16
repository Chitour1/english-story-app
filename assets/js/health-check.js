// assets/js/health-check.js
// فحص سريع للتكامل. لا يغيّر سلوك التطبيق.
// يظهر تنبيه واحد فقط عند وجود مشكلة جوهرية.

(function () {
  const problems = [];

  // 1) APP_CONFIG
  if (!window.APP_CONFIG) {
    problems.push('APP_CONFIG غير محمّل. تأكد أن assets/js/config.js يُحمّل قبل باقي الملفات.');
  } else {
    const C = window.APP_CONFIG;
    // APP_BASE فحص بسيط
    if (typeof C.APP_BASE !== 'string') {
      problems.push('APP_BASE غير معرّف كسلسلة نصية في config.js');
    }
    // صفحات
    if (!C.PAGES || !C.PAGES.KEY || !C.PAGES.LEVELS) {
      problems.push('PAGES.KEY أو PAGES.LEVELS غير موجودين في config.js');
    }
    // Google
    if (!C.GOOGLE || !C.GOOGLE.CLIENT_ID) {
      problems.push('GOOGLE.CLIENT_ID غير مضبوط في config.js');
    }
    if (!C.GOOGLE || !(Array.isArray(C.GOOGLE.SCOPES) || typeof C.GOOGLE.SCOPES === 'string')) {
      problems.push('GOOGLE.SCOPES غير مضبوط في config.js');
    }
  }

  // 2) مكتبات Google
  const gapiReady  = !!(window.gapi);
  const gisReady   = !!(window.google && window.google.accounts && window.google.accounts.oauth2);
  if (!gapiReady) problems.push('مكتبة gapi لم تُحمّل. تأكد من تضمين https://apis.google.com/js/api.js مع onload="gapiLoaded()"');
  if (!gisReady)  problems.push('مكتبة Google Identity (gsi) لم تُحمّل. تأكد من تضمين https://accounts.google.com/gsi/client مع onload="gisLoaded()"');

  // 3) callbacks
  if (typeof window.gapiLoaded !== 'function') problems.push('الدالة العالمية gapiLoaded غير معرّفة (تحتاجها سطر onload في سكربت gapi).');
  if (typeof window.gisLoaded  !== 'function') problems.push('الدالة العالمية gisLoaded غير معرّفة (تحتاجها سطر onload في سكربت gsi).');

  // 4) ترتيب التحميل الأساسي
  const configLoadedFirst = !!window.APP_CONFIG;
  if (!configLoadedFirst) {
    problems.push('config.js يجب أن يحمَّل أولًا قبل main-login.js');
  }

  // 5) مسارات أساس
  try {
    const base = (window.APP_CONFIG && window.APP_CONFIG.APP_BASE || '').replace(/\/+$/, '');
    const expectIndex = base + '/' + (window.APP_CONFIG?.PAGES?.INDEX || 'index.html');
    // ملاحظة: هذا فحص ناعم للمسار وليس إلزاميًا
    if (!base.length) {
      problems.push('APP_BASE فارغ — على GitHub Pages يجب أن يكون "/english-story-app" أو "/english-story-app/".');
    }
  } catch(_) {}

  if (problems.length) {
    console.warn('[HealthCheck] مشاكل تم اكتشافها:\n- ' + problems.join('\n- '));
    alert('⚠️ اكتشفنا مشكلات في الإعداد:\n\n- ' + problems.join('\n- ') + '\n\nأصلح الترتيب/الإعداد ثم حدّث الصفحة.');
  } else {
    // إذا أردت رؤية نجاح الفحص ضع ?debug=1 في العنوان
    if (location.search.includes('debug=1') || location.hash.includes('debug')) {
      console.log('[HealthCheck] كل شيء سليم ✅');
      alert('✅ Health Check: كل شيء سليم.');
    }
  }
})();
