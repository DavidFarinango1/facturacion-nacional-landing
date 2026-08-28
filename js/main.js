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
  // Las tasas se leen de la configuración del panel administrador (js/store.js).
  // Si el panel cambia ISD/IVA/comisión, la calculadora usa los nuevos valores.
  function getRates() {
    const s = (window.ANDStore && window.ANDStore.getSettings()) || { isd: 0.05, iva: 0.15, fee: 0.10, nonDeductible: 0.25 };
    return { ISD: s.isd, IVA: s.iva, FEE: s.fee, NON_DEDUCTIBLE: s.nonDeductible };
  }
  let RATES = getRates();
  function updateRateLabels() {
    const pct = function (v) { return (v * 100).toFixed(v * 100 % 1 === 0 ? 0 : 1) + "%"; };
    document.querySelectorAll("[data-rate]").forEach(function (el) { el.textContent = pct(RATES[el.dataset.rate]); });
  }
  window.addEventListener("storage", function (e) {
    if (e.key === "and_settings") { RATES = getRates(); updateRateLabels(); render(sanitize(investInput.value)); }
  });

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

  function updateRangeFill() {
    const min = +investRange.min, max = +investRange.max, v = +investRange.value;
    investRange.style.setProperty("--pct", Math.round(((v - min) / (max - min)) * 100) + "%");
  }

  function render(inv) {
    updateRangeFill();
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
  const presets = document.querySelectorAll("[data-preset]");
  function syncPresets(v) { presets.forEach(function (b) { b.classList.toggle("is-on", +b.dataset.preset === v); }); }
  presets.forEach(function (b) {
    b.addEventListener("click", function () {
      const v = +b.dataset.preset;
      investInput.value = v; investRange.value = Math.min(Math.max(v, 100), 10000);
      render(v); syncPresets(v);
    });
  });
  investInput.addEventListener("input", function () { syncPresets(sanitize(investInput.value)); });
  investRange.addEventListener("input", function () { syncPresets(+investRange.value); });
  updateRateLabels();
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

    // Se guarda en la capa de datos compartida → aparece en el panel administrador (Leads).
    // Punto de integración: reemplazar por fetch() a tu backend / CRM.
    if (window.ANDStore) window.ANDStore.addLead(data);

    // Mensaje de WhatsApp con los datos del formulario y el ahorro calculado
    const r = compute(data.monthlyBudget);
    const msg = [
      "Hola ENVYX, quiero acceder a mi ahorro facturando localmente mi pauta digital.",
      "",
      "Nombre: " + data.fullName,
      "Empresa: " + data.companyName,
      "Correo: " + data.email,
      "Teléfono: " + data.phone,
      "Pauta mensual: $" + Math.round(data.monthlyBudget).toLocaleString("en-US"),
      "Ahorro estimado: " + fmt(r.saveMonth) + "/mes · " + fmt(r.saveYear) + "/año"
    ].join("\n");
    const url = "https://wa.me/593999078539?text=" + encodeURIComponent(msg);

    const submitHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.textContent = "Abriendo WhatsApp…";
    const win = window.open(url, "_blank");
    if (win) { try { win.opener = null; } catch (_) {} } else { window.location.href = url; } // si el navegador bloquea la pestaña nueva

    setTimeout(function () {
      status.classList.remove("is-error");
      status.textContent = "¡Listo! Te contactaremos pronto para activar tu ahorro.";
      form.reset();
      submitBtn.innerHTML = submitHtml;
      render(sanitize(investInput.value));
      validateForm();
    }, 900);
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
  const navItems = Array.prototype.slice.call(document.querySelectorAll(".nav__link[data-target]"));
  const sections = navItems.map(function (b) { return document.getElementById(b.dataset.target); });

  document.querySelectorAll("[data-target]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      const target = document.getElementById(el.dataset.target);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
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
   8) Modal "Quiero empezar" — datos de la empresa (sin contraseña) →
      se guarda como lead en el panel y abre WhatsApp con el mensaje listo
   ===================================================================== */
(function () {
  "use strict";
  const WHATSAPP_NUMBER = "593999078539"; // 0999078539 (Ecuador) en formato internacional

  const modal = document.getElementById("startModal");
  const form = document.getElementById("startForm");
  if (!modal || !form) return;
  const submitBtn = document.getElementById("startSubmit");
  const status = document.getElementById("startStatus");
  const terms = document.getElementById("sTerms");
  const fields = ["sName", "sCompany", "sEmail", "sRuc", "sPhone", "sCity"].map(function (id) { return document.getElementById(id); });
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
  document.querySelectorAll("[data-open-start]").forEach(function (b) { b.addEventListener("click", openModal); });
  document.querySelectorAll("[data-close-start]").forEach(function (b) { b.addEventListener("click", closeModal); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal(); });
  document.getElementById("sRuc").addEventListener("input", function (e) { e.target.value = e.target.value.replace(/\D/g, ""); });

  function validate() {
    const filled = fields.every(function (f) { return f.value.trim() !== ""; });
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.getElementById("sEmail").value.trim());
    submitBtn.disabled = !(filled && emailOk && terms.checked);
  }
  fields.forEach(function (f) { f.addEventListener("input", validate); });
  terms.addEventListener("change", validate);
  validate();

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitBtn.disabled) return;

    const budgetEl = document.getElementById("investInput");
    const budget = budgetEl ? Math.round(parseFloat(budgetEl.value) || 0) : 0;
    const data = {
      name: document.getElementById("sName").value.trim(),
      company: document.getElementById("sCompany").value.trim(),
      email: document.getElementById("sEmail").value.trim(),
      ruc: document.getElementById("sRuc").value.trim(),
      phone: document.getElementById("sPhone").value.trim(),
      city: document.getElementById("sCity").value.trim()
    };

    // Queda registrado como lead en el panel administrador
    if (window.ANDStore) {
      window.ANDStore.addLead({ fullName: data.name, companyName: data.company, email: data.email, phone: data.phone, monthlyBudget: budget });
      window.ANDStore.updateLead(window.ANDStore.getLeads()[0].id, { notes: "Origen: botón \"Quiero empezar\" (WhatsApp). RUC " + data.ruc + " · " + data.city });
    }

    const msg = [
      "Hola ENVYX, quiero empezar a facturar localmente mi pauta digital.",
      "",
      "Nombre: " + data.name,
      "Empresa: " + data.company,
      "RUC: " + data.ruc,
      "Correo: " + data.email,
      "Teléfono: " + data.phone,
      "Ciudad: " + data.city,
      budget ? "Pauta mensual estimada: $" + budget.toLocaleString("en-US") : ""
    ].filter(function (l, i) { return l !== "" || i === 1; }).join("\n");
    const url = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(msg);

    status.classList.remove("is-error");
    status.textContent = "¡Gracias! Abriendo WhatsApp…";
    const win = window.open(url, "_blank");
    if (win) { try { win.opener = null; } catch (_) {} } else { window.location.href = url; } // si el navegador bloquea la pestaña nueva
    setTimeout(function () { form.reset(); validate(); status.textContent = ""; closeModal(); }, 1500);
  });
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
  const fields = ["rName", "rCompany", "rEmail", "rRuc", "rPhone", "rCity", "rPass", "rPass2"].map(function (id) { return document.getElementById(id); });
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
      contact: document.getElementById("rName").value.trim(),
      company: document.getElementById("rCompany").value.trim(),
      email: document.getElementById("rEmail").value.trim(),
      ruc: document.getElementById("rRuc").value.trim(),
      phone: document.getElementById("rPhone").value.trim(),
      city: document.getElementById("rCity").value.trim(),
      password: pass.value
    };
    // Se guarda en la capa de datos compartida → aparece en el panel administrador (Empresas, pendiente de aprobación).
    // Punto de integración: enviar `data` a tu backend de registro.
    const result = window.ANDStore ? window.ANDStore.addCompany(data) : {};
    if (result && result.error) { status.classList.add("is-error"); status.textContent = result.error; return; }

    submitBtn.disabled = true;
    submitBtn.textContent = "Creando cuenta…";
    setTimeout(function () {
      form.reset();
      submitBtn.innerHTML = submitHtml;
      validate(); // deja el botón deshabilitado y limpia errores…
      status.classList.remove("is-error");
      status.textContent = "¡Solicitud enviada! El equipo de AND la aprobará y podrás iniciar sesión."; // …y luego el mensaje de éxito
      setTimeout(closeModal, 2200);
    }, 800);
  });
})();
