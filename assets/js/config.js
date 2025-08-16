// assets/js/config.js

// كل الثوابت العامة للتطبيق في مكان واحد
window.APP_CONFIG = Object.freeze({
  APP_NAME: "قصتي اللغوية",
  // على GitHub Pages: اسم الريبو هو المسار الأساسي
  APP_BASE: "/english-story-app/",

  // صفحات التطبيق (للاستخدام في التوجيه وبناء الروابط)
  PAGES: Object.freeze({
    INDEX: "index.html",
    KEY: "key.html",
    LEVELS: "levels.html",
    A1: "level-a1.html",
    NOT_FOUND: "404.html",
  }),

  // مفاتيح التخزين المحلي (prefix موحّد لتفادي التصادم)
  STORAGE: Object.freeze({
    PREFIX: "english_story_app__",
    API_KEY: "english_story_app__geminiApiKey",
    HISTORY: "english_story_app__lessonHistory",
    BASKET: "english_story_app__learningBasket",
    IN_PROGRESS: "english_story_app__inProgressWords",
    DRIVE_FILE_ID: "english_story_app__driveFileId",
  }),

  // إعدادات Google OAuth + Drive
  GOOGLE: Object.freeze({
    CLIENT_ID: "484856738377-c2ng08gfa9sstobj8ilji7vduk47qa3p.apps.googleusercontent.com",
    SCOPES: [
      "https://www.googleapis.com/auth/drive.appdata",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ],
  }),

  // إعدادات Gemini
  GEMINI: Object.freeze({
    MODEL_TEXT: "gemini-2.5-flash-preview-05-20:generateContent",
    MODEL_TTS: "gemini-2.5-flash-preview-tts:generateContent",
    ENDPOINT: "https://generativelanguage.googleapis.com/v1beta/models",
  }),
});

// ============ دوال مساعدة بسيطة ============

// يبني رابط نسبي آمن داخل المسار الأساسي (لـ GitHub Pages)
window.buildUrl = function buildUrl(pageName) {
  const base = window.APP_CONFIG.APP_BASE.replace(/\/+$/, "");
  return `${base}/${pageName}`;
};

// توجيه سريع لصفحة معينة
window.goto = function goto(pageName) {
  window.location.href = buildUrl(pageName);
};

// جلب قيمة من localStorage مع حماية
window.safeGet = function safeGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
};

// حفظ قيمة في localStorage مع حماية
window.safeSet = function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

// جلب JSON من التخزين
window.safeGetJson = function safeGetJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

// حفظ JSON في التخزين
window.safeSetJson = function safeSetJson(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj || null));
  } catch {}
};
