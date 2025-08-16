// assets/js/auth.js
// يعتمد على window.APP_CONFIG من config.js
// يوفّر الواجهة العامة: window.AUTH

(function () {
  const CFG = window.APP_CONFIG;
  const STORAGE = CFG.STORAGE;

  // ------- حالة داخلية -------
  let tokenClient = null;
  let gapiInited = false;
  let gisInited = false;
  let isLoggedIn = false;
  let userProfile = null;
  let driveFileId = window.safeGet(STORAGE.DRIVE_FILE_ID, null);

  // اسم الملف داخل appDataFolder
  const DRIVE_FILENAME = "language_story_data.json";

  // ------- Helpers -------
  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function getAccessToken() {
    const t = gapi.client.getToken();
    return t?.access_token || null;
  }

  function headersWithAuth() {
    const token = getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  function emit(eventName, detail = {}) {
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  // ------- تحميل سكربتات Google (gapi + gis) -------
  async function loadGoogleScripts() {
    // حقن السكربتات إذا لم تكن موجودة
    if (!document.querySelector('script[data-auth="gapi"]')) {
      const s1 = document.createElement("script");
      s1.src = "https://apis.google.com/js/api.js";
      s1.async = true;
      s1.defer = true;
      s1.dataset.auth = "gapi";
      document.head.appendChild(s1);
    }
    if (!document.querySelector('script[data-auth="gis"]')) {
      const s2 = document.createElement("script");
      s2.src = "https://accounts.google.com/gsi/client";
      s2.async = true;
      s2.defer = true;
      s2.dataset.auth = "gis";
      document.head.appendChild(s2);
    }

    // انتظر توافر window.gapi و window.google
    let tries = 0;
    while (!(window.gapi && window.google) && tries < 200) {
      await wait(50);
      tries++;
    }
    if (!(window.gapi && window.google)) {
      throw new Error("تعذر تحميل مكتبات Google");
    }
  }

  // ------- تهيئة gapi و GIS -------
  async function initGapi() {
    if (gapiInited) return;
    await new Promise((resolve) => {
      gapi.load("client", resolve);
    });
    await gapi.client.init({});
    gapiInited = true;
  }

  async function initGis() {
    if (gisInited) return;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CFG.GOOGLE.CLIENT_ID,
      scope: CFG.GOOGLE.SCOPES.join(" "),
      callback: async (resp) => {
        if (resp.error) {
          emit("auth:error", { error: resp.error });
          return;
        }
        gapi.client.setToken({ access_token: resp.access_token });
        isLoggedIn = true;
        try {
          await ensureDriveLoaded();
          await fetchUserProfile();
          emit("auth:signin", { profile: userProfile });
        } catch (e) {
          emit("auth:error", { error: e });
        }
      },
    });
    gisInited = true;
  }

  async function ensureDriveLoaded() {
    // تحميل ديسكفري درايف
    await gapi.client.load(
      "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"
    );
  }

  // ------- تسجيل الدخول/الخروج -------
  async function signIn() {
    await loadGoogleScripts();
    await initGapi();
    await initGis();
    tokenClient.requestAccessToken({ prompt: "consent" });
  }

  async function signOut() {
    const token = gapi.client.getToken();
    if (token) {
      try {
        await google.accounts.oauth2.revoke(token.access_token);
      } catch (_) {}
      gapi.client.setToken("");
    }
    isLoggedIn = false;
    userProfile = null;
    driveFileId = null;
    window.safeSet(STORAGE.DRIVE_FILE_ID, "");
    emit("auth:signout");
  }

  async function tokenRefresh() {
    // طلب توكن صامت إذا أمكن
    tokenClient?.requestAccessToken({ prompt: "" });
  }

  // ------- الملف على Drive -------
  async function findOrCreateDriveFileId() {
    if (driveFileId) return driveFileId;

    // ابحث عن الملف
    const list = await gapi.client.drive.files.list({
      spaces: "appDataFolder",
      q: `name='${DRIVE_FILENAME}' and trashed=false`,
      fields: "files(id,name)",
    });

    if (list?.result?.files?.length) {
      driveFileId = list.result.files[0].id;
      window.safeSet(STORAGE.DRIVE_FILE_ID, driveFileId);
      return driveFileId;
    }

    // إن لم يوجد، أنشئه فارغًا
    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;
    const metadata = {
      name: DRIVE_FILENAME,
      mimeType: "application/json",
      parents: ["appDataFolder"],
    };
    const data = JSON.stringify({ wordsInProgress: [], masteredWords: [], learningBasket: [], lessonHistory: [] });

    const body =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: application/json\r\n\r\n" +
      data +
      closeDelim;

    const token = getAccessToken();
    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body }
    );
    if (!res.ok) throw new Error("فشل إنشاء ملف المزامنة على Drive");
    const created = await res.json();
    driveFileId = created.id;
    window.safeSet(STORAGE.DRIVE_FILE_ID, driveFileId);
    return driveFileId;
  }

  async function loadStateFromDrive() {
    if (!isLoggedIn) throw new Error("غير مسجّل الدخول");
    await ensureDriveLoaded();
    const id = await findOrCreateDriveFileId();
    const file = await gapi.client.drive.files.get({ fileId: id, alt: "media" });
    const raw = file.result ?? file.body ?? "{}";
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    emit("drive:load", { data });
    return data;
  }

  async function saveStateToDrive(stateObj) {
    if (!isLoggedIn) throw new Error("غير مسجّل الدخول");
    await ensureDriveLoaded();
    const id = await findOrCreateDriveFileId();

    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const metaForUpdate = {}; // لا نحتاج لتغيير الاسم
    const dataPart = JSON.stringify(stateObj || {});

    const body =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metaForUpdate) +
      delimiter +
      "Content-Type: application/json\r\n\r\n" +
      dataPart +
      closeDelim;

    const token = getAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=multipart`,
      { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body }
    );
    if (!res.ok) throw new Error("فشل الحفظ على Drive");
    emit("drive:save");
    return true;
  }

  // ------- ملف شخصي -------
  async function fetchUserProfile() {
    const token = getAccessToken();
    if (!token) return null;
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    userProfile = await res.json();
    emit("auth:profile", { profile: userProfile });
    return userProfile;
  }

  // ------- تهيئة عامة -------
  async function init() {
    try {
      await loadGoogleScripts();
      await initGapi();
      await initGis();
      emit("auth:ready");
    } catch (e) {
      emit("auth:error", { error: e });
    }
  }

  // ------- API عامة متاحة للتطبيق -------
  window.AUTH = {
    init,                 // انتظار جاهزية المكتبات
    signIn,               // تسجيل الدخول
    signOut,              // تسجيل الخروج
    tokenRefresh,         // تحديث صامت للتوكن
    isLoggedIn: () => isLoggedIn,
    getProfile: () => userProfile,
    loadStateFromDrive,   // { wordsInProgress, masteredWords, learningBasket, lessonHistory }
    saveStateToDrive,     // يرسل نفس الكائن أعلاه للحفظ
    getDriveFileId: () => driveFileId,
  };
})();
