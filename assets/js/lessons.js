// assets/js/lessons.js
// يعتمد على: window.APP_CONFIG, window.STATE, window.UI, window.TTS
// يوفّر الواجهة العامة: window.LESSONS

(function () {
  const CFG = window.APP_CONFIG;
  const ENDPOINT = CFG.GEMINI.ENDPOINT;                  // "https://generativelanguage.googleapis.com/v1beta/models"
  const MODEL_TEXT = CFG.GEMINI.MODEL_TEXT;              // "gemini-2.5-flash-preview-05-20:generateContent"

  // ========== أدوات عامة ==========
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const stripHtml = (t = "") => t.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();

  function createSection(title, contentHtml) {
    return `
      <div class="p-5 bg-white rounded-lg shadow-md">
        <h3 class="text-xl font-bold mb-4 text-sky-700">${title}</h3>
        ${contentHtml}
      </div>
    `;
  }

  function createTable(data, headers, key1, key2) {
    if (!Array.isArray(data) || data.length === 0) return '<p class="text-slate-500">لا يوجد محتوى هنا.</p>';
    let tableHTML = '<div class="overflow-x-auto"><table class="w-full border-collapse">';
    tableHTML += `<thead><tr>
      <th class="border p-2 bg-slate-50">${headers[0]}</th>
      <th class="border p-2 bg-slate-50">${headers[1]}</th>
    </tr></thead><tbody>`;
    data.forEach(item => {
      const a = (item?.[key1] ?? '').toString();
      const b = (item?.[key2] ?? '').toString();
      tableHTML += `<tr>
        <td class="border p-2">${a}</td>
        <td class="border p-2">${b}</td>
      </tr>`;
    });
    tableHTML += '</tbody></table></div>';
    return tableHTML;
  }

  function renderGrammarSection(grammar) {
    if (!grammar) return '<p>لا توجد ملاحظات نحوية لهذا الدرس.</p>';
    const ar = grammar.explanation_ar || grammar.explanation || '';
    const en = grammar.explanation_en || '';
    let html = `
      <h4 class="font-bold text-lg mb-2">${grammar.title || 'Grammar'}</h4>
      <div class="grid md:grid-cols-2 gap-3 mb-4">
        <div><h5 class="font-bold text-sky-700 mb-1">شرح بالعربية</h5><p class="text-slate-700">${ar}</p></div>
        <div><h5 class="font-bold text-sky-700 mb-1">English note</h5><p class="text-slate-700 font-english" dir="ltr">${en}</p></div>
      </div>
    `;
    if (Array.isArray(grammar.examples) && grammar.examples.length) {
      html += createTable(grammar.examples, ['المثال', 'الترجمة'], 'example', 'translation');
    }
    return html;
  }

  function wrapWordsInSpans(htmlContent) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const textNodes = [];
    while (node = walker.nextNode()) {
      const parentTag = (node.parentNode?.tagName || "").toUpperCase();
      if (parentTag !== 'B' && parentTag !== 'I' && parentTag !== 'SPAN' && parentTag !== 'SCRIPT' && parentTag !== 'STYLE') {
        textNodes.push(node);
      }
    }

    textNodes.forEach(node => {
      const parent = node.parentNode;
      const words = node.nodeValue.split(/(\s+)/);
      const fragment = document.createDocumentFragment();
      words.forEach(word => {
        if (word.trim().length > 0) {
          const span = document.createElement('span');
          span.className = 'word-span';
          span.textContent = word;
          fragment.appendChild(span);
        } else {
          fragment.appendChild(document.createTextNode(word));
        }
      });
      parent.replaceChild(fragment, node);
    });

    return tempDiv.innerHTML;
  }

  function formatStory(story, storyType) {
    const wrapped = wrapWordsInSpans(story || "");
    if (storyType !== 'dialogue') return wrapped;

    const speakers = [];
    const lines = wrapped.split(/\n|<br>|<br\/>/g);
    return lines.map(line => {
      if (!line.trim()) return '';
      const match = line.match(/^(.*?):/);
      if (match) {
        let speaker = match[1].replace(/<[^>]*>?/gm, '').trim();
        let speakerClass = 'dialogue-speaker-1 font-bold text-blue-700';
        if (!speakers.includes(speaker)) speakers.push(speaker);
        if (speakers.indexOf(speaker) % 2 !== 0) speakerClass = 'dialogue-speaker-2 font-bold text-pink-700';
        const rest = line.substring(match[0].length);
        return `<div class="dialogue-line mb-2"><span class="${speakerClass}">${speaker}:</span>${rest}</div>`;
      }
      return `<div class="dialogue-line mb-2">${line}</div>`;
    }).join('');
  }

  function renderExercises(exercises) {
    if (!Array.isArray(exercises) || !exercises.length)
      return '<p>لا توجد تمارين لهذا الدرس.</p>';
    let html = '<div class="space-y-4">';
    exercises.forEach((ex, index) => {
      const type = ex.type || 'fill_in_the_blank';
      const cleanQuestion = (ex.question || '...').replace(/\*\*/g, '');
      const answer = (ex.answer || '').toString();
      html += `<div class="exercise p-3 border-r-4 border-slate-200" data-answer="${answer.toLowerCase()}">`;
      if (type === 'multiple_choice' && Array.isArray(ex.options)) {
        html += `<p class="font-english" dir="ltr">${index + 1}. ${cleanQuestion}</p>
          <div class="flex flex-wrap gap-2 mt-2" dir="ltr">
          ${ex.options.map(opt => `<label class="flex items-center gap-2 p-2 border rounded-md cursor-pointer"><input type="radio" name="ex${index}" value="${opt}" class="exercise-input"> ${opt}</label>`).join('')}
          </div>`;
      } else if (type === 'true_false') {
        html += `<p class="font-english" dir="ltr">${index + 1}. ${cleanQuestion}</p>
          <div class="flex gap-4 mt-2" dir="ltr">
            <label class="flex items-center gap-2 p-2 border rounded-md cursor-pointer"><input type="radio" name="ex${index}" value="true" class="exercise-input">True</label>
            <label class="flex items-center gap-2 p-2 border rounded-md cursor-pointer"><input type="radio" name="ex${index}" value="false" class="exercise-input">False</label>
          </div>`;
      } else {
        html += `<p class="font-english" dir="ltr">${index + 1}. ${cleanQuestion.replace('___', '<input type="text" class="exercise-input border-b-2 bg-transparent text-center w-24 mx-1">')}</p>`;
      }
      html += `</div>`;
    });
    html += '</div><button id="check-answers-btn" class="mt-6 bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700">تحقق من الإجابات</button><div id="results-container" class="mt-4"></div>';
    return html;
  }

  function checkAnswers(container) {
    const root = container || document;
    const exercises = qsa('.exercise', root);
    let correctCount = 0;
    exercises.forEach(ex => {
      const correct = ex.dataset.answer ? ex.dataset.answer.toLowerCase() : '';
      const inputs = qsa('.exercise-input', ex);
      ex.classList.remove('border-green-400', 'border-red-400');

      if (inputs.length > 0 && inputs[0].type === 'text') {
        const user = (inputs[0].value || '').trim().toLowerCase();
        if (user === correct) {
          ex.classList.add('border-green-400'); correctCount++;
        } else { ex.classList.add('border-red-400'); }
      } else {
        let answered = false;
        inputs.forEach(input => {
          if (input.checked) {
            answered = true;
            const user = (input.value || '').toLowerCase();
            if (user === correct) {
              ex.classList.add('border-green-400'); correctCount++;
            } else { ex.classList.add('border-red-400'); }
          }
        });
        if (!answered) ex.classList.add('border-red-400');
      }
    });
    const res = qs('#results-container', root);
    if (res) res.innerHTML = `<p class="font-bold">نتيجتك: ${correctCount} من ${exercises.length} إجابات صحيحة.</p>`;
  }

  // ========== تفاعل القصة: ترجمة/نطق/حفظ ==========
  function attachStoryInteractions(container) {
    if (!container) return;

    // Popup صغير أعلى التحديد
    let selectionPopup = qs('#selection-popup');
    if (!selectionPopup) {
      selectionPopup = document.createElement('div');
      selectionPopup.id = 'selection-popup';
      selectionPopup.className = 'hidden absolute bg-white border rounded-lg shadow-xl p-1 flex gap-1 z-50';
      selectionPopup.innerHTML = `
        <button id="popup-translate" title="ترجمة" class="p-2 hover:bg-slate-100 rounded-md">🇹🇷</button>
        <button id="popup-speak" title="نطق" class="p-2 hover:bg-slate-100 rounded-md">🔊</button>
        <button id="popup-phonetics" title="كتابة صوتية" class="p-2 hover:bg-slate-100 rounded-md">🗣️</button>
        <button id="popup-save" title="حفظ للسلة" class="p-2 hover:bg-slate-100 rounded-md">💾</button>
      `;
      document.body.appendChild(selectionPopup);
    }

    let isDragging = false;

    const endHandler = (event) => {
      setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (isDragging && selectedText.length > 0) {
          if (event.type === 'touchend') event.preventDefault();
          showSelectionPopup(selection);
        } else if (!isDragging && event.target.closest('.word-span, b, i')) {
          const target = event.target.closest('.word-span, b, i');
          const text = target.textContent.trim().replace(/[.,!?;:]/g, '');
          if (text) {
            showWordModal(text);
          }
        }
        isDragging = false;
      }, 10);
    };

    container.addEventListener('mousedown', () => { isDragging = false; });
    container.addEventListener('mousemove', () => { isDragging = true; });
    container.addEventListener('mouseup', endHandler);
    container.addEventListener('touchstart', () => { isDragging = false; }, { passive: true });
    container.addEventListener('touchmove', () => { isDragging = true; }, { passive: true });
    container.addEventListener('touchend', endHandler);

    function showSelectionPopup(selection) {
      const selectedText = selection.toString().trim();
      if (!selectedText) return;

      const rect = selection.getRangeAt(0).getBoundingClientRect();
      const popup = selectionPopup;
      popup.classList.remove('hidden');

      const vw = window.innerWidth, vh = window.innerHeight;
      const pw = popup.offsetWidth || 160, ph = popup.offsetHeight || 40;
      let left = rect.left + (rect.width / 2) - (pw / 2);
      let top = rect.top - ph - 10;

      if (top < 8) top = rect.bottom + 10;
      if (left < 8) left = 8;
      if (left + pw > vw - 8) left = vw - pw - 8;

      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;

      const mood = container?.dataset?.mood || 'neutral';
      popup.querySelector('#popup-translate').onclick = () => { translate(selectedText); popup.classList.add('hidden'); };
      popup.querySelector('#popup-speak').onclick = () => { TTS.speak(selectedText, { mood }); };
      popup.querySelector('#popup-phonetics').onclick = async () => {
        const p = await phonetics(selectedText);
        if (p) UI.openModal({ title: `النطق التقريبي لـ: <span class="font-english text-xl">${selectedText}</span>`, html: `<p class="text-xl font-bold text-sky-600">${p}</p>` });
        popup.classList.add('hidden');
      };
      popup.querySelector('#popup-save').onclick = async () => {
        const tr = await translate(selectedText, true);
        if (tr) { STATE.addToBasket(selectedText, tr); UI.showToast('تمت إضافة الكلمة إلى سلة المراجعة', { type: 'success' }); }
        popup.classList.add('hidden');
      };
    }

    async function showWordModal(text) {
      const mood = container?.dataset?.mood || 'neutral';
      UI.openModal({
        title: `<span class="font-english text-3xl">${text}</span>`,
        html: `<div class="flex justify-center"><div class="mx-auto mb-2 w-10 h-10 rounded-full border-4 border-slate-200 border-t-sky-600 animate-spin"></div></div>`
      });
      const tr = await translate(text, false);
      if (!tr) {
        UI.openModal({ title: `<span class="font-english text-3xl">${text}</span>`, html: "<p>لم نتمكن من العثور على ترجمة.</p>" });
        return;
      }
      UI.openModal({
        title: `<span class="font-english text-3xl">${text}</span>`,
        html: `<p class="text-2xl font-bold text-sky-600">${tr}</p>`,
        actions: [
          { text: '🔊 نطق', class: 'px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700', keepOpen: true, onClick: () => TTS.speak(text, { mood }) },
          { text: '🗣️ كتابة صوتية', class: 'px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700', onClick: async () => {
              const p = await phonetics(text);
              if (p) UI.openModal({ title: `النطق التقريبي لـ: <span class="font-english text-xl">${text}</span>`, html: `<p class="text-xl font-bold text-sky-600">${p}</p>` });
            }
          },
          { text: '💾 حفظ للمراجعة', class: 'px-4 py-2 rounded-md bg-amber-500 text-white hover:bg-amber-600', onClick: () => {
              STATE.addToBasket(text, tr);
              UI.showToast('تم الحفظ في سلة المراجعة', { type: 'success' });
            }
          }
        ]
      });
    }
  }

  // ========== Gemini: ترجمات/فونيتكس/إنشاء درس ==========
  async function callGeminiSimple(prompt) {
    const apiKey = STATE.getApiKey();
    if (!apiKey) { UI.showToast('الرجاء حفظ مفتاح Gemini أولاً.', { type: 'warning' }); return null; }
    const url = `${ENDPOINT}/${MODEL_TEXT}?key=${encodeURIComponent(apiKey)}`;
    const body = { contents: [{ parts: [{ text: prompt }] }] };

    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      let msg = "API Error";
      try { const j = await res.json(); msg = JSON.stringify(j).slice(0, 300); } catch {}
      UI.showToast(`خطأ من الذكاء الاصطناعي:\n${msg}`, { type: 'error', timeout: 4000 });
      return null;
    }
    const data = await res.json();
    let t = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return t.replace(/^```(?:json)?/gi, '').replace(/```$/, '').trim();
  }

  async function translate(text, silent = false) {
    const prompt = `Translate the English text "${text}" into a simple, direct Arabic equivalent. Provide only the translation, nothing else.`;
    const t = await callGeminiSimple(prompt);
    if (t && !silent) {
      UI.openModal({
        title: `ترجمة: <span class="font-english">${text}</span>`,
        html: `<p class="text-xl font-bold text-sky-600">${t}</p>`,
        actions: [{ text: '💾 حفظ للمراجعة', class: 'px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700', onClick: () => { STATE.addToBasket(text, t); UI.showToast('تم الحفظ', { type: 'success' }); } }]
      });
    }
    return t;
  }

  async function phonetics(text) {
    const prompt = `اكتب النطق التقريبي لهذه الكلمة أو الجملة الإنجليزية باستخدام حروف عربية مبسطة. فقط أعط النطق ولا شيء آخر. النص هو: "${text}"`;
    return await callGeminiSimple(prompt);
  }

  async function generateLesson({ newWords = [], repetitionWords = [], rewrite = false, isRevision = false, storyWordCount = 100, customInstructions = '' } = {}) {
    const apiKey = STATE.getApiKey();
    if (!apiKey) { UI.showToast('الرجاء حفظ مفتاح Gemini أولاً.', { type: 'warning' }); return null; }

    UI.showLoader(isRevision ? 'تحضير مراجعة…' : 'إنشاء درس جديد…');

    const lessonWords = [...newWords, ...repetitionWords.map(w => w.word || w)];
    const repetitionWordsList = repetitionWords.map(w => w.word || w);

    const prompt = `
You are a veteran ESL teacher. Build a **single valid JSON object** for an A1 Arabic-speaking learner.

STRICT RULES:
- Vocabulary & grammar = A1 only. Present Simple, "can", be/there is/there are. No conditionals, no perfect/continuous, no advanced modals.
- Use ONLY the provided target words naturally (use each at least once). New words = <b>…</b>, repetition = <i>…</i>.
- Follow the user's request exactly: "${(customInstructions || 'No specific instructions.').slice(0,300)}"
- Length ≈ ${storyWordCount} words.
- Output JSON ONLY (no backticks, no markdown).

JSON SHAPE:
{
 "story_type": "story|dialogue|narrative",
 "story_mood": "happy|calm|exciting|neutral",
 "story": "Text with <b>new</b> and <i>repetition</i> tags.",
 "new_words": [{"word":"cat","translation":"قطة"}],
 "grammar_focus": {
  "title": "Present Simple - be",
  "explanation_en": "Very short, simple English explanation.",
  "explanation_ar": "شرح عربي مختصر جدًا للمبتدئ.",
  "examples": [{"example":"I am a student.","translation":"أنا طالب."}]
 },
 "useful_structures": [{"structure":"I like ...","explanation":"أقول ما أحب."}],
 "pronunciation_tips": {
  "title":"A1 Sounds",
  "tips":[{"context":"th","tip":"انطقها مثل 'ذ' في العربية عند الكلمات: this, that."}]
 },
 "exercises":[
  {"type":"fill_in_the_blank","question":"I ___ a student.","answer":"am"},
  {"type":"multiple_choice","question":"He has a ___","options":["dog","rice","tea"],"answer":"dog"},
  {"type":"true_false","question":"They are in the school.","answer":"true"}
 ],
 "meta":{
  "target_words_new": [${newWords.map(w=>`"${w}"`).join(', ')}],
  "target_words_repetition": [${repetitionWordsList.map(w=>`"${w}"`).join(', ')}]
 }
}
Use ONLY these lesson words: ${lessonWords.join(', ')}.
Highlight NEW with <b> and REPETITION with <i>.
`.trim();

    try {
      const url = `${ENDPOINT}/${MODEL_TEXT}?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      const result = await res.json();
      let text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      const jsonString = text.replace(/^```(?:json)?/gi, '').replace(/```$/, '').trim();
      const lessonData = JSON.parse(jsonString);

      // تحديث الحالة
      if (isRevision) {
        STATE.markRepetitionBatchDone(repetitionWordsList);
        lessonData.learnedWords = repetitionWordsList;
      } else if (!rewrite) {
        newWords.forEach(w => STATE.addToInProgress(w));        // يبدأ تتبّعها
        repetitionWords.forEach(rep => STATE.incrementReview(rep.word || rep)); // عدّادات المراجعة
        lessonData.learnedWords = lessonWords;
      }

      // حفظ في السجل
      STATE.addLessonToHistory({
        story_type: lessonData.story_type,
        story_mood: lessonData.story_mood,
        story: lessonData.story,
        new_words: lessonData.new_words,
        grammar_focus: lessonData.grammar_focus,
        useful_structures: lessonData.useful_structures,
        pronunciation_tips: lessonData.pronunciation_tips,
        exercises: lessonData.exercises,
        meta: lessonData.meta
      });

      UI.hideLoader();
      return lessonData;
    } catch (e) {
      console.error('Error generating lesson:', e);
      UI.hideLoader();
      UI.showToast('حدث خطأ أثناء إنشاء الدرس. تأكد من مفتاح API أو حاول لاحقًا.', { type: 'error', timeout: 4000 });
      return null;
    }
  }

  // ========== عرض الدرس ==========
  function renderLesson(containerSelector, data, { isRevision = false } = {}) {
    const container = typeof containerSelector === 'string' ? qs(containerSelector) : containerSelector;
    if (!container) return;

    const lessonTitle = isRevision ? 'مراجعة النص' : '1. النص';
    const wordsTitle  = isRevision ? 'كلمات للمراجعة' : '2. الكلمات الجديدة';
    const storyText   = stripHtml(data.story || "");

    // خيارات الدرس القادم
    const optionsHtml = `
      <div class="max-w-md mx-auto space-y-4 my-6 text-right p-4 border rounded-md bg-slate-50">
        <h3 class="text-lg font-bold text-center">خيارات الدرس القادم</h3>
        <div>
          <label for="word-count-lesson" class="block text-sm font-medium text-slate-700">إجمالي كلمات القصة (تقريبيًا 50-500)</label>
          <input type="number" id="word-count-lesson" value="100" min="50" max="500" class="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm">
        </div>
        <div>
          <label for="custom-prompt-lesson" class="block text-sm font-medium text-slate-700">تعليمات للقصة (اختياري)</label>
          <textarea id="custom-prompt-lesson" rows="2" class="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm" placeholder="مثال: قصة عن حيوانات في حديقة..."></textarea>
        </div>
      </div>
    `;

    container.innerHTML = `
      ${createSection(lessonTitle, 
        `<div id="story-container" class="text-lg/relaxed font-english lesson-content" dir="ltr" data-mood="${data.story_mood || 'neutral'}">${formatStory(data.story, data.story_type)}</div>
         <div id="story-audio-player" class="mt-4 border-t pt-4">
            <div class="flex items-center gap-3">
              <button id="play-story-btn" class="flex-shrink-0 p-3 bg-sky-600 text-white rounded-full hover:bg-sky-700 transition">
                ▶
              </button>
              <button id="refresh-story-audio-btn" class="hidden flex-shrink-0 p-3 bg-slate-500 text-white rounded-full hover:bg-slate-600 transition">
                ⟳
              </button>
              <audio id="full-story-audio" class="w-full hidden" controls></audio>
            </div>
            <div class="mt-2">
              <input type="text" id="audio-custom-prompt" class="w-full p-2 border rounded-md text-sm" placeholder="اكتب تعليمات للقارئ (مثال: اقرأ بصوت هادئ)...">
            </div>
         </div>`
      )}
      ${createSection(wordsTitle, createTable(data.new_words, ['الكلمة', 'المعنى'], 'word', 'translation'))}
      ${createSection('3. قواعد نستفيدها', renderGrammarSection(data.grammar_focus))}
      ${createSection('4. تراكيب مفيدة', createTable(data.useful_structures, ['التركيب', 'الاستخدام'], 'structure', 'explanation'))}
      ${createSection(data.pronunciation_tips?.title || '5. نصائح للنطق', createTable((data.pronunciation_tips || {}).tips || [], ['الكلمة/الحرف', 'النصيحة'], 'context', 'tip'))}
      ${createSection('6. تمارين', renderExercises(data.exercises))}
      <div class="flex flex-col sm:flex-row gap-4 justify-center mt-8">
        <button id="rewrite-btn" class="bg-amber-500 text-white px-6 py-2 rounded-md hover:bg-amber-600 transition">أعد كتابة القصة بنفس الكلمات</button>
        <button id="next-lesson-btn" class="bg-sky-600 text-white px-6 py-2 rounded-md hover:bg-sky-700 transition">درس جديد بكلمات جديدة</button>
      </div>
      ${optionsHtml}
    `;

    // أحداث الصوت
    const audioEl    = qs('#full-story-audio', container);
    const playBtn    = qs('#play-story-btn', container);
    const refreshBtn = qs('#refresh-story-audio-btn', container);

    async function generateAndPlay() {
      playBtn.disabled = true; refreshBtn.disabled = true;
      const custom = qs('#audio-custom-prompt', container)?.value || "";
      const res = await TTS.speakStory(storyText, { mood: data.story_mood || 'neutral', audioSelector: audioEl, customPrompt: custom });
      playBtn.disabled = false; refreshBtn.disabled = false;
      if (res?.ok) { playBtn.classList.add('hidden'); refreshBtn.classList.remove('hidden'); }
    }

    playBtn.addEventListener('click', async () => {
      if (audioEl.src) { try { await audioEl.play(); } catch{} }
      else { await generateAndPlay(); }
    });
    refreshBtn.addEventListener('click', async () => { await generateAndPlay(); });

    // فحص التمارين
    qs('#check-answers-btn', container)?.addEventListener('click', () => checkAnswers(container));

    // أزرار إعادة الكتابة/الدرس الجديد (يتم تنفيذها من خارج الصفحة الرئيسية عبر main-a1.js عادةً)
    // لكن نترك callbacks يمكن لملفات main-* ربطها:
    container.dataset.lessonReady = "1";

    // تفاعل القصة (ترجمة/نطق/حفظ)
    attachStoryInteractions(qs('#story-container', container));
  }

  // ========== API العام ==========
  window.LESSONS = {
    generateLesson,    // يعيد كائن الدرس أو null
    renderLesson,      // يرسم الدرس داخل عنصر محدد
    attachStoryInteractions,
    translate,         // ترجمة سريعة
    phonetics,         // كتابة صوتية
  };
})();
