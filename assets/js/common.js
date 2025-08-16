// assets/js/common.js
// محاولـة تسجيل دخول صامتة عبر Google GIS في الخلفية,
// بدون أي إعادة توجيه قسرية. عند عدم تسجيل الدخول نعرض شريط تنبيه فقط.

(function () {
  const $ = (s, r=document) => r.querySelector(s);

  const CFG    = window.APP_CONFIG || {};
  const PAGES  = (CFG.PAGES   || {});
  const GOOGLE = (CFG.GOOGLE  || {});

  // صفحات لا تحتاج تسجيل دخول إطلاقًا
  const NO_GUARD_PAGES = new Set([
    (PAGES.INDEX   || 'index.html').toLowerCase(),
    (PAGES.KEY     || 'key.html').toLowerCase(),
    (PAGES.LEVELS  || 'levels.html').toLowerCase(),
    (PAGES.A1      || 'level-a1.html').toLowerCase(),
    (PAGES.NOT_FOUND || '404.html').toLowerCase(),
  ]);

  function buildUrl(page){
    try { return window.buildUrl ? window.buildUrl(page) : page; }
    catch { return page; }
  }

  // تحميل سكريبت خارجي إن لم يكن محمّلًا
  function loadScript(src) {
    return new Promise((resolve) => {
      if ([...document.scripts].some(s => s.src === src)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.async = true; s.defer = true;
      s.onload = resolve; s.onerror = resolve;
      document.head.appendChild(s);
      // مهلة أمان
      setTimeout(resolve, 12000);
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

  async function trySilentLoginOnce() {
    if (!GOOGLE.CLIENT_ID) return false;
    const okGIS = await ensureGIS();
    await ensureGapi();
    if (!okGIS) return false;

    return await new Promise((resolve) => {
      try {
        const scopes = Array.isArray(GOOGLE.SCOPES) ? GOOGLE.SCOPES.join(' ') : (GOOGLE.SCOPES || '');
        const tc = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE.CLIENT_ID,
          scope: scopes,
          callback: (resp) => {
            if (resp?.access_token) {
              try { window.gapi?.client?.setToken?.({ access_token: resp.access_token }); } catch {}
              sessionStorage.setItem('__esa_google_ok', '1');
              resolve(true);
            } else {
              resolve(false);
            }
          },
        });
        tc.requestAccessToken({ prompt: '' }); // صامت
      } catch {
        resolve(false);
      }
    });
  }

  async function isLoggedIn() {
    if (gapiHasToken()) return true;

    const tried = sessionStorage.getItem('__esa_tried_silent') === '1';
    if (!tried) {
      sessionStorage.setItem('__esa_tried_silent', '1');
      const ok = await trySilentLoginOnce();
      if (ok) return true;
    }
    return gapiHasToken();
  }

  function showAuthBanner() {
    if (document.getElementById('esa-auth-banner')) return;

    const bar = document.createElement('div');
    bar.id = 'esa-auth-banner';
    bar.dir = 'rtl';
    bar.className =
      'fixed top-0 inset-x-0 z-50 bg-amber-50 text-amber-900 border-b border-amber-200';
    bar.innerHTML = `
      <div class="container mx-auto max-w-4xl px-4 py-2 flex items-center justify-between gap-3">
        <div class="text-sm">
          لست مُسجّلًا في Google حاليًا — <b>تقدّمك لن يُحفَظ على Google Drive</b>.
        </div>
        <div class="flex items-center gap-2">
          <a href="${buildUrl(PAGES.INDEX || 'index.html')}"
             class="px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 text-sm">
             تسجيل الدخول لحفظ التقدّم
          </a>
          <button type="button" id="esa-auth-banner-close"
            class="px-2 py-1 text-sm border rounded-md hover:bg-amber-100">إخفاء</button>
        </div>
      </div>`;
    document.body.appendChild(bar);
    $('#esa-auth-banner-close')?.addEventListener('click', () => bar.remove());
  }

  async function guard() {
    // اسم الصفحة الحالي
    const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

    // لا نعيد التوجيه على الإطلاق — حتى الصفحات المحمية مسموح بها،
    // فقط نُظهر شريط تنبيه إن لم يكن هناك تسجيل.
    // (هذا يمنع الارتداد الذي شاهدته).
    // نحاول تسجيلًا صامتًا في الخلفية:
    isLoggedIn().then((ok) => {
      if (!ok) showAuthBanner();
    });

    // لا شيء آخر — اترك الصفحة تعمل.
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guard);
  else guard();

  // واجهة بسيطة إن احتجتها:
  window.Auth = { isLoggedIn };
})();
