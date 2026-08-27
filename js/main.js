/* =====================================================================
   AND Local Ads — lógica de la landing
   1) Tema claro/oscuro   2) Calculadora de ahorro   3) Formulario de leads
   4) Animaciones de aparición y pasos   5) Navegación lateral   6) Marquee
   ===================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     1) Tema
     ------------------------------------------------------------------ */
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");

  function applyTheme(theme) {
    root.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("and-theme", theme); } catch (_) {}
  }
  (function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem("and-theme"); } catch (_) {}
    applyTheme(saved || "dark"); // el sitio original se ve en oscuro por defecto
  })();
  themeToggle.addEventListener("click", function () {
    applyTheme(root.classList.contains("dark") ? "light" : "dark");
  });

  /* ------------------------------------------------------------------
     2) Calculadora de Ahorro Real
        Misma lógica que la página original:
        SIN factura nacional:
          ISD 5%            = inv * 0.05
          IVA 15% (no recup)= (inv + ISD) * 0.15
          Costo visible     = inv + ISD + IVA
          No deducible 25%  = costo visible * 0.25
          Total             = costo visible + no deducible
        CON factura nacional:
          ISD 5%            = inv * 0.05
          Comisión AND 10%  = inv * 0.10
          IVA 15% (crédito) = (inv + ISD + comisión) * 0.15
          Renta deducible   = 0
          Total             = inv + ISD + comisión + IVA
        Ahorro mensual = total informal - total formal
        % ahorro       = ahorro / total informal
        Ahorro anual   = ahorro * 12
        Meses gratis   = ahorro anual / total informal
     ------------------------------------------------------------------ */
  const RATES = { ISD: 0.05, IVA: 0.15, FEE: 0.10, NON_DEDUCTIBLE: 0.25 };

  const investInput = document.getElementById("investInput");
  const investRange = document.getElementById("investRange");
  const budgetField = document.getElementById("budget");
  const outs = {};
  document.querySelectorAll("[data-out]").forEach(function (el) { outs[el.dataset.out] = el; });

  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  const fmt = function (n) { return money.format(n); };

  function compute(inv) {
    const isd = inv * RATES.ISD;

    // Sin factura nacional
    const iva1 = (inv + isd) * RATES.IVA;
    const visible = inv + isd + iva1;
    const nonDeductible = visible * RATES.NON_DEDUCTIBLE;
    const total1 = visible + nonDeductible;

    // Con factura nacional
    const fee = inv * RATES.FEE;
    const iva2 = (inv + isd + fee) * RATES.IVA;
    const total2 = inv + isd + fee + iva2;

    const saveMonth = total1 - total2;
    const savePct = total1 > 0 ? (saveMonth / total1) * 100 : 0;
    const saveYear = saveMonth * 12;
    const freeMonths = total1 > 0 ? saveYear / total1 : 0;

    return { inv, isd, iva1, visible, nonDeductible, total1, fee, iva2, total2, saveMonth, savePct, saveYear, freeMonths };
  }

  function render(inv) {
    const r = compute(inv);
    outs.inv1.textContent = fmt(r.inv);
    outs.isd1.textContent = fmt(r.isd);
    outs.iva1.textContent = fmt(r.iva1);
    outs.visible1.textContent = fmt(r.visible);
    outs.nodeduc1.textContent = fmt(r.nonDeductible);
    outs.total1.textContent = fmt(r.total1);

    outs.inv2.textContent = fmt(r.inv);
    outs.isd2.textContent = fmt(r.isd);
    outs.fee2.textContent = fmt(r.fee);
    outs.iva2.textContent = fmt(r.iva2);
    outs.total2.textContent = fmt(r.total2);

    outs.saveMonth.textContent = fmt(r.saveMonth);
    outs.savePct.textContent = r.savePct.toFixed(1);
    outs.saveYear.textContent = fmt(r.saveYear);
    outs.freeMonths.textContent = r.freeMonths.toFixed(2);

    budgetField.value = "$" + Math.round(inv);
  }

  function sanitize(v) {
    const n = parseFloat(v);
    return isNaN(n) || n < 0 ? 0 : n;
  }

  investInput.addEventListener("input", function () {
    const v = sanitize(investInput.value);
    investRange.value = Math.min(Math.max(v, 100), 10000);
    render(v);
  });
  investRange.addEventListener("input", function () {
    investInput.value = investRange.value;
    render(sanitize(investRange.value));
  });
  render(sanitize(investInput.value));

  /* ------------------------------------------------------------------
     3) Formulario de leads
     ------------------------------------------------------------------ */
  const form = document.getElementById("leadForm");
  const submitBtn = document.getElementById("leadSubmit");
  const consent = document.getElementById("consent");
  const status = document.getElementById("leadStatus");
  const phoneInput = document.getElementById("phone");
  const requiredFields = ["fullName", "companyName", "email", "phone"].map(function (id) { return document.getElementById(id); });

  phoneInput.addEventListener("input", function () {
    phoneInput.value = phoneInput.value.replace(/\D/g, "");
  });

  function validateForm() {
    const filled = requiredFields.every(function (f) { return f.value.trim() !== ""; });
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.getElementById("email").value.trim());
    submitBtn.disabled = !(filled && emailOk && consent.checked);
  }
  requiredFields.forEach(function (f) { f.addEventListener("input", validateForm); });
  consent.addEventListener("change", validateForm);
  validateForm();

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitBtn.disabled) return;

    const data = {
      fullName: document.getElementById("fullName").value.trim(),
      companyName: document.getElementById("companyName").value.trim(),
      email: document.getElementById("email").value.trim(),
      phone: document.getElementById("phoneCode").value + " " + phoneInput.value.trim(),
      monthlyBudget: sanitize(investInput.value),
      consent: consent.checked,
      submittedAt: new Date().toISOString()
    };

    // Punto de integración: reemplazar por fetch() a tu backend / CRM.
    console.log("Lead capturado:", data);

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando…";
    setTimeout(function () {
      status.classList.remove("is-error");
      status.textContent = "¡Listo! Te contactaremos pronto para activar tu ahorro.";
      form.reset();
      submitBtn.innerHTML = "Quiero acceder a mi ahorro";
      render(sanitize(investInput.value));
      validateForm();
    }, 700);
  });

  /* ------------------------------------------------------------------
     4) Animaciones de aparición + activación de pasos
     ------------------------------------------------------------------ */
  const revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll(".reveal").forEach(function (el) { revealObserver.observe(el); });

  const balanceEl = document.querySelector("[data-balance]");
  function countBalance() {
    const target = Math.round(sanitize(investInput.value)) || 1000;
    const start = performance.now();
    const duration = 1400;
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      balanceEl.textContent = Math.round(target * eased).toLocaleString("en-US");
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const stepObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && !entry.target.classList.contains("is-active")) {
        entry.target.classList.add("is-active");
        if (entry.target.dataset.step === "4") countBalance();
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll(".step").forEach(function (el) { stepObserver.observe(el); });

  /* ------------------------------------------------------------------
     5) Navegación lateral por secciones
     ------------------------------------------------------------------ */
  const navItems = Array.prototype.slice.call(document.querySelectorAll(".side-nav__item"));
  const sections = navItems.map(function (b) { return document.getElementById(b.dataset.target); });

  navItems.forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.getElementById(btn.dataset.target).scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  function updateNav() {
    const marker = window.scrollY + window.innerHeight * 0.4;
    let active = 0;
    sections.forEach(function (sec, i) { if (sec && sec.offsetTop <= marker) active = i; });
    // Al llegar al final de la página, marcar "Contacto"
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) active = sections.length - 1;
    navItems.forEach(function (b, i) { b.classList.toggle("is-active", i === active); });
  }
  window.addEventListener("scroll", updateNav, { passive: true });
  window.addEventListener("resize", updateNav);
  updateNav();

  /* ------------------------------------------------------------------
     6) Marquee de clientes (duplicar grupo para loop infinito)
     ------------------------------------------------------------------ */
  const track = document.getElementById("clientTrack");
  const group = track.querySelector(".marquee__group");
  track.appendChild(group.cloneNode(true));
})();

