/* =====================================================================
   AND Local Ads — páginas de autenticación (login.html / registro.html)
   ===================================================================== */
(function () {
  "use strict";

  /* ---------- Tema (compartido con la landing) ---------- */
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  function applyTheme(theme) {
    root.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("and-theme", theme); } catch (_) {}
  }
  (function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem("and-theme"); } catch (_) {}
    applyTheme(saved || "dark");
  })();
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      applyTheme(root.classList.contains("dark") ? "light" : "dark");
    });
  }

  /* ---------- Mostrar / ocultar contraseña ---------- */
  document.querySelectorAll("[data-toggle-pass]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const input = document.getElementById(btn.dataset.togglePass);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.classList.toggle("is-visible", show);
      btn.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
    });
  });

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ==================================================================
     LOGIN
     ================================================================== */
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    const email = document.getElementById("loginEmail");
    const pass = document.getElementById("loginPass");
    const submit = document.getElementById("loginSubmit");
    const status = document.getElementById("loginStatus");
    const submitHtml = submit.innerHTML;
    let role = "empresa";

    // Selector "Tipo de acceso"
    document.querySelectorAll(".access__btn").forEach(function (b) {
      b.addEventListener("click", function () {
        role = b.dataset.role;
        document.querySelectorAll(".access__btn").forEach(function (o) {
          const on = o === b;
          o.classList.toggle("is-active", on);
          o.setAttribute("aria-checked", on ? "true" : "false");
        });
      });
    });

    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      status.classList.remove("is-error");

      if (!EMAIL_RE.test(email.value.trim())) {
        status.classList.add("is-error"); status.textContent = "Ingresa un correo electrónico válido."; email.focus(); return;
      }
      if (pass.value.length < 1) {
        status.classList.add("is-error"); status.textContent = "Ingresa tu contraseña."; pass.focus(); return;
      }

      const data = { role: role, email: email.value.trim(), loginAt: new Date().toISOString() };
      // Punto de integración: enviar credenciales a tu backend de autenticación.
      console.log("Login:", data);

      submit.disabled = true;
      submit.textContent = "Ingresando…";
      setTimeout(function () {
        status.textContent = role === "admin" ? "Acceso de administrador verificado." : "¡Bienvenido! Redirigiendo a tu panel…";
        submit.innerHTML = submitHtml;
        submit.disabled = false;
      }, 900);
    });
  }

  /* ==================================================================
     REGISTRO CORPORATIVO (página)
     ================================================================== */
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    const submitBtn = document.getElementById("registerSubmit");
    const submitHtml = submitBtn.innerHTML;
    const status = document.getElementById("registerStatus");
    const terms = document.getElementById("rTerms");
    const pass = document.getElementById("rPass");
    const pass2 = document.getElementById("rPass2");
    const fields = ["rCompany", "rEmail", "rRuc", "rPhone", "rCity", "rPass", "rPass2"].map(function (id) { return document.getElementById(id); });

    document.getElementById("rRuc").addEventListener("input", function (e) {
      e.target.value = e.target.value.replace(/\D/g, "");
    });

    function validate() {
      const filled = fields.every(function (f) { return f.value.trim() !== ""; });
      const emailOk = EMAIL_RE.test(document.getElementById("rEmail").value.trim());
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

    registerForm.addEventListener("submit", function (e) {
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
        status.textContent = "¡Cuenta creada! Redirigiendo al inicio de sesión…";
        submitBtn.innerHTML = submitHtml;
        setTimeout(function () { window.location.href = "login.html"; }, 1500);
      }, 800);
    });
  }
})();
