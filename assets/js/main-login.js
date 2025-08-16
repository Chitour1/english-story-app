// assets/js/main-login.js
// نسخة مبسّطة ومضمونة لزر الدخول: لا تعتمد على gapi ولا onload.
// عند الضغط: نحقن مكتبة GIS إن لزم، ثم نطلب التوكن، ثم نوجّه حسب وجود مفتاح Gemini.

(function () {
  const CFG   = window.APP_CONFIG || {};
  const PAGES = (CFG.PAGES   || {});
  const STORE = (CFG.STORAGE || {});
  const G     = (CFG.GOOGLE  || {});

  const SCOPES = Array.isArray(G.SCOPES) ? G.SCOPES.join(' ') : (G.SCOPES || '');
  const $ = (s, r=document) => r.querySelector(s);

  const btn = $('#signin-btn');
  const userInfo   = $('#user-info');
  const userName   = $('#user-name');
  const userAvatar = $('#user-avatar');

  const goto = (name) => {
    try {
      if (window.goto) return window.goto(name);
      const url = window.buildUrl ? window.buildUrl(name) : name;
      window.location.href = url;
    } catch { window.location.href = name; }
  };

  const hasApiKey = () => {
    try {
      if (window.safeGet) return !!window.safeGet(STORE.API_KEY);
      return !!localStorage.getItem(STORE.API_KEY);
    } catch { return false; }
  };

  // تحميل مكتبة Google Identity إن لزم
  function loadGIS() {
    return new Promise((resolve) => {
      if (window.google?.accounts?.oauth2) { resolve(); return; }
      if ([...document.scripts].some(s => s.src.includes('accounts.google.com/gsi/client'))) {
        // السكربت موجود وسيتحمّل بعد قليل
        const check = setInterval(() => {
          if (window.google?.accounts?.oauth2) { clearInterval(check); resolve(); }
        }, 100);
        setTimeout(() => { clearInterval(check); resolve(); }, 15000);
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => resolve(); // لا نعلّق لو فشل
      document.head.appendChild(s);
      setTimeout(resolve, 15000);
    });
  }

  // طلب التوكن وتوجيه المستخدم
  async function startSignIn() {
    if (!G.CLIENT_ID) {
      alert('CLIENT_ID غير مضبوط في assets/js/config.js');
      return;
    }

    // نضمن تحميل مكتبة GIS
    await loadGIS();

    if (!window.google?.accounts?.oauth2) {
      alert('تعذّر تحميل خدمة Google. حدّث الصفحة ثم جرّب ثانية.');
      return;
    }

    let tokenClient;
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: G.CLIENT_ID,
        scope: SCOPES,
        callback: async (resp) => {
          if (resp?.error) return;

          // ملء بيانات المستخدم (اختياري للتجربة البصرية)
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

          // التوجيه النهائي
          if (hasApiKey()) goto(PAGES.LEVELS || 'levels.html');
          else             goto(PAGES.KEY    || 'key.html');
        }
      });
    } catch (e) {
      alert('فشل تهيئة Google OAuth.'); return;
    }

    try {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch {
      alert('المتصفح منع النافذة المنبثقة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم اضغط الزر مرة أخرى.');
    }
  }

  // نعرّف الدالة عالميًا كاحتياط وتفعيل الزر
  window.__signinNow = startSignIn;

  function init() {
    if (btn) {
      btn.disabled = false;
      // نستعمل كلٍ من onclick والـ addEventListener للاحتياط
      btn.onclick = startSignIn;
      btn.addEventListener('click', startSignIn);
    }

    // تحويل تلقائي صامت إن كان المستخدم مسجّل سابقًا ولديه مفتاح
    setTimeout(() => {
      try {
        if (hasApiKey() && sessionStorage.getItem('__signedOnce')) {
          goto(PAGES.LEVELS || 'levels.html');
        }
      } catch {}
    }, 600);

    // علامة جلسة بعد أول ضغط
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'signin-btn') {
        try { sessionStorage.setItem('__signedOnce', '1'); } catch {}
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
