// assets/js/main-levels.js
// يعتمد على: ROUTER, STATE, UI, APP_CONFIG (جميعها مُعدة مسبقًا)
(function () {
  const qs  = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  const els = {
    a1Card:        null, // #level-a1-btn
    disabledCards: [],   // .level-card-disabled
    // (اختياري) عناصر إحصاءات إن وُجدت في الصفحة
    statTotal:     null, // #total-words
    statLearned:   null, // #learned-words
    statRemain:    null, // #remaining-words
  };

  function linkDom() {
    els.a1Card        = qs('#level-a1-btn');
    els.disabledCards = qsa('.level-card-disabled');
    els.statTotal     = qs('#total-words');
    els.statLearned   = qs('#learned-words');
    els.statRemain    = qs('#remaining-words');
  }

  function bindEvents() {
    // فتح مستوى A1
    els.a1Card?.addEventListener('click', () => {
      ROUTER.go(APP_CONFIG.PAGES.A1);
    });

    // إظهار “قريبًا” على البطاقات الموقوفة
    els.disabledCards.forEach(card => {
      card.style.cursor = 'not-allowed';
      card.addEventListener('click', () => {
        UI.showToast('هذا المستوى قيد الإعداد. قريبًا بإذن الله.', { type: 'warning' });
      });
    });
  }

  // (اختياري) إحصاءات بسيطة إن وُجدت عناصرها
  function renderStatsIfAny() {
    if (!els.statTotal && !els.statLearned && !els.statRemain) return;

    try {
      const st = STATE.readLocalState();
      const wordsInProgress = Array.isArray(st.wordsInProgress) ? st.wordsInProgress : [];
      const masteredWords   = Array.isArray(st.masteredWords)   ? st.masteredWords   : [];
      // إجمالي A1 — نحاول قراءته من STATE.A1_WORDS إن توفّر
      const A1 = Array.isArray(STATE.A1_WORDS) ? STATE.A1_WORDS : [];
      const total = A1.length || 0;
      const learnedCount = new Set([
        ...wordsInProgress.map(w => w.word),
        ...masteredWords
      ]).size;
      const remaining = total > 0 ? Math.max(0, total - learnedCount) : 0;

      if (els.statTotal)   els.statTotal.textContent   = String(total);
      if (els.statLearned) els.statLearned.textContent = String(learnedCount);
      if (els.statRemain)  els.statRemain.textContent  = String(remaining);
    } catch (e) {
      // إحصاءات اختيارية — نتجاهل أي خطأ بهدوء
      console.warn('levels stats render skipped:', e);
    }
  }

  function init() {
    linkDom();
    bindEvents();
    renderStatsIfAny();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
