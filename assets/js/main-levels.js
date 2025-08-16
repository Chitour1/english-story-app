// assets/js/main-levels.js
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const CFG   = window.APP_CONFIG || {};
  const PAGES = CFG.PAGES || {};
  const S     = CFG.STORAGE || {};

  function t(id, v) { const el = $('#' + id); if (el) el.textContent = v; }

  function computeCounters() {
    const a1List = (window.A1_WORDS || window.a1Words || []); // من state.js
    const totalA1 = Array.isArray(a1List) ? a1List.length : null;

    const hist   = window.safeGetJson ? safeGetJson(S.HISTORY, [])    : [];
    const inProg = window.safeGetJson ? safeGetJson(S.IN_PROGRESS, []) : [];
    const learned = new Set();
    hist.forEach(h => (h?.learnedWords || []).forEach(w => learned.add(String(w).toLowerCase())));
    inProg.forEach(it => it?.word && learned.add(String(it.word).toLowerCase()));

    const learnedInA1 = a1List && a1List.length
      ? [...learned].filter(w => a1List.includes(w)).length
      : learned.size;

    if ($('#counter-a1-total'))   t('counter-a1-total',   totalA1 ?? '—');
    if ($('#counter-a1-learned')) t('counter-a1-learned', learnedInA1);
    if ($('#counter-a1-left'))    t('counter-a1-left',    totalA1 != null ? Math.max(totalA1 - learnedInA1, 0) : '—');
  }

  function wireNav() {
    const go = (p) => window.location.href = (window.buildUrl ? buildUrl(p) : p);

    const goA1 = () => go(PAGES.A1 || 'level-a1.html');
    // نربط على أكثر من محدِّد حتى لو تغيّر HTML
    ['#card-a1', '#level-a1', '#level-a1-btn', '[data-level="a1"]', '.card-a1'].forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        el.style.cursor = 'pointer';
        el.setAttribute('tabindex', '0');
        el.addEventListener('click', goA1);
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goA1(); }
        });
      }
    });

    // رابط "مفتاح Gemini"
    const keyLink = $('[data-nav="key.html"]') || $('.goto-key');
    if (keyLink) keyLink.addEventListener('click', (e) => { e.preventDefault(); go(PAGES.KEY || 'key.html'); });

    // زر الرجوع (إن وُجد)
    const back = $('[data-nav="index.html"]');
    if (back) back.addEventListener('click', (e) => { e.preventDefault(); go(PAGES.INDEX || 'index.html'); });
  }

  function init() { try { computeCounters(); } catch {} wireNav(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
