// assets/js/auth.js
// إدارة تسجيل الدخول + مزامنة Google Drive (appData) + تحميل/حفظ التقدّم.
// يعمل على كل الصفحات بدون إعادة توجيه قسرية.

(function () {
  const CFG   = window.APP_CONFIG || {};
  const GCFG  = CFG.GOOGLE || {};
  const STORE = CFG.STORAGE || {};
  const PAGES = CFG.PAGES || {};

  const FILE_NAME = "language_story_data.json";

  let gapiReady = false;
  let gisReady  = false;
  let tokenClient = null;
  let _profile = null;

  const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));
  const $ = (s, r=document)=> r.querySelector(s);
  const build = (p)=> window.buildUrl ? buildUrl(p) : p;

  // ---------- كشف حالة الدخول ----------
  function hasToken() {
    try { return !!(window.gapi?.client?.getToken?.()); } catch { return false; }
  }
  function markSignedIn(ok) {
    const v = ok ? "1" : "0";
    try { sessionStorage.setItem("__esa_google_ok", v); } catch {}
    try { localStorage.setItem("__esa_google_ok", v); } catch {}
  }
  function isProbablySignedIn() {
    if (hasToken()) return true;
    if (sessionStorage.getItem("__esa_google_ok")==="1") return true;
    if (localStorage.getItem("__esa_google_ok")==="1") return true;
    if (localStorage.getItem(STORE.DRIVE_FILE_ID)) return true;
    return false;
  }

  // ---------- تحميل مكتبات Google ----------
  function injectOnce(src, {id, onload}={}) {
    if (id && document.getElementById(id)) return;
    const s = document.createElement("script");
    if (id) s.id = id;
    s.src = src; s.async = true; s.defer = true;
    if (onload) s.onload = onload;
    document.head.appendChild(s);
  }

  async function initGapi() {
    if (gapiReady) return;
    await new Promise(res=>{
      if (window.gapi?.load) { res(); return; }
      injectOnce("https://apis.google.com/js/api.js", { id:"gapi-js" });
      const t = setInterval(()=>{ if (window.gapi?.load) { clearInterval(t); res(); } }, 30);
    });
    await new Promise(res=> window.gapi.load('client', res));
    await window.gapi.client.init({});
    gapiReady = true;
  }

  async function initGis() {
    if (gisReady) return;
    await new Promise(res=>{
      if (window.google?.accounts?.oauth2) { res(); return; }
      injectOnce("https://accounts.google.com/gsi/client", { id:"gis-js" });
      const t = setInterval(()=>{ if (window.google?.accounts?.oauth2) { clearInterval(t); res(); } }, 30);
    });
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: (GCFG.CLIENT_ID||"").trim(),
      scope: (GCFG.SCOPES||[]).join(" "),
      callback: async (resp)=>{
        if (resp?.access_token) {
          window.gapi.client.setToken({ access_token: resp.access_token });
          markSignedIn(true);
          document.dispatchEvent(new CustomEvent("esa:google-signed-in"));
        }
      }
    });
    gisReady = true;
  }

  async function ready() {
    await initGapi();
    await initGis();
    return true;
  }

  // ---------- صامت/تفاعلي ----------
  async function silent() {
    await ready();
    if (hasToken()) return true;
    try {
      tokenClient.requestAccessToken({ prompt: "" }); // silent
      // انتظر لحظات لمعالجة الكالباك
      for (let i=0;i<20;i++){ if (hasToken()) break; await sleep(50); }
      return hasToken();
    } catch { return false; }
  }

  async function signInInteractive() {
    await ready();
    return new Promise((resolve)=>{
      tokenClient.callback = async (resp)=>{
        const ok = !!resp?.access_token;
        if (ok) {
          window.gapi.client.setToken({ access_token: resp.access_token });
          markSignedIn(true);
          await fetchProfile();
        }
        resolve(ok);
      };
      tokenClient.requestAccessToken({ prompt: "consent" });
    });
  }

  async function signOut() {
    try {
      const tok = window.gapi?.client?.getToken?.();
      if (tok?.access_token) {
        await window.google.accounts.oauth2.revoke(tok.access_token, ()=>{});
      }
    } catch {}
    try { window.gapi?.client?.setToken?.(''); } catch {}
    markSignedIn(false);
    _profile = null;
    document.dispatchEvent(new CustomEvent("esa:google-signed-out"));
  }

  // ---------- بروفايل ----------
  async function fetchProfile() {
    if (!hasToken()) return null;
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${window.gapi.client.getToken().access_token}` }
      });
      if (res.ok) { _profile = await res.json(); return _profile; }
    } catch {}
    return null;
  }
  function getProfile(){ return _profile; }

  // ---------- Drive (appDataFolder) ----------
  async function ensureDriveApi() {
    await ready();
    await window.gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
  }

  function readLocalState() {
    return {
      wordsInProgress: window.safeGetJson(STORE.IN_PROGRESS, []) || [],
      masteredWords : window.safeGetJson(STORE.HISTORY, [])?.__mastered || window.safeGetJson("english_story_app__masteredWords", []) || [],
      learningBasket : window.safeGetJson(STORE.BASKET, []) || [],
      lessonHistory  : window.safeGetJson(STORE.HISTORY, []) || []
    };
  }

  function writeLocalState(d) {
    if (!d || typeof d !== 'object') return;
    try {
      if (Array.isArray(d.wordsInProgress)) window.safeSetJson(STORE.IN_PROGRESS, d.wordsInProgress);
      if (Array.isArray(d.masteredWords))   window.safeSetJson("english_story_app__masteredWords", d.masteredWords);
      if (Array.isArray(d.learningBasket))   window.safeSetJson(STORE.BASKET, d.learningBasket);
      if (Array.isArray(d.lessonHistory))    window.safeSetJson(STORE.HISTORY, d.lessonHistory);
    } catch {}
  }

  async function loadFromDrive() {
    if (!hasToken()) return { ok:false, reason:'no_token' };
    await ensureDriveApi();

    // ابحث عن الملف
    const list = await window.gapi.client.drive.files.list({
      spaces: 'appDataFolder',
      q: `name='${FILE_NAME}' and trashed=false`,
      fields: 'files(id,name,modifiedTime)'
    });
    const file = list.result.files?.[0];

    if (!file) return { ok:false, reason:'not_found' };

    const blob = await window.gapi.client.drive.files.get({ fileId: file.id, alt: 'media' });
    const raw  = blob.result ?? blob.body ?? '{}';
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;

    window.safeSet(STORE.DRIVE_FILE_ID, file.id);
    writeLocalState(data);

    document.dispatchEvent(new CustomEvent("esa:drive-loaded", { detail:{ fileId:file.id, modified:file.modifiedTime } }));
    return { ok:true, data, fileId:file.id };
  }

  async function saveToDrive() {
    if (!hasToken()) return { ok:false, reason:'no_token' };
    await ensureDriveApi();

    const appState = readLocalState();
    const tokenObj = window.gapi.client.getToken();
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;
    const headers = {
      'Authorization': `Bearer ${tokenObj.access_token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    };

    const createMeta = { name: FILE_NAME, mimeType: 'application/json', parents: ['appDataFolder'] };
    const metaCreateStr = JSON.stringify(createMeta);
    const metaUpdateStr = JSON.stringify({});
    const dataPart = JSON.stringify(appState);

    const makeBody = (meta)=> delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      meta + delimiter + 'Content-Type: application/json\r\n\r\n' + dataPart + closeDelim;

    let fileId = window.safeGet(STORE.DRIVE_FILE_ID, null);

    try {
      if (fileId) {
        const res = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
          { method: 'PATCH', headers, body: makeBody(metaUpdateStr) }
        );
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          { method: 'POST', headers, body: makeBody(metaCreateStr) }
        );
        if (!res.ok) throw new Error(await res.text());
        const created = await res.json();
        fileId = created.id;
        window.safeSet(STORE.DRIVE_FILE_ID, fileId);
      }
      document.dispatchEvent(new CustomEvent("esa:drive-saved", { detail:{ fileId } }));
      return { ok:true, fileId };
    } catch (e) {
      return { ok:false, reason:'network_error' };
    }
  }

  // ---------- تهيئة تلقائية على كل صفحة ----------
  (async function bootstrap(){
    await ready();

    // حاول تسجيل دخول صامت لتأكيد الحالة
    await silent();

    // إن كنا مسجّلين: حمّل من Drive لمرة أولى (أولوية سحابية)
    if (hasToken()) {
      const r = await loadFromDrive();
      if (!r.ok && r.reason==='not_found') {
        // إن لم يوجد ملف: أنشئه بالبيانات المحليّة
        await saveToDrive();
      }
    }
  })();

  // واجهة عامة
  window.Auth = {
    ready,
    silent,
    signInInteractive,
    signOut,
    isSignedIn: ()=> hasToken() || isProbablySignedIn(),
    getProfile,
    loadFromDrive,
    saveToDrive,
  };
})();
