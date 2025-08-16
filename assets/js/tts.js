// assets/js/tts.js
// يعتمد على: window.APP_CONFIG, window.STATE, window.UI
// يوفّر الواجهة العامة: window.TTS

(function () {
  const CFG = window.APP_CONFIG;
  const MODEL_TTS = CFG.GEMINI.MODEL_TTS;     // "gemini-2.5-flash-preview-tts:generateContent"
  const ENDPOINT  = CFG.GEMINI.ENDPOINT;      // "https://generativelanguage.googleapis.com/v1beta/models"

  // أصوات جاهزة (Prebuilt)
  const PREBUILT_VOICES = Object.freeze([
    'Zephyr','Puck','Charon','Kore','Fenrir','Leda','Orus','Aoede','Callirrhoe','Autonoe',
    'Enceladus','Iapetus','Umbriel','Algieba','Despina','Erinome','Algenib','Rasalgethi',
    'Laomedeia','Achernar','Alnilam','Schedar','Gacrux','Pulcherrima','Achird',
    'Zubenelgenubi','Vindemiatrix','Sadachbia','Sadaltager','Sulafat'
  ]);

  // أدوات داخلية
  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const stripHtml = (t = "") => t.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();

  function base64ToBlobUrl(base64, mime = "audio/wav") {
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    return URL.createObjectURL(blob);
  }

  function ensureAudioEl(selectorOrEl) {
    if (!selectorOrEl) return null;
    if (typeof selectorOrEl === "string") {
      const el = document.querySelector(selectorOrEl);
      return el || null;
    }
    return selectorOrEl;
  }

  // استدعاء واجهة Gemini TTS
  async function requestTTS({ text, mood = "neutral", voiceName, customPrompt }) {
    const apiKey = window.STATE?.getApiKey?.();
    if (!apiKey) throw new Error("API key missing. احفظ مفتاح Gemini أولاً.");

    const finalVoice = voiceName && PREBUILT_VOICES.includes(voiceName) ? voiceName : pickRandom(PREBUILT_VOICES);
    const cleaned = stripHtml(text || "");
    const prompt = customPrompt
      ? `Read the following text with these instructions: "${customPrompt}". The text is: ${cleaned}`
      : (mood && mood !== "neutral" ? `Say in a ${mood} tone: ${cleaned}` : cleaned);

    const url = `${ENDPOINT}/${MODEL_TTS}?key=${encodeURIComponent(apiKey)}`;

    const body = {
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: finalVoice } }
        }
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const info = await safeJson(res);
      throw new Error(`TTS API Error ${res.status}${info ? `: ${info}` : ""}`);
    }
    const data = await res.json();
    const b64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) throw new Error("لم يصل صوت صالح من واجهة TTS.");
    return { b64, voice: finalVoice };
  }

  async function safeJson(res) {
    try { const j = await res.json(); return JSON.stringify(j).slice(0, 300); }
    catch { return null; }
  }

  // واجهة عليا: تُرجع رابط صوت (blob:) أو تشغّله مباشرةً
  async function speak(text, {
    mood = "neutral",
    voiceName = undefined,
    customPrompt = "",
    returnUrl = false,
    audioEl = null, // اختياري: عنصر <audio> موجود
    showErrors = true,
  } = {}) {
    try {
      const { b64, voice } = await requestTTS({ text, mood, voiceName, customPrompt });
      const url = base64ToBlobUrl(b64, "audio/wav");
      if (returnUrl) return url;

      const el = ensureAudioEl(audioEl);
      if (el) {
        el.src = url;
        el.classList.remove("hidden");
        await el.play();
      } else {
        // تشغيل سريع بدون عنصر
        const audio = new Audio(url);
        await audio.play();
      }

      return { ok: true, url, voice };
    } catch (e) {
      console.error("TTS error:", e);
      if (showErrors && window.UI?.showToast) {
        window.UI.showToast(`تعذّر تشغيل الصوت:\n${e.message || e}`, { type: "error", timeout: 3500 });
      }
      return { ok: false, error: e };
    }
  }

  // واجهة مختصرة لقراءة “نص القصة” مع عنصر Audio في الصفحة
  async function speakStory(storyHtmlOrText, {
    mood = "neutral",
    voiceName = undefined,
    audioSelector = "#full-story-audio",
    customPrompt = "",
    returnUrl = false,
  } = {}) {
    const text = stripHtml(storyHtmlOrText || "");
    return await speak(text, { mood, voiceName, customPrompt, returnUrl, audioEl: audioSelector });
  }

  // API العامة
  window.TTS = {
    voices: PREBUILT_VOICES,
    speak,       // TTS.speak("text", {mood, voiceName, customPrompt, returnUrl, audioEl})
    speakStory,  // TTS.speakStory(htmlOrText, {mood, voiceName, audioSelector, customPrompt, returnUrl})
  };
})();
