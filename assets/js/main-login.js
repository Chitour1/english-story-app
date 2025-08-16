// assets/js/main-login.js
// يعمل مع APP_CONFIG (config.js) ويُهيّئ gapi/gsi تلقائياً سواء استخدمت onload في <script> أو لا.
// بعد نجاح الدخول: إن وُجد مفتاح Gemini في التخزين => levels.html وإلا => key.html

(function () {
  const CFG   = window.APP_CONFIG || {};
  const PAGES = CFG.PAGES || {};
  const STORE = CFG.STORAGE || {};
  const G     = CFG.GOOGLE  || {};

  const SCOPES = Array.isArray(G.SCOPES) ? G.SCOPES.join(' ') : (G.SCOPES || '');
  const gotoPage = (name) =>
    (window.goto ? window.goto(name) :
      (window.location.href = (window.buildUrl ? window.buildUrl(name) : name)));

  const hasApiKey = () => {
    try {
      const k = window.safeGet ? window.safeGet(STORE.API_KEY) : localStorage.getItem(STORE.API_KEY);
      return !!k;
    } catch { return false; }
  };

  const $ = (s, r=document) => r.querySelector(s);
  const signinBtn   = $('#signin-btn');
  const userInfo    = $('#user-info');
  const userName    = $('#user-name');
  const userAvatar  = $('#user-avatar');
  const userMenuBtn = $('#user-menu-btn');
  const userMenu    = $('#user-menu');
  const btnExport   = $('#btn-export');
  const importInput = $('#import-input');
  const btnReset    = $('#reset-progress-btn-menu');
  const signoutBtn  = $('#signout-btn');

  let gapiInited = false;
  let gisInited  = false;
  let tokenClient = null;
  let gapiPromise = null;
  let gisPromise  = null;

  // --- تهيئة gapi حتى لو لم نستخدم onload في <script> ---
  function ensureGapi() {
    if (gapiInited) return Promise.resolve();
    if (gapiPromise) return gapiPromise;

    gapiPromise = new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (window.gapi && window.gapi.load) {
          try {
            window.gapi.load('client', () => {
              window.gapi.client.init({}).then(() => {
                gapiInited = true;
                maybeEnableSignin();
                tryAutoRedirect();
                resolve();
              }).catch(() => { gapiInited = true; maybeEnableSignin(); resolve(); });
            });
          } catch { setTimeout(tick, 150); }
        } else if (Date.now() - start < 15000) {
          setTimeout(tick, 150);
        } else {
          resolve(); // لا نتوقف، نكمل بدون gapi (لن يعمل Drive لكن زر الدخول لن ينهار)
        }
      };
      tick();
    });
    return gapiPromise;
  }

  // --- تهيئة Google Identity Services (GIS) ---
  function ensureGIS() {
    if (gisInited && tokenClient) return Promise.resolve();
    if (gisPromise) return gisPromise;

    gisPromise = new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const oauth2 = window.google && window.google.accounts && window.google.accounts.oauth2;
        if (oauth2) {
          try {
            tokenClient = oauth2.initTokenClient({
              client_id: G.CLIENT_ID || '',
              scope: SCOPES,
              callback: onTokenReceived
            });
            gisInited = true;
            maybeEnableSignin();
            resolve();
          } catch { setTimeout(tick, 150); }
        } else if (Date.now() - start < 15000) {
          setTimeout(tick, 150);
        } else {
          resolve();
        }
      };
      tick();
    });
    return gisPromise;
  }

  // --- دعم onload في وسوم السكربت إن وُجدت ---
  window.gapiLoaded = () => { ensureGapi(); };
  window.gisLoaded  = () => { ensureGIS();  };

  // --- ما بعد استلام التوكن ---
  async function onTokenReceived(resp) {
    if (resp?.error) return;
    try {
      window.gapi?.client?.setToken?.({ access_token: resp.access_token });

      // تعبئة بيانات المستخدم (اختياري)
      try {
        const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${resp.access_token}` }
        });
        if (r.ok) {
          const profile = await r.json();
          if (userName) userName.textContent = profile.given_name || profile.name || '';
          if (userAvatar && profile.picture) userAvatar.src = profile.picture;
          userInfo?.classList.remove('hidden');
          signinBtn?.classList.add('hidden');
        }
      } catch {}

      // تحويل حسب وجود مفتاح Gemini
      if (hasApiKey()) gotoPage(PAGES.LEVELS || 'levels.html');
      else             gotoPage(PAGES.KEY    || 'key.html');
    } catch (e) {
      console.error('Token handling error:', e);
    }
  }

  // --- تمكين زر الدخول عند الجاهزية ---
  function maybeEnableSignin() {
    if (!signinBtn) return;
    const ready = !!tokenClient; // يكفي GIS لبدء الدخول
    signinBtn.disabled = !ready;
  }

  // --- تحويل تلقائي إن وُجد توكن سابق ---
  function tryAutoRedirect() {
    try {
      const tok = window.gapi?.client?.getToken?.();
      if (tok?.access_token) {
        if (hasApiKey()) gotoPage(PAGES.LEVELS || 'levels.html');
        else             gotoPage(PAGES.KEY    || 'key.html');
      }
    } catch {}
  }

  // --- ربط زر الدخول ---
  function bindSignin() {
    if (!signinBtn) return;
    signinBtn.addEventListener('click', async () => {
      await Promise.all([ensureGIS(), ensureGapi()]);
      if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        alert('خدمات Google لم تجهز بعد. أعد المحاولة خلال ثوانٍ.');
      }
    });
  }

  // --- قائمة المستخدم (اختياري) ---
  function bindUserMenu() {
    if (userMenuBtn && userMenu) {
      userMenuBtn.addEventListener('click', () => userMenu.classList.toggle('hidden'));
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#user-info')) userMenu.classList.add('hidden');
      });
    }

    btnExport?.addEventListener('click', () => {
      try {
        const read = (k, fb=[]) => (window.safeGetJson ? window.safeGetJson(k, fb) : JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)));
        const st = {
          wordsInProgress: read(STORE.IN_PROGRESS, []),
          learningBasket:  read(STORE.BASKET, []),
          lessonHistory:   read(STORE.HISTORY, [])
        };
        const blob = new Blob([JSON.stringify(st, null, 2)], { type:'application/json' });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'language_story_backup.json'; a.click();
        URL.revokeObjectURL(url);
      } catch {}
    });

    importInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const data = JSON.parse(fr.result);
          const setJson = (k,v)=> (window.safeSetJson ? window.safeSetJson(k, v) : localStorage.setItem(k, JSON.stringify(v||[])));
          if (Array.isArray(data.wordsInProgress)) setJson(STORE.IN_PROGRESS, data.wordsInProgress);
          if (Array.isArray(data.learningBasket))  setJson(STORE.BASKET,      data.learningBasket);
          if (Array.isArray(data.lessonHistory))   setJson(STORE.HISTORY,     data.lessonHistory);
          alert('تم الاستيراد بنجاح.');
        } catch { alert('ملف غير صالح.'); }
      };
      fr.readAsText(file);
    });

    signoutBtn?.addEventListener('click', () => {
      try {
        const tok = window.gapi?.client?.getToken?.();
        if (tok?.access_token) {
          window.google?.accounts?.oauth2?.revoke?.(tok.access_token, () => {
            window.gapi?.client?.setToken?.('');
            userInfo?.classList.add('hidden');
            signinBtn?.classList.remove('hidden');
            alert('تم تسجيل الخروج.');
          });
        }
      } catch {}
    });
  }

  // --- روابط data-nav للبطاقات ---
  function bindDataNav() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-nav]');
      if (!a) return;
      e.preventDefault();
      gotoPage(a.getAttribute('data-nav'));
    });
  }

  // --- تشغيل أولي ---
  async function init() {
    bindSignin();
    bindUserMenu();
    bindDataNav();

    // ابدأ التهيئة فورًا
    ensureGIS();
    ensureGapi();

    // محاولات تمكين الزر أثناء التحميل
    const i = setInterval(() => {
      maybeEnableSignin();
      if (gapiInited && gisInited && tokenClient) clearInterval(i);
    }, 150);

    // محاولة تحويل تلقائي بعد قليل إذا كان هناك توكن سابق
    setTimeout(tryAutoRedirect, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
