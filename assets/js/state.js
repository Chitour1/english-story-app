// assets/js/state.js
// يعتمد على window.APP_CONFIG (+ AUTH اختياريًا)
// يوفّر الواجهة العامة: window.STATE

(function () {
  const CFG = window.APP_CONFIG;
  const ST = CFG.STORAGE;

  // ========= بيانات ثابتة للمستوى A1 =========
  const A1_WORDS = Object.freeze([
    'a','an','about','above','across','action','activity','actor','actress','add','address','adult','advice','afraid','after','afternoon','again','age','ago','agree','air','airport','all','also','always','amazing','and','angry','animal','another','answer','any','anyone','anything','apartment','apple','April','area','arm','around','arrive','art','article','artist','as','ask','at','August','aunt','autumn','away','baby','back','bad','bag','ball','banana','band','bank','bath','bathroom','be','beach','beautiful','because','become','bed','bedroom','beer','before','begin','beginning','behind','believe','below','best','better','between','bicycle','big','bike','bill','bird','birthday','black','blog','blonde','blue','boat','body','book','boot','bored','boring','born','both','bottle','box','boy','boyfriend','bread','break','breakfast','bring','brother','brown','build','building','bus','business','busy','but','butter','buy','by','bye','cafe','cake','call','camera','can','cannot','capital','car','card','career','carrot','carry','cat','CD','cent','centre','century','chair','change','chart','cheap','check','cheese','chicken','child','chocolate','choose','cinema','city','class','classroom','clean','climb','clock','close','clothes','club','coat','coffee','cold','college','colour','come','common','company','compare','complete','computer','concert','conversation','cook','cooking','cool','correct','cost','could','country','course','cousin','cow','cream','create','culture','cup','customer','cut','dad','dance','dancer','dancing','dangerous','dark','date','daughter','day','dear','December','decide','delicious','describe','description','design','desk','detail','dialogue','dictionary','die','diet','difference','different','difficult','dinner','dirty','discuss','dish','do','doctor','dog','dollar','door','down','downstairs','draw','dress','drink','drive','driver','during','DVD','each','ear','early','east','easy','eat','egg','eight','eighteen','eighty','elephant','eleven','else','email','end','enjoy','enough','euro','even','evening','event','ever','every','everybody','everyone','everything','exam','example','excited','exciting','exercise','expensive','explain','extra','eye','face','fact','fall','false','family','famous','fantastic','far','farm','farmer','fast','fat','father','favourite','February','feel','feeling','festival','few','fifteen','fifth','fifty','fill','film','final','find','fine','finish','fire','first','fish','five','flat','flight','floor','flower','fly','follow','food','foot','football','for','forget','form','forty','four','fourteen','fourth','free','Friday','friend','friendly','from','front','fruit','full','fun','funny','future','game','garden','geography','get','girl','girlfriend','give','glass','go','good','goodbye','grandfather','grandmother','grandparent','great','green','grey','group','grow','guess','guitar','gym','hair','half','hand','happen','happy','hard','hat','hate','have','have to','he','head','health','healthy','hear','hello','help','her','here','hey','hi','high','him','his','history','hobby','holiday','home','homework','hope','horse','hospital','hot','hotel','hour','house','how','however','hundred','hungry','husband','I','ice','ice cream','idea','if','imagine','important','improve','in','include','information','interest','interested','interesting','internet','interview','into','introduce','island','it','its','January','jeans','job','join','journey','juice','July','June','just','keep','key','kilometre','kind','kitchen','know','land','language','large','last','late','later','laugh','learn','leave','left','leg','lesson','let','letter','library','lie','life','light','like','line','lion','list','listen','little','live','local','long','look','lose','lot','love','lunch','machine','magazine','main','make','man','many','map','March','market','married','match','May','maybe','me','meal','mean','meaning','meat','meet','meeting','member','menu','message','metre','midnight','mile','milk','million','minute','miss','mistake','model','modern','moment','Monday','money','month','more','morning','most','mother','mountain','mouse','mouth','move','movie','much','mum','museum','music','must','my','name','natural','near','need','negative','neighbour','never','new','news','newspaper','next','next to','nice','night','nine','nineteen','ninety','no','no one','nobody','north','nose','not','note','nothing','November','now','number','nurse','object',"o'clock",'October','of','off','office','often','oh','OK','old','on','once','one','onion','online','only','open','opinion','opposite','or','orange','order','other','our','out','outside','over','own','page','paint','painting','pair','paper','paragraph','parent','park','part','partner','party','passport','past','pay','pen','pencil','people','pepper','perfect','period','person','personal','phone','photo','photograph','phrase','piano','picture','piece','pig','pink','place','plan','plane','plant','play','player','please','point','police','policeman','pool','poor','popular','positive','possible','post','potato','pound','practice','practise','prefer','prepare','present','pretty','price','probably','problem','product','programme','project','purple','put','quarter','question','quick','quickly','quiet','quite','radio','rain','read','reader','reading','ready','real','really','reason','red','relax','remember','repeat','report','restaurant','result','return','rice','rich','ride','right','river','road','room','routine','rule','run','sad','salad','salt','same','sandwich','Saturday','say','school','science','scientist','sea','second','section','see','sell','send','sentence','September','seven','seventeen','seventy','share','she','sheep','shirt','shoe','shop','shopping','short','should','show','shower','sick','similar','sing','singer','sister','sit','situation','six','sixteen','sixty','skill','skirt','sleep','slow','small','snake','snow','so','some','somebody','someone','something','sometimes','son','song','soon','sorry','sound','soup','south','space','speak','special','spell','spelling','spend','sport','spring','stand','star','start','statement','station','stay','still','stop','story','street','strong','student','study','style','subject','success','sugar','summer','sun','Sunday','supermarket','sure','sweater','swim','swimming','table','take','talk','tall','taxi','tea','teach','teacher','team','teenager','telephone','television','tell','ten','tennis','terrible','test','text','than','thank','thanks','that','the','theatre','their','them','then','there','they','thing','think','third','thirsty','thirteen','thirty','this','thousand','three','through','Thursday','ticket','time','tired','title','to','today','together','toilet','tomato','tomorrow','tonight','too','tooth','topic','tourist','town','traffic','train','travel','tree','trip','trousers','true','try','T-shirt','Tuesday','turn','TV','twelve','twenty','twice','two','type','umbrella','uncle','under','understand','university','until','up','upstairs','us','use','useful','usually','vacation','vegetable','very','video','village','visit','visitor','wait','waiter','wake','walk','wall','want','warm','wash','watch','water','way','we','wear','weather','website','Wednesday','week','weekend','welcome','well','west','what','when','where','which','white','who','why','wife','will','win','window','wine','winter','with','without','woman','wonderful','word','work','worker','world','worry','would','write','writer','writing','wrong','year','yellow','yes','yesterday','you','young','your','yourself'
  ]);

  // تكرارات المراجعة (مبسطة)
  const REPETITION_INTERVALS = Object.freeze({ 1: 5, 2: 15, 3: 20 });

  // ========= تخزين محلي =========
  function getApiKey() { return window.safeGet(ST.API_KEY, ""); }
  function setApiKey(v) { window.safeSet(ST.API_KEY, v || ""); }

  function getHistory() { return window.safeGetJson(ST.HISTORY, []); }
  function setHistory(list) { window.safeSetJson(ST.HISTORY, list || []); }

  function getBasket() { return window.safeGetJson(ST.BASKET, []); }
  function setBasket(list) { window.safeSetJson(ST.BASKET, list || []); }

  function getInProgress() { return window.safeGetJson(ST.IN_PROGRESS, []); }
  function setInProgress(list) { window.safeSetJson(ST.IN_PROGRESS, list || []); }

  // ========= واجهة موحّدة لحالة التطبيق =========
  function readLocalState() {
    return {
      wordsInProgress: getInProgress(),     // [{ word, level, lessonCounter, reviews, lastReviewed }] أو {en,ar} في النسخ السابقة
      masteredWords: [],                    // نتركها لاحقًا إذا رغبت بإضافتها
      learningBasket: getBasket(),          // [{id,en,ar}]
      lessonHistory: getHistory(),          // [{date, lesson}]
    };
  }

  function writeLocalState(state) {
    if (!state || typeof state !== "object") return;
    if (Array.isArray(state.learningBasket)) setBasket(state.learningBasket);
    if (Array.isArray(state.lessonHistory)) setHistory(state.lessonHistory);
    if (Array.isArray(state.wordsInProgress)) setInProgress(state.wordsInProgress);
    // masteredWords غير مستخدمة في الواجهة الحالية، لكن أبقيناها لدعم المستقبل
    document.dispatchEvent(new CustomEvent("state:changed", { detail: { state: readLocalState() } }));
  }

  // ========= دمج حالة (محلي + Drive) =========
  function mergeArraysUniqueBy(listA, listB, keyFn) {
    const map = new Map();
    [...(listA || []), ...(listB || [])].forEach((item) => {
      const k = keyFn(item);
      if (!map.has(k)) map.set(k, item);
      else {
        // فضّل السجل الأحدث/الأغنى (مثال للمفردات قيد التعلم)
        const prev = map.get(k);
        const merged = mergeWordProgress(prev, item);
        map.set(k, merged);
      }
    });
    return Array.from(map.values());
  }

  function mergeWordProgress(a, b) {
    // دعم شكلين: {word,...} أو {en,ar}
    // إذا كانا من نوعين مختلفين نعيد الأحدث طولاً/مراجعات.
    const pick = (x) => x || {};
    a = pick(a); b = pick(b);

    // شكل الكلمات قيد التعلم (en/ar) — نفضّل وجود الترجمة
    if (a.en || b.en) {
      const en = (a.en || b.en || "").toLowerCase();
      const ar = a.ar || b.ar || "";
      return { en, ar };
    }

    // شكل التقدّم (word + counters)
    const word = (a.word || b.word || "").toLowerCase();
    const reviews = Math.max(a.reviews || 0, b.reviews || 0);
    const level = Math.max(a.level || 1, b.level || 1);
    const lessonCounter = Math.max(a.lessonCounter || 0, b.lessonCounter || 0);
    const lastReviewed = (a.lastReviewed || b.lastReviewed || null);
    return { word, reviews, level, lessonCounter, lastReviewed };
  }

  function mergeStates(local, remote) {
    const out = {
      wordsInProgress: mergeArraysUniqueBy(local.wordsInProgress, remote.wordsInProgress, (x) => (x.word || x.en || "").toLowerCase()),
      masteredWords: mergeArraysUniqueBy(local.masteredWords || [], remote.masteredWords || [], (x) => (x || "").toLowerCase()),
      learningBasket: mergeArraysUniqueBy(local.learningBasket, remote.learningBasket, (x) => (x.en || "").toLowerCase()),
      lessonHistory: mergeArraysUniqueBy(local.lessonHistory, remote.lessonHistory, (x) => (x.date || "") + "|" + (x?.lesson?.story?.slice?.(0, 24) || ""),
    };
    // حدّ أقصى للسجل
    out.lessonHistory = (out.lessonHistory || []).slice(0, 50);
    return out;
  }

  // ========= مزامنة مع Drive (اختياري) =========
  async function syncWithDrive(mode = "merge") {
    // إذا لم يكن هناك AUTH فسنعتبر المزامنة غير متاحة.
    if (!window.AUTH || !window.AUTH.isLoggedIn || !window.AUTH.isLoggedIn()) {
      return { ok: false, reason: "not-logged-in" };
    }
    try {
      const local = readLocalState();
      if (mode === "pull") {
        const remote = await window.AUTH.loadStateFromDrive();
        writeLocalState(remote);
        return { ok: true, mode: "pull" };
      } else if (mode === "push") {
        await window.AUTH.saveStateToDrive(local);
        return { ok: true, mode: "push" };
      } else {
        // merge
        const remote = await window.AUTH.loadStateFromDrive();
        const merged = mergeStates(local, remote);
        writeLocalState(merged);
        await window.AUTH.saveStateToDrive(merged);
        return { ok: true, mode: "merge" };
      }
    } catch (e) {
      console.error("Drive sync error:", e);
      return { ok: false, error: e?.message || String(e) };
    }
  }

  // ========= واجهات شائعة الاستخدام =========
  function addLessonToHistory(lessonObj) {
    const history = getHistory();
    history.unshift({ date: new Date().toLocaleString('ar-EG'), lesson: lessonObj });
    if (history.length > 50) history.pop();
    setHistory(history);
  }

  function addToBasket(en, ar) {
    const basket = getBasket();
    const exists = basket.some(it => (it.en || "").toLowerCase() === (en || "").toLowerCase());
    if (!exists) {
      basket.unshift({ id: Date.now(), en, ar });
      setBasket(basket);
    }
  }

  function addToInProgress(word, translation) {
    // ندعم إدخالين:
    // 1) كلمة قيد التعلم كمفردة مع ترجمتها (en/ar) — تُعرض في شاشة "قيد التعلم"
    // 2) تقدّم تعلم (word + counters) لاستعمالات لاحقة
    const list = getInProgress();
    // إذا كانت كلمة + ترجمة
    if (translation) {
      const exists = list.some(x => x.en && x.en.toLowerCase() === word.toLowerCase());
      if (!exists) {
        list.unshift({ en: word, ar: translation });
        setInProgress(list);
      }
      return;
    }
    // إذا كانت تتبع نموذج التقدّم
    const exists2 = list.some(x => x.word && x.word.toLowerCase() === word.toLowerCase());
    if (!exists2) {
      list.push({ word, level: 1, lessonCounter: 0, reviews: 0, lastReviewed: null });
      setInProgress(list);
    }
  }

  function incrementReview(word) {
    const list = getInProgress();
    const i = list.findIndex(x => x.word && x.word.toLowerCase() === String(word).toLowerCase());
    if (i === -1) return;
    const it = list[i];
    it.reviews = (it.reviews || 0) + 1;
    it.lessonCounter = 0;
    it.lastReviewed = new Date().toISOString();
    if (it.reviews >= 5 && it.reviews < 15) it.level = Math.max(it.level || 1, 2);
    if (it.reviews >= 15 && it.reviews < 20) it.level = Math.max(it.level || 1, 3);
    if (it.reviews >= 20) {
      // يمكن نقلها لاحقاً إلى masteredWords لو رغبت
      list.splice(i, 1);
    }
    setInProgress(list);
  }

  function markRepetitionBatchDone(words) {
    (words || []).forEach(w => incrementReview(w));
  }

  function selectWordsForLesson(targetWordCount = 20) {
    // رفع عداد الدروس لكل كلمة قيد التعلّم (نموذج التقدّم)
    const list = getInProgress().map(w => {
      if (w.word) w.lessonCounter = (w.lessonCounter || 0) + 1;
      return w;
    });
    setInProgress(list);

    // الكلمات المقرر تكرارها
    const due = list.filter(it => {
      if (!it.word) return false;
      const lvl = it.level || 1;
      const need = REPETITION_INTERVALS[lvl] || 5;
      return (it.lessonCounter || 0) >= need;
    });

    const repetitionWords = due.slice(0, Math.min(due.length, Math.floor(targetWordCount / 2)));
    const newWordsCount = targetWordCount - repetitionWords.length;

    // كلمات جديدة غير موجودة في قيد التعلّم أو السلة
    const learned = new Set([
      ...list.filter(x => x.word).map(x => x.word),
      ...getBasket().map(x => x.en),
    ].map(s => (s || "").toLowerCase()));

    const remaining = A1_WORDS.filter(w => !learned.has(w.toLowerCase()));
    const newWords = shuffle(remaining).slice(0, newWordsCount);

    return { newWords, repetitionWords }; // repetitionWords عناصرها كائنات {word,...}
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ========= API عامة =========
  window.STATE = {
    // ثابت
    A1_WORDS,
    REPETITION_INTERVALS,

    // التخزين البسيط
    getApiKey, setApiKey,

    getHistory, setHistory,
    getBasket, setBasket,
    getInProgress, setInProgress,

    readLocalState,
    writeLocalState,

    // عمليات متقدمة
    addLessonToHistory,
    addToBasket,
    addToInProgress,
    incrementReview,
    markRepetitionBatchDone,
    selectWordsForLesson,

    // مزامنة اختيارية مع Drive
    syncWithDrive,
    mergeStates, // متاحة إن احتاجتها ملفات أخرى
  };
})();
