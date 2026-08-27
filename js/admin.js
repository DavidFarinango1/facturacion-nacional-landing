/* =====================================================================
   Panel Administrador — lógica de vistas
   Depende de js/store.js (ANDStore). Sin librerías externas.
   ===================================================================== */
(function () {
  "use strict";
  const S = window.ANDStore;

  /* ---------- Guardia de sesión ---------- */
  const session = S.getSession();
  if (!session || session.role !== "admin") {
    window.location.replace("login.html#admin");
    return;
  }

  /* ---------- Tema ---------- */
  const root = document.documentElement;
  function applyTheme(t) { root.classList.toggle("dark", t === "dark"); try { localStorage.setItem("and-theme", t); } catch (_) {} }
  (function () { let s = null; try { s = localStorage.getItem("and-theme"); } catch (_) {} applyTheme(s || "dark"); })();
  document.getElementById("themeToggle").addEventListener("click", function () { applyTheme(root.classList.contains("dark") ? "light" : "dark"); });

  /* ---------- Cabecera ---------- */
  document.getElementById("adminName").textContent = session.name;
  document.getElementById("adminEmail").textContent = session.email;
  document.getElementById("adminAvatar").textContent = (session.name || "A").trim().charAt(0).toUpperCase();
  document.getElementById("logoutBtn").addEventListener("click", function () { S.logout(); window.location.href = "login.html"; });

  /* ---------- Sidebar móvil ---------- */
  const sidebar = document.querySelector(".sidebar");
  const backdrop = document.getElementById("backdrop");
  document.getElementById("menuBtn").addEventListener("click", function () { sidebar.classList.add("is-open"); backdrop.classList.add("is-open"); });
  backdrop.addEventListener("click", closeSidebar);
  function closeSidebar() { sidebar.classList.remove("is-open"); backdrop.classList.remove("is-open"); }

  /* ---------- Utilidades ---------- */
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  const fmt = function (n) { return money.format(Number(n) || 0); };
  const esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function fdate(iso) { const d = new Date(iso); return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" }); }
  function fdatetime(iso) { const d = new Date(iso); return d.toLocaleString("es-EC", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  function ago(iso) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "hace un momento";
    if (s < 3600) return "hace " + Math.floor(s / 60) + " min";
    if (s < 86400) return "hace " + Math.floor(s / 3600) + " h";
    return "hace " + Math.floor(s / 86400) + " d";
  }
  let toastTimer;
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("is-show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("is-show"); }, 2600);
  }
  const STATUS = {
    lead: { nuevo: ["info", "Nuevo"], contactado: ["warn", "Contactado"], convertido: ["ok", "Convertido"] },
    company: { pendiente: ["warn", "Pendiente"], aprobada: ["ok", "Aprobada"], rechazada: ["bad", "Rechazada"], suspendida: ["neutral", "Suspendida"] },
    invoice: { pendiente: ["warn", "Pendiente de pago"], pagada: ["ok", "Pagada"] }
  };
  function pill(kind, status) { const m = STATUS[kind][status] || ["neutral", status]; return '<span class="pill pill--' + m[0] + '">' + m[1] + "</span>"; }

  /* ---------- Badges del menú ---------- */
  function refreshBadges() {
    const nl = S.getLeads().filter(function (l) { return l.status === "nuevo"; }).length;
    const nc = S.getCompanies().filter(function (c) { return c.status === "pendiente"; }).length;
    const ni = S.getInvoices().filter(function (f) { return f.status === "pendiente"; }).length;
    document.querySelector('[data-badge="leads"]').textContent = nl || "";
    document.querySelector('[data-badge="companies"]').textContent = nc || "";
    document.querySelector('[data-badge="invoices"]').textContent = ni || "";
  }

  /* ---------- Router ---------- */
  const view = document.getElementById("view");
  const titleEl = document.getElementById("viewTitle");
  const TITLES = { dashboard: "Dashboard", leads: "Leads de la calculadora", companies: "Empresas registradas", invoices: "Facturación", settings: "Configuración", admins: "Administradores", activity: "Actividad reciente" };
  const VIEWS = {};
  let current = "dashboard";
  function go(name) {
    current = VIEWS[name] ? name : "dashboard";
    document.querySelectorAll(".nav-item").forEach(function (b) { b.classList.toggle("is-active", b.dataset.view === current); });
    titleEl.textContent = TITLES[current];
    view.innerHTML = VIEWS[current]();
    bind();
    refreshBadges();
    closeSidebar();
    try { history.replaceState(null, "", "#" + current); } catch (_) {}
  }
  function rerender() { go(current); }
  document.querySelectorAll(".nav-item").forEach(function (b) { b.addEventListener("click", function () { go(b.dataset.view); }); });

  /* ==================================================================
     DASHBOARD
     ================================================================== */
  VIEWS.dashboard = function () {
    const leads = S.getLeads(), comps = S.getCompanies(), invs = S.getInvoices();
    const newLeads = leads.filter(function (l) { return l.status === "nuevo"; }).length;
    const converted = leads.filter(function (l) { return l.status === "convertido"; }).length;
    const pendingC = comps.filter(function (c) { return c.status === "pendiente"; }).length;
    const approved = comps.filter(function (c) { return c.status === "aprobada"; }).length;
    const paid = invs.filter(function (f) { return f.status === "pagada"; });
    const billed = paid.reduce(function (a, f) { return a + f.total; }, 0);
    const pendingAmt = invs.filter(function (f) { return f.status === "pendiente"; }).reduce(function (a, f) { return a + f.total; }, 0);
    const pipeline = leads.reduce(function (a, l) { return a + l.monthlyBudget; }, 0);
    const savings = leads.reduce(function (a, l) { return a + l.saveYear; }, 0);

    // Leads por día (últimos 7 días) — una sola serie
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i); days.push(d); }
    const counts = days.map(function (d) {
      const next = new Date(d); next.setDate(d.getDate() + 1);
      return leads.filter(function (l) { const t = new Date(l.createdAt); return t >= d && t < next; }).length;
    });
    const max = Math.max(1, Math.max.apply(null, counts));
    const bars = counts.map(function (c, i) {
      return '<div class="chart__col" title="' + c + ' lead' + (c === 1 ? "" : "s") + ' el ' + fdate(days[i]) + '"><span class="chart__val">' + c + '</span><div class="chart__bar" style="height:' + Math.round((c / max) * 100) + '%"></div></div>';
    }).join("");
    const labels = days.map(function (d) { return "<span>" + d.toLocaleDateString("es-EC", { weekday: "short" }).replace(".", "") + "</span>"; }).join("");

    const cs = { pendiente: pendingC, aprobada: approved, rechazada: comps.filter(function (c) { return c.status === "rechazada"; }).length, suspendida: comps.filter(function (c) { return c.status === "suspendida"; }).length };
    const totalC = Math.max(1, comps.length);
    const statusBar = ["aprobada", "pendiente", "suspendida", "rechazada"].map(function (k) {
      const m = STATUS.company[k]; return '<span style="width:' + (cs[k] / totalC * 100) + '%;background:var(--' + (m[0] === "neutral" ? "neutral" : m[0]) + ')" title="' + m[1] + ': ' + cs[k] + '"></span>';
    }).join("");
    const statusList = ["aprobada", "pendiente", "suspendida", "rechazada"].map(function (k) { return "<li>" + pill("company", k) + "<b>" + cs[k] + "</b></li>"; }).join("");

    const recent = S.getActivity().slice(0, 6).map(function (a) {
      return '<li><span class="act-ico act-ico--' + a.type + '">' + a.type.slice(0, 2) + '</span><div>' + esc(a.message) + '<div class="act-time">' + ago(a.at) + '</div></div></li>';
    }).join("") || '<li class="empty">Sin actividad todavía.</li>';

    const pendingList = comps.filter(function (c) { return c.status === "pendiente"; }).slice(0, 5).map(function (c) {
      return '<tr><td><strong>' + esc(c.company) + '</strong><div class="muted">' + esc(c.city) + ' · RUC ' + esc(c.ruc) + '</div></td><td class="muted">' + ago(c.createdAt) + '</td><td class="actions"><button class="pbtn pbtn--sm pbtn--ok" data-approve="' + c.id + '">Aprobar</button><button class="pbtn pbtn--sm pbtn--bad" data-reject="' + c.id + '">Rechazar</button></td></tr>';
    }).join("");

    return '\
<div class="grid-4">\
  <div class="stat"><span class="stat__icon"><svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Z"/></svg></span><span class="stat__label">Leads</span><span class="stat__value">' + leads.length + '</span><span class="stat__sub"><b>' + newLeads + ' nuevos</b> · ' + converted + ' convertidos</span></div>\
  <div class="stat"><span class="stat__icon stat__icon--warn"><svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M240,208H224V96a16,16,0,0,0-16-16H144V32a16,16,0,0,0-24.88-13.32L39.12,72A16,16,0,0,0,32,85.34V208H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16Z"/></svg></span><span class="stat__label">Empresas</span><span class="stat__value">' + comps.length + '</span><span class="stat__sub"><b>' + approved + ' activas</b> · ' + pendingC + ' por aprobar</span></div>\
  <div class="stat"><span class="stat__icon stat__icon--ok"><svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Z"/></svg></span><span class="stat__label">Facturado (pagado)</span><span class="stat__value">' + fmt(billed) + '</span><span class="stat__sub">' + fmt(pendingAmt) + ' pendiente de cobro</span></div>\
  <div class="stat"><span class="stat__icon"><svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V48a8,8,0,0,1,16,0v94.37L90.73,98a8,8,0,0,1,10.07-.38l58.81,44.11L218.73,90a8,8,0,1,1,10.54,12l-64,56a8,8,0,0,1-10.07.38L96.39,114.29,40,163.63V200H224A8,8,0,0,1,232,208Z"/></svg></span><span class="stat__label">Pauta mensual en pipeline</span><span class="stat__value">' + fmt(pipeline) + '</span><span class="stat__sub">Ahorro anual prometido: <b>' + fmt(savings) + '</b></span></div>\
</div>\
<div class="grid-3">\
  <section class="panel"><div class="panel__head"><div><h2>Leads por día</h2><p>Registros de la calculadora en los últimos 7 días</p></div><span class="legend"><i style="background:var(--emerald-500)"></i>Leads</span></div>\
    <div class="chart"><div class="chart__bars">' + bars + '</div><div class="chart__labels">' + labels + '</div></div></section>\
  <section class="panel"><div class="panel__head"><div><h2>Estado de empresas</h2><p>' + comps.length + ' registradas</p></div></div><div class="status-bar">' + statusBar + '</div><div class="status-list"><ul>' + statusList + '</ul></div></section>\
</div>\
<div class="grid-2">\
  <section class="panel"><div class="panel__head"><div><h2>Solicitudes por aprobar</h2><p>Registros corporativos pendientes</p></div><button class="pbtn" data-go="companies">Ver todas</button></div>\
    ' + (pendingList ? '<div class="table-wrap"><table class="tbl"><tbody>' + pendingList + '</tbody></table></div>' : '<p class="empty">No hay solicitudes pendientes. ✔</p>') + '</section>\
  <section class="panel"><div class="panel__head"><div><h2>Actividad reciente</h2></div><button class="pbtn" data-go="activity">Ver todo</button></div><ul class="timeline-list">' + recent + '</ul></section>\
</div>';
  };

  /* ==================================================================
     LEADS
     ================================================================== */
  const leadFilter = { q: "", status: "" };
  VIEWS.leads = function () {
    let leads = S.getLeads();
    if (leadFilter.status) leads = leads.filter(function (l) { return l.status === leadFilter.status; });
    if (leadFilter.q) { const q = leadFilter.q.toLowerCase(); leads = leads.filter(function (l) { return (l.fullName + " " + l.companyName + " " + l.email + " " + l.phone).toLowerCase().indexOf(q) >= 0; }); }
    const rows = leads.map(function (l) {
      return '<tr>\
<td><strong>' + esc(l.companyName) + '</strong><div class="muted">' + esc(l.fullName) + '</div></td>\
<td>' + esc(l.email) + '<div class="muted">' + esc(l.phone) + '</div></td>\
<td class="num">' + fmt(l.monthlyBudget) + '</td>\
<td class="num">' + fmt(l.saveYear) + '<div class="muted">' + fmt(l.saveMonth) + '/mes</div></td>\
<td>' + pill("lead", l.status) + '</td>\
<td class="muted">' + fdatetime(l.createdAt) + '</td>\
<td class="actions"><select class="pselect" data-lead-status="' + l.id + '"><option value="nuevo"' + (l.status === "nuevo" ? " selected" : "") + '>Nuevo</option><option value="contactado"' + (l.status === "contactado" ? " selected" : "") + '>Contactado</option><option value="convertido"' + (l.status === "convertido" ? " selected" : "") + '>Convertido</option></select>\
<button class="pbtn pbtn--sm" data-lead-detail="' + l.id + '">Detalle</button><button class="pbtn pbtn--sm pbtn--bad" data-lead-del="' + l.id + '">Eliminar</button></td></tr>';
    }).join("");
    return '<section class="panel"><div class="panel__head"><div><h2>' + leads.length + ' lead' + (leads.length === 1 ? "" : "s") + '</h2><p>Personas que dejaron sus datos en "Deja tus datos y accede a tu ahorro"</p></div>\
<div class="filters"><input class="pinput pinput--search" id="leadQ" placeholder="Buscar por nombre, empresa, correo…" value="' + esc(leadFilter.q) + '" />\
<select class="pselect" id="leadStatus"><option value="">Todos los estados</option><option value="nuevo"' + (leadFilter.status === "nuevo" ? " selected" : "") + '>Nuevos</option><option value="contactado"' + (leadFilter.status === "contactado" ? " selected" : "") + '>Contactados</option><option value="convertido"' + (leadFilter.status === "convertido" ? " selected" : "") + '>Convertidos</option></select>\
<button class="pbtn" id="leadExport">Exportar CSV</button></div></div>\
' + (rows ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Empresa / contacto</th><th>Contacto</th><th class="num">Pauta mensual</th><th class="num">Ahorro anual</th><th>Estado</th><th>Fecha</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="empty">No hay leads que coincidan.</p>') + '</section>';
  };

  /* ==================================================================
     EMPRESAS
     ================================================================== */
  const compFilter = { q: "", status: "" };
  VIEWS.companies = function () {
    let comps = S.getCompanies();
    if (compFilter.status) comps = comps.filter(function (c) { return c.status === compFilter.status; });
    if (compFilter.q) { const q = compFilter.q.toLowerCase(); comps = comps.filter(function (c) { return (c.company + " " + c.email + " " + c.ruc + " " + c.city).toLowerCase().indexOf(q) >= 0; }); }
    const rows = comps.map(function (c) {
      let actions = '';
      if (c.status === "pendiente") actions = '<button class="pbtn pbtn--sm pbtn--ok" data-approve="' + c.id + '">Aprobar</button><button class="pbtn pbtn--sm pbtn--bad" data-reject="' + c.id + '">Rechazar</button>';
      else if (c.status === "aprobada") actions = '<button class="pbtn pbtn--sm pbtn--primary" data-invoice="' + c.id + '">Emitir factura</button><button class="pbtn pbtn--sm pbtn--warn" data-suspend="' + c.id + '">Suspender</button>';
      else actions = '<button class="pbtn pbtn--sm pbtn--ok" data-approve="' + c.id + '">Reactivar</button>';
      return '<tr><td><strong>' + esc(c.company) + '</strong><div class="muted">RUC ' + esc(c.ruc) + '</div></td><td>' + esc(c.email) + '<div class="muted">' + esc(c.phone) + '</div></td><td>' + esc(c.city) + '</td><td class="num">' + fmt(c.balance) + '</td><td>' + pill("company", c.status) + '</td><td class="muted">' + fdate(c.createdAt) + '</td><td class="actions">' + actions + '<button class="pbtn pbtn--sm" data-comp-detail="' + c.id + '">Detalle</button></td></tr>';
    }).join("");
    return '<section class="panel"><div class="panel__head"><div><h2>' + comps.length + ' empresa' + (comps.length === 1 ? "" : "s") + '</h2><p>Registros corporativos (formulario "Registro Corporativo")</p></div>\
<div class="filters"><input class="pinput pinput--search" id="compQ" placeholder="Buscar empresa, RUC, correo, ciudad…" value="' + esc(compFilter.q) + '" />\
<select class="pselect" id="compStatus"><option value="">Todos los estados</option>' + ["pendiente", "aprobada", "suspendida", "rechazada"].map(function (k) { return '<option value="' + k + '"' + (compFilter.status === k ? " selected" : "") + '>' + STATUS.company[k][1] + '</option>'; }).join("") + '</select></div></div>\
' + (rows ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Empresa</th><th>Contacto</th><th>Ciudad</th><th class="num">Saldo pauta</th><th>Estado</th><th>Registro</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="empty">No hay empresas que coincidan.</p>') + '</section>';
  };

  /* ==================================================================
     FACTURAS
     ================================================================== */
  const invFilter = { status: "" };
  VIEWS.invoices = function () {
    let invs = S.getInvoices();
    if (invFilter.status) invs = invs.filter(function (f) { return f.status === invFilter.status; });
    const s = S.getSettings();
    const approved = S.getCompanies().filter(function (c) { return c.status === "aprobada"; });
    const opts = approved.map(function (c) { return '<option value="' + c.id + '">' + esc(c.company) + '</option>'; }).join("");
    const rows = invs.map(function (f) {
      return '<tr><td><strong>' + esc(f.number) + '</strong><div class="muted">' + fdate(f.createdAt) + '</div></td><td>' + esc(f.companyName) + '</td><td class="num">' + fmt(f.amount) + '</td><td class="num muted">' + fmt(f.isd) + '</td><td class="num muted">' + fmt(f.fee) + '</td><td class="num muted">' + fmt(f.iva) + '</td><td class="num"><strong>' + fmt(f.total) + '</strong></td><td>' + pill("invoice", f.status) + (f.paidAt ? '<div class="muted">' + fdate(f.paidAt) + '</div>' : '') + '</td><td class="actions">' + (f.status === "pendiente" ? '<button class="pbtn pbtn--sm pbtn--ok" data-pay="' + f.id + '">Marcar pagada</button>' : '<span class="muted">Saldo acreditado</span>') + '</td></tr>';
    }).join("");
    const total = invs.reduce(function (a, f) { return a + f.total; }, 0);
    return '<section class="panel"><div class="panel__head"><div><h2>Emitir factura nacional</h2><p>Paso 2 del proceso: una única factura válida fiscalmente. Al marcarla pagada se recarga la pauta (paso 4).</p></div></div>\
<form id="invoiceForm" class="pform pform--2">\
<div class="pfield"><label>Empresa (solo aprobadas)</label><select class="pselect" id="invCompany" required>' + (opts || '<option value="">— No hay empresas aprobadas —</option>') + '</select></div>\
<div class="pfield"><label>Monto de pauta ($)</label><input class="pinput" id="invAmount" type="number" min="1" step="1" placeholder="1000" required /><span class="hint">Se agregan ISD ' + (s.isd * 100).toFixed(1) + '%, comisión AND ' + (s.fee * 100).toFixed(1) + '% e IVA ' + (s.iva * 100).toFixed(1) + '% (crédito tributario).</span></div>\
<div class="pform__actions" style="grid-column:1/-1"><button type="submit" class="pbtn pbtn--primary"' + (opts ? "" : " disabled") + '>Emitir factura</button><span id="invPreview" class="pmsg"></span></div></form></section>\
<section class="panel"><div class="panel__head"><div><h2>' + invs.length + ' factura' + (invs.length === 1 ? "" : "s") + ' · ' + fmt(total) + '</h2></div>\
<div class="filters"><select class="pselect" id="invStatus"><option value="">Todas</option><option value="pendiente"' + (invFilter.status === "pendiente" ? " selected" : "") + '>Pendientes</option><option value="pagada"' + (invFilter.status === "pagada" ? " selected" : "") + '>Pagadas</option></select></div></div>\
' + (rows ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>N.º</th><th>Empresa</th><th class="num">Pauta</th><th class="num">ISD</th><th class="num">Comisión</th><th class="num">IVA</th><th class="num">Total</th><th>Estado</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="empty">No hay facturas.</p>') + '</section>';
  };

  /* ==================================================================
     CONFIGURACIÓN
     ================================================================== */
  VIEWS.settings = function () {
    const s = S.getSettings();
    return '<section class="panel"><div class="panel__head"><div><h2>Tasas de la calculadora de ahorro</h2><p>Estos valores los usa la calculadora de la página principal y la emisión de facturas. Cambia aquí y la landing se actualiza.</p></div></div>\
<form id="settingsForm" class="pform pform--2" novalidate>\
<div class="pfield"><label>ISD — Impuesto a la Salida de Divisas (%)</label><input class="pinput" name="isd" type="number" step="0.1" min="0" max="100" value="' + (s.isd * 100) + '" /></div>\
<div class="pfield"><label>IVA (%)</label><input class="pinput" name="iva" type="number" step="0.1" min="0" max="100" value="' + (s.iva * 100) + '" /></div>\
<div class="pfield"><label>Comisión AND (%)</label><input class="pinput" name="fee" type="number" step="0.1" min="0" max="100" value="' + (s.fee * 100) + '" /></div>\
<div class="pfield"><label>Gasto no deducible sin factura (%)</label><input class="pinput" name="nonDeductible" type="number" step="0.1" min="0" max="100" value="' + (s.nonDeductible * 100) + '" /></div>\
<div class="pfield"><label>Código de invitación para nuevos administradores</label><input class="pinput" name="inviteCode" type="text" value="' + esc(s.inviteCode) + '" /><span class="hint">Se pide en "¿Nuevo administrador? Registrar acceso" del login.</span></div>\
<div class="pfield"><label>Vista previa con pauta de ($)</label><input class="pinput" id="previewAmount" type="number" min="0" step="100" value="1000" /></div>\
<div class="pform__actions" style="grid-column:1/-1"><button type="submit" class="pbtn pbtn--primary">Guardar cambios</button><button type="button" class="pbtn" id="settingsReset">Restaurar valores originales</button><span id="settingsMsg" class="pmsg"></span></div></form>\
<div class="preview" id="preview"></div></section>\
<section class="panel"><div class="panel__head"><div><h2>Datos de demostración</h2><p>Todo el panel guarda la información en este navegador (localStorage). Puedes reiniciar los datos de ejemplo.</p></div><button class="pbtn pbtn--bad" id="resetDemo">Reiniciar datos de demo</button></div></section>';
  };
  function renderPreview() {
    const f = document.getElementById("settingsForm"); if (!f) return;
    const s = { isd: +f.isd.value / 100 || 0, iva: +f.iva.value / 100 || 0, fee: +f.fee.value / 100 || 0, nonDeductible: +f.nonDeductible.value / 100 || 0 };
    const r = S.compute(+document.getElementById("previewAmount").value || 0, s);
    document.getElementById("preview").innerHTML = '\
<div class="preview__card"><h4>Sin factura nacional</h4><div class="line"><span>Inversión</span><span>' + fmt(r.inv) + '</span></div><div class="line"><span>ISD</span><span>' + fmt(r.isd) + '</span></div><div class="line"><span>IVA (no recuperable)</span><span>' + fmt(r.iva1) + '</span></div><div class="line"><span>No deducible</span><span>' + fmt(r.nonDeductible) + '</span></div><div class="line total"><span>Gasto real</span><span>' + fmt(r.total1) + '</span></div></div>\
<div class="preview__card"><h4>Con factura nacional</h4><div class="line"><span>Inversión</span><span>' + fmt(r.inv) + '</span></div><div class="line"><span>ISD</span><span>' + fmt(r.isd) + '</span></div><div class="line"><span>Comisión AND</span><span>' + fmt(r.fee) + '</span></div><div class="line"><span>IVA (crédito)</span><span>' + fmt(r.iva2) + '</span></div><div class="line total"><span>Gasto real</span><span>' + fmt(r.total2) + '</span></div><div class="line"><span>Ahorro mensual</span><span><b>' + fmt(r.saveMonth) + ' (' + r.savePct.toFixed(1) + '%)</b></span></div></div>';
  }

  /* ==================================================================
     ADMINISTRADORES
     ================================================================== */
  VIEWS.admins = function () {
    const admins = S.getAdmins();
    const rows = admins.map(function (a) {
      return '<tr><td><strong>' + esc(a.name) + '</strong>' + (a.id === session.id ? ' <span class="pill pill--info">Tú</span>' : '') + '</td><td>' + esc(a.email) + '</td><td class="muted">' + fdate(a.createdAt) + '</td><td class="actions">' + (a.id === session.id ? '' : '<button class="pbtn pbtn--sm pbtn--bad" data-admin-del="' + a.id + '">Eliminar</button>') + '</td></tr>';
    }).join("");
    return '<section class="panel"><div class="panel__head"><div><h2>' + admins.length + ' administrador' + (admins.length === 1 ? "" : "es") + '</h2><p>Personas con acceso "Admin AND"</p></div></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Nombre</th><th>Correo</th><th>Alta</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></section>\
<section class="panel"><div class="panel__head"><div><h2>Agregar administrador</h2><p>También se puede desde el login con el código de invitación.</p></div></div>\
<form id="adminForm" class="pform pform--2"><div class="pfield"><label>Nombre</label><input class="pinput" name="name" required placeholder="Nombre completo" /></div><div class="pfield"><label>Correo</label><input class="pinput" name="email" type="email" required placeholder="nombre@and.com" /></div><div class="pfield"><label>Contraseña</label><input class="pinput" name="password" type="password" minlength="8" required placeholder="Mínimo 8 caracteres" /></div>\
<div class="pform__actions" style="align-self:end"><button type="submit" class="pbtn pbtn--primary">Crear acceso</button><span id="adminMsg" class="pmsg"></span></div></form></section>';
  };

  /* ==================================================================
     ACTIVIDAD
     ================================================================== */
  VIEWS.activity = function () {
    const list = S.getActivity();
    const items = list.map(function (a) { return '<li><span class="act-ico act-ico--' + a.type + '">' + a.type.slice(0, 2) + '</span><div>' + esc(a.message) + '<div class="act-time">' + fdatetime(a.at) + ' · ' + ago(a.at) + '</div></div></li>'; }).join("");
    return '<section class="panel"><div class="panel__head"><div><h2>' + list.length + ' evento' + (list.length === 1 ? "" : "s") + '</h2><p>Todo lo que ocurre en la landing, el login y el panel</p></div></div><ul class="timeline-list">' + (items || '<li class="empty">Sin actividad.</li>') + '</ul></section>';
  };

  /* ==================================================================
     DRAWER de detalle
     ================================================================== */
  function openDrawer(title, html) {
    let d = document.getElementById("drawer");
    if (!d) {
      d = document.createElement("div"); d.id = "drawer"; d.className = "drawer";
      d.innerHTML = '<div class="drawer__bg"></div><div class="drawer__panel"><div class="drawer__head"><h3 id="drawerTitle"></h3><button class="drawer__close" aria-label="Cerrar">✕</button></div><div id="drawerBody"></div></div>';
      document.body.appendChild(d);
      d.querySelector(".drawer__bg").addEventListener("click", closeDrawer);
      d.querySelector(".drawer__close").addEventListener("click", closeDrawer);
    }
    document.getElementById("drawerTitle").textContent = title;
    document.getElementById("drawerBody").innerHTML = html;
    d.classList.add("is-open");
  }
  function closeDrawer() { const d = document.getElementById("drawer"); if (d) d.classList.remove("is-open"); }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDrawer(); });

  /* ==================================================================
     EVENTOS (delegados) por vista
     ================================================================== */
  function bind() {
    view.querySelectorAll("[data-go]").forEach(function (b) { b.addEventListener("click", function () { go(b.dataset.go); }); });

    // Empresas: aprobar / rechazar / suspender / detalle / factura
    view.querySelectorAll("[data-approve]").forEach(function (b) { b.addEventListener("click", function () { const c = S.updateCompany(b.dataset.approve, { status: "aprobada" }); toast(c.company + " aprobada. Ya puede iniciar sesión."); rerender(); }); });
    view.querySelectorAll("[data-reject]").forEach(function (b) { b.addEventListener("click", function () { if (!confirm("¿Rechazar esta solicitud?")) return; const c = S.updateCompany(b.dataset.reject, { status: "rechazada" }); toast(c.company + " rechazada."); rerender(); }); });
    view.querySelectorAll("[data-suspend]").forEach(function (b) { b.addEventListener("click", function () { const c = S.updateCompany(b.dataset.suspend, { status: "suspendida" }); toast(c.company + " suspendida."); rerender(); }); });
    view.querySelectorAll("[data-invoice]").forEach(function (b) { b.addEventListener("click", function () { go("invoices"); const sel = document.getElementById("invCompany"); if (sel) { sel.value = b.dataset.invoice; document.getElementById("invAmount").focus(); } }); });
    view.querySelectorAll("[data-comp-detail]").forEach(function (b) { b.addEventListener("click", function () {
      const c = S.getCompany(b.dataset.compDetail); if (!c) return;
      const invs = S.getInvoices().filter(function (f) { return f.companyId === c.id; });
      const invRows = invs.map(function (f) { return '<li style="display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid var(--panel-border)"><span>' + esc(f.number) + '</span><span>' + fmt(f.total) + ' ' + pill("invoice", f.status) + '</span></li>'; }).join("");
      openDrawer(c.company, '<dl class="dl"><dt>Estado</dt><dd>' + pill("company", c.status) + '</dd><dt>RUC</dt><dd>' + esc(c.ruc) + '</dd><dt>Correo</dt><dd>' + esc(c.email) + '</dd><dt>Teléfono</dt><dd>' + esc(c.phone) + '</dd><dt>Ciudad</dt><dd>' + esc(c.city) + '</dd><dt>Saldo de pauta</dt><dd>' + fmt(c.balance) + '</dd><dt>Registro</dt><dd>' + fdatetime(c.createdAt) + '</dd></dl><h4 style="margin:1.25rem 0 .5rem;font-size:.85rem">Facturas (' + invs.length + ')</h4><ul style="list-style:none;padding:0;margin:0;font-size:.85rem">' + (invRows || '<li class="muted">Sin facturas.</li>') + '</ul>');
    }); });

    // Leads
    const lq = document.getElementById("leadQ"), ls = document.getElementById("leadStatus");
    if (lq) lq.addEventListener("input", function () { leadFilter.q = lq.value; const pos = lq.selectionStart; rerender(); const n = document.getElementById("leadQ"); n.focus(); n.setSelectionRange(pos, pos); });
    if (ls) ls.addEventListener("change", function () { leadFilter.status = ls.value; rerender(); });
    view.querySelectorAll("[data-lead-status]").forEach(function (sel) { sel.addEventListener("change", function () { S.updateLead(sel.dataset.leadStatus, { status: sel.value }); toast("Estado actualizado."); rerender(); }); });
    view.querySelectorAll("[data-lead-del]").forEach(function (b) { b.addEventListener("click", function () { if (!confirm("¿Eliminar este lead?")) return; S.deleteLead(b.dataset.leadDel); toast("Lead eliminado."); rerender(); }); });
    view.querySelectorAll("[data-lead-detail]").forEach(function (b) { b.addEventListener("click", function () {
      const l = S.getLeads().find(function (x) { return x.id === b.dataset.leadDetail; }); if (!l) return;
      const r = S.compute(l.monthlyBudget);
      openDrawer(l.companyName, '<dl class="dl"><dt>Contacto</dt><dd>' + esc(l.fullName) + '</dd><dt>Correo</dt><dd><a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a></dd><dt>Teléfono</dt><dd><a href="tel:' + esc(l.phone.replace(/\s/g, "")) + '">' + esc(l.phone) + '</a></dd><dt>Pauta mensual</dt><dd>' + fmt(l.monthlyBudget) + '</dd><dt>Sin factura</dt><dd>' + fmt(r.total1) + '</dd><dt>Con factura</dt><dd>' + fmt(r.total2) + '</dd><dt>Ahorro</dt><dd>' + fmt(r.saveMonth) + '/mes · ' + fmt(r.saveYear) + '/año</dd><dt>Estado</dt><dd>' + pill("lead", l.status) + '</dd><dt>Fecha</dt><dd>' + fdatetime(l.createdAt) + '</dd></dl>\
<div class="pfield" style="margin-top:1.25rem"><label>Notas de seguimiento</label><textarea class="ptextarea" id="leadNotes" rows="4" placeholder="Ej. Llamé el lunes, pidió propuesta…">' + esc(l.notes) + '</textarea></div><div class="pform__actions" style="margin-top:.75rem"><button class="pbtn pbtn--primary" id="saveNotes">Guardar notas</button><a class="pbtn" href="https://wa.me/' + esc(l.phone.replace(/\D/g, "")) + '" target="_blank" rel="noopener">WhatsApp</a></div>');
      document.getElementById("saveNotes").addEventListener("click", function () { S.updateLead(l.id, { notes: document.getElementById("leadNotes").value }); toast("Notas guardadas."); });
    }); });
    const ex = document.getElementById("leadExport");
    if (ex) ex.addEventListener("click", function () {
      const rows = [["Empresa", "Contacto", "Correo", "Telefono", "Pauta mensual", "Ahorro mensual", "Ahorro anual", "Estado", "Fecha", "Notas"]].concat(S.getLeads().map(function (l) { return [l.companyName, l.fullName, l.email, l.phone, l.monthlyBudget, l.saveMonth.toFixed(2), l.saveYear.toFixed(2), l.status, l.createdAt, l.notes]; }));
      const csv = rows.map(function (r) { return r.map(function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }).join(","); }).join("\n");
      const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8,﻿" + encodeURIComponent(csv); a.download = "leads-and.csv"; a.click();
      toast("CSV exportado.");
    });

    // Empresas filtros
    const cq = document.getElementById("compQ"), cs = document.getElementById("compStatus");
    if (cq) cq.addEventListener("input", function () { compFilter.q = cq.value; const pos = cq.selectionStart; rerender(); const n = document.getElementById("compQ"); n.focus(); n.setSelectionRange(pos, pos); });
    if (cs) cs.addEventListener("change", function () { compFilter.status = cs.value; rerender(); });

    // Facturas
    const invForm = document.getElementById("invoiceForm");
    if (invForm) {
      const amt = document.getElementById("invAmount"), pv = document.getElementById("invPreview");
      amt.addEventListener("input", function () { const r = S.compute(+amt.value || 0); pv.className = "pmsg"; pv.textContent = amt.value ? "Total de la factura: " + fmt(r.total2) : ""; });
      invForm.addEventListener("submit", function (e) { e.preventDefault(); const r = S.createInvoice(document.getElementById("invCompany").value, amt.value); if (r.error) { pv.className = "pmsg pmsg--bad"; pv.textContent = r.error; return; } toast("Factura " + r.number + " emitida."); rerender(); });
    }
    const is = document.getElementById("invStatus");
    if (is) is.addEventListener("change", function () { invFilter.status = is.value; rerender(); });
    view.querySelectorAll("[data-pay]").forEach(function (b) { b.addEventListener("click", function () { const f = S.markInvoicePaid(b.dataset.pay); if (f) toast("Pago registrado. Saldo de " + f.companyName + " recargado con " + fmt(f.amount) + "."); rerender(); }); });

    // Configuración
    const sf = document.getElementById("settingsForm");
    if (sf) {
      renderPreview();
      sf.addEventListener("input", renderPreview);
      sf.addEventListener("submit", function (e) {
        e.preventDefault();
        S.saveSettings({ isd: +sf.isd.value / 100, iva: +sf.iva.value / 100, fee: +sf.fee.value / 100, nonDeductible: +sf.nonDeductible.value / 100, inviteCode: sf.inviteCode.value.trim() || "AND2025" });
        const m = document.getElementById("settingsMsg"); m.className = "pmsg pmsg--ok"; m.textContent = "Guardado. La calculadora de la landing ya usa estas tasas.";
        toast("Configuración guardada.");
      });
      document.getElementById("settingsReset").addEventListener("click", function () { S.saveSettings({ isd: .05, iva: .15, fee: .10, nonDeductible: .25 }); toast("Tasas restauradas."); rerender(); });
      document.getElementById("resetDemo").addEventListener("click", function () { if (!confirm("Esto borra leads, empresas, facturas y administradores creados, y vuelve a los datos de ejemplo. ¿Continuar?")) return; S.resetDemo(); S.logout(); window.location.href = "login.html"; });
    }

    // Administradores
    const af = document.getElementById("adminForm");
    if (af) af.addEventListener("submit", function (e) {
      e.preventDefault();
      const r = S.addAdmin({ name: af.name.value.trim(), email: af.email.value.trim(), password: af.password.value }, S.getSettings().inviteCode);
      const m = document.getElementById("adminMsg");
      if (r.error) { m.className = "pmsg pmsg--bad"; m.textContent = r.error; return; }
      toast("Administrador creado."); rerender();
    });
    view.querySelectorAll("[data-admin-del]").forEach(function (b) { b.addEventListener("click", function () { if (!confirm("¿Eliminar este administrador?")) return; const r = S.removeAdmin(b.dataset.adminDel); if (r && r.error) { toast(r.error); return; } toast("Administrador eliminado."); rerender(); }); });
  }

  /* ---------- Sincronización entre pestañas (landing → panel en vivo) ---------- */
  window.addEventListener("storage", function (e) { if (e.key && e.key.indexOf("and_") === 0) { refreshBadges(); if (current === "dashboard" || current === "leads" || current === "companies" || current === "activity") rerender(); } });

  /* ---------- Inicio ---------- */
  go((location.hash || "#dashboard").slice(1));
})();
