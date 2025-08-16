// assets/js/main-login.js
// يضمن وجود APP_CONFIG.GOOGLE.CLIENT_ID حتى لو تأخر/لم يُحمّل config.js (مع cache-buster)
// ثم يفتح تسجيل الدخول عبر Google Identity (GIS) ويوجّه حسب وجود مفتاح Gemini.

(function () {
  const $ = (s, r=document) => r.querySelector(s);

  const btn        = $('#signin-btn');
  const userInfo   = $('#user-info');
  const userName   = $('#user-name');
  const userAvatar = $('#user-avatar');

  // ---------------- helpers ----------------
  function getCFG() { return window.APP_CONFIG || {}; }
  function getGOOG(){ return (getCFG().GOOGLE || {}); }
  function getPAGES(){ return (getCFG().PAGES || {}); }
  function getSTORE(){ return (getCFG().STORAGE || {}); }
  function hasApiKey() {
    const k = getSTORE().API_KEY || '';
    try { return !!(window.safeGet ? window.safeGet(k) : localStorage.getItem(k)); } catch { return false; }
  }
  function goto(page) {
    try {
      if (window.goto) return window.goto(page);
      const url = window.buildUrl ? window.buildUrl(page) : page;
      window.location.href = url;
    } catch { window.location.href = page; }
  }

  function loadScript(src) {
    return new Promise((resolve) => {
      if ([...document.scripts].some(s => s.src === src)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
      setTimeout(resolve, 15000);
    });
  }

  async function ensureConfig(maxWaitMs = 5000) {
    // إذا كان CLIENT_ID موجودًا نعود مباشرة
    if (getGOOG().CLIENT_ID) return true;

    // جرّب تحميل config.js يدويًا مع cache-buster
    const cacheBust = Math.floor(Date.now() / 60000); // تتغير كل دقيقة
    await loadScript(`assets/js/config.js?v=${cacheBust}`);

    // انتظر حتى يظهر CLIENT_ID
    const start = Date.now();
    return await new Promise((resolve) => {
      const timer = setInterval(() => {
        if (getGOOG().CLIENT_ID) { clearInterval(timer); resolve(true); }
        else if (Date.now() - start > maxWaitMs) { clearInterval(timer); resolve(false); }
      }, 60);
    });
  }

  async function ensureGIS() {
    if (!window.google?.accounts?.oauth2) {
      await loadScript('https://accounts.google.com/gsi/client');
    }
    return !!window.google?.accounts?.oauth2;
  }

  // ---------------- sign-in flow ----------------
  async function startSignIn() {
    btn && (btn.disabled = true);

    // 1) تأكد من config.js و CLIENT_ID
    const okCfg = await ensureConfig();
    const G = getGOOG();
    const SCOPES = Array.isArray(G.SCOPES) ? G.SCOPES.join(' ') : (G.SCOPES || '');

    if (!okCfg || !G.CLIENT_ID) {
      alert('CLIENT_ID غير مضبوط في assets/js/config.js.\nتأكد من لصق CLIENT_ID الصحيح ثم حدِّث الصفحة (Ctrl+F5).');
      btn && (btn.disabled = false);
      return;
    }

    // 2) حمّل Google Identity
    const okGIS = await ensureGIS();
    if (!okGIS) {
      alert('تعذّر تحميل خدمة Google. حدِّث الصفحة ثم جرّب ثانية.');
      btn && (btn.disabled = false);
      return;
    }

    // 3) افتح نافذة الموافقة ووجّه
    let tokenClient;
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: G.CLIENT_ID,
        scope: SCOPES,
        callback: async (resp) => {
          if (resp?.error) { btn && (btn.disabled = false); return; }

          // تعبئة اسم/صورة (اختياري)
          try {
            const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${resp.access_token}` }
            });
            if (r.ok) {
              const p = await r.json();
              if (userName)  userName.textContent = p.given_name || p.name || '';
              if (userAvatar && p.picture) userAvatar.src = p.picture;
              userInfo?.classList?.remove('hidden');
              btn?.classList?.add('hidden');
            }
          } catch {}

          const PAGES = getPAGES();
          if (hasApiKey()) goto(PAGES.LEVELS || 'levels.html');
          else             goto(PAGES.KEY    || 'key.html');
        }
      });
    } catch {
      alert('فشل تهيئة Google OAuth.');
      btn && (btn.disabled = false);
      return;
    }

    try {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch {
      alert('تم منع النافذة المنبثقة. اسمح بها لهذا الموقع ثم اضغط الزر مرة أخرى.');
      btn && (btn.disabled = false);
    }
  }

  // متاح أيضًا بالـ onclick الاحتياطي
  window.__signinNow = startSignIn;

  function init() {
    if (btn) {
      btn.disabled = false;
      btn.onclick = startSignIn;
      btn.addEventListener('click', startSignIn);
    }
    // تحميل مسبق صامت
    ensureConfig();
    loadScript('https://accounts.google.com/gsi/client');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
