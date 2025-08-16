// assets/js/main-login.js
// زر تسجيل الدخول يعمل حتى لو لم تُحمَّل مكتبات Google بعد.
// بعد الدخول: إن وُجد مفتاح Gemini => levels.html وإلا => key.html

(function () {
  const CFG   = window.APP_CONFIG || {};
  const PAGES = CFG.PAGES || {};
  const STORE = CFG.STORAGE || {};
  const G     = CFG.GOOGLE  || {};

  const SCOPES = Array.isArray(G.SCOPES) ? G.SCOPES.join(' ') : (G.SCOPES || '');

  const $ = (s, r=document) => r.querySelector(s);
  const signinBtn  = $('#signin-btn');
  const userInfo   = $('#user-info');
  const userName   = $('#user-name');
  const userAvatar = $('#user-avatar');

  const gotoPage = (name) =>
    (window.goto ? window.goto(name) :
      (window.location.href = (window.buildUrl ? window.buildUrl(name) : name)));

  const hasApiKey = () => {
    try { return !!(window.safeGet ? window.safeGet(STORE.API_KEY) : localStorage.getItem(STORE.API_KEY)); }
    catch { return false; }
  };

  // ---------- تحميل السكربتات عند الحاجة ----------
  function loadScript(src) {
    return new Promise((resolve) => {
      if ([...document.scripts].some(s => s.src === src)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => resolve();            // لا نعلّق في الخطأ
      document.head.appendChild(s);
      setTimeout(resolve, 15000);             // مهلة أمان
    });
  }

  // ---------- GIS (الأساسي لتسجيل الدخول) ----------
  let tokenClient = null;

  async function ensureGIS() {
    if (tokenClient) return tokenClient;
    if (!window.google?.accounts?.oauth2) {
      await loadScript('https://accounts.google.com/gsi/client');
    }
    if (!window.google?.accounts?.oauth2) return null;

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: G.CLIENT_ID || '',
      scope: SCOPES,
      callback: onTokenReceived,
    });
    return tokenClient;
  }

  // ---------- GAPI (اختياري فقط لضبط التوكن داخليًا) ----------
  async function ensureGapi() {
    if (!window.gapi?.load) {
      await loadScript('https://apis.google.com/js/api.js');
    }
    if (window.gapi?.load) {
      try {
        await new Promise((res) => window.gapi.load('client', () => window.gapi.client.init({}).then(res).catch(res)));
      } catch {}
    }
  }

  // callbacks لو كنت تضع onload في index.html
  window.gisLoaded  = () => ensureGIS();
  window.gapiLoaded = () => ensureGapi();

  // ---------- بعد استلام التوكن ----------
  async function onTokenReceived(resp) {
    if (resp?.error) return;
    try {
      window.gapi?.client?.setToken?.({ access_token: resp.access_token });

      // نملأ الاسم/الصورة (اختياري)
      try {
        const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${resp.access_token}` }
        });
        if (r.ok) {
          const p = await r.json();
          if (userName)  userName.textContent = p.given_name || p.name || '';
          if (userAvatar && p.picture) userAvatar.src = p.picture;
          userInfo?.classList?.remove('hidden');
          signinBtn?.classList?.add('hidden');
        }
      } catch {}

      // توجيه
      if (hasApiKey()) gotoPage(PAGES.LEVELS || 'levels.html');
      else             gotoPage(PAGES.KEY    || 'key.html');

    } catch {
      alert('حدث خطأ أثناء إتمام تسجيل الدخول.');
    }
  }

  // ---------- زر الدخول ----------
  async function signInNow() {
    // نضمن المكتبتين (GIS أولًا لأنه الأهم)
    await ensureGIS();
    await ensureGapi();

    if (!tokenClient) {
      alert('خدمات Google لم تجهز بعد. جرّب خلال ثوانٍ.');
      return;
    }
    try {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch {
      alert('تعذّر فتح نافذة تسجيل الدخول. اسمح بالنوافذ المنبثقة ثم جرّب ثانية.');
    }
  }

  // نجعلها متاحة أيضًا للـ onclick في الزر إن لزم
  window.__signinNow = signInNow;

  function init() {
    if (signinBtn) {
      signinBtn.disabled = false;
      signinBtn.addEventListener('click', signInNow);
    }
    // تحميل مسبق هادئ
    ensureGIS();
    ensureGapi();

    // تحويل تلقائي لو كان لديك توكن سابق
    setTimeout(() => {
      try {
        const tok = window.gapi?.client?.getToken?.();
        if (tok?.access_token) {
          if (hasApiKey()) gotoPage(PAGES.LEVELS || 'levels.html');
          else             gotoPage(PAGES.KEY    || 'key.html');
        }
      } catch {}
    }, 600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
