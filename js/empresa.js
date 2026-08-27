/* =====================================================================
   Panel de empresa (cliente) — saldo de pauta, facturas y recargas
   ===================================================================== */
(function () {
  "use strict";
  const S = window.ANDStore;
  const session = S.getSession();
  if (!session || session.role !== "empresa") { window.location.replace("login.html"); return; }

  const root = document.documentElement;
  function applyTheme(t) { root.classList.toggle("dark", t === "dark"); try { localStorage.setItem("and-theme", t); } catch (_) {} }
  (function () { let s = null; try { s = localStorage.getItem("and-theme"); } catch (_) {} applyTheme(s || "dark"); })();
  document.getElementById("themeToggle").addEventListener("click", function () { applyTheme(root.classList.contains("dark") ? "light" : "dark"); });
  document.getElementById("logoutBtn").addEventListener("click", function () { S.logout(); window.location.href = "login.html"; });

  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  const fmt = function (n) { return money.format(Number(n) || 0); };
  const esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function fdate(iso) { return new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" }); }
  let toastTimer;
  function toast(msg) { const t = document.getElementById("toast"); t.textContent = msg; t.classList.add("is-show"); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("is-show"); }, 2600); }

  function render() {
    const c = S.getCompany(session.id);
    if (!c || c.status !== "aprobada") { S.logout(); window.location.replace("login.html"); return; }
    document.getElementById("coName").textContent = c.company;
    document.getElementById("coEmail").textContent = c.email;
    document.getElementById("coAvatar").textContent = c.company.charAt(0).toUpperCase();

    const invs = S.getInvoices().filter(function (f) { return f.companyId === c.id; });
    const pending = invs.filter(function (f) { return f.status === "pendiente"; });
    const paidTotal = invs.filter(function (f) { return f.status === "pagada"; }).reduce(function (a, f) { return a + f.amount; }, 0);
    const s = S.getSettings();
    const rows = invs.map(function (f) {
      return '<tr><td><strong>' + esc(f.number) + '</strong><div class="muted">' + fdate(f.createdAt) + '</div></td><td class="num">' + fmt(f.amount) + '</td><td class="num muted">' + fmt(f.isd + f.fee) + '</td><td class="num muted">' + fmt(f.iva) + '</td><td class="num"><strong>' + fmt(f.total) + '</strong></td><td>' + (f.status === "pagada" ? '<span class="pill pill--ok">Pagada</span>' : '<span class="pill pill--warn">Pendiente de pago</span>') + '</td></tr>';
    }).join("");

    const hasInvoice = invs.length > 0, hasPaid = paidTotal > 0, hasBalance = c.balance > 0;
    document.getElementById("view").innerHTML = '\
<div class="hero-balance"><div><h2>Saldo publicitario disponible</h2><div class="big">' + fmt(c.balance) + '</div><div class="sub">Pauta recargada históricamente: ' + fmt(paidTotal) + '</div></div>\
<form id="rechargeForm" class="pform" style="min-width:260px"><div class="pfield"><label style="color:rgba(255,255,255,.85)">Solicitar recarga de pauta ($)</label><input class="pinput" id="rechargeAmount" type="number" min="100" step="100" placeholder="1000" required /></div><button type="submit" class="pbtn pbtn--accent">Solicitar factura y recargar</button><span id="rechargeMsg" class="pmsg" style="color:#fff"></span></form></div>\
<section class="panel"><div class="panel__head"><div><h2>Tu proceso</h2><p>Los 5 pasos de la landing, aplicados a tu cuenta</p></div></div>\
<div class="steps-mini"><div class="done">Paso 1<b>Monto confirmado</b></div><div class="' + (hasInvoice ? "done" : "") + '">Paso 2<b>Factura local</b></div><div class="' + (hasPaid ? "done" : "") + '">Paso 3<b>Pago</b></div><div class="' + (hasBalance ? "done" : "") + '">Paso 4<b>Pauta recargada</b></div><div class="' + (hasBalance ? "done" : "") + '">Paso 5<b>A pautar</b></div></div></section>\
<section class="panel"><div class="panel__head"><div><h2>Mis facturas nacionales</h2><p>' + invs.length + ' emitidas · ' + pending.length + ' pendientes · ISD ' + (s.isd * 100).toFixed(0) + '% · comisión ' + (s.fee * 100).toFixed(0) + '% · IVA ' + (s.iva * 100).toFixed(0) + '% (crédito tributario)</p></div></div>\
' + (rows ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>N.º</th><th class="num">Pauta</th><th class="num">ISD + comisión</th><th class="num">IVA</th><th class="num">Total</th><th>Estado</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="empty">Aún no tienes facturas. Solicita tu primera recarga arriba.</p>') + '</section>\
<section class="panel"><div class="panel__head"><div><h2>Datos de la empresa</h2></div></div><dl class="dl"><dt>Razón social</dt><dd>' + esc(c.company) + '</dd><dt>RUC</dt><dd>' + esc(c.ruc) + '</dd><dt>Correo</dt><dd>' + esc(c.email) + '</dd><dt>Teléfono</dt><dd>' + esc(c.phone) + '</dd><dt>Ciudad</dt><dd>' + esc(c.city) + '</dd><dt>Cliente desde</dt><dd>' + fdate(c.createdAt) + '</dd></dl></section>';

    const rf = document.getElementById("rechargeForm");
    rf.addEventListener("submit", function (e) {
      e.preventDefault();
      const r = S.requestRecharge(c.id, document.getElementById("rechargeAmount").value);
      const m = document.getElementById("rechargeMsg");
      if (r.error) { m.textContent = r.error; return; }
      toast("Factura " + r.number + " emitida por " + fmt(r.total) + ". Cuando AND registre el pago, tu saldo se recarga.");
      render();
    });
  }
  window.addEventListener("storage", function (e) { if (e.key && e.key.indexOf("and_") === 0) render(); });
  render();
})();
