// assets/js/main-a1.js
// يعتمد على: STATE, LESSONS, TTS, UI, ROUTER, APP_CONFIG
(function () {
  const qs  = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  const els = {
    // تبويبات
    navHome:      null, // #nav-home
    navHistory:   null, // #nav-history
    navProgress:  null, // #nav-in-progress
    navBasket:    null, // #nav-basket

    // شاشات
    homeScreen:      null, // #home-screen
    historyScreen:   null, // #history-screen
    inProgressScreen:null, // #in-progress-screen
    basketScreen:    null, // #basket-screen
    loadingScreen:   null, // #loading-screen
    lessonScreen:    null, // #lesson-screen

    // أزرار رئيسية
    newLessonBtn:    null, // #new-lesson-btn
    resetBtn:        null, // #reset-progress-btn

    // حقول إعدادات القصة في الصفحة الرئيسية
    wordCountHome:   null, // #word-count-home
    promptHome:      null, // #custom-prompt-home

    // إحصاءات أعلى الصفحة (اختياري)
    statTotal:       null, // #total-words
    statLearned:     null, // #learned-words
    statRemain:      null, // #remaining-words

    // قائمة التاريخ
    historyList:     null, // #history-list
  };

  let basketPage = 0;
  const BASKET_PAGE_SIZE = 12;

  // ========== ربط عناصر DOM ==========
  function linkDom() {
    els.navHome       = qs('#nav-home');
    els.navHistory    = qs('#nav-history');
    els.navProgress   = qs('#nav-in-progress');
    els.navBasket     = qs('#nav-basket');

    els.homeScreen       = qs('#home-screen');
    els.historyScreen    = qs('#history-screen');
    els.inProgressScreen = qs('#in-progress-screen');
    els.basketScreen     = qs('#basket-screen');
    els.loadingScreen    = qs('#loading-screen');
    els.lessonScreen     = qs('#lesson-screen');

    els.newLessonBtn   = qs('#new-lesson-btn');
    els.resetBtn       = qs('#reset-progress-btn');

    els.wordCountHome  = qs('#word-count-home');
    els.promptHome     = qs('#custom-prompt-home');

    els.statTotal   = qs('#total-words');
    els.statLearned = qs('#learned-words');
    els.statRemain  = qs('#remaining-words');

    els.historyList  = qs('#history-list');
  }

  // ========== تبويبات ==========
  function setActiveTab(btn) {
    [els.navHome, els.navHistory, els.navProgress, els.navBasket].forEach(b => {
      b?.classList.remove('border-sky-600', 'text-sky-600');
      b?.classList.add('text-slate-500');
    });
    btn?.classList.add('border-sky-600', 'text-sky-600');
    btn?.classList.remove('text-slate-500');
  }

  function showOnly(screen) {
    [els.homeScreen, els.historyScreen, els.inProgressScreen, els.basketScreen, els.loadingScreen, els.lessonScreen]
      .forEach(s => s && s.classList.add('hidden'));
    screen && screen.classList.remove('hidden');
  }

  function bindTabs() {
    els.navHome?.addEventListener('click', () => {
      setActiveTab(els.navHome);
      // لو يوجد درس معروض نظهره، وإلا نظهر المنزل
      if (els.lessonScreen && els.lessonScreen.dataset.lessonReady === "1") {
        showOnly(els.lessonScreen);
      } else {
        showOnly(els.homeScreen);
      }
    });

    els.navHistory?.addEventListener('click', () => {
      setActiveTab(els.navHistory);
      renderHistory();
      showOnly(els.historyScreen);
    });

    els.navProgress?.addEventListener('click', () => {
      setActiveTab(els.navProgress);
      renderInProgress();
      showOnly(els.inProgressScreen);
    });

    els.navBasket?.addEventListener('click', () => {
      setActiveTab(els.navBasket);
      renderBasket();
      showOnly(els.basketScreen);
    });
  }

  // ========== إحصاءات ==========
  function updateStats() {
    if (!els.statTotal && !els.statLearned && !els.statRemain) return;

    try {
      const st = STATE.readLocalState();
      const inProg = Array.isArray(st.wordsInProgress) ? st.wordsInProgress : [];
      const mastered = Array.isArray(st.masteredWords) ? st.masteredWords : [];
      const A1 = Array.isArray(STATE.A1_WORDS) ? STATE.A1_WORDS : [];
      const total = A1.length || 0;
      const learnedCount = new Set([...inProg.map(w => w.word), ...mastered]).size;
      const remaining = total > 0 ? Math.max(0, total - learnedCount) : 0;

      els.statTotal   && (els.statTotal.textContent   = String(total));
      els.statLearned && (els.statLearned.textContent = String(learnedCount));
      els.statRemain  && (els.statRemain.textContent  = String(remaining));
    } catch (e) { console.warn('stats skipped:', e); }
  }

  // ========== درس جديد ==========
  async function handleNewLesson() {
    const storyCount = parseInt((els.wordCountHome?.value || "100"), 10) || 100;
    const custom     = (els.promptHome?.value || "").trim();

    // اختيار الكلمات: نستخدم STATE.selectWordsForLesson إن متوفّر، وإلا اختيار افتراضي
    let pick = null;
    try { pick = STATE.selectWordsForLesson ? STATE.selectWordsForLesson(20) : null; } catch {}
    if (!pick) {
      pick = fallbackSelectWords(20);
    }

    const { newWords, repetitionWords } = pick;
    if ((!newWords || !newWords.length) && (!repetitionWords || !repetitionWords.length)) {
      UI.showToast('لا توجد كلمات مناسبة الآن. جرّب لاحقًا.', { type: 'warning' });
      return;
    }

    const data = await LESSONS.generateLesson({
      newWords,
      repetitionWords,
      rewrite: false,
      isRevision: false,
      storyWordCount: storyCount,
      customInstructions: custom
    });

    if (!data) return;

    LESSONS.renderLesson(els.lessonScreen, data, { isRevision: false });
    setActiveTab(els.navHome);
    showOnly(els.lessonScreen);
    updateStats();
  }

  // اختيار احتياطي للكلمات لو STATE.selectWordsForLesson غير متاح
  function fallbackSelectWords(target = 20) {
    const st = STATE.readLocalState();
    const inProg = Array.isArray(st.wordsInProgress) ? st.wordsInProgress : [];
    const mastered = Array.isArray(st.masteredWords) ? st.masteredWords : [];
    const learnedSet = new Set([...inProg.map(w => w.word), ...mastered]);

    const A1 = Array.isArray(STATE.A1_WORDS) ? STATE.A1_WORDS : [];
    const remaining = A1.filter(w => !learnedSet.has(w));
    const newWords = remaining.sort(() => 0.5 - Math.random()).slice(0, Math.max(0, target - Math.min(target/2, inProg.length)));

    // كلمات للمراجعة: نأخذ الأقدم مراجعة
    const due = inProg.slice().sort((a,b) => {
      const la = a.lastReviewed ? Date.parse(a.lastReviewed) : 0;
      const lb = b.lastReviewed ? Date.parse(b.lastReviewed) : 0;
      return la - lb; // الأقدم أولًا
    }).slice(0, target - newWords.length);

    const repetitionWords = due.map(x => ({ word: x.word }));
    return { newWords, repetitionWords };
  }

  // ========== التاريخ ==========
  function renderHistory() {
    const st = STATE.readLocalState();
    const hist = Array.isArray(st.lessonHistory) ? st.lessonHistory : [];
    if (!els.historyList) return;
    if (!hist.length) {
      els.historyList.innerHTML = '<p class="text-center text-slate-500">لا توجد دروس محفوظة بعد.</p>';
      return;
    }
    els.historyList.innerHTML = hist.map((lesson, idx) => `
      <div class="p-3 border rounded-md hover:bg-slate-100 cursor-pointer" data-idx="${idx}">
        <p class="font-bold">درس #${idx + 1}</p>
        <p class="text-sm text-slate-600 font-english" dir="ltr">${(lesson.meta?.target_words_new || []).slice(0,5).join(', ') || (lesson.learnedWords || []).slice(0,5).join(', ')}</p>
      </div>
    `).join('');

    qsa('[data-idx]', els.historyList).forEach(node => {
      node.addEventListener('click', () => {
        const i = parseInt(node.getAttribute('data-idx'), 10);
        const item = hist[i];
        if (!item) return;
        LESSONS.renderLesson(els.lessonScreen, item, { isRevision: false });
        setActiveTab(els.navHome);
        showOnly(els.lessonScreen);
      });
    });
  }

  // ========== الكلمات قيد التعلّم ==========
  function renderInProgress() {
    const st = STATE.readLocalState();
    const inProg = Array.isArray(st.wordsInProgress) ? st.wordsInProgress : [];
    const mastered = Array.isArray(st.masteredWords) ? st.masteredWords : [];

    const buckets = [
      { title: '0–4 مراجعات',   test: (x) => (x.reviews || 0) < 5 },
      { title: '5–14 مراجعات',  test: (x) => (x.reviews || 0) >= 5 && (x.reviews || 0) < 15 },
      { title: '15–19 مراجعات', test: (x) => (x.reviews || 0) >= 15 && (x.reviews || 0) < 20 },
    ];

    const groupsHtml = buckets.map(b => {
      const list = inProg.filter(b.test).sort((a, b) => a.word.localeCompare(b.word));
      const grid = list.length === 0
        ? '<p class="text-slate-500 text-sm">لا توجد كلمات هنا.</p>'
        : `<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${list.map(item => `
              <div class="p-3 border rounded-md hover:bg-sky-50 cursor-pointer inprog-item" data-word="${item.word}">
                <div class="font-english font-bold">${item.word}</div>
                <div class="text-xs text-slate-500 mt-1">المستوى ${item.level || 1} — مراجعات ${(item.reviews || 0)}</div>
              </div>`).join('')}
          </div>`;
      return section(b.title, grid);
    }).join('');

    const masteredHtml = mastered.length
      ? `<div class="flex flex-wrap gap-2">${[...mastered].sort().map(w => `<span class="px-2 py-1 bg-emerald-50 border border-emerald-200 rounded font-english">${w}</span>`).join('')}</div>`
      : '<p class="text-slate-500">لا توجد كلمات متقنة بعد.</p>';

    // خيارات مراجعة نصية
    const opts = `
      <div class="max-w-md mx-auto space-y-4 mb-6 text-right p-4 border rounded-md bg-slate-50">
        <h3 class="text-lg font-bold text-center">خيارات المراجعة</h3>
        <div>
          <label for="word-count-review" class="block text-sm font-medium text-slate-700">إجمالي كلمات القصة (50–500)</label>
          <input type="number" id="word-count-review" value="100" min="50" max="500" class="mt-1 block w-full p-2 border rounded-md">
        </div>
        <div>
          <label for="custom-prompt-review" class="block text-sm font-medium text-slate-700">تعليمات القصة (اختياري)</label>
          <textarea id="custom-prompt-review" rows="2" class="mt-1 block w-full p-2 border rounded-md" placeholder="مثال: حوار قصير في مطعم…"></textarea>
        </div>
        <div class="text-center">
          <button id="review-lesson-btn" class="bg-sky-600 text-white px-6 py-2 rounded-md hover:bg-sky-700">مراجعة بقصة جديدة</button>
        </div>
      </div>
    `;

    els.inProgressScreen.innerHTML =
      section('لوحة المراجعة', opts) +
      groupsHtml +
      section('الكلمات المتقنة ⭐', masteredHtml);

    qs('#review-lesson-btn', els.inProgressScreen)?.addEventListener('click', handleRevisionLesson);

    qsa('.inprog-item', els.inProgressScreen).forEach(node => {
      node.addEventListener('click', async () => {
        const word = node.getAttribute('data-word');
        if (!word) return;
        UI.openModal({
          title: `<span class="font-english text-3xl">${word}</span>`,
          html: `ماذا تريد أن تفعل بالكلمة؟`,
          actions: [
            { text: '✅ أتقنتها', class: 'px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700', onClick: () => { STATE.masterWord?.(word); updateStats(); renderInProgress(); } },
            { text: '💾 إضافة للمراجعة', class: 'px-4 py-2 rounded-md bg-amber-500 text-white hover:bg-amber-600', onClick: async () => {
                const tr = await LESSONS.translate(word, true);
                if (tr) { STATE.addToBasket(word, tr); UI.showToast('تم الحفظ في السلة', { type: 'success' }); }
              }
            }
          ]
        });
      });
    });
  }

  function section(title, content) {
    return `
      <div class="p-5 bg-white rounded-lg shadow-md">
        <h3 class="text-xl font-bold mb-4 text-sky-700">${title}</h3>
        ${content}
      </div>
    `;
  }

  async function handleRevisionLesson() {
    // نختار مجموعة من الكلمات الموجودة قيد التعلّم (حتى 20)
    const st = STATE.readLocalState();
    const inProg = (st.wordsInProgress || []).slice().sort(() => 0.5 - Math.random()).slice(0, 20);
    const wordsForRevision = inProg.map(x => x.word);

    if (!wordsForRevision.length) {
      UI.showToast('لا توجد كلمات كافية للمراجعة الآن.', { type: 'warning' });
      return;
    }

    const wordCount = parseInt((qs('#word-count-review')?.value || "100"), 10) || 100;
    const custom    = (qs('#custom-prompt-review')?.value || "").trim();

    const data = await LESSONS.generateLesson({
      newWords: [],
      repetitionWords: wordsForRevision.map(w => ({ word: w })),
      rewrite: false,
      isRevision: true,
      storyWordCount: wordCount,
      customInstructions: custom
    });

    if (!data) return;
    LESSONS.renderLesson(els.lessonScreen, data, { isRevision: true });
    setActiveTab(els.navHome);
    showOnly(els.lessonScreen);
    updateStats();
  }

  // ========== سلّة المراجعة ==========
  function renderBasket() {
    const st = STATE.readLocalState();
    const items = Array.isArray(st.learningBasket) ? st.learningBasket : [];
    const total = items.length;

    if (total === 0) {
      els.basketScreen.innerHTML = section('سلة المراجعة', '<p class="text-center text-slate-500">سلّتك فارغة.</p>');
      return;
    }

    const pages = Math.ceil(total / BASKET_PAGE_SIZE);
    basketPage = Math.min(Math.max(basketPage, 0), pages - 1);
    const start = basketPage * BASKET_PAGE_SIZE;
    const slice = items.slice(start, start + BASKET_PAGE_SIZE);

    const pager = `
      <div class="flex items-center justify-center gap-2 my-2">
        <button class="px-3 py-1 border rounded ${basketPage === 0 ? 'opacity-50 pointer-events-none' : ''}" id="pg-prev">السابق</button>
        <span class="text-sm">صفحة ${basketPage + 1} من ${pages}</span>
        <button class="px-3 py-1 border rounded ${basketPage === pages - 1 ? 'opacity-50 pointer-events-none' : ''}" id="pg-next">التالي</button>
      </div>`;

    const flashcards = `
      <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem;">
        ${slice.map(item => `
          <div class="bg-white border rounded-lg h-[100px] cursor-pointer flash" data-id="${item.id}">
            <div class="w-full h-full flex items-center justify-center px-3 font-english front">${item.en}</div>
            <div class="w-full h-full hidden items-center justify-center px-3 back">${item.ar}</div>
          </div>
        `).join('')}
      </div>`;

    const matching = buildMatching(slice);

    els.basketScreen.innerHTML =
      section('1. بطاقات تعليمية (Flashcards)', '<p class="mb-2 text-sm text-slate-500">اضغط على البطاقة لقلبها.</p>' + flashcards) +
      pager +
      section('2. تمرين التوصيل', '<p class="mb-2 text-sm text-slate-500">صل الكلمة بترجمتها.</p>' + matching);

    // قلب البطاقات
    qsa('.flash', els.basketScreen).forEach(card => {
      card.addEventListener('click', () => {
        const front = qsa('.front', card)[0];
        const back  = qsa('.back', card)[0];
        if (!front || !back) return;
        if (back.classList.contains('hidden')) {
          front.classList.add('hidden'); back.classList.remove('hidden');
        } else {
          back.classList.add('hidden'); front.classList.remove('hidden');
        }
      });
    });

    qs('#pg-prev', els.basketScreen)?.addEventListener('click', () => { basketPage--; renderBasket(); });
    qs('#pg-next', els.basketScreen)?.addEventListener('click', () => { basketPage++; renderBasket(); });

    setupMatchingListeners();
  }

  function buildMatching(slice) {
    const shuffledEn = slice.slice().sort(() => 0.5 - Math.random());
    const shuffledAr = slice.slice().sort(() => 0.5 - Math.random());
    const enHtml = shuffledEn.map(item => `<div class="p-2 border-2 rounded-md cursor-pointer match-item font-english" data-id="${item.id}">${item.en}</div>`).join('');
    const arHtml = shuffledAr.map(item => `<div class="p-2 border-2 rounded-md cursor-pointer match-item" data-id="${item.id}">${item.ar}</div>`).join('');
    return `
      <div class="flex gap-3">
        <div class="flex-1 flex flex-col gap-2">${enHtml}</div>
        <div class="flex-1 flex flex-col gap-2">${arHtml}</div>
      </div>
      <p id="match-result" class="text-center font-bold mt-4"></p>
    `;
  }

  function setupMatchingListeners() {
    let selectedEn = null;
    let selectedAr = null;
    const items = qsa('.match-item', els.basketScreen);
    const resultEl = qs('#match-result', els.basketScreen);

    items.forEach(item => {
      item.addEventListener('click', () => {
        const isEnglish = item.classList.contains('font-english');

        if (isEnglish) {
          if (selectedEn) selectedEn.classList.remove('border-sky-500');
          selectedEn = item;
          item.classList.add('border-sky-500');
        } else {
          if (selectedAr) selectedAr.classList.remove('border-sky-500');
          selectedAr = item;
          item.classList.add('border-sky-500');
        }

        if (selectedEn && selectedAr) {
          if (selectedEn.dataset.id === selectedAr.dataset.id) {
            selectedEn.classList.add('border-emerald-500', 'bg-emerald-50');
            selectedAr.classList.add('border-emerald-500', 'bg-emerald-50');
            resultEl.textContent = 'صحيح!';
            resultEl.style.color = 'green';
          } else {
            selectedEn.classList.add('border-red-500', 'bg-red-50');
            selectedAr.classList.add('border-red-500', 'bg-red-50');
            resultEl.textContent = 'حاول مرة أخرى!';
            resultEl.style.color = 'red';
            setTimeout(() => {
              selectedEn.classList.remove('border-red-500', 'bg-red-50');
              selectedAr.classList.remove('border-red-500', 'bg-red-50');
            }, 900);
          }
          selectedEn.classList.remove('border-sky-500');
          selectedAr.classList.remove('border-sky-500');
          selectedEn = null;
          selectedAr = null;
        }
      });
    });
  }

  // ========== إعادة التعيين ==========
  function bindReset() {
    els.resetBtn?.addEventListener('click', async () => {
      const ok = await UI.confirmDialog({
        title: 'تأكيد إعادة الضبط',
        message: 'سيتم حذف كل تقدّمك (الكلمات والسجل وسلة المراجعة). هل أنت متأكد؟',
        confirmText: 'نعم، أعد الضبط'
      });
      if (!ok) return;
      STATE.writeLocalState({ wordsInProgress: [], masteredWords: [], learningBasket: [], lessonHistory: [] });
      updateStats();
      setActiveTab(els.navHome);
      showOnly(els.homeScreen);
      UI.showToast('تمت إعادة تعيين تقدمك.', { type: 'success' });
    });
  }

  // ========== تهيئة ==========
  function bindHomeActions() {
    els.newLessonBtn?.addEventListener('click', handleNewLesson);
  }

  function init() {
    // تأكيد الحراس (الدخول + المفتاح)
    try { ROUTER.enforceGuards(); } catch {}

    linkDom();
    bindTabs();
    bindHomeActions();
    bindReset();
    updateStats();

    // مبدئيًا: تفعيل تبويب "الرئيسية"
    setActiveTab(els.navHome);
    showOnly(els.homeScreen);

    // إعادة بناء روابط data-nav إن وُجدت عناصر مضافة لاحقًا
    try { ROUTER.ensureBaseOnLinks?.(); } catch {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
