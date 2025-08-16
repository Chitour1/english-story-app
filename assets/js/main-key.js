// assets/js/main-key.js
// يحفظ مفتاح Gemini محليًا ويوجّه لصفحة المستويات بدون أي تحقق خارجي يمنع الحفظ.

(function () {
  const CFG   = window.APP_CONFIG || {};
  const STORE = (CFG.STORAGE || {});
  const PAGES = (CFG.PAGES   || {});

  const $ = (s, r=document) => r.querySelector(s);
  const input = $('#api-key-input');
  const saveBtn = $('#save-api-key-btn');

  function goto(page) {
    try {
      if (window.goto) return window.goto(page);
      const url = window.buildUrl ? window.buildUrl(page) : page;
      window.location.href = url;
    } catch { window.location.href = page; }
  }

  function readKey() {
    try { return window.safeGet ? window.safeGet(STORE.API_KEY) : localStorage.getItem(STORE.API_KEY); }
    catch { return null; }
  }

  function writeKey(k) {
    // نحاول localStorage أولاً، وإن فشل نستخدم sessionStorage كخطة بديلة
    try {
      if (window.safeSet) window.safeSet(STORE.API_KEY, k);
      else localStorage.setItem(STORE.API_KEY, k);
      return true;
    } catch {
      try { sessionStorage.setItem(STORE.API_KEY, k); return true; }
      catch { return false; }
    }
  }

  async function onSave() {
    const key = (input?.value || '').trim();
    if (!key) {
      alert('رجاءً أدخل مفتاح Gemini أولًا.');
      input?.focus();
      return;
    }

    saveBtn && (saveBtn.disabled = true);

    const ok = writeKey(key);
    if (!ok) {
      alert('تعذّر حفظ المفتاح في المتصفح. عطّل التصفّح الخاص أو جرّب متصفحًا آخر.');
      saveBtn && (saveBtn.disabled = false);
      return;
    }

    alert('تم حفظ مفتاح Gemini بنجاح ✅');
    goto(PAGES.LEVELS || 'levels.html');
  }

  function init() {
    const existing = readKey();
    if (existing && input) input.value = existing;

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.addEventListener('click', onSave);
    }
    input?.addEventListener('keypress', (e) => { if (e.key === 'Enter') onSave(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
