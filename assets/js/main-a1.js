// assets/js/main-a1.js
// صفحة مستوى A1 — بناء الدرس، العرض، التمارين، الترجمة/الصوت، السجل، السلة… إلخ
// منسّق للعمل مع الهيكلة الجديدة وملفات config/state/ui/tts.

// ===================== مراجع وتهيئة عامة =====================
(function () {
  const CFG = window.APP_CONFIG || {};
  const PAGES = CFG.PAGES || {};
  const STORAGE = (CFG.STORAGE || {});
  const GEMINI = (CFG.GEMINI || {});
  const ENDPOINT = GEMINI.ENDPOINT || "https://generativelanguage.googleapis.com/v1beta/models";
  const MODEL_TEXT = GEMINI.MODEL_TEXT || "gemini-2.5-flash-preview-05-20:generateContent";

  // أدوات تخزين آمنة (من config.js لكن نعيد تعريفها احتياطاً)
  const get = (k, d=null) => { try { const v = localStorage.getItem(k); return v===null?d:v; } catch { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const getJSON = (k, d=null) => { try { const raw = localStorage.getItem(k); return raw? JSON.parse(raw): d; } catch { return d; } };
  const setJSON = (k, obj) => { try { localStorage.setItem(k, JSON.stringify(obj||null)); } catch {} };

  const apiKeyKey = STORAGE.API_KEY || "english_story_app__geminiApiKey";
  const historyKey = STORAGE.HISTORY || "english_story_app__lessonHistory";
  const basketKey  = STORAGE.BASKET  || "english_story_app__learningBasket";
  const progKey    = STORAGE.IN_PROGRESS || "english_story_app__inProgressWords";

  // واجهات مشتركة (من ui.js إن وُجدت، وإلا بدائل بسيطة)
  const UI = window.UI || {
    showLoader: (txt="جاري التحميل…") => {
      const box = document.getElementById("screen-loader");
      const t = document.getElementById("screen-loader-text");
      if (t) t.textContent = txt;
      if (box) box.style.display = "flex";
    },
    hideLoader: () => {
      const box = document.getElementById("screen-loader");
      if (box) box.style.display = "none";
    },
    modal: (content, title="تنبيه", actions=[]) => {
      // Modal بديلة بسيطة
      const old = document.querySelector(".modal-overlay"); if (old) old.remove();
      const ov = document.createElement("div");
      ov.className = "modal-overlay";
      ov.innerHTML = `
        <div class="modal-content">
          <h3 class="text-xl font-bold mb-4">${title}</h3>
          <div class="modal-body">${content}</div>
          <div class="mt-6 flex gap-3 justify-center flex-wrap">
            ${actions.map(a => `<button class="${a.class||""} px-4 py-2 rounded-md transition">${a.text||"موافق"}</button>`).join("")}
            <button class="modal-close bg-slate-500 text-white px-6 py-2 rounded-md hover:bg-slate-600">إغلاق</button>
          </div>
        </div>`;
      document.body.appendChild(ov);
      ov.addEventListener("click", (e) => {
        if (e.target.classList.contains("modal-close") || e.target === ov) ov.remove();
        actions.forEach(a => {
          const firstClass = (a.class||"").split(" ")[0];
          if (firstClass && e.target.classList.contains(firstClass)) {
            a.callback && a.callback();
            if (!a.keepOpen) ov.remove();
          }
        });
      });
    }
  };

  // كلمات المستوى A1 (من state.js إن وُجدت؛ وإلا مجموعة صغيرة لتفادي التعطل)
  const A1_WORDS = (window.A1_WORDS && Array.isArray(window.A1_WORDS) && window.A1_WORDS.length)
    ? window.A1_WORDS
    : ["a","an","about","above","across","action","activity","actor","add","address","adult","afraid","after","age","ago","agree","air","airport","all","also","always","amazing","and","angry","animal","answer","any","anyone","anything","apple","area","arrive","as","ask","at","away","baby","back","bag","ball","banana","bank","bath","bathroom","be","beach","beautiful","because","bed","bedroom","before","begin","behind","believe","below","best","better","between","bicycle","big","bird","birthday","black","blue","boat","body","book","bored","both","bottle","box","boy","bread","break","breakfast","brother","build","bus","busy","but","buy","by","bye"];

  // فواصل مراجعة (Spaced Repetition) مبسطة
  const repetitionIntervals = { 1: 5, 2: 15, 3: 20 };

  // عناصر DOM المطلوبة
  const els = {
    navHome: document.getElementById("nav-home"),
    navHistory: document.getElementById("nav-history"),
    navProgress: document.getElementById("nav-in-progress"),
    navBasket: document.getElementById("nav-basket"),

    homeScreen: document.getElementById("home-screen"),
    historyScreen: document.getElementById("history-screen"),
    inProgressScreen: document.getElementById("in-progress-screen"),
    basketScreen: document.getElementById("basket-screen"),
    loadingScreen: document.getElementById("loading-screen"),
    lessonScreen: document.getElementById("lesson-screen"),

    statsTotal: document.getElementById("total-words"),
    statsLearned: document.getElementById("learned-words"),
    statsRemaining: document.getElementById("remaining-words"),

    historyList: document.getElementById("history-list"),
    selectionPopup: document.getElementById("selection-popup"),

    newLessonBtn: document.getElementById("new-lesson-btn"),
    resetBtn: document.getElementById("reset-progress-btn"),
  };

  // حالة التطبيق
  let apiKey = "";
  let wordsInProgress = [];   // [{word, level, reviews, lessonCounter, lastReviewed}]
  let masteredWords = [];     // [word]
  let learningBasket = [];    // [{id,en,ar}]
  let lessonHistory = [];     // [{...lessonJson, date, learnedWords}]
  let isLessonActive = false;
  let isDragging = false;
  let basketPage = 0;
  const BASKET_PAGE_SIZE = 12;

  // ===================== وظائف مشتركة =====================

  function updateStats() {
    const learnedAndMastered = new Set([
      ...wordsInProgress.map(w => w.word),
      ...masteredWords
    ]);
    const remaining = A1_WORDS.filter(w => !learnedAndMastered.has(w));
    if (els.statsTotal) els.statsTotal.textContent = A1_WORDS.length;
    if (els.statsLearned) els.statsLearned.textContent = learnedAndMastered.size;
    if (els.statsRemaining) els.statsRemaining.textContent = remaining.length;
  }

  function showScreen(screenEl) {
    [els.homeScreen, els.historyScreen, els.inProgressScreen, els.basketScreen, els.loadingScreen, els.lessonScreen]
      .forEach(s => s && s.classList.add("hidden"));
    if (screenEl) screenEl.classList.remove("hidden");
  }

  function activateNav(tab) {
    [els.navHome, els.navHistory, els.navProgress, els.navBasket].forEach(btn => {
      if (!btn) return;
      btn.classList.remove("border-sky-600","text-sky-600");
      btn.classList.add("border-transparent");
    });
    if (tab) {
      tab.classList.remove("border-transparent");
      tab.classList.add("border-sky-600","text-sky-600");
    }
  }

  function showTab(name) {
    if (name === "home") {
      if (isLessonActive) showScreen(els.lessonScreen);
      else showScreen(els.homeScreen);
      activateNav(els.navHome);
    } else if (name === "history") {
      renderHistory();
      showScreen(els.historyScreen);
      activateNav(els.navHistory);
    } else if (name === "progress") {
      renderInProgressWords();
      showScreen(els.inProgressScreen);
      activateNav(els.navProgress);
    } else if (name === "basket") {
      renderBasket();
      showScreen(els.basketScreen);
      activateNav(els.navBasket);
    }
  }

  function requireApiKeyOrGoToKey() {
    apiKey = get(apiKeyKey, "");
    if (!apiKey) {
      UI.modal("الرجاء إدخال مفتاح Gemini أولاً.", "مفتاح مفقود");
      if (window.buildUrl) window.location.href = window.buildUrl(PAGES.KEY || "key.html");
      return false;
    }
    return true;
  }

  // ===================== اختيار الكلمات للدرس =====================

  function selectWordsForLesson() {
    const targetWordCount = 20;

    // نزيد عدّاد الدروس لكل كلمة قيد التعلم
    wordsInProgress.forEach(w => w.lessonCounter = (w.lessonCounter || 0) + 1);

    // الكلمات المستحقة للمراجعة حسب المستوى
    const due = wordsInProgress.filter(it => {
      const lvl = it.level || 1;
      const need = repetitionIntervals[lvl] || 5;
      return (it.lessonCounter || 0) >= need;
    });

    const repetitionWords = due.slice(0, Math.min(due.length, Math.floor(targetWordCount / 2)));
    const newWordsCount = targetWordCount - repetitionWords.length;

    const learned = new Set([...wordsInProgress.map(w => w.word), ...masteredWords]);
    const remaining = A1_WORDS.filter(w => !learned.has(w));
    const newWords = remaining.sort(() => Math.random()-0.5).slice(0, newWordsCount);

    return { newWords, repetitionWords }; // repetitionWords عناصر كاملة من wordsInProgress
  }

  function incrementReview(word) {
    const i = wordsInProgress.findIndex(x => x.word === word);
    if (i === -1) return;
    const item = wordsInProgress[i];
    item.reviews = (item.reviews || 0) + 1;
    item.lessonCounter = 0;
    item.lastReviewed = new Date().toISOString();

    if (item.reviews >= 5 && item.reviews < 15) item.level = Math.max(item.level||1, 2);
    if (item.reviews >= 15 && item.reviews < 20) item.level = Math.max(item.level||1, 3);
    if (item.reviews >= 20) {
      masteredWords.push(item.word);
      wordsInProgress.splice(i, 1);
    }
  }

  function markRepetitionBatchDone(words) {
    words.forEach(w => incrementReview(w));
  }

  // ===================== استدعاء Gemini =====================

  async function callGeminiText(prompt) {
    if (!requireApiKeyOrGoToKey()) throw new Error("NO_API_KEY");
    const res = await fetch(`${ENDPOINT}/${MODEL_TEXT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }]}] })
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // تنظيف أي أسوار كود
    text = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
    return text;
  }

  async function fetchLessonJSON({ wordsNew, wordsRep, wordCount=120, instructions="" }) {
    const wordsAll = [...wordsNew, ...wordsRep];
    const prompt = `
You are an expert ESL teacher. Build one **valid JSON object** for an A1 Arabic-speaking learner.

STRICT:
- ONLY A1 grammar/vocab (be, can, present simple). No advanced tenses or conditionals.
- Use ONLY these target words naturally (each at least once): ${wordsAll.join(", ")}.
- NEW words must be wrapped with <b>...</b>, repetition with <i>...</i>.
- User's note: "${(instructions||"No special instructions.").slice(0,300)}"
- Length ≈ ${wordCount} words.
- Output **JSON ONLY** (no markdown).

SHAPE:
{
 "story_type": "story|dialogue|narrative",
 "story_mood": "happy|calm|exciting|neutral",
 "story": "Text with <b>new</b> and <i>repetition</i> tags.",
 "new_words": [{"word":"cat","translation":"قطة"}],
 "grammar_focus": {
   "title": "Present Simple",
   "explanation_en": "Very short and simple.",
   "explanation_ar": "شرح عربي مختصر جدًا.",
   "examples": [{"example":"I am a student.","translation":"أنا طالب."}]
 },
 "useful_structures": [{"structure":"I like ...","explanation":"أقول ما أحب."}],
 "pronunciation_tips": {
   "title":"A1 Sounds",
   "tips":[{"context":"th","tip":"انطقها مثل 'ذ' عند this/that."}]
 },
 "exercises":[
   {"type":"fill_in_the_blank","question":"I ___ a student.","answer":"am"},
   {"type":"multiple_choice","question":"He has a ___","options":["dog","rice","tea"],"answer":"dog"},
   {"type":"true_false","question":"They are in the school.","answer":"true"}
 ],
 "meta":{"target_words_new":[${wordsNew.map(w=>`"${w}"`).join(", ")}],"target_words_repetition":[${wordsRep.map(w=>`"${w}"`).join(", ")}]}
}
    `.trim();

    const raw = await callGeminiText(prompt);

    // حاول استخراج JSON حتى لو أضاف النموذج نصوصاً أخرى
    let jsonText = raw;
    try {
      return JSON.parse(jsonText);
    } catch (e) {
      const s = raw.indexOf("{");
      const eidx = raw.lastIndexOf("}");
      if (s>=0 && eidx>s) {
        jsonText = raw.slice(s, eidx+1);
        return JSON.parse(jsonText);
      }
      throw new Error("تعذّر تحليل استجابة الذكاء الاصطناعي كـ JSON.");
    }
  }

  async function translateSimple(text) {
    const prompt = `Translate the English text "${text}" into a simple, direct Arabic equivalent. Provide only the translation, nothing else.`;
    return (await callGeminiText(prompt)).trim();
  }

  async function phoneticsSimple(text) {
    const prompt = `اكتب النطق التقريبي لهذه الكلمة/الجملة الإنجليزية بحروف عربية مبسطة فقط (بدون شرح): "${text}"`;
    return (await callGeminiText(prompt)).trim();
  }

  // ===================== عرض الدرس + الصوت =====================

  function createSection(title, html) {
    return `
      <div class="p-5 bg-white rounded-lg shadow-md">
        <h3 class="text-xl font-bold mb-4 text-sky-700">${title}</h3>
        ${html}
      </div>
    `;
  }

  function createTable(arr, headers, k1, k2) {
    if (!Array.isArray(arr) || !arr.length) return `<p class="text-slate-500">لا يوجد محتوى.</p>`;
    return `
      <div class="overflow-x-auto">
        <table class="table-style">
          <thead><tr><th>${headers[0]}</th><th>${headers[1]}</th></tr></thead>
          <tbody>
            ${arr.map(o => `<tr><td>${(o?.[k1]??"")}</td><td>${(o?.[k2]??"")}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderGrammarSection(g) {
    if (!g) return `<p>لا توجد ملاحظات نحوية لهذا الدرس.</p>`;
    const ar = g.explanation_ar || g.explanation || "";
    const en = g.explanation_en || "";
    let html = `
      <h4 class="font-bold text-lg mb-2">${g.title || "Grammar"}</h4>
      <div class="grid md:grid-cols-2 gap-3 mb-4">
        <div><h5 class="font-bold text-sky-700 mb-1">شرح بالعربية</h5><p class="text-slate-700">${ar}</p></div>
        <div><h5 class="font-bold text-sky-700 mb-1">English note</h5><p class="text-slate-700 font-english" dir="ltr">${en}</p></div>
      </div>
    `;
    if (Array.isArray(g.examples) && g.examples.length) {
      html += createTable(g.examples, ["المثال","الترجمة"], "example", "translation");
    }
    return html;
  }

  function renderPronTips(p) {
    if (!p || !Array.isArray(p.tips) || !p.tips.length) return "<p>لا توجد نصائح نطق.</p>";
    const title = p.title || "A1 Sounds";
    return `<h4 class="font-bold mb-2">${title}</h4>` + createTable(p.tips, ["السياق","النصيحة"], "context", "tip");
  }

  function wrapWordsInSpans(htmlContent) {
    const temp = document.createElement("div");
    temp.innerHTML = htmlContent;
    const walker = document.createTreeWalker(temp, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      const p = node.parentNode.tagName;
      if (p !== "B" && p !== "I" && p !== "SPAN") nodes.push(node);
    }
    nodes.forEach(n => {
      const parent = n.parentNode;
      const parts = n.nodeValue.split(/(\s+)/);
      const frag = document.createDocumentFragment();
      parts.forEach(part => {
        if (part.trim()) {
          const span = document.createElement("span");
          span.className = "word-span";
          span.textContent = part;
          frag.appendChild(span);
        } else {
          frag.appendChild(document.createTextNode(part));
        }
      });
      parent.replaceChild(frag, n);
    });
    return temp.innerHTML;
  }

  function formatStory(story, type) {
    const wrapped = wrapWordsInSpans(story || "");
    if (type !== "dialogue") return wrapped;

    const speakers = [];
    const lines = wrapped.split(/\n|<br\s*\/?>/gi);
    return lines.map(line => {
      if (!line.trim()) return "";
      const m = line.match(/^(.*?):/);
      if (m) {
        const speaker = m[1].replace(/<[^>]*>/g,"").trim();
        if (!speakers.includes(speaker)) speakers.push(speaker);
        const cls = (speakers.indexOf(speaker) % 2) ? "dialogue-speaker-2" : "dialogue-speaker-1";
        const rest = line.slice(m[0].length);
        return `<div class="dialogue-line"><span class="${cls}">${speaker}:</span>${rest}</div>`;
      }
      return `<div class="dialogue-line">${line}</div>`;
    }).join("");
  }

  function renderExercises(exercises) {
    if (!Array.isArray(exercises) || !exercises.length) return "<p>لا توجد تمارين.</p>";
    let html = `<div class="space-y-4">`;
    exercises.forEach((ex, idx) => {
      const type = ex.type || "fill_in_the_blank";
      const q = (ex.question || "...").replace(/\*\*/g,"");
      const ans = (ex.answer || "").toString().toLowerCase();
      html += `<div class="exercise p-3 border-r-4 border-slate-200" data-answer="${ans}">`;
      if (type === "multiple_choice" && Array.isArray(ex.options)) {
        html += `<p class="font-english" dir="ltr">${idx+1}. ${q}</p>
                 <div class="flex flex-wrap gap-2 mt-2" dir="ltr">
                   ${ex.options.map(opt => `
                     <label class="flex items-center gap-2 p-2 border rounded-md cursor-pointer">
                       <input type="radio" name="ex${idx}" value="${opt}" class="exercise-input"> ${opt}
                     </label>`).join("")}
                 </div>`;
      } else if (type === "true_false") {
        html += `<p class="font-english" dir="ltr">${idx+1}. ${q}</p>
                 <div class="flex gap-4 mt-2" dir="ltr">
                   <label class="flex items-center gap-2 p-2 border rounded-md cursor-pointer"><input type="radio" name="ex${idx}" value="true" class="exercise-input">True</label>
                   <label class="flex items-center gap-2 p-2 border rounded-md cursor-pointer"><input type="radio" name="ex${idx}" value="false" class="exercise-input">False</label>
                 </div>`;
      } else {
        html += `<p class="font-english" dir="ltr">${idx+1}. ${q.replace('___','<input type="text" class="exercise-input border-b-2 bg-transparent text-center w-24 mx-1">')}</p>`;
      }
      html += `</div>`;
    });
    html += `</div>
      <button id="check-answers-btn" class="mt-6 bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700">تحقق من الإجابات</button>
      <div id="results-container" class="mt-4"></div>`;
    return html;
  }

  function renderStoryAudioPlayer(storyText, mood) {
    const container = document.getElementById("story-audio-player");
    if (!container) return;
    container.innerHTML = `
      <div class="flex items-center gap-3">
        <button id="play-story-btn" class="flex-shrink-0 p-3 bg-sky-600 text-white rounded-full hover:bg-sky-700 transition">
          <svg id="play-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="w-6 h-6"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          <div id="play-loader" class="hidden w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </button>
        <button id="refresh-story-audio-btn" class="flex-shrink-0 p-3 bg-slate-500 text-white rounded-full hover:bg-slate-600 transition">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
        </button>
        <audio id="full-story-audio" class="w-full" controls></audio>
      </div>
      <div class="mt-2">
        <input type="text" id="audio-custom-prompt" class="w-full p-2 border rounded-md text-sm" placeholder="اكتب تعليمات للقارئ (مثال: اقرأ بصوت هادئ)…">
      </div>
    `;

    const audioEl = document.getElementById("full-story-audio");
    const playBtn = document.getElementById("play-story-btn");
    const refreshBtn = document.getElementById("refresh-story-audio-btn");
    const playIcon = document.getElementById("play-icon");
    const playLoader = document.getElementById("play-loader");

    const gen = async () => {
      try {
        playIcon.classList.add("hidden");
        playLoader.classList.remove("hidden");
        playBtn.disabled = true; refreshBtn.disabled = true;

        const custom = (document.getElementById("audio-custom-prompt")?.value || "").trim();
        // استخدام tts.js
        await window.TTS.speak(storyText, { mood: mood || "neutral", audioEl: "#full-story-audio", custom: custom });

        playIcon.classList.remove("hidden");
        playLoader.classList.add("hidden");
        playBtn.disabled = false; refreshBtn.disabled = false;

        if (audioEl.src) { audioEl.style.display = "block"; audioEl.play(); }
      } catch {
        playIcon.classList.remove("hidden");
        playLoader.classList.add("hidden");
        playBtn.disabled = false; refreshBtn.disabled = false;
      }
    };

    audioEl.style.display = "none";
    playBtn.addEventListener("click", () => { if (audioEl.src) audioEl.play(); else gen(); });
    refreshBtn.addEventListener("click", () => gen());
  }

  function renderLesson(data, isRevision=false) {
    const title1 = isRevision ? "مراجعة النص" : "1. النص";
    const title2 = isRevision ? "كلمات للمراجعة" : "2. الكلمات الجديدة";
    const storyText = (data.story || "").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();

    const optionsBox = `
      <div class="max-w-md mx-auto space-y-4 my-6 text-right p-4 border rounded-md bg-slate-50">
        <h3 class="text-lg font-bold text-center">خيارات الدرس القادم</h3>
        <div>
          <label for="word-count-lesson" class="block text-sm font-medium text-slate-700">إجمالي كلمات القصة (50–500)</label>
          <input type="number" id="word-count-lesson" value="100" min="50" max="500" class="mt-1 block w-full p-2 border rounded-md">
        </div>
        <div>
          <label for="custom-prompt-lesson" class="block text-sm font-medium text-slate-700">تعليمات القصة (اختياري)</label>
          <textarea id="custom-prompt-lesson" rows="2" class="mt-1 block w-full p-2 border rounded-md" placeholder="مثال: قصة في مطعم…"></textarea>
        </div>
      </div>
    `;

    els.lessonScreen.innerHTML = `
      ${createSection(title1, `
        <div id="story-container" class="text-lg/relaxed font-english lesson-content" dir="ltr" data-mood="${data.story_mood || "neutral"}">
          ${formatStory(data.story || "", data.story_type)}
        </div>
        <div id="story-audio-player" class="mt-4 border-t pt-4"></div>
      `)}
      ${createSection(title2, createTable(data.new_words || [], ["الكلمة","المعنى"], "word","translation"))}
      ${createSection("3. قواعد نستفيدها", renderGrammarSection(data.grammar_focus))}
      ${createSection("4. تراكيب مفيدة", createTable(data.useful_structures || [], ["التركيب","الاستخدام"], "structure","explanation"))}
      ${createSection(data?.pronunciation_tips?.title || "5. نصائح للنطق", renderPronTips(data.pronunciation_tips || {}))}
      ${createSection("6. تمارين", renderExercises(data.exercises || []))}
      <div class="flex flex-col sm:flex-row gap-4 justify-center mt-8">
        <button id="rewrite-btn" class="bg-amber-500 text-white px-6 py-2 rounded-md hover:bg-amber-600">أعد كتابة القصة بنفس الكلمات</button>
        <button id="next-lesson-btn" class="bg-sky-600 text-white px-6 py-2 rounded-md hover:bg-sky-700">درس جديد بكلمات جديدة</button>
      </div>
      ${optionsBox}
    `;

    renderStoryAudioPlayer(storyText, data.story_mood || "neutral");

    const rewriteBtn = document.getElementById("rewrite-btn");
    const nextBtn = document.getElementById("next-lesson-btn");
    const checkBtn = document.getElementById("check-answers-btn");

    rewriteBtn?.addEventListener("click", async () => {
      const wc = parseInt(document.getElementById("word-count-lesson").value || "100", 10);
      const note = (document.getElementById("custom-prompt-lesson").value || "").trim();
      const newW = (data.new_words || []).map(w => (w.word || "")).filter(w => w && !w.includes(" "));
      await generateLesson(newW, [], true, isRevision, wc, note);
    });

    nextBtn?.addEventListener("click", async () => {
      const wc = parseInt(document.getElementById("word-count-lesson").value || "100", 10);
      const note = (document.getElementById("custom-prompt-lesson").value || "").trim();
      const sel = selectWordsForLesson();
      if (sel.newWords.length || sel.repetitionWords.length) {
        await generateLesson(sel.newWords, sel.repetitionWords, false, false, wc, note);
      } else {
        UI.modal('تهانينا! لا توجد كلمات متبقية — راجع من "كلمات قيد التعلم".');
      }
    });

    checkBtn?.addEventListener("click", checkAnswers);
  }

  function checkAnswers() {
    const items = els.lessonScreen.querySelectorAll(".exercise");
    let correct = 0;
    items.forEach(ex => {
      const correctAns = (ex.dataset.answer || "").toLowerCase();
      const inputs = ex.querySelectorAll(".exercise-input");
      let user = "";
      ex.classList.remove("border-green-400","border-red-400");

      if (inputs.length && inputs[0].type === "text") {
        user = (inputs[0].value || "").trim().toLowerCase();
        if (user === correctAns) { ex.classList.add("border-green-400"); correct++; }
        else ex.classList.add("border-red-400");
      } else {
        let chosen = "";
        inputs.forEach(i => { if (i.checked) chosen = (i.value||"").toLowerCase(); });
        if (chosen === correctAns) { ex.classList.add("border-green-400"); correct++; }
        else ex.classList.add("border-red-400");
      }
    });
    const res = document.getElementById("results-container");
    if (res) res.innerHTML = `<p class="font-bold">نتيجتك: ${correct} من ${items.length}.</p>`;
  }

  // ===================== إنشاء الدرس وتحديث الحالة =====================

  async function generateLesson(newWords, repetitionWordsObjs, rewrite=false, isRevision=false, storyWordCount=100, customInstructions="") {
    if (!requireApiKeyOrGoToKey()) return;

    // لواجهة التحميل
    UI.showLoader("الذكاء الاصطناعي يكتب قصتك…");
    showScreen(els.loadingScreen);

    const repWords = repetitionWordsObjs.map(w => w.word || w);
    try {
      const lesson = await fetchLessonJSON({
        wordsNew: newWords,
        wordsRep: repWords,
        wordCount: Math.max(50, Math.min(500, parseInt(storyWordCount||"100",10))),
        instructions: customInstructions
      });

      if (isRevision) {
        markRepetitionBatchDone(repWords);
      } else if (!rewrite) {
        // إضافة الكلمات الجديدة لقائمة قيد التعلم
        newWords.forEach(w => {
          if (!wordsInProgress.some(x => x.word === w)) {
            wordsInProgress.push({ word: w, level: 1, reviews: 0, lessonCounter: 0, lastReviewed: null });
          }
        });
        // مراجعة الكلمات المُكررة
        repWords.forEach(rw => incrementReview(rw));
      }

      // حفظ الدرس في السجل
      lesson.learnedWords = [...newWords, ...repWords];
      lesson.date = new Date().toLocaleString("ar");
      lessonHistory.unshift(lesson);
      if (lessonHistory.length > 20) lessonHistory.pop();

      // حفظ الحالة
      persistState();
      updateStats();

      // عرض الدرس
      isLessonActive = true;
      renderLesson(lesson, isRevision);
      showScreen(els.lessonScreen);
    } catch (e) {
      console.error(e);
      UI.modal(e.message || "حدث خطأ أثناء إنشاء الدرس.");
      showScreen(els.homeScreen);
    } finally {
      UI.hideLoader();
    }
  }

  // ===================== الترجمة/النطق/الحفظ من النص =====================

  function handleInteractionEnd(evt) {
    setTimeout(async () => {
      const sel = window.getSelection();
      const txt = (sel?.toString() || "").trim();
      const popup = els.selectionPopup;
      if (!popup) return;
      // سحب = اختيار مقطع — انقر = كلمة
      if (isDragging && txt) {
        // أظهر Popup
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        popup.classList.remove("hidden");

        const vw = window.innerWidth, vh = window.innerHeight;
        const pw = popup.offsetWidth || 160, ph = popup.offsetHeight || 40;
        let left = rect.left + rect.width/2 - pw/2;
        let top  = rect.top - ph - 10;
        if (top < 8) top = rect.bottom + 10;
        if (left < 8) left = 8;
        if (left + pw > vw - 8) left = vw - pw - 8;
        popup.style.left = `${left}px`;
        popup.style.top  = `${top}px`;

        const mood = document.getElementById("story-container")?.dataset.mood || "neutral";
        popup.querySelector("#popup-translate")?.addEventListener("click", async () => {
          popup.classList.add("hidden");
          const ar = await translateSimple(txt);
          const actions = [{
            text:"💾 حفظ للمراجعة", class:"save-to-basket-btn bg-green-500 text-white",
            callback:()=> saveToBasket(txt, ar)
          }];
          UI.modal(`<p class="text-xl font-bold text-sky-600">${ar}</p>`, `ترجمة: <span class="font-english">${txt}</span>`, actions);
        }, { once:true });

        popup.querySelector("#popup-speak")?.addEventListener("click", async () => {
          await window.TTS.speak(txt, { mood });
        }, { once:true });

        popup.querySelector("#popup-phonetics")?.addEventListener("click", async () => {
          const ph = await phoneticsSimple(txt);
          UI.modal(`<p class="text-xl font-bold text-sky-600">${ph}</p>`, `النطق التقريبي لـ: <span class="font-english">${txt}</span>`);
          popup.classList.add("hidden");
        }, { once:true });

        popup.querySelector("#popup-save")?.addEventListener("click", async () => {
          const ar = await translateSimple(txt);
          saveToBasket(txt, ar);
          popup.classList.add("hidden");
        }, { once:true });

      } else if (!isDragging && evt.target.closest(".word-span, b, i")) {
        const t = evt.target.closest(".word-span, b, i");
        const word = (t.textContent || "").trim().replace(/[.,!?;:()"]/g,"");
        if (!word) return;
        const mood = document.getElementById("story-container")?.dataset.mood || "neutral";

        UI.modal('<div class="flex justify-center"><div class="loader"></div></div>', `<span class="font-english text-2xl">${word}</span>`);
        const ar = await translateSimple(word);
        const actions = [
          { text:"🔊 نطق", class:"act-speak bg-green-600 text-white", keepOpen:true, callback:()=> window.TTS.speak(word, { mood }) },
          { text:"🗣️ كتابة صوتية", class:"act-phon bg-purple-600 text-white", callback:async ()=> {
              const ph = await phoneticsSimple(word);
              UI.modal(`<p class="text-xl font-bold text-sky-600">${ph}</p>`, `النطق التقريبي لـ: <span class="font-english">${word}</span>`);
            }
          },
          { text:"💾 حفظ للمراجعة", class:"act-save bg-amber-500 text-white", callback:()=> saveToBasket(word, ar) }
        ];
        UI.modal(`<p class="text-2xl font-bold text-sky-600">${ar}</p>`, `<span class="font-english text-2xl">${word}</span>`, actions);
      }
      isDragging = false;
    }, 10);
  }

  async function saveToBasket(en, ar) {
    if (!en) return;
    const already = learningBasket.some(x => (x.en||"").toLowerCase() === en.toLowerCase());
    if (already) { UI.modal(`"${en}"<br><br> موجودة بالفعل في سلة المراجعة.`); return; }
    const tr = ar || await translateSimple(en);
    if (!tr) { UI.modal("تعذّر إيجاد ترجمة للحفظ."); return; }
    learningBasket.unshift({ id: Date.now(), en, ar: tr });
    persistState();
    UI.modal(`"${en}"<br><br> تم حفظها في سلة المراجعة.`);
  }

  // ===================== الكلمات قيد التعلم + المراجعة =====================

  function renderInProgressWords() {
    const box = els.inProgressScreen;
    if (!box) return;

    const buckets = [
      { title:"0–4 مراجعات",  test:x => (x.reviews||0) < 5 },
      { title:"5–14 مراجعات", test:x => (x.reviews||0) >=5 && (x.reviews||0) < 15 },
      { title:"15–19 مراجعات",test:x => (x.reviews||0) >=15 && (x.reviews||0) < 20 },
    ];

    const groups = buckets.map(b => {
      const list = wordsInProgress.filter(b.test).sort((a,b)=>a.word.localeCompare(b.word));
      const grid = (!list.length)
        ? `<p class="text-slate-500 text-sm">لا توجد كلمات هنا.</p>`
        : `<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${list.map(it=>`
              <div class="p-3 border rounded-md hover:bg-sky-50 cursor-pointer" data-w="${it.word}">
                <div class="font-english font-bold">${it.word}</div>
                <div class="text-xs text-slate-500 mt-1">المستوى ${it.level||1} — مراجعات ${(it.reviews||0)}</div>
              </div>`).join("")}
           </div>`;
      return createSection(b.title, grid);
    }).join("");

    const opts = `
      <div class="max-w-md mx-auto space-y-4 mb-6 text-right p-4 border rounded-md bg-slate-50">
        <h3 class="text-lg font-bold text-center">خيارات المراجعة</h3>
        <div>
          <label class="block text-sm font-medium text-slate-700">إجمالي كلمات القصة (50–500)</label>
          <input type="number" id="word-count-review" value="100" min="50" max="500" class="mt-1 block w-full p-2 border rounded-md">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700">تعليمات القصة (اختياري)</label>
          <textarea id="custom-prompt-review" rows="2" class="mt-1 block w-full p-2 border rounded-md" placeholder="مثال: حوار قصير في مطعم…"></textarea>
        </div>
        <div class="text-center">
          <button id="review-lesson-btn" class="bg-sky-600 text-white px-6 py-2 rounded-md hover:bg-sky-700">مراجعة بقصة جديدة</button>
        </div>
      </div>
    `;

    const masteredHtml = masteredWords.length
      ? `<div class="flex flex-wrap gap-2">${[...masteredWords].sort().map(w=>`<span class="px-2 py-1 bg-emerald-50 border border-emerald-200 rounded font-english">${w}</span>`).join("")}</div>`
      : `<p class="text-slate-500">لا توجد كلمات متقنة بعد.</p>`;

    box.innerHTML = createSection("لوحة المراجعة", opts) + groups + createSection("الكلمات المتقنة ⭐", masteredHtml);

    document.querySelectorAll('[data-w]').forEach(el => {
      el.addEventListener("click", () => inProgressWordMenu(el.dataset.w));
    });
    document.getElementById("review-lesson-btn")?.addEventListener("click", handleRevisionLesson);
  }

  function inProgressWordMenu(word) {
    const actions = [
      { text:"✅ أتقنتها", class:"master-word bg-green-600 text-white", callback:()=> masterWord(word) },
      { text:"💾 إضافة للسلة", class:"add-basket bg-amber-500 text-white", callback:async ()=>{
          const tr = await translateSimple(word); if (tr) saveToBasket(word, tr);
        } }
    ];
    UI.modal("ماذا تريد أن تفعل بالكلمة؟", `<span class="font-english text-2xl">${word}</span>`, actions);
  }

  function masterWord(w) {
    const i = wordsInProgress.findIndex(x=>x.word===w);
    if (i>-1) {
      masteredWords.push(wordsInProgress[i].word);
      wordsInProgress.splice(i,1);
      persistState();
      updateStats();
      renderInProgressWords();
      UI.modal(`تم نقل "${w}" إلى قائمة الكلمات المتقنة.`, "تم");
    }
  }

  async function handleRevisionLesson() {
    const wc = parseInt(document.getElementById("word-count-review").value || "100", 10);
    const note = (document.getElementById("custom-prompt-review").value || "").trim();
    const pool = [...wordsInProgress].sort(()=>Math.random()-0.5).slice(0, 20);
    const rep = pool.map(x => ({ word: x.word }));
    if (rep.length) await generateLesson([], rep, false, true, wc, note);
    else UI.modal("لا توجد كلمات كافية للمراجعة الآن.");
  }

  // ===================== السلة (Flashcards + Matching) =====================

  function renderBasket() {
    const box = els.basketScreen;
    if (!box) return;
    const total = learningBasket.length;
    if (!total) {
      box.innerHTML = createSection("سلة المراجعة", `<p class="text-center text-slate-500">سلّتك فارغة.</p>`);
      return;
    }

    const pages = Math.ceil(total / BASKET_PAGE_SIZE);
    basketPage = Math.min(Math.max(basketPage, 0), pages-1);
    const start = basketPage * BASKET_PAGE_SIZE;
    const slice = learningBasket.slice(start, start + BASKET_PAGE_SIZE);

    const pager = `
      <div class="flex items-center justify-center gap-2 my-2">
        <button class="px-3 py-1 border rounded ${basketPage===0?"opacity-50 pointer-events-none":""}" id="pg-prev">السابق</button>
        <span class="text-sm">صفحة ${basketPage+1} من ${pages}</span>
        <button class="px-3 py-1 border rounded ${basketPage===pages-1?"opacity-50 pointer-events-none":""}" id="pg-next">التالي</button>
      </div>`;

    const flash = `
      <div class="flashcard-container">
        ${slice.map(it => `
          <div class="flashcard" data-id="${it.id}">
            <div class="flashcard-inner">
              <div class="flashcard-front font-english">${it.en}</div>
              <div class="flashcard-back">${it.ar}</div>
            </div>
          </div>`).join("")}
      </div>`;

    const match = renderMatching(slice);

    box.innerHTML =
      createSection("1. بطاقات تعليمية (Flashcards)", `<p class="mb-2 text-sm text-slate-500">اضغط لقلب البطاقة.</p>${flash}`) +
      pager +
      createSection("2. تمرين التوصيل", `<p class="mb-2 text-sm text-slate-500">صل الكلمة بترجمتها.</p>${match}`);

    box.querySelectorAll(".flashcard").forEach(el => {
      el.addEventListener("click", () => el.classList.toggle("is-flipped"));
    });
    document.getElementById("pg-prev")?.addEventListener("click", ()=>{ basketPage--; renderBasket(); });
    document.getElementById("pg-next")?.addEventListener("click", ()=>{ basketPage++; renderBasket(); });
    setupMatchingListeners();
  }

  function renderMatching(items) {
    const en = [...items].sort(()=>Math.random()-0.5);
    const ar = [...items].sort(()=>Math.random()-0.5);
    return `
      <div class="matching-container">
        <div class="matching-column">
          ${en.map(i=>`<div class="match-item font-english" data-id="${i.id}">${i.en}</div>`).join("")}
        </div>
        <div class="matching-column">
          ${ar.map(i=>`<div class="match-item" data-id="${i.id}">${i.ar}</div>`).join("")}
        </div>
      </div>
      <p id="match-result" class="text-center font-bold mt-4"></p>
    `;
  }

  function setupMatchingListeners() {
    let selEn=null, selAr=null;
    document.querySelectorAll(".match-item").forEach(it=>{
      it.addEventListener("click", ()=>{
        const isEn = it.classList.contains("font-english");
        if (isEn) { if (selEn) selEn.classList.remove("selected"); selEn=it; it.classList.add("selected"); }
        else { if (selAr) selAr.classList.remove("selected"); selAr=it; it.classList.add("selected"); }
        if (selEn && selAr) {
          const ok = selEn.dataset.id === selAr.dataset.id;
          const res = document.getElementById("match-result");
          if (ok) {
            selEn.classList.add("correct"); selAr.classList.add("correct");
            if (res) { res.textContent="صحيح!"; res.style.color="green"; }
          } else {
            selEn.classList.add("incorrect"); selAr.classList.add("incorrect");
            if (res) { res.textContent="حاول مرة أخرى!"; res.style.color="red"; }
            setTimeout(()=>{ selEn.classList.remove("incorrect"); selAr.classList.remove("incorrect"); }, 900);
          }
          selEn.classList.remove("selected");
          selAr.classList.remove("selected");
          selEn=null; selAr=null;
        }
      });
    });
  }

  // ===================== السجل =====================

  function renderHistory() {
    if (!els.historyList) return;
    if (!lessonHistory.length) {
      els.historyList.innerHTML = `<p class="text-center text-slate-500">لا توجد دروس محفوظة.</p>`;
      return;
    }
    els.historyList.innerHTML = lessonHistory.map((l,i)=>`
      <div class="p-3 border rounded-md hover:bg-slate-100 cursor-pointer" data-h="${i}">
        <p class="font-bold">درس بتاريخ: ${l.date}</p>
        <p class="text-sm text-slate-600 font-english" dir="ltr">${(l.learnedWords||[]).slice(0,5).join(", ")}…</p>
      </div>
    `).join("");
    els.historyList.querySelectorAll("[data-h]").forEach(el=>{
      el.addEventListener("click", ()=>{
        const idx = parseInt(el.dataset.h,10);
        const data = lessonHistory[idx];
        renderLesson(data, false);
        isLessonActive = true;
        showScreen(els.lessonScreen);
        activateNav(els.navHome);
      });
    });
  }

  // ===================== حفظ/تحميل الحالة =====================

  function loadState() {
    apiKey = get(apiKeyKey, "") || "";
    wordsInProgress = getJSON(progKey, []) || [];
    masteredWords = getJSON(progKey+"_mastered", []) || [];
    learningBasket = getJSON(basketKey, []) || [];
    lessonHistory = getJSON(historyKey, []) || [];
  }

  function persistState() {
    setJSON(progKey, wordsInProgress);
    setJSON(progKey+"_mastered", masteredWords);
    setJSON(basketKey, learningBasket);
    setJSON(historyKey, lessonHistory);
    // إن كان auth.js يوفّر مزامنة، أرسل حدثاً (لا يضر إن لم يلتقطه أحد)
    window.dispatchEvent(new CustomEvent("esa:save-state", {
      detail: { wordsInProgress, masteredWords, learningBasket, lessonHistory }
    }));
  }

  // ===================== أحداث الصفحة =====================

  function handleNewLesson() {
    const wc = parseInt(document.getElementById("word-count-home")?.value || "100", 10);
    const note = (document.getElementById("custom-prompt-home")?.value || "").trim();
    const { newWords, repetitionWords } = selectWordsForLesson();
    if (newWords.length || repetitionWords.length) {
      generateLesson(newWords, repetitionWords, false, false, wc, note);
    } else {
      isLessonActive = false;
      showScreen(els.homeScreen);
      UI.modal('تهانينا! لقد تعلمت كل الكلمات الأساسية. راجع من "كلمات قيد التعلم".');
    }
  }

  function handleResetProgress() {
    UI.modal(
      'هل تريد حذف كل التقدم؟ سيتم حذف الكلمات والدروس والسلة نهائيًا.',
      'تأكيد إعادة الضبط',
      [{
        text:"نعم، احذف", class:"confirm-reset bg-red-600 text-white",
        callback:()=>{
          wordsInProgress=[]; masteredWords=[]; learningBasket=[]; lessonHistory=[]; isLessonActive=false;
          persistState(); updateStats(); showTab("home");
          UI.modal("تمت إعادة التعيين.");
        }
      }]
    );
  }

  function attachCommonListeners() {
    els.navHome?.addEventListener("click", ()=> showTab("home"));
    els.navHistory?.addEventListener("click", ()=> showTab("history"));
    els.navProgress?.addEventListener("click", ()=> showTab("progress"));
    els.navBasket?.addEventListener("click", ()=> showTab("basket"));

    els.newLessonBtn?.addEventListener("click", handleNewLesson);
    els.resetBtn?.addEventListener("click", handleResetProgress);

    // تحديد/نقر داخل النص
    const lessonArea = els.lessonScreen;
    if (lessonArea) {
      lessonArea.addEventListener("mousedown", ()=>{ isDragging=false; });
      lessonArea.addEventListener("mousemove", ()=>{ isDragging=true; });
      lessonArea.addEventListener("mouseup", handleInteractionEnd);
      lessonArea.addEventListener("touchstart", ()=>{ isDragging=false; }, {passive:true});
      lessonArea.addEventListener("touchmove", ()=>{ isDragging=true; }, {passive:true});
      lessonArea.addEventListener("touchend", handleInteractionEnd, {passive:false});
    }
  }

  // ===================== تشغيل أولي =====================

  document.addEventListener("DOMContentLoaded", () => {
    loadState();
    updateStats();
    showTab("home");  // يبدأ على الرئيسية (أو يعرض الدرس الأخير إن وُجد)
    attachCommonListeners();
  });

})();
