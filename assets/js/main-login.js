// assets/js/main-login.js
// تسجيل الدخول يعمل حتى لو سكربتات Google لم تُحمَّل بعد.
// يحقن السكربتات تلقائياً ويستخدم APP_CONFIG للتوجيه.

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
  const signoutBtn  = $('#signout-btn');

  // ---------- أدوات تحميل سكربت ----------
  function loadScript(src, { timeout = 20000 } = {}) {
    return new Promise((resolve, reject) => {
      // إن كان محقونًا سابقًا
      if ([...document.scripts].some(s => s.src === src)) {
        resolve(); return;
      }
      const s = document.createElement('script');
      s.src = src; s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
      setTimeout(() => resolve(), timeout); // لا نعلّق للأبد
    });
  }

  // ---------- تهيئة gapi/gsi ----------
  let gapiReady = false, gisReady = false, tokenClient = null;

  async function ensureGapi() {
    if (gapiReady) return;
    if (!window.gapi || !window.gapi.load) {
      await loadScript('https://apis.google.com/js/api.js');
    }
    if (window.gapi?.load) {
      await new Promise((res) => {
        try {
          window.gapi.load('client', () => {
            window.gapi.client.init({}).then(() => {
              gapiReady = true; res();
            }).catch(() => { gapiReady = true; res(); });
          });
        } catch { res(); }
      });
    }
  }

  async function ensureGIS() {
    if (gisReady && tokenClient) return;
    if (!window.google?.accounts?.oauth2) {
      await loadScript('https://accounts.google.com/gsi/client');
    }
    if (window.google?.accounts?.oauth2) {
      try {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: G.CLIENT_ID || '',
          scope: SCOPES,
          callback: onTokenReceived,
        });
        gisReady = true;
        enableSignin(true);
      } catch {
        // يظل الزر مفعّل، لكن قد نحتاج إعادة المحاولة بعد قليل
      }
    }
  }

  // نوفّر دوال onload لمن اختار استعمالها في <script>
  window.gapiLoaded = () => { ensureGapi(); };
  window.gisLoaded  = () => { ensureGIS();  };

  // ---------- بعد الحصول على التوكن ----------
  async function onTokenReceived(resp) {
    if (resp?.error) return;
    try {
      window.gapi?.client?.setToken?.({ access_token: resp.access_token });

      // جلب ملف المستخدم (اختياري)
      try {
        const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${resp.access_token}` }
        });
        if (r.ok) {
          const p = await r.json();
          if (userName)  userName.textContent = p.given_name || p.name || '';
          if (userAvatar && p.picture) userAvatar.src = p.picture;
          userInfo?.classList.remove('hidden');
          signinBtn?.classList.add('hidden');
        }
      } catch {}

      // توجيه حسب وجود مفتاح Gemini
      if (hasApiKey()) gotoPage(PAGES.LEVELS || 'levels.html');
      else             gotoPage(PAGES.KEY    || 'key.html');

    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء إتمام تسجيل الدخول.');
    }
  }

  // ---------- ربط الواجهة ----------
  function enableSignin(isReady) {
    if (signinBtn) signinBtn.disabled = !isReady;
  }

  function bindSignin() {
    if (!signinBtn) return;
    signinBtn.addEventListener('click', async () => {
      // نضمن جاهزية المكتبات أولاً
      await Promise.all([ensureGIS(), ensureGapi()]);

      if (!tokenClient) {
        // محاولة ثانية سريعة: قد يكون السكربت وصل للتو
        await ensureGIS();
      }

      if (tokenClient) {
        try {
          tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch {
          alert('لم نتمكن من فتح نافذة تسجيل الدخول. تأكد أن النوافذ المنبثقة مسموحة للحظات وجرب ثانية.');
        }
      } else {
        alert('خدمات Google لم تجهز بعد. أعد المحاولة خلال ثوانٍ.');
      }
    });
  }

  function bindUserMenu() {
    if (userMenuBtn && userMenu) {
      userMenuBtn.addEventListener('click', () => userMenu.classList.toggle('hidden'));
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#user-info')) userMenu.classList.add('hidden');
      });
    }

    btnExport?.addEventListener('click', () => {
      try {
        const read = (k, fb=[]) =>
          (window.safeGetJson ? window.safeGetJson(k, fb) : JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)));
        const st = {
          wordsInProgress: read(STORE.IN_PROGRESS, []),
          learningBasket:  read(STORE.BASKET, []),
          lessonHistory:   read(STORE.HISTORY, [])
        };
        const blob = new Blob([JSON.stringify(st, null, 2)], { type: 'application/json' });
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

  function bindDataNav() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-nav]');
      if (!a) return;
      e.preventDefault();
      gotoPage(a.getAttribute('data-nav'));
    });
  }

  // ---------- تشغيل ----------
  async function init() {
    bindSignin();
    bindUserMenu();
    bindDataNav();

    // نبدأ التحميل المسبق بهدوء
    ensureGIS().then(() => enableSignin(!!tokenClient));
    ensureGapi();

    // إن كان هناك توكن سابق، نحول بهدوء بعد قليل
    setTimeout(() => {
      try {
        const tok = window.gapi?.client?.getToken?.();
        if (tok?.access_token) {
          if (hasApiKey()) gotoPage(PAGES.LEVELS || 'levels.html');
          else             gotoPage(PAGES.KEY    || 'key.html');
        }
      } catch {}
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
