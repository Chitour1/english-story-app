// assets/js/main-levels.js
// يربط بطاقة A1 مهما تغيّر الـ HTML + يحدّث عدّادات مبسطة + يربط رابط صفحة المفتاح.

(function(){
  const CFG   = window.APP_CONFIG || {};
  const PAGES = CFG.PAGES || {};
  const STORE = CFG.STORAGE || {};
  const $ = (s,r=document)=> r.querySelector(s);
  const $$= (s,r=document)=> Array.from(r.querySelectorAll(s));
  const build = (p)=> window.buildUrl ? buildUrl(p) : p;

  // رابط صفحة المفتاح إن وُجد زر/نص "مفتاح Gemini"
  const keyLink = $$("a,button").find(el=> /Gemini|مفتاح/i.test(el.textContent));
  if (keyLink) keyLink.addEventListener('click', (e)=> {
    e.preventDefault();
    window.location.href = build(PAGES.KEY || "key.html");
  });

  // عدّادات بسيطة (من التخزين المحلي)
  function safeJson(k){ try { return JSON.parse(localStorage.getItem(k)||"null"); } catch { return null; } }
  function setNum(sel, n){ const el=$(sel); if(el) el.textContent = String(n||0); }
  function updateCounters(){
    const hist = safeJson(STORE.HISTORY) || [];
    const inProg = safeJson(STORE.IN_PROGRESS) || [];
    const learned = (Array.isArray(hist)? hist.length : 0);
    const inLearning = (Array.isArray(inProg)? inProg.length : 0);
    // ملاحظة: هذه المؤشرات عامة — عدّلها حسب HTML لو أحببت
    // إجمالي A1
    setNum('#a1-total', learned + inLearning);
    // كلمات تعلمتها
    setNum('#a1-done', learned);
    // المتبقي (تقريبي)
    setNum('#a1-left', Math.max(0, (learned+inLearning? (learned+inLearning) : 0) - learned));
  }

  // ربط بطاقة A1 حتى لو ما عندها id معيّن
  function findA1Card() {
    // 1) id واضح
    let el = document.getElementById("level-a1-btn") || document.getElementById("card-a1");
    if (el) return el;
    // 2) نص عربي/إنجليزي
    el = $$("div,button,a").find(x=> /(^|\s)A1(\s|$)|المستوى\s*A1/i.test(x.textContent||""));
    if (el) return el;
    // 3) افتراضي: البطاقة الثالثة (غالبًا)
    const cards = $$("section div, .grid > div, .card");
    return cards[2] || cards[cards.length-1] || null;
  }

  function bindA1() {
    const a1 = findA1Card();
    if (!a1) return;
    a1.style.cursor = "pointer";
    a1.addEventListener('click', (e)=>{
      e.preventDefault();
      window.location.href = build(PAGES.A1 || "level-a1.html");
    }, { once:true });
  }

  async function main(){
    try { await window.Auth?.silent?.(); } catch {}
    updateCounters();
    bindA1();

    // إن وصلت إشعارات مزامنة، حدّث العدّاد
    document.addEventListener("esa:drive-loaded", updateCounters);
    document.addEventListener("esa:drive-saved",  updateCounters);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
