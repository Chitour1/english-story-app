// assets/js/auth.js
(function () {
  const { GOOGLE, STORAGE } = window.APP_CONFIG;

  const SCOPES = GOOGLE.SCOPES.join(" ");
  const K = {
    HAS_CONSENT: STORAGE.PREFIX + "google_has_consent",
    ACCESS_TOKEN: STORAGE.PREFIX + "google_access_token",
    EXPIRES_AT: STORAGE.PREFIX + "google_expires_at",
  };

  let tokenClient = null;
  let initDone = false;

  function _set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  function _get(k, d = "") { try { const v = localStorage.getItem(k); return v ?? d; } catch { return d; } }

  function _setToken(token, expiresAtMs) {
    _set(K.ACCESS_TOKEN, token || "");
    _set(K.EXPIRES_AT, String(expiresAtMs || 0));
  }

  function _getToken() {
    const t = _get(K.ACCESS_TOKEN, "");
    const e = parseInt(_get(K.EXPIRES_AT, "0"), 10) || 0;
    return { token: t, exp: e };
  }

  function _hasValidToken() {
    const { token, exp } = _getToken();
    // هامش 30 ثانية قبل الانتهاء
    return Boolean(token) && Date.now() < (exp - 30_000);
  }

  function init() {
    if (initDone) return;
    initDone = true;

    // لو رجعنا يوماً بتصريح ضمن #fragment (كخطة احتياط) نظّف العنوان وخزّنه
    if (location.hash && location.hash.includes("access_token=")) {
      const p = new URLSearchParams(location.hash.slice(1));
      const at = p.get("access_token");
      const ex = parseInt(p.get("expires_in") || "3600", 10);
      if (at) _setToken(at, Date.now() + ex * 1000);
      history.replaceState({}, document.title, location.pathname + location.search);
    }

    // تحضير عميل Google Identity Services
    window.gisLoaded = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE.CLIENT_ID,
        scope: SCOPES,
        callback: _onTokenResponse,
      });
    };
    // إن كانت المكتبة محمّلة بالفعل
    if (window.google?.accounts?.oauth2) window.gisLoaded();
  }

  function _onTokenResponse(resp) {
    if (resp?.access_token) {
      // GIS لا يعيد expires_in هنا دائماً، نضبط 55 دقيقة افتراضياً
      _setToken(resp.access_token, Date.now() + 55 * 60 * 1000);
      _set(K.HAS_CONSENT, "1");
      // أخفِ شريط التنبيه إن وُجد
      window.UI?.hideBanner?.("signin");
      return;
    }
    if (resp?.error) {
      console.warn("GIS error:", resp.error);
      if (resp.error === "access_denied") _set(K.HAS_CONSENT, "0");
    }
  }

  async function ensureAccessToken() {
    init();
    if (_hasValidToken()) return _getToken().token;

    const hasConsentBefore = _get(K.HAS_CONSENT, "0") === "1";

    // لو لم يجهز العميل بعد (حالة تحميل بطيء)
    if (!tokenClient && window.google?.accounts?.oauth2) window.gisLoaded();
    if (!tokenClient) await new Promise(r => setTimeout(r, 150));

    return new Promise((resolve, reject) => {
      if (!tokenClient) return reject(new Error("GIS not loaded"));
      tokenClient.callback = (resp) => {
        if (resp?.access_token) return resolve(resp.access_token);
        return reject(new Error(resp?.error || "no_token"));
      };
      tokenClient.requestAccessToken({ prompt: hasConsentBefore ? "" : "consent" });
    });
  }

  // زر تفاعلي: مرة واحدة يفرض consent، ثم التجديد صامتاً
  function signInInteractive() {
    _set(K.HAS_CONSENT, "0"); // إجبار نافذة موافقة مرة واحدة إن لم تُمنح سابقاً
    return ensureAccessToken();
  }

  function signOut() {
    const { token } = _getToken();
    if (token && window.google?.accounts?.oauth2) {
      try { google.accounts.oauth2.revoke(token, () => {}); } catch {}
    }
    _setToken("", 0);
    _set(K.HAS_CONSENT, "0");
  }

  // استدعاء fetch مع توكن Drive جاهز + إعادة المحاولة الصامتة عند 401
  async function driveFetch(url, options = {}) {
    const at1 = await ensureAccessToken();
    const opts = { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${at1}` } };
    const res = await fetch(url, opts);
    if (res.status !== 401) return res;

    // إعادة محاولة صامتة مرّة واحدة
    _set(K.HAS_CONSENT, "1");
    const at2 = await ensureAccessToken();
    const opts2 = { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${at2}` } };
    return fetch(url, opts2);
  }

  window.Auth = {
    init,
    ensureAccessToken,
    signInInteractive,
    signOut,
    hasValidToken: _hasValidToken,
    driveFetch,
  };
})();
