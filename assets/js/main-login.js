// assets/js/main-login.js
// يعمل مع إعدادات APP_CONFIG (pages/storage/google) ودوال buildUrl/goto/safeGet.
// بعد الحصول على توكن Google:
//  - إن كان هناك مفتاح Gemini محفوظ في STORAGE.API_KEY => يوجّه إلى PAGES.LEVELS
//  - غير ذلك => يوجّه إلى PAGES.KEY

(function () {
  // ==== مراجع الإعدادات والدوال المساعدة من config.js ====
  const CFG   = window.APP_CONFIG || {};
  const PAGES = (CFG.PAGES   || {});
  const STORE = (CFG.STORAGE || {});
  const G     = (CFG.GOOGLE  || {});

  const gotoPage = (name) => window.goto ? window.goto(name) : (window.location.href = (window.buildUrl ? window.buildUrl(name) : name));
  const hasApiKey = () => !!(window.safeGet ? window.safeGet(STORE.API_KEY) : localStorage.getItem(STORE.API_KEY));

  // عناصر الواجهة (اختيارية للزينة)
  const qs = (s, r=document) => r.querySelector(s);
  const signinBtn   = qs('#signin-btn');
  const userInfo    = qs('#user-info');
  const userName    = qs('#user-name');
  const userAvatar  = qs('#user-avatar');
  const userMenuBtn = qs('#user-menu-btn');
  const userMenu    = qs('#user-menu');
  const btnExport   = qs('#btn-export');
  const importInput = qs('#import-input');
  const btnReset    = qs('#reset-progress-btn-menu');
  const signoutBtn  = qs('#signout-btn');

  // حالة تحميل Google
  let gapiInited = false;
  let gisInited  = false;
  let tokenClient = null;

  // تعريف callbacks عالمية لو تم استخدام onload في <script> داخل index.html
  window.gapiLoaded = async function gapiLoaded() {
    try {
      await window.gapi.load('client');
      await window.gapi.client.init({});
      gapiInited = true;
      maybeEnableSignin();
      tryAutoRedirect();
    } catch (_) {}
  };

  window.gisLoaded = function gisLoaded() {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: G.CLIENT_ID || '',
        scope: Array.isArray(G.SCOPES) ? G.SCOPES.join(' ') : (G.SCOPES || ''),
        callback: onTokenReceived
      });
      gisInited = true;
      maybeEnableSignin();
    } catch (_) {}
  };

  // استطلاع احتياطي إذا لم تُستدعِ onload
  const poll = setInterval(() => {
    if (!gapiInited && window.gapi?.client) {
      window.gapi.client.init({}).then(() => {
        gapiInited = true; maybeEnableSignin(); tryAutoRedirect();
      }).catch(()=>{});
    }
    if (!gisInited && window.google?.accounts?.oauth2) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: G.CLIENT_ID || '',
        scope: Array.isArray(G.SCOPES) ? G.SCOPES.join(' ') : (G.SCOPES || ''),
        callback: onTokenReceived
      });
      gisInited = true; maybeEnableSignin();
    }
    if (gapiInited && gisInited) clearInterval(poll);
  }, 150);

  // بعد استلام التوكن
  async function onTokenReceived(resp) {
    if (resp?.error) return;
    try {
      window.gapi?.client?.setToken?.({ access_token: resp.access_token });

      // تعبئة بطاقة المستخدم (اختياري)
      try {
        const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${resp.access_token}` }
        });
        if (r.ok) {
          const profile = await r.json();
          if (userName)  userName.textContent = profile.given_name || profile.name || '';
          if (userAvatar && profile.picture) userAvatar.src = profile.picture;
          userInfo?.classList.remove('hidden');
          signinBtn?.classList.add('hidden');
        }
      } catch (_) {}

      // تحويل بحسب وجود مفتاح Gemini
      if (hasApiKey()) gotoPage(PAGES.LEVELS);
      else gotoPage(PAGES.KEY);
    } catch (e) {
      console.error('Token handling error', e);
    }
  }

  function maybeEnableSignin() {
    if (signinBtn) signinBtn.disabled = !(gapiInited && gisInited && tokenClient);
  }

  // إن كان هناك توكن مسبقًا (عودة من جلسة سابقة) نحول فورًا
  function tryAutoRedirect() {
    try {
      const tok = window.gapi?.client?.getToken?.();
      if (tok?.access_token) {
        if (hasApiKey()) gotoPage(PAGES.LEVELS);
        else gotoPage(PAGES.KEY);
      }
    } catch (_) {}
  }

  // ربط زر "تسجيل الدخول مع Google"
  function bindSignin() {
    if (!signinBtn) return;
    signinBtn.addEventListener('click', () => {
      if (!tokenClient) {
        // إعادة محاولة هادئة لاحقًا بدل تنبيه مزعج
        setTimeout(() => tokenClient?.requestAccessToken?.({ prompt: 'consent' }), 300);
        return;
      }
      tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  // قائمة المستخدم (اختياري)
  function bindUserMenu() {
    if (userMenuBtn && userMenu) {
      userMenuBtn.addEventListener('click', () => userMenu.classList.toggle('hidden'));
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#user-info')) userMenu.classList.add('hidden');
      });
    }

    btnExport?.addEventListener('click', () => {
      try {
        const read = (k) => (window.safeGetJson ? window.safeGetJson(k, []) : JSON.parse(localStorage.getItem(k) || '[]'));
        const st = {
          wordsInProgress: read(STORE.IN_PROGRESS),
          masteredWords:   read(STORE.PREFIX + 'masteredWords'), // إن لم تكن موجودة لديك تجاهلها
          learningBasket:  read(STORE.BASKET),
          lessonHistory:   read(STORE.HISTORY),
        };
        const blob = new Blob([JSON.stringify(st, null, 2)], { type:'application/json' });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'language_story_backup.json'; a.click();
        URL.revokeObjectURL(url);
      } catch (_) {}
    });

    importInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const data = JSON.parse(fr.result);
          const setJson = (k, v) => (window.safeSetJson ? window.safeSetJson(k, v) : localStorage.setItem(k, JSON.stringify(v||[])));
          setJson(STORE.IN_PROGRESS, Array.isArray(data.wordsInProgress) ? data.wordsInProgress : []);
          setJson(STORE.BASKET,      Array.isArray(data.learningBasket)  ? data.learningBasket  : []);
          setJson(STORE.HISTORY,     Array.isArray(data.lessonHistory)   ? data.lessonHistory   : []);
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
      } catch (_) {}
    });
  }

  // روابط data-nav
  function bindDataNav() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-nav]');
      if (!a) return;
      e.preventDefault();
      const page = a.getAttribute('data-nav');
      if (page) gotoPage(page);
    });
  }

  function init() {
    bindSignin();
    bindUserMenu();
    bindDataNav();
    // محاولة تحويل تلقائي إن كان التوكن موجودًا
    setTimeout(tryAutoRedirect, 200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
