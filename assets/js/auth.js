// assets/js/auth.js
// طبقة موحّدة للدخول عبر Google + إدارة التوكن عبر localStorage

(function () {
  const CFG = (window.APP_CONFIG && window.APP_CONFIG.GOOGLE) || {};
  const STORAGE = (window.APP_CONFIG && window.APP_CONFIG.STORAGE) || {};
  const PREFIX = STORAGE.PREFIX || "english_story_app__";

  const K = {
    TOKEN: PREFIX + "google_access_token",
    EXPIRES_AT: PREFIX + "google_expires_at",
    GRANTED: PREFIX + "google_granted", // "1" بعد الموافقة الأولى
    USER: PREFIX + "google_user",
  };

  // حالة داخلية
  let tokenClient = null;
  let _token = safeGet(K.TOKEN, "");
  let _expiresAt = Number(safeGet(K.EXPIRES_AT, "0")) || 0;
  let _granted = safeGet(K.GRANTED, "0") === "1";
  let _initStarted = false;

  // ========= أدوات مساعدة =========
  function now() { return Date.now(); }
  function safeGet(k, d = "") { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
  function safeSet(k, v) { try { localStorage.setItem(k, String(v)); } catch {} }
  function safeDel(k) { try { localStorage.removeItem(k); } catch {} }

  function hasValidToken() {
    return !!_token && now() < (_expiresAt - 60 * 1000); // هامش دقيقة
  }

  // انتظار تحميل مكتبة GIS
  function waitForGIS() {
    return new Promise((resolve) => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        resolve(); return;
      }
      let tries = 0;
      const t = setInterval(() => {
        tries++;
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
          clearInterval(t); resolve();
        } else if (tries > 200) { // ~10 ثوانٍ
          clearInterval(t); resolve();
        }
      }, 50);
    });
  }

  // تهيئة العميل
  async function init() {
    if (_initStarted) return;
    _initStarted = true;
    await waitForGIS();

    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: (CFG.CLIENT_ID || "").trim(),
        scope: Array.isArray(CFG.SCOPES) ? CFG.SCOPES.join(" ") : (CFG.SCOPES || ""),
        callback: handleTokenResponse,
        error_callback: (err) => console.warn("GIS error:", err),
      });
    }
  }

  // حفظ حالة التوكن
  function setToken(resp) {
    _token = resp.access_token;
    const expiresIn = Number(resp.expires_in || 3600);
    _expiresAt = now() + (expiresIn * 1000);
    _granted = true;

    safeSet(K.TOKEN, _token);
    safeSet(K.EXPIRES_AT, String(_expiresAt));
    safeSet(K.GRANTED, "1");
  }

  // ردّ GIS
  function handleTokenResponse(resp) {
    if (resp && resp.access_token) {
      setToken(resp);
      // تحديث المستخدم اختياري
      fetchUserProfile().catch(() => {});
    } else if (resp && resp.error) {
      console.warn("GIS token error:", resp.error);
    }
  }

  // محاولة صامتة للحصول على توكن (بعد موافقة سابقة)
  function requestSilent() {
    return new Promise((resolve, reject) => {
      if (!tokenClient) return reject(new Error("GIS not ready"));
      tokenClient.callback = (resp) => {
        if (resp && resp.access_token) { setToken(resp); resolve(_token); }
        else reject(new Error(resp && resp.error ? resp.error : "silent_failed"));
      };
      tokenClient.requestAccessToken({ prompt: "" }); // بدون نوافذ
    });
  }

  // طلب تفاعلي (أول مرّة فقط أو عند الحاجة)
  function requestInteractive() {
    return new Promise((resolve, reject) => {
      if (!tokenClient) return reject(new Error("GIS not ready"));
      tokenClient.callback = (resp) => {
        if (resp && resp.access_token) { setToken(resp); resolve(_token); }
        else reject(new Error(resp && resp.error ? resp.error : "interactive_failed"));
      };
      tokenClient.requestAccessToken({ prompt: "consent" });
    });
  }

  // استرجاع الملف الشخصي (اختياري لعرض الاسم/الصورة)
  async function fetchUserProfile() {
    if (!hasValidToken()) return null;
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${_token}` },
    });
    if (!res.ok) return null;
    const profile = await res.json();
    safeSet(K.USER, JSON.stringify(profile || {}));
    return profile;
  }

  // API عام:

  // ستُناديه الصفحات عند التحميل
  async function ensureAccessToken({ interactiveIfNeeded = false } = {}) {
    await init();

    if (hasValidToken()) return _token;

    if (_granted) {
      try { await requestSilent(); return _token; }
      catch (e) { /* سنجرّب تفاعليًا لاحقًا إن طُلب */ }
    }

    if (interactiveIfNeeded) {
      await requestInteractive();
      return _token;
    }

    // لم نستطع الصمت + لا نريد نافذة الآن
    throw new Error("no_token");
  }

  // يستدعى مرة واحدة من المستخدم (زر تسجيل الدخول)
  async function signInInteractive() {
    await init();
    await requestInteractive();
    return _token;
  }

  // تسجيل خروج
  async function signOut() {
    try {
      if (_token && window.google && window.google.accounts && window.google.accounts.oauth2) {
        await window.google.accounts.oauth2.revoke(_token);
      }
    } catch {}
    _token = ""; _expiresAt = 0; _granted = false;
    [K.TOKEN, K.EXPIRES_AT, K.GRANTED, K.USER].forEach(safeDel);
  }

  // جلب الحالة
  function isSignedIn() { return hasValidToken() || _granted; }
  function getToken() { return _token; }
  function getExpiresAt() { return _expiresAt; }
  function getUser() {
    try { return JSON.parse(safeGet(K.USER, "{}")); } catch { return {}; }
  }

  // تحديث كل بضع دقائق بصمت إن أمكن
  setInterval(async () => {
    try {
      if (!_granted) return;
      if (hasValidToken()) return;
      await ensureAccessToken({ interactiveIfNeeded: false });
    } catch { /* تجاهل */ }
  }, 3 * 60 * 1000);

  // تعريض الدوال
  window.Auth = {
    init,
    ensureAccessToken,      // يحاول الصمت، يطلب نافذة فقط لو interactiveIfNeeded=true
    signInInteractive,      // استدعِه من زر "تسجيل الدخول" مرة واحدة
    signOut,

    // أدوات
    hasValidToken, isSignedIn, getToken, getExpiresAt, fetchUserProfile,
  };
})();
