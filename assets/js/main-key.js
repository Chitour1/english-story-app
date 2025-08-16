// assets/js/main-key.js
// يعتمد على: STATE, UI, ROUTER, APP_CONFIG
(function () {
  const qs  = (s, r = document) => r.querySelector(s);

  const els = {
    input: null,   // #api-key-input
    save:  null,   // #save-api-key-btn
    show:  null,   // #toggle-key-visibility (اختياري إن وُجد)
  };

  function linkDom() {
    els.input = qs('#api-key-input');
    els.save  = qs('#save-api-key-btn');
    els.show  = qs('#toggle-key-visibility'); // زر إظهار/إخفاء (اختياري)
  }

  function prefillIfAny() {
    try {
      const key = (STATE.getApiKey?.() || '').trim();
      if (els.input && key) els.input.value = key;
    } catch {}
  }

  function validateKey(v) {
    // تحقق بسيط: غير فارغ، طول معقول
    return typeof v === 'string' && v.trim().length >= 12;
  }

  async function onSave() {
    const val = (els.input?.value || '').trim();
    if (!validateKey(val)) {
      UI.showToast('الرجاء إدخال مفتاح API صالح.', { type: 'warning' });
      els.input?.focus();
      return;
    }
    try {
      UI.showLoader('جاري حفظ المفتاح…');
      STATE.setApiKey(val);
      UI.hideLoader();
      UI.showToast('تم حفظ مفتاح Gemini.', { type: 'success' });
      // إلى صفحة اختيار المستويات
      ROUTER.go(APP_CONFIG.PAGES.LEVELS);
    } catch (e) {
      console.error(e);
      UI.hideLoader();
      UI.showToast('تعذر حفظ المفتاح.', { type: 'error' });
    }
  }

  function bindEvents() {
    els.save?.addEventListener('click', onSave);
    els.input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') onSave();
    });

    // زر إظهار/إخفاء المفتاح إن وُجد
    els.show?.addEventListener('click', () => {
      if (!els.input) return;
      const isPwd = els.input.type === 'password';
      els.input.type = isPwd ? 'text' : 'password';
      els.show.textContent = isPwd ? 'إخفاء' : 'إظهار';
      els.input.focus();
    });

    // لصق تلقائي: عند لصق سلسلة طويلة نعتبرها مفتاحًا ونفعل الحفظ
    els.input?.addEventListener('paste', (e) => {
      setTimeout(() => {
        const v = (els.input.value || '').trim();
        if (validateKey(v)) UI.showToast('تم لصق مفتاح يبدو صالحًا.', { type: 'info' });
      }, 0);
    });
  }

  function init() {
    linkDom();
    prefillIfAny();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
