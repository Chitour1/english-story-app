// assets/js/common.js
// يحاول إنشاء جلسة Google "صامتة" في كل صفحة (ما عدا index) قبل تطبيق الحماية.
// يدعم GitHub Pages (APP_BASE) ويعتمد على GOOGLE.CLIENT_ID + SCOPES من config.js.

(function () {
  const $ = (s, r=document) => r.querySelector(s);

  function CFG()    { return window.APP_CONFIG || {}; }
  function PAGES()  { return (CFG().PAGES   || {}); }
  function STORE()  { return (CFG().STORAGE || {}); }
  function GOOGLE() { return (CFG().GOOGLE  || {}); }

  function buildUrl(page) {
    try { return (window.buildUrl ? window.buildUrl(page) : `${(CFG().APP_BASE||'').replace(/\/+$/,'')}/${page}`); }
    catch { return page; }
  }
  function goto(page) {
    try { window.location.href = buildUrl(page); }
    catch { window.location.href = page; }
  }

  function loadScript(src) {
    return new Promise((resolve) => {
      if ([...document.scripts].some(s => s.src === src)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
      setTimeout(resolve, 15000); // مهلة أمان
    });
  }

  async function ensureConfig(maxWaitMs = 5000) {
    if (GOOGLE().CLIENT_ID) return true;
    // حمّل config.js مع cache-buster لتفادي كاش GitHub Pages
    const cb = Math.floor(Date.now()/60000);
    await loadScript(`assets/js/config.js?v=${cb}`);
    const start = Date.now();
    return await new Promise((res) => {
      const t = setInterval(() => {
        if (GOOGLE().CLIENT_ID) { clearInterval(t); res(true); }
        else if (Date.now()-start > maxWaitMs) { clearInterval(t); res(false); }
      }, 60);
    });
  }

  async function ensureGIS() {
    if (!window.google?.accounts?.oauth2) {
      await loadScript('https://accounts.google.com/gsi/client');
    }
    return !!window.google?.accounts?.oauth2;
  }

  async function ensureGapi() {
    if (!window.gapi?.load) {
      await loadScript('https://apis.google.com/js/api.js');
    }
    if (window.gapi?.load) {
      try {
        await new Promise((res) => window.gapi.load('client', () =>
          window.gapi.client.init({}).then(res).catch(res)
        ));
      } catch {}
    }
  }

  function gapiHasToken() {
    try { return !!window.gapi?.client?.getToken?.(); } catch { return false; }
  }

  async function acquireTokenSilently() {
    const G = GOOGLE();
    const SCOPES = Array.isArray(G.SCOPES) ? G.SCOPES.join(' ') : (G.SCOPES || '');
    const okGIS = await ensureGIS();
    await ensureGapi();
    if (!okGIS || !G.CLIENT_ID) return false;

    return await new Promise((resolve) => {
      try {
        const tc = window.google.accounts.oauth2.initTokenClient({
          client_id: G.CLIENT_ID,
          scope: SCOPES,
          callback: (resp) => {
            if (resp?.access_token) {
              try { window.gapi?.client?.setToken?.({ access_token: resp.access_token }); } catch {}
              sessionStorage.setItem('__esa_google_ok', '1');
              resolve(true);
            } else {
              resolve(false);
            }
          }
        });
        // طلب صامت بلا prompt — إن كانت هناك جلسة Google مفتوحة سيعطي توكن
        tc.requestAccessToken({ prompt: '' });
      } catch {
        resolve(false);
      }
    });
  }

  async function isLoggedIn() {
    if (!await ensureConfig()) return false;
    if (gapiHasToken()) return true;
    // جرّب تسجيل دخول صامت لمرة
    const tried = sessionStorage.getItem('__esa_tried_silent') === '1';
    if (!tried) {
      sessionStorage.setItem('__esa_tried_silent','1');
      const ok = await acquireTokenSilently();
      if (ok) return true;
    }
    return gapiHasToken();
  }

  async function guard() {
    const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const isIndex = (page === '' || page === 'index.html');

    // لا حراسة على صفحة index
    if (isIndex) return;

    const ok = await isLoggedIn();
    if (!ok) {
      // إن لم ننجح في إنشاء الجلسة الصامتة، نعيدك لـ index لتسجّل دخولك يدويًا
      goto(PAGES().INDEX || 'index.html');
      return;
    }
    // logged in — تابع عادي
  }

  // واجهة بسيطة لو احتجتها من ملفات أخرى
  window.Auth = {
    isLoggedIn,
    guard,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guard);
  else guard();
})();
