// assets/js/main-key.js
// يحفظ مفتاح Gemini محليًا (localStorage ثم sessionStorage كخطة بديلة)
// ويتحقق من نجاح الحفظ قبل التوجيه إلى صفحة المستويات.

(function () {
  const $ = (s, r=document) => r.querySelector(s);

  const CFG    = window.APP_CONFIG || {};
  const PAGES  = (CFG.PAGES   || {});
  const STORE  = (CFG.STORAGE || {});

  // اسم المفتاح مع افتراضي آمن إذا لم يصل من config.js
  const STORE_KEY = STORE.API_KEY || 'english_story_app__geminiApiKey';

  const input   = $('#api-key-input');
  const saveBtn = $('#save-api-key-btn');
  const toggle  = $('#toggle-key-visibility');

  function buildUrl(page){
    try { return window.buildUrl ? window.buildUrl(page) : page; }
    catch { return page; }
  }
  function goto(page){
    const p = page || PAGES.LEVELS || 'levels.html';
    window.location.href = buildUrl(p);
  }

  function readKey() {
    try {
      if (window.safeGet) return window.safeGet(STORE_KEY);
      return localStorage.getItem(STORE_KEY) ?? sessionStorage.getItem(STORE_KEY);
    } catch { return null; }
  }

  function tryWrite(key) {
    // 1) localStorage
    try {
      if (window.safeSet) window.safeSet(STORE_KEY, key);
      else localStorage.setItem(STORE_KEY, key);
      return true;
    } catch {/* ignore */}
    // 2) sessionStorage
    try {
      sessionStorage.setItem(STORE_KEY, key);
      return true;
    } catch {/* ignore */}
    return false;
  }

  function verifyWrite(expected) {
    try {
      const a = localStorage.getItem(STORE_KEY);
      const b = sessionStorage.getItem(STORE_KEY);
      return (a === expected) || (b === expected);
    } catch { return false; }
  }

  async function onSave() {
    const key = (input?.value || '').trim();
    if (!key) { alert('رجاءً أدخل مفتاح Gemini أولًا.'); input?.focus(); return; }

    if (saveBtn) saveBtn.disabled = true;

    const ok = tryWrite(key) && verifyWrite(key);
    if (!ok) {
      if (saveBtn) saveBtn.disabled = false;
      alert(
        'تعذّر حفظ المفتاح في المتصفح.\n' +
        'جرّب إلغاء وضع التصفّح الخاص (InPrivate) أو السماح للتخزين المحلي، ثم أعد المحاولة.'
      );
      return;
    }

    alert('تم حفظ مفتاح Gemini بنجاح ✅');
    goto(PAGES.LEVELS || 'levels.html');
  }

  function init() {
    // عبّئ الحقل إن كان محفوظًا
    const existing = readKey();
    if (existing && input) input.value = existing;

    // زر الحفظ
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.addEventListener('click', onSave);
    }
    // Enter يحفظ
    input?.addEventListener('keypress', (e) => { if (e.key === 'Enter') onSave(); });

    // إظهار/إخفاء
    toggle?.addEventListener('click', () => {
      if (!input) return;
      const isPwd = input.type === 'password';
      input.type = isPwd ? 'text' : 'password';
      toggle.textContent = isPwd ? 'إخفاء' : 'إظهار';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
