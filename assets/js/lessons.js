// assets/js/lessons.js
// =======================================================
// توليد درس A1 (نص + جداول + تمارين) + تهيئة مشغّل الصوت
// متوافق مع الهيكلة الجديدة:
// - يعتمد مفاتيح التخزين من APP_CONFIG.STORAGE
// - يستخدم نماذج/نقاط النهاية من APP_CONFIG.GEMINI
// - يستعمل UI.showLoader/UI.hideLoader/UI.modal إن توفرت
// - يستعمل TTS.speak من assets/js/tts.js
// - لا يتعامل مع Google Drive أو الدخول — هذه في ملفات أخرى
// =======================================================

(function () {
  const CFG = window.APP_CONFIG || {};
  const STORAGE = (CFG.STORAGE || {});
  const GEM = (CFG.GEMINI || {});
  const ENDPOINT = GEM.ENDPOINT || "https://generativelanguage.googleapis.com/v1beta/models";
  const MODEL_TEXT = GEM.MODEL_TEXT || "gemini-2.5-flash-preview-05-20:generateContent";

  const UI = window.UI || {
    showLoader: (txt = "جاري التحميل…") => {
      const box = document.getElementById("screen-loader");
      const t = document.getElementById("screen-loader-text");
      if (t) t.textContent = txt;
      if (box) box.classList.remove("hidden");
      if (box && box.style) box.style.display = "flex";
    },
    hideLoader: () => {
      const el = document.getElementById("screen-loader");
      if (el) el.classList.add("hidden");
      if (el && el.style) el.style.display = "none";
    },
    modal: (msg, title = "تنبيه") => alert(`${title}\n\n${msg}`)
  };

  // ===== أدوات تخزين آمنة =====
  const safeGet = (k, d = null) => {
    try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; }
  };

  function getApiKey() {
    // المفتاح الموحّد في config.js
    const keyName = STORAGE.API_KEY || "english_story_app__geminiApiKey";
    return safeGet(keyName, "");
  }

  // ===== المولد النصي الصارم (JSON) =====
  async function callGeminiJSON(promptText, apiKey) {
    const url = `${ENDPOINT}/${MODEL_TEXT}?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`API ${res.status} – ${txt || "فشل الطلب"}`);
    }

    const data = await res.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // أحيانًا يرد داخل ```json … ``` — ننظّف
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

    // محاولة صارمة لتحويله إلى JSON
    try {
      return JSON.parse(text);
    } catch {
      const s = text.indexOf("{");
      const e = text.lastIndexOf("}");
      if (s >= 0 && e > s) {
        const maybe = text.slice(s, e + 1);
        return JSON.parse(maybe);
      }
      throw new Error("تعذّر قراءة استجابة الذكاء الاصطناعي كـ JSON صالح.");
    }
  }

  // ===== خدمات قصيرة (ترجمة/فونيتكس) بنفس الموديل =====
  async function callGeminiPlain(promptText, apiKey) {
    const url = `${ENDPOINT}/${MODEL_TEXT}?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    let t = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    t = t.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    return t;
  }

  // ===== توليد درس A1 =====
  async function generateLesson({ newWords = [], repetitionWords = [], storyWordCount = 100, customInstructions = "", rewrite = false, isRevision = false } = {}) {
    const apiKey = getApiKey();
    if (!apiKey) {
      UI.modal("الرجاء إدخال مفتاح Gemini أولاً من صفحة المفتاح.", "مفتاح مفقود");
      if (window.buildUrl) window.location.href = window.buildUrl(CFG.PAGES?.KEY || "key.html");
      throw new Error("API key missing");
    }

    const lessonWords = [...newWords, ...repetitionWords.map(w => typeof w === "string" ? w : w.word)].filter(Boolean);
    const repList = repetitionWords.map(w => (typeof w === "string" ? w : w.word)).filter(Boolean);

    const prompt = `
You are a veteran ESL teacher. Build exactly ONE **valid JSON object** for an A1 Arabic-speaking learner.

STRICT RULES:
- Vocabulary & grammar: A1 only (be, have, can, present simple; no perfect/continuous/conditionals).
- Use ONLY the provided target words, each at least once.
- NEW words must be wrapped with <b>…</b>, and REPETITION words with <i>…</i>.
- Follow the user's instruction: "${(customInstructions || "No specific instructions.").slice(0, 300)}"
- Length ≈ ${Math.max(50, Math.min(500, parseInt(storyWordCount, 10) || 100))} words.
- Output JSON ONLY (no markdown fences, no commentary).

JSON SHAPE:
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
 "meta":{"target_words_new":[${newWords.map(w => `"${w}"`).join(", ")}],"target_words_repetition":[${repList.map(w => `"${w}"`).join(", ")}]}
}

Use ONLY these lesson words: ${lessonWords.join(", ")}.
`.trim();

    UI.showLoader("الذكاء الاصطناعي يكتب قصتك…");
    try {
      const json = await callGeminiJSON(prompt, apiKey);
      // نُطلق حدثًا ليحفظه main-a1.js في السجل/التقدم
      document.dispatchEvent(new CustomEvent("lesson:ready", { detail: { lesson: json, isRevision, rewrite, newWords, repetitionWords } }));
      return json;
    } finally {
      UI.hideLoader();
    }
  }

  // ===== عرض الدرس (HTML) + تهيئة الصوت =====
  function renderLesson(container, lesson) {
    const el = typeof container === "string" ? document.getElementById(container) : container;
    if (!el) return;

    const storyHtml = (lesson.story || "").replace(/\n/g, "<br>");
    const section = (title, content) => `
      <div class="p-5 bg-white rounded-lg shadow-md">
        <h3 class="text-xl font-bold mb-4 text-sky-700">${title}</h3>
        ${content}
      </div>
    `;

    const table2 = (arr, h1, h2, k1, k2) => {
      if (!Array.isArray(arr) || !arr.length) return `<p class="text-slate-500">لا يوجد محتوى.</p>`;
      return `
        <div class="overflow-x-auto">
          <table class="table-style">
            <thead><tr><th>${h1}</th><th>${h2}</th></tr></thead>
            <tbody>
              ${arr.map(o => `<tr><td>${(o?.[k1] ?? "").toString()}</td><td>${(o?.[k2] ?? "").toString()}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      `;
    };

    const grammarHtml = (() => {
      const g = lesson.grammar_focus || {};
      const ar = g.explanation_ar || g.explanation || "";
      const en = g.explanation_en || "";
      let html = `
        <div class="grid md:grid-cols-2 gap-3 mb-4">
          <div><h4 class="font-bold text-sky-700 mb-1">${g.title || "Grammar"}</h4><p class="text-slate-700">${ar}</p></div>
          <div><h4 class="font-bold text-sky-700 mb-1">English note</h4><p class="text-slate-700 font-english" dir="ltr">${en}</p></div>
        </div>
      `;
      html += table2(g.examples || [], "المثال", "الترجمة", "example", "translation");
      return html;
    })();

    const pronHtml = (() => {
      const p = lesson.pronunciation_tips || {};
      return table2(p.tips || [], "السياق", "النصيحة", "context", "tip");
    })();

    el.innerHTML = `
      ${section("النص", `
        <div id="story-container" class="text-lg/relaxed font-english lesson-content" dir="ltr" data-mood="${lesson.story_mood || "neutral"}">${storyHtml}</div>
        <div id="story-audio-player" class="mt-4 border-t pt-4"></div>
      `)}
      ${section("الكلمات الجديدة", table2(lesson.new_words || [], "الكلمة", "المعنى", "word", "translation"))}
      ${section("قواعد", grammarHtml)}
      ${section("تراكيب مفيدة", table2(lesson.useful_structures || [], "التركيب", "الاستخدام", "structure", "explanation"))}
      ${section(lesson.pronunciation_tips?.title || "نصائح نطق", pronHtml)}
      ${section("تمارين", renderExercises(lesson.exercises))}
      <div class="flex flex-col sm:flex-row gap-4 justify-center mt-8">
        <button id="rewrite-lesson" class="bg-amber-500 text-white px-6 py-2 rounded-md hover:bg-amber-600 transition">أعد كتابة القصة بنفس الكلمات</button>
        <button id="next-lesson" class="bg-sky-600 text-white px-6 py-2 rounded-md hover:bg-sky-700 transition">درس جديد بكلمات جديدة</button>
      </div>
      <div class="max-w-md mx-auto space-y-4 my-6 text-right p-4 border rounded-md bg-slate-50">
        <h3 class="text-lg font-bold text-center">خيارات الدرس القادم</h3>
        <div>
          <label for="word-count-lesson" class="block text-sm font-medium text-slate-700">إجمالي كلمات القصة (50–500)</label>
          <input type="number" id="word-count-lesson" value="100" min="50" max="500" class="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm">
        </div>
        <div>
          <label for="custom-prompt-lesson" class="block text-sm font-medium text-slate-700">تعليمات للقصة (اختياري)</label>
          <textarea id="custom-prompt-lesson" rows="2" class="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm" placeholder="مثال: قصة لطيفة عن حديقة…"></textarea>
        </div>
      </div>
    `;

    // زِرّ إعادة الكتابة والانتقال للدرس التالي — نرسل أحداثًا يلتقطها main-a1.js
    el.querySelector("#rewrite-lesson")?.addEventListener("click", () => {
      const wc = parseInt(document.getElementById("word-count-lesson")?.value || "100", 10);
      const note = (document.getElementById("custom-prompt-lesson")?.value || "").trim();
      document.dispatchEvent(new CustomEvent("lesson:rewrite", { detail: { wordCount: wc, customInstructions: note, lastLesson: lesson } }));
    });
    el.querySelector("#next-lesson")?.addEventListener("click", () => {
      const wc = parseInt(document.getElementById("word-count-lesson")?.value || "100", 10);
      const note = (document.getElementById("custom-prompt-lesson")?.value || "").trim();
      document.dispatchEvent(new CustomEvent("lesson:next", { detail: { wordCount: wc, customInstructions: note, lastLesson: lesson } }));
    });

    // مشغّل صوت القصة (Gemini TTS عبر TTS.speak)
    initStoryAudioPlayer(lesson);
  }

  function renderExercises(exercises) {
    if (!Array.isArray(exercises) || !exercises.length) return `<p>لا توجد تمارين لهذا الدرس.</p>`;
    const html = exercises.map((ex, i) => {
      const type = ex.type || "fill_in_the_blank";
      const q = (ex.question || "...").replace(/\*\*/g, "");
      const ans = (ex.answer || "").toString();
      if (type === "multiple_choice" && Array.isArray(ex.options)) {
        return `
          <div class="exercise p-3 border-r-4 border-slate-200" data-answer="${ans.toLowerCase()}">
            <p class="font-english" dir="ltr">${i + 1}. ${q}</p>
            <div class="flex flex-wrap gap-2 mt-2" dir="ltr">
              ${ex.options.map(opt => `
                <label class="flex items-center gap-2 p-2 border rounded-md cursor-pointer">
                  <input type="radio" name="ex${i}" value="${opt}" class="exercise-input"> ${opt}
                </label>
              `).join("")}
            </div>
          </div>`;
      } else if (type === "true_false") {
        return `
          <div class="exercise p-3 border-r-4 border-slate-200" data-answer="${ans.toLowerCase()}">
            <p class="font-english" dir="ltr">${i + 1}. ${q}</p>
            <div class="flex gap-4 mt-2" dir="ltr">
              <label class="flex items-center gap-2 p-2 border rounded-md cursor-pointer"><input type="radio" name="ex${i}" value="true" class="exercise-input">True</label>
              <label class="flex items-center gap-2 p-2 border rounded-md cursor-pointer"><input type="radio" name="ex${i}" value="false" class="exercise-input">False</label>
            </div>
          </div>`;
      } else {
        return `
          <div class="exercise p-3 border-r-4 border-slate-200" data-answer="${ans.toLowerCase()}">
            <p class="font-english" dir="ltr">${i + 1}. ${q.replace("___", '<input type="text" class="exercise-input border-b-2 bg-transparent text-center w-24 mx-1">')}</p>
          </div>`;
      }
    }).join("");

    // زر التحقق
    setTimeout(() => {
      const host = document.getElementById("lesson-screen") || document;
      const btnId = "check-answers-btn";
      if (!host.querySelector(`#${btnId}`)) {
        const wrap = document.createElement("div");
        wrap.innerHTML = `<button id="${btnId}" class="mt-6 bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700">تحقق من الإجابات</button><div id="results-container" class="mt-4"></div>`;
        host.querySelector(".p-5.bg-white.rounded-lg.shadow-md:last-of-type")?.appendChild(wrap);
        host.querySelector(`#${btnId}`)?.addEventListener("click", checkAnswers);
      }
    }, 0);

    return `<div class="space-y-4">${html}</div>`;
  }

  function checkAnswers() {
    const root = document.getElementById("lesson-screen") || document;
    const exercises = root.querySelectorAll(".exercise");
    let correctCount = 0;

    exercises.forEach(ex => {
      const correctAnswer = ex.dataset.answer ? ex.dataset.answer.toLowerCase() : "";
      const inputs = ex.querySelectorAll(".exercise-input");
      ex.classList.remove("border-green-400", "border-red-400");

      if (inputs.length && inputs[0].type === "text") {
        const userAnswer = inputs[0].value.trim().toLowerCase();
        if (userAnswer === correctAnswer) {
          ex.classList.add("border-green-400"); correctCount++;
        } else { ex.classList.add("border-red-400"); }
      } else {
        let matched = false;
        inputs.forEach(input => {
          if (input.checked) {
            matched = true;
            const val = input.value.toLowerCase();
            if (val === correctAnswer) {
              ex.classList.add("border-green-400"); correctCount++;
            } else { ex.classList.add("border-red-400"); }
          }
        });
        if (!matched) ex.classList.add("border-red-400");
      }
    });

    const res = root.querySelector("#results-container");
    if (res) res.innerHTML = `<p class="font-bold">نتيجتك: ${correctCount} من ${exercises.length}.</p>`;
  }

  // ===== تهيئة الصوت =====
  function initStoryAudioPlayer(lesson) {
    const host = document.getElementById("story-audio-player");
    if (!host) return;

    const mood = lesson.story_mood || "neutral";
    const text = (lesson.story || "").replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();

    host.innerHTML = `
      <div class="flex items-center gap-3">
        <button id="play-story-btn" class="flex-shrink-0 p-3 bg-sky-600 text-white rounded-full hover:bg-sky-700 transition disabled:bg-slate-400">
          <span id="play-icon">▶</span>
          <span id="play-loader" class="hidden w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        </button>
        <button id="refresh-story-audio-btn" class="flex-shrink-0 p-3 bg-slate-500 text-white rounded-full hover:bg-slate-600 transition disabled:bg-slate-400">↻</button>
        <audio id="full-story-audio" class="w-full" controls></audio>
      </div>
      <div class="mt-2">
        <input type="text" id="audio-custom-prompt" class="w-full p-2 border rounded-md text-sm" placeholder="تعليمات للقارئ (مثال: بصوت هادئ)…">
      </div>
    `;

    const audioEl = host.querySelector("#full-story-audio");
    const btn = host.querySelector("#play-story-btn");
    const refresh = host.querySelector("#refresh-story-audio-btn");
    const icon = host.querySelector("#play-icon");
    const spinner = host.querySelector("#play-loader");

    audioEl.style.display = "none";

    async function genAndPlay() {
      try {
        icon.classList.add("hidden");
        spinner.classList.remove("hidden");
        btn.disabled = true; refresh.disabled = true;

        const note = host.querySelector("#audio-custom-prompt")?.value || "";
        // نستخدم TTS.speak (من tts.js) كما في الاستخدامات التي أعطيناك إياها
        const { url } = await window.TTS.speak(text, { mood, returnUrl: true, customPrompt: note });
        if (url) {
          audioEl.src = url;
          audioEl.style.display = "block";
          await audioEl.play().catch(() => {});
        }
      } finally {
        icon.classList.remove("hidden");
        spinner.classList.add("hidden");
        btn.disabled = false; refresh.disabled = false;
      }
    }

    btn.addEventListener("click", async () => {
      if (audioEl.src) { try { await audioEl.play(); } catch {} }
      else { await genAndPlay(); }
    });
    refresh.addEventListener("click", genAndPlay);
    audioEl.addEventListener("play", () => { btn.style.opacity = "0.6"; });
    audioEl.addEventListener("pause", () => { btn.style.opacity = "1"; });
  }

  // ===== خدمات مساعدة خارجية للصفحات الأخرى (اختياري) =====
  async function translate(text) {
    const apiKey = getApiKey();
    if (!apiKey) { UI.modal("الرجاء إدخال مفتاح Gemini أولاً."); return null; }
    const p = `Translate the English text "${text}" into a simple, direct Arabic equivalent. Provide only the translation, nothing else.`;
    try { return await callGeminiPlain(p, apiKey); } catch { UI.modal("تعذّرت الترجمة الآن."); return null; }
  }

  async function phonetics(text) {
    const apiKey = getApiKey();
    if (!apiKey) { UI.modal("الرجاء إدخال مفتاح Gemini أولاً."); return null; }
    const p = `اكتب النطق التقريبي لهذه الكلمة/الجملة الإنجليزية بحروف عربية مبسّطة فقط:\n"${text}"`;
    try { return await callGeminiPlain(p, apiKey); } catch { UI.modal("تعذّر جلب النطق الآن."); return null; }
  }

  // واجهة عامة
  window.LESSONS = Object.freeze({
    generate: generateLesson,
    render: renderLesson,
    translate,
    phonetics,
  });
})();
