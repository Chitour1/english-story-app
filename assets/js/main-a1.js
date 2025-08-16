// assets/js/main-a1.js
// ربط واجهة مستوى A1 وإنشاء القصة

(function () {
  const CFG = window.APP_CONFIG;
  const STORAGE = CFG?.STORAGE || {};
  const UI = window.UI || {
    showLoader: (txt = "جاري التحميل…") => {
      const box = document.getElementById("screen-loader");
      const t = document.getElementById("screen-loader-text");
      if (t) t.textContent = txt;
      if (box) box.classList.remove("hidden");
    },
    hideLoader: () => document.getElementById("screen-loader")?.classList.add("hidden"),
    modal: (msg, title = "تنبيه") => alert(`${title}\n\n${msg}`)
  };

  // أداة آمنة للقراءة من التخزين
  const get = (k, d = null) => {
    try { return localStorage.getItem(k) ?? d; } catch { return d; }
  };
  const getJSON = (k, d = null) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; }
  };
  const setJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v || null)); } catch {} };

  // نقرأ المفتاح من نفس المفتاح الموحّد في config.js
  const getApiKey = () => get(STORAGE.API_KEY || "english_story_app__geminiApiKey", "");

  // كلمات A1 (يجب أن تكون مُحمّلة من state.js، لكن نوفر بديلًا مختصرًا إن لم تتوفر)
  const A1_WORDS = (window.A1_WORDS && Array.isArray(window.A1_WORDS) && window.A1_WORDS.length)
    ? window.A1_WORDS
    : ["a","an","about","above","across","action","activity","actor","actress","add","address","adult","advice","afraid","after","afternoon","again","age","ago","agree","air","airport","all","also","always","amazing","and","angry","animal","another","answer","any","anyone","anything","apartment","apple","April","area","arm","around","arrive","art","article","artist","as","ask","at","August","aunt","autumn","away","baby","back","bad","bag","ball","banana","band","bank","bath","bathroom","be","beach","beautiful","because","become","bed","bedroom","beer","before","begin","beginning","behind","believe","below","best","better","between","bicycle","big","bike","bill","bird","birthday","black","blog","blonde","blue","boat","body","book","boot","bored","boring","born","both","bottle","box","boy","boyfriend","bread","break","breakfast","bring","brother","brown","build","building","bus","business","busy","but","butter","buy","by","bye"];

  // اختيار كلمات الدرس ببساطة (20 كلمة عشوائية من A1)
  function pickA1Words(count = 20) {
    const pool = [...A1_WORDS];
    pool.sort(() => Math.random() - 0.5);
    return pool.slice(0, count);
  }

  // استدعاء Gemini وقراءة JSON بصرامة (مع تنظيف الأكواد)
  async function fetchLessonJSON({ apiKey, words, wordCount = 120, instructions = "" }) {
    const endpoint = (CFG?.GEMINI?.ENDPOINT || "https://generativelanguage.googleapis.com/v1beta/models");
    const model = (CFG?.GEMINI?.MODEL_TEXT || "gemini-2.5-flash-preview-05-20:generateContent");

    const prompt = `
You are an expert ESL teacher. Build one **valid JSON object** for an A1 Arabic-speaking learner.

STRICT:
- Only A1 grammar/vocab. Use the provided target words naturally (each at least once).
- Length ≈ ${wordCount} words.
- Follow user's note: "${(instructions || "No special instructions.").slice(0, 300)}"
- Output JSON ONLY (no markdown fences).

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
 "meta":{"target_words_new":[${words.map(w=>`"${w}"`).join(", ")}],"target_words_repetition":[]}
}
Use ONLY these words: ${words.join(", ")}.
    `.trim();

    const res = await fetch(`${endpoint}/${model}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`API ${res.status} – ${txt || "فشل الطلب"}`);
    }

    const data = await res.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    text = text.replace(/^```(?:json)?/gi, "").replace(/```$/g, "").trim();

    try {
      return JSON.parse(text);
    } catch (e) {
      // أحيانًا يرجع سطورًا إضافية؛ حاول إيجاد أول/آخر قوس
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) {
        const trimmed = text.slice(start, end + 1);
        return JSON.parse(trimmed);
      }
      throw new Error("تعذّر قراءة استجابة الذكاء الاصطناعي كـ JSON صالح.");
    }
  }

  // عرض النتيجة في الصفحة
  function renderLesson(lesson) {
    const container = document.getElementById("lesson-screen");
    if (!container) return;
    const storyHtml = (lesson.story || "").replace(/\n/g, "<br>");

    // جدول مساعد مبسّط
    const table = (arr, h1, h2, k1, k2) => {
      if (!Array.isArray(arr) || !arr.length) return "<p class='text-slate-500'>لا يوجد محتوى.</p>";
      return `
        <div class="overflow-x-auto">
          <table class="table-style">
            <thead><tr><th>${h1}</th><th>${h2}</th></tr></thead>
            <tbody>
              ${arr.map(o => `<tr><td>${o?.[k1] ?? ""}</td><td>${o?.[k2] ?? ""}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>`;
    };

    container.innerHTML = `
      <div class="p-5 bg-white rounded-lg shadow-md">
        <h3 class="text-xl font-bold mb-4 text-sky-700">النص</h3>
        <div class="lesson-content font-english" dir="ltr">${storyHtml}</div>
      </div>
      <div class="p-5 bg-white rounded-lg shadow-md mt-4">
        <h3 class="text-xl font-bold mb-4 text-sky-700">الكلمات الجديدة</h3>
        ${table(lesson.new_words || [], "الكلمة", "المعنى", "word", "translation")}
      </div>
      <div class="p-5 bg-white rounded-lg shadow-md mt-4">
        <h3 class="text-xl font-bold mb-4 text-sky-700">قواعد</h3>
        <div class="grid md:grid-cols-2 gap-3">
          <div>
            <h4 class="font-bold text-sky-700 mb-1">${lesson.grammar_focus?.title || ""}</h4>
            <p class="text-slate-700">${lesson.grammar_focus?.explanation_ar || ""}</p>
          </div>
          <div>
            <h4 class="font-bold text-sky-700 mb-1">English note</h4>
            <p class="text-slate-700 font-english" dir="ltr">${lesson.grammar_focus?.explanation_en || ""}</p>
          </div>
        </div>
        ${table(lesson.grammar_focus?.examples || [], "المثال", "الترجمة", "example", "translation")}
      </div>
      <div class="p-5 bg-white rounded-lg shadow-md mt-4">
        <h3 class="text-xl font-bold mb-4 text-sky-700">تراكيب مفيدة</h3>
        ${table(lesson.useful_structures || [], "التركيب", "الاستخدام", "structure", "explanation")}
      </div>
      <div class="p-5 bg-white rounded-lg shadow-md mt-4">
        <h3 class="text-xl font-bold mb-4 text-sky-700">${lesson.pronunciation_tips?.title || "نصائح نطق"}</h3>
        ${table(lesson.pronunciation_tips?.tips || [], "السياق", "النصيحة", "context", "tip")}
      </div>
    `;

    // أظهر القسم إن كان مخفيًا
    container.classList.remove("hidden");
    document.getElementById("home-screen")?.classList.add("hidden");

    // احفظ مختصرًا في سجل الدروس (اختياري)
    const historyKey = STORAGE.HISTORY || "english_story_app__lessonHistory";
    const history = getJSON(historyKey, []);
    history.unshift({ date: new Date().toISOString(), learnedWords: (lesson.meta?.target_words_new || []), story: lesson.story || "" });
    setJSON(historyKey, history.slice(0, 20));
  }

  async function handleCreateLesson() {
    const apiKey = getApiKey();
    if (!apiKey) {
      UI.modal("الرجاء إدخال مفتاح Gemini أولاً.", "مفتاح مفقود");
      // توجيه سريع لصفحة المفتاح
      if (window.buildUrl) window.location.href = window.buildUrl(window.APP_CONFIG.PAGES.KEY);
      return;
    }

    const countEl = document.getElementById("word-count-home");
    const promptEl = document.getElementById("custom-prompt-home");
    const wc = Math.max(50, Math.min(500, parseInt(countEl?.value || "120", 10)));
    const note = (promptEl?.value || "").trim();

    const words = pickA1Words(20);

    UI.showLoader("الذكاء الاصطناعي يكتب قصتك…");
    try {
      const json = await fetchLessonJSON({ apiKey, words, wordCount: wc, instructions: note });
      renderLesson(json);
    } catch (e) {
      console.error(e);
      UI.modal(e.message || "حدث خطأ أثناء إنشاء القصة.");
    } finally {
      UI.hideLoader();
    }
  }

  // ====== تهيئة الصفحة ======
  document.addEventListener("DOMContentLoaded", () => {
    // زر إنشاء القصة
    document.getElementById("new-lesson-btn")?.addEventListener("click", handleCreateLesson);

    // إن وُجد تبويب سجل/سلة.. إلخ، تجاهلها الآن — المهم زر الإنشاء
    // أظهر واجهة A1 الرئيسية
    document.getElementById("home-screen")?.classList.remove("hidden");
  });
})();
