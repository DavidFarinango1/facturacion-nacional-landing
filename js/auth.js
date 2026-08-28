/* =====================================================================
   AND Local Ads — páginas de autenticación (login.html / registro.html)
   Conectadas a la capa de datos compartida (js/store.js):
   - Empresa: valida contra los registros corporativos aprobados → empresa.html
   - Admin AND: valida contra los administradores → admin.html
   ===================================================================== */
(function () {
  "use strict";
  const S = window.ANDStore;

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
  const params = new URLSearchParams(location.search);

  /* ==================================================================
     LOGIN
     ================================================================== */
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    const email = document.getElementById("loginEmail");
    const pass = document.getElementById("loginPass");
    const submit = document.getElementById("loginSubmit");
    const status = document.getElementById("loginStatus");
    const forgot = document.querySelector(".auth__forgot");
    const submitHtml = submit.innerHTML;
    let role = "empresa";

    // Si ya hay sesión activa, ir directo al panel
    const existing = S.getSession();
    if (existing) { window.location.replace(existing.role === "admin" ? "admin.html" : "empresa.html"); return; }

    function setRole(r) {
      role = r;
      document.querySelectorAll(".access__btn").forEach(function (o) {
        const on = o.dataset.role === r;
        o.classList.toggle("is-active", on);
        o.setAttribute("aria-checked", on ? "true" : "false");
      });
      // Misma UI que el original: placeholder, "olvidaste" y pie cambian según el rol
      email.placeholder = r === "admin" ? "admin@and.com" : "tu@email.com";
      if (forgot) forgot.hidden = r === "admin";
      document.querySelectorAll(".auth__foot[data-mode]").forEach(function (f) { f.hidden = f.dataset.mode !== r; });
      status.textContent = ""; status.classList.remove("is-error");
    }
    document.querySelectorAll(".access__btn").forEach(function (b) { b.addEventListener("click", function () { setRole(b.dataset.role); }); });
    // Se acepta ?next=admin o #admin (el hash sobrevive a redirecciones de servidores estáticos)
    setRole(params.get("next") === "admin" || location.hash === "#admin" ? "admin" : "empresa");

    if (params.get("registered") === "1" || location.hash === "#registered") {
      status.classList.remove("is-error");
      status.textContent = "¡Solicitud enviada! Podrás ingresar cuando el equipo de AND apruebe tu empresa.";
    }

    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      status.classList.remove("is-error");

      if (!EMAIL_RE.test(email.value.trim())) {
        status.classList.add("is-error"); status.textContent = "Ingresa un correo electrónico válido."; email.focus(); return;
      }
      if (pass.value.length < 1) {
        status.classList.add("is-error"); status.textContent = "Ingresa tu contraseña."; pass.focus(); return;
      }

      // Punto de integración: reemplazar S.login por una llamada a tu API de autenticación.
      const result = S.login(role, email.value.trim(), pass.value);
      if (result.error) { status.classList.add("is-error"); status.textContent = result.error; pass.focus(); return; }

      submit.disabled = true;
      submit.textContent = "Ingresando…";
      status.textContent = result.role === "admin" ? "Acceso verificado. Abriendo el panel administrador…" : "¡Bienvenido, " + result.name + "! Abriendo tu panel…";
      setTimeout(function () {
        submit.innerHTML = submitHtml;
        window.location.href = result.role === "admin" ? "admin.html" : "empresa.html";
      }, 700);
    });

    /* ----- Registro de nuevo administrador (con código de invitación) ----- */
    const link = document.getElementById("adminRegisterLink");
    const aform = document.getElementById("adminRegisterForm");
    if (link && aform) {
      link.addEventListener("click", function (e) { e.preventDefault(); aform.hidden = !aform.hidden; if (!aform.hidden) document.getElementById("aName").focus(); });
      aform.addEventListener("submit", function (e) {
        e.preventDefault();
        const st = document.getElementById("adminRegisterStatus");
        const name = document.getElementById("aName").value.trim();
        const em = document.getElementById("aEmail").value.trim();
        const pw = document.getElementById("aPass").value;
        const code = document.getElementById("aCode").value.trim();
        st.classList.remove("is-error");
        if (!name || !EMAIL_RE.test(em) || pw.length < 8 || !code) { st.classList.add("is-error"); st.textContent = "Completa todos los campos (contraseña mínimo 8 caracteres)."; return; }
        const r = S.addAdmin({ name: name, email: em, password: pw }, code);
        if (r.error) { st.classList.add("is-error"); st.textContent = r.error; return; }
        st.textContent = "Acceso creado. Ya puedes iniciar sesión como Admin AND.";
        email.value = em; pass.value = ""; aform.reset();
        setTimeout(function () { aform.hidden = true; pass.focus(); }, 1200);
      });
    }
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
    const fields = ["rName", "rCompany", "rEmail", "rRuc", "rPhone", "rCity", "rPass", "rPass2"].map(function (id) { return document.getElementById(id); });

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
        contact: document.getElementById("rName").value.trim(),
        company: document.getElementById("rCompany").value.trim(),
        email: document.getElementById("rEmail").value.trim(),
        ruc: document.getElementById("rRuc").value.trim(),
        phone: document.getElementById("rPhone").value.trim(),
        city: document.getElementById("rCity").value.trim(),
        password: pass.value
      };
      // Se guarda como empresa "pendiente" → el administrador la aprueba en admin.html.
      // Punto de integración: enviar `data` a tu backend de registro.
      const r = S.addCompany(data);
      if (r.error) { status.classList.add("is-error"); status.textContent = r.error; return; }

      submitBtn.disabled = true;
      submitBtn.textContent = "Creando cuenta…";
      setTimeout(function () {
        status.classList.remove("is-error");
        status.textContent = "¡Solicitud enviada! Redirigiendo al inicio de sesión…";
        submitBtn.innerHTML = submitHtml;
        setTimeout(function () { window.location.href = "login.html#registered"; }, 1500);
      }, 800);
    });
  }
})();
