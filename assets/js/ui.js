// assets/js/ui.js
// يعتمد على Tailwind (من CDN أو من styles.css) لكنه يعمل أيضًا بدونها.
// يوفّر الواجهة العامة: window.UI

(function () {
  // ========= أدوات داخلية =========
  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c === null || c === undefined) return;
      if (typeof c === "string") node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    });
    return node;
  }

  function ensureSingleton(id, builder) {
    let node = qs("#" + id);
    if (!node) {
      node = builder();
      document.body.appendChild(node);
    }
    return node;
  }

  // ========= Modal =========
  function buildModalRoot() {
    return el("div", {
      id: "ui-modal-overlay",
      class: "fixed inset-0 z-[1000] hidden",
      "aria-hidden": "true",
    }, [
      el("div", {
        class: "absolute inset-0 bg-black/50 backdrop-blur-sm",
        onclick: closeModal
      }),
      el("div", {
        class: "relative mx-auto my-8 w-[92%] max-w-lg bg-white rounded-xl shadow-xl p-5 text-right overflow-hidden",
        role: "dialog",
        "aria-modal": "true",
      }, [
        el("div", { id: "ui-modal-header", class: "flex items-center justify-between mb-3" }, [
          el("h3", { id: "ui-modal-title", class: "text-xl font-bold text-slate-800" }, "عنوان"),
          el("button", { id: "ui-modal-close", class: "text-slate-500 hover:text-slate-700", onclick: closeModal, "aria-label":"إغلاق" }, "✕")
        ]),
        el("div", { id: "ui-modal-content", class: "text-slate-700 leading-relaxed max-h-[65vh] overflow-auto" }),
        el("div", { id: "ui-modal-actions", class: "mt-5 flex flex-wrap gap-2 justify-center" }),
      ])
    ]);
  }

  function openModal({ title = "", html = "", actions = [] } = {}) {
    const root = ensureSingleton("ui-modal-overlay", buildModalRoot);
    qs("#ui-modal-title", root).textContent = title || "";
    const content = qs("#ui-modal-content", root);
    content.innerHTML = "";
    if (typeof html === "string") content.innerHTML = html;
    else if (html instanceof Node) content.appendChild(html);

    const actionsBox = qs("#ui-modal-actions", root);
    actionsBox.innerHTML = "";
    (actions || []).forEach((a) => {
      const btn = el("button", {
        class: a.class || "px-4 py-2 rounded-md bg-sky-600 text-white hover:bg-sky-700",
        onclick: async (e) => {
          try {
            const res = await a.onClick?.(e);
            if (!a.keepOpen) closeModal();
            return res;
          } catch (err) {
            // لا نغلق عند الخطأ إلا إذا طُلب
            if (!a.keepOpenOnError) closeModal();
          }
        }
      }, a.text || "حسنًا");
      actionsBox.appendChild(btn);
    });

    root.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    return root;
  }

  function closeModal() {
    const root = qs("#ui-modal-overlay");
    if (!root) return;
    root.classList.add("hidden");
    document.body.style.overflow = "";
  }

  // ========= Confirm (وعد يرجع بصح/خطأ) =========
  function confirmDialog({ title = "تأكيد", message = "هل أنت متأكد؟", confirmText = "تأكيد", cancelText = "إلغاء" } = {}) {
    return new Promise((resolve) => {
      openModal({
        title,
        html: `<p class="text-slate-700">${message}</p>`,
        actions: [
          { text: cancelText, class: "px-4 py-2 rounded-md bg-slate-200 hover:bg-slate-300", onClick: () => resolve(false) },
          { text: confirmText, class: "px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700", onClick: () => resolve(true) }
        ]
      });
    });
  }

  // ========= Loader شاشة تحميل كاملة =========
  function buildScreenLoader() {
    return el("div", {
      id: "ui-screen-loader",
      class: "fixed inset-0 z-[1100] hidden items-center justify-center"
    }, [
      el("div", { class: "absolute inset-0 bg-black/50 backdrop-blur-sm" }),
      el("div", { class: "relative bg-white rounded-xl shadow-xl px-6 py-5 w-[92%] max-w-sm text-center" }, [
        el("div", { class: "mx-auto mb-3 w-12 h-12 rounded-full border-4 border-slate-200 border-t-sky-600 animate-spin" }),
        el("div", { id: "ui-screen-loader-text", class: "text-slate-700 font-semibold" }, "جاري التحميل…")
      ])
    ]);
  }

  function showLoader(text = "جاري التحميل…") {
    const root = ensureSingleton("ui-screen-loader", buildScreenLoader);
    qs("#ui-screen-loader-text", root).textContent = text;
    root.classList.remove("hidden");
    root.classList.add("flex");
    document.body.style.overflow = "hidden";
  }

  function hideLoader() {
    const root = qs("#ui-screen-loader");
    if (!root) return;
    root.classList.add("hidden");
    root.classList.remove("flex");
    document.body.style.overflow = "";
  }

  // ========= Toast =========
  function buildToastRoot() {
    return el("div", {
      id: "ui-toast-root",
      class: "fixed z-[1200] bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-xl space-y-2 pointer-events-none"
    });
  }

  function showToast(message = "", { type = "info", timeout = 2500 } = {}) {
    const root = ensureSingleton("ui-toast-root", buildToastRoot);
    const color =
      type === "success" ? "bg-emerald-600" :
      type === "error" ? "bg-red-600" :
      type === "warning" ? "bg-amber-600" :
      "bg-sky-600";

    const item = el("div", {
      class: `pointer-events-auto ${color} text-white px-4 py-3 rounded-lg shadow-lg flex items-start gap-3`
    }, [
      el("div", { class: "mt-1" }, type === "success" ? "✅" : type === "error" ? "⚠️" : type === "warning" ? "🟠" : "ℹ️"),
      el("div", { class: "flex-1 text-sm whitespace-pre-wrap" }, message),
      el("button", { class: "text-white/85 hover:text-white", onclick: () => root.removeChild(item) }, "✕")
    ]);

    root.appendChild(item);
    if (timeout > 0) {
      setTimeout(() => { try { root.removeChild(item); } catch {} }, timeout);
    }
  }

  // ========= Dialog صغير بإدخال نصّي =========
  function promptDialog({ title = "إدخال", placeholder = "", okText = "موافق", cancelText = "إلغاء", defaultValue = "" } = {}) {
    return new Promise((resolve) => {
      const input = el("input", { class: "w-full p-2 border rounded-md", placeholder, value: defaultValue });
      openModal({
        title,
        html: el("div", { class: "space-y-3" }, [
          input
        ]),
        actions: [
          { text: cancelText, class: "px-4 py-2 rounded-md bg-slate-200 hover:bg-slate-300", onClick: () => resolve(null) },
          { text: okText, class: "px-4 py-2 rounded-md bg-sky-600 text-white hover:bg-sky-700", onClick: () => resolve(input.value || "") }
        ]
      });
      // فوكس تلقائي
      setTimeout(() => input.focus(), 50);
    });
  }

  // ========= شريط سفلي قانوني ثابت (اختياري) =========
  function ensureLegalBar({ termsUrl = "#", privacyUrl = "#", year = new Date().getFullYear(), brand = "© قصتي اللغوية" } = {}) {
    // إذا كان موجود لا نكرره
    if (qs("#ui-legal-bar")) return;
    const bar = el("div", {
      id: "ui-legal-bar",
      class: "fixed inset-x-0 bottom-0 z-[900] bg-white/95 backdrop-blur border-t border-slate-200"
    }, [
      el("div", { class: "mx-auto max-w-5xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm" }, [
        el("div", { class: "flex items-center gap-4" }, [
          el("a", { href: termsUrl, target: "_blank", rel: "noopener", class: "text-sky-700 hover:underline" }, "بنود الخدمة"),
          el("a", { href: privacyUrl, target: "_blank", rel: "noopener", class: "text-sky-700 hover:underline" }, "سياسة الخصوصية"),
        ]),
        el("span", { class: "text-slate-400" }, `${year} ${brand}`)
      ])
    ]);
    document.body.appendChild(bar);
  }

  // ========= API عام =========
  window.UI = {
    // Modal
    openModal,
    closeModal,
    confirmDialog,
    promptDialog,

    // Loader
    showLoader,
    hideLoader,

    // Toast
    showToast,

    // Legal bar
    ensureLegalBar,
  };
})();