/* =====================================================================
   7) Modal "Registro Corporativo" — se abre desde "Optimizar mi gestión"
   ===================================================================== */
(function () {
  "use strict";

  const modal = document.getElementById("registerModal");
  const form = document.getElementById("registerForm");
  const submitBtn = document.getElementById("registerSubmit");
  const submitHtml = submitBtn.innerHTML;
  const status = document.getElementById("registerStatus");
  const terms = document.getElementById("rTerms");
  const pass = document.getElementById("rPass");
  const pass2 = document.getElementById("rPass2");
  const fields = ["rCompany", "rEmail", "rRuc", "rPhone", "rCity", "rPass", "rPass2"].map(function (id) { return document.getElementById(id); });
  let lastFocus = null;

  function openModal() {
    lastFocus = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    setTimeout(function () { fields[0].focus(); }, 50);
  }
  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.querySelectorAll("[data-open-register]").forEach(function (b) { b.addEventListener("click", openModal); });
  document.querySelectorAll("[data-close-register]").forEach(function (b) { b.addEventListener("click", closeModal); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  // Solo dígitos en RUC
  document.getElementById("rRuc").addEventListener("input", function (e) {
    e.target.value = e.target.value.replace(/\D/g, "");
  });

  function validate() {
    const filled = fields.every(function (f) { return f.value.trim() !== ""; });
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.getElementById("rEmail").value.trim());
    const passOk = pass.value.length >= 8;
    const match = pass.value === pass2.value;
    pass2.classList.toggle("is-invalid", pass2.value !== "" && !match);
    submitBtn.disabled = !(filled && emailOk && passOk && match && terms.checked);

    if (pass2.value !== "" && !match) {
      status.classList.add("is-error"); status.textContent = "Las contraseñas no coinciden.";
    } else if (pass.value !== "" && !passOk) {
      status.classList.add("is-error"); status.textContent = "La contraseña debe tener al menos 8 caracteres.";
    } else {
      status.classList.remove("is-error"); status.textContent = "";
    }
  }
  fields.forEach(function (f) { f.addEventListener("input", validate); });
  terms.addEventListener("change", validate);
  validate();

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitBtn.disabled) return;

    const data = {
      company: document.getElementById("rCompany").value.trim(),
      email: document.getElementById("rEmail").value.trim(),
      ruc: document.getElementById("rRuc").value.trim(),
      phone: document.getElementById("rPhone").value.trim(),
      city: document.getElementById("rCity").value.trim(),
      createdAt: new Date().toISOString()
    };
    // Punto de integración: enviar `data` (+ contraseña) a tu backend de registro.
    console.log("Registro corporativo:", data);

    submitBtn.disabled = true;
    submitBtn.textContent = "Creando cuenta…";
    setTimeout(function () {
      status.classList.remove("is-error");
      status.textContent = "¡Cuenta creada! Revisa tu correo para activarla.";
      form.reset();
      submitBtn.innerHTML = submitHtml;
      validate();
      setTimeout(closeModal, 1800);
    }, 800);
  });
})();
