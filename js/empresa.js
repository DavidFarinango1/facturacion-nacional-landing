/* =====================================================================
   Panel de empresa (cliente)
   Paso 1 monto → Paso 2 factura (PDF) → Paso 3 comprobante de pago →
   Paso 4 saldo recargado → Paso 5 asignar pauta por plataforma
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
  function toast(msg) { const t = document.getElementById("toast"); t.textContent = msg; t.classList.add("is-show"); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("is-show"); }, 3200); }
  const INV_STATUS = { pendiente: '<span class="pill pill--warn">Pendiente de pago</span>', en_revision: '<span class="pill pill--info">Pago en revisión</span>', pagada: '<span class="pill pill--ok">Pagada</span>' };
  const P = S.PLATFORMS;

  /* Lee un archivo (imagen o PDF) → dataURL; las imágenes se reducen para caber en localStorage */
  function readReceipt(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject("Selecciona un archivo.");
      if (file.type === "application/pdf") {
        if (file.size > 900000) return reject("El PDF supera 900 KB. Sube una captura o imagen del comprobante.");
        const r = new FileReader(); r.onload = function () { resolve({ dataUrl: r.result, name: file.name, type: file.type }); }; r.onerror = function () { reject("No se pudo leer el archivo."); }; r.readAsDataURL(file); return;
      }
      if (!/^image\//.test(file.type)) return reject("Formato no admitido. Sube una imagen (JPG/PNG) o PDF.");
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        const max = 1200, k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        resolve({ dataUrl: cv.toDataURL("image/jpeg", 0.8), name: file.name, type: "image/jpeg" });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject("No se pudo procesar la imagen."); };
      img.src = url;
    });
  }

  function render() {
    const c = S.getCompany(session.id);
    if (!c || c.status !== "aprobada") { S.logout(); window.location.replace("login.html"); return; }
    document.getElementById("coName").textContent = c.company;
    document.getElementById("coEmail").textContent = c.email;
    document.getElementById("coAvatar").textContent = c.company.charAt(0).toUpperCase();

    const invs = S.getInvoices().filter(function (f) { return f.companyId === c.id; });
    const pending = invs.filter(function (f) { return f.status === "pendiente"; });
    const reviewing = invs.filter(function (f) { return f.status === "en_revision"; });
    const paidTotal = invs.filter(function (f) { return f.status === "pagada"; }).reduce(function (a, f) { return a + f.amount; }, 0);
    const spends = S.getSpends(c.id);
    const byPlat = S.spendByPlatform(c.id);
    const spentTotal = spends.reduce(function (a, s) { return a + s.amount; }, 0);
    const s = S.getSettings();

    /* ---- facturas ---- */
    const rows = invs.map(function (f) {
      let action = '';
      if (f.status === "pendiente") action = '<button class="pbtn pbtn--sm pbtn--primary" data-upload="' + f.id + '">Subir comprobante</button>';
      else if (f.status === "en_revision") action = '<span class="muted">Comprobante enviado ' + fdate(f.receipt.uploadedAt) + '</span>';
      else action = '<span class="muted">Saldo acreditado</span>';
      return '<tr><td><strong>' + esc(f.number) + '</strong><div class="muted">' + fdate(f.createdAt) + '</div>' + (f.receiptNote ? '<div class="note-bad">⚠ ' + esc(f.receiptNote) + '</div>' : '') + '</td><td class="num">' + fmt(f.amount) + '</td><td class="num muted">' + fmt(f.isd + f.fee) + '</td><td class="num muted">' + fmt(f.iva) + '</td><td class="num"><strong>' + fmt(f.total) + '</strong></td><td>' + INV_STATUS[f.status] + '</td><td class="actions"><a class="pbtn pbtn--sm" href="factura.html#' + f.id + '" target="_blank" rel="noopener">PDF</a>' + action + '</td></tr>';
    }).join("");

    /* ---- gasto por plataforma (una sola serie: monto) ---- */
    const maxPlat = Math.max(1, Math.max.apply(null, Object.keys(byPlat).map(function (k) { return byPlat[k]; })));
    const platBars = Object.keys(P).map(function (k) {
      const v = byPlat[k] || 0, pctv = spentTotal ? Math.round(v / spentTotal * 100) : 0;
      return '<div class="plat"><div class="plat__head"><img src="' + P[k].logo + '" alt="" /><span>' + P[k].name + '</span><b>' + fmt(v) + '</b><em>' + pctv + '%</em></div><div class="plat__track"><i style="width:' + Math.round(v / maxPlat * 100) + '%"></i></div></div>';
    }).join("");
    const spendRows = spends.slice(0, 8).map(function (sp) {
      return '<tr><td><img class="plat__mini" src="' + P[sp.platform].logo + '" alt="" /> ' + P[sp.platform].name + '</td><td>' + esc(sp.campaign) + '</td><td class="muted">' + fdate(sp.createdAt) + '</td><td class="num"><strong>' + fmt(sp.amount) + '</strong></td></tr>';
    }).join("");
    const platOpts = Object.keys(P).map(function (k) { return '<option value="' + k + '">' + P[k].name + '</option>'; }).join("");

    /* ---- pasos ---- */
    const st = {
      s1: true,
      s2: invs.length > 0,
      s3: invs.some(function (f) { return f.status === "en_revision" || f.status === "pagada"; }),
      s4: paidTotal > 0,
      s5: spends.length > 0
    };
    const stepHint = !st.s2 ? "Solicita tu primera recarga para generar la factura." : (pending.length ? "Tienes " + pending.length + " factura(s) pendiente(s): súbenos el comprobante de pago." : (reviewing.length ? "AND está revisando tu comprobante. Al confirmarlo, tu saldo se recarga." : (c.balance > 0 ? "Tienes saldo disponible: asígnalo a tus plataformas." : "Saldo agotado. Solicita una nueva recarga cuando quieras."))) ;

    document.getElementById("view").innerHTML = '\
<div class="hero-balance"><div><h2>Saldo publicitario disponible</h2><div class="big">' + fmt(c.balance) + '</div><div class="sub">Recargado: ' + fmt(paidTotal) + ' · Asignado a plataformas: ' + fmt(spentTotal) + '</div></div>\
<form id="rechargeForm" class="pform" style="min-width:260px"><div class="pfield"><label style="color:rgba(255,255,255,.85)">Solicitar recarga de pauta ($)</label><input class="pinput" id="rechargeAmount" type="number" min="100" step="100" placeholder="1000" required /></div><button type="submit" class="pbtn pbtn--accent">Solicitar factura y recargar</button><span id="rechargeMsg" class="pmsg" style="color:#fff"></span></form></div>\
\
<section class="panel"><div class="panel__head"><div><h2>Tu proceso</h2><p>' + esc(stepHint) + '</p></div></div>\
<div class="steps-mini">\
<div class="' + (st.s1 ? "done" : "") + '">Paso 1<b>Monto confirmado</b></div>\
<div class="' + (st.s2 ? "done" : "") + '">Paso 2<b>Factura local</b><small>' + invs.length + ' emitida(s)</small></div>\
<div class="' + (st.s3 ? "done" : "") + '">Paso 3<b>Pago</b><small>' + (reviewing.length ? reviewing.length + " en revisión" : (pending.length ? pending.length + " pendiente(s)" : "al día")) + '</small></div>\
<div class="' + (st.s4 ? "done" : "") + '">Paso 4<b>Pauta recargada</b><small>' + fmt(paidTotal) + '</small></div>\
<div class="' + (st.s5 ? "done" : "") + '">Paso 5<b>A pautar</b><small>' + fmt(spentTotal) + ' asignados</small></div></div></section>\
\
<section class="panel"><div class="panel__head"><div><h2>Mis facturas nacionales</h2><p>' + invs.length + ' emitidas · ' + pending.length + ' pendientes · ' + reviewing.length + ' en revisión · ISD ' + (s.isd * 100).toFixed(0) + '% · comisión ' + (s.fee * 100).toFixed(0) + '% · IVA ' + (s.iva * 100).toFixed(0) + '% (crédito tributario)</p></div></div>\
' + (rows ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>N.º</th><th class="num">Pauta</th><th class="num">ISD + comisión</th><th class="num">IVA</th><th class="num">Total</th><th>Estado</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="empty">Aún no tienes facturas. Solicita tu primera recarga arriba.</p>') + '</section>\
\
<div class="grid-2">\
<section class="panel"><div class="panel__head"><div><h2>Asignar pauta a una plataforma</h2><p>Paso 5: distribuye tu saldo entre Meta, Google, TikTok y X</p></div></div>\
<form id="spendForm" class="pform" novalidate>\
<div class="pfield"><label>Plataforma</label><select class="pselect" id="spPlatform">' + platOpts + '</select></div>\
<div class="pfield"><label>Nombre de la campaña</label><input class="pinput" id="spCampaign" type="text" placeholder="Ej. Lanzamiento septiembre" maxlength="60" /></div>\
<div class="pfield"><label>Monto ($) — disponible ' + fmt(c.balance) + '</label><input class="pinput" id="spAmount" type="number" min="1" step="1" max="' + Math.floor(c.balance) + '" placeholder="500" ' + (c.balance > 0 ? "" : "disabled") + ' /></div>\
<div class="pform__actions"><button type="submit" class="pbtn pbtn--primary" ' + (c.balance > 0 ? "" : "disabled") + '>Activar campaña</button><span id="spMsg" class="pmsg"></span></div></form></section>\
<section class="panel"><div class="panel__head"><div><h2>¿En qué se gastó el saldo?</h2><p>' + fmt(spentTotal) + ' asignados en ' + spends.length + ' campaña(s)</p></div></div><div class="plats">' + platBars + '</div>\
' + (spendRows ? '<div class="table-wrap" style="margin-top:1rem"><table class="tbl"><thead><tr><th>Plataforma</th><th>Campaña</th><th>Fecha</th><th class="num">Monto</th></tr></thead><tbody>' + spendRows + '</tbody></table></div>' : '<p class="empty">Todavía no has asignado pauta.</p>') + '</section>\
</div>\
\
<section class="panel"><div class="panel__head"><div><h2>Datos de la empresa</h2></div></div><dl class="dl"><dt>Razón social</dt><dd>' + esc(c.company) + '</dd><dt>RUC</dt><dd>' + esc(c.ruc) + '</dd><dt>Correo</dt><dd>' + esc(c.email) + '</dd><dt>Teléfono</dt><dd>' + esc(c.phone) + '</dd><dt>Ciudad</dt><dd>' + esc(c.city) + '</dd><dt>Cliente desde</dt><dd>' + fdate(c.createdAt) + '</dd></dl></section>';

    /* ---- eventos ---- */
    document.getElementById("rechargeForm").addEventListener("submit", function (e) {
      e.preventDefault();
      const r = S.requestRecharge(c.id, document.getElementById("rechargeAmount").value);
      const m = document.getElementById("rechargeMsg");
      if (r.error) { m.textContent = r.error; return; }
      toast("Factura " + r.number + " emitida por " + fmt(r.total) + ". Descárgala en PDF, paga y súbenos el comprobante.");
      render();
    });

    document.getElementById("spendForm").addEventListener("submit", function (e) {
      e.preventDefault();
      const m = document.getElementById("spMsg");
      const r = S.addSpend(c.id, document.getElementById("spPlatform").value, document.getElementById("spAmount").value, document.getElementById("spCampaign").value);
      if (r.error) { m.className = "pmsg pmsg--bad"; m.textContent = r.error; return; }
      toast("Campaña “" + r.campaign + "” activada en " + P[r.platform].name + " con " + fmt(r.amount) + ".");
      render();
    });

    document.querySelectorAll("[data-upload]").forEach(function (b) { b.addEventListener("click", function () { openUpload(b.dataset.upload); }); });
  }

  /* ---- modal de comprobante ---- */
  function openUpload(invoiceId) {
    const inv = S.getInvoice(invoiceId); if (!inv) return;
    let d = document.getElementById("drawer");
    if (!d) {
      d = document.createElement("div"); d.id = "drawer"; d.className = "drawer";
      d.innerHTML = '<div class="drawer__bg"></div><div class="drawer__panel"><div class="drawer__head"><h3 id="drawerTitle"></h3><button class="drawer__close" aria-label="Cerrar">✕</button></div><div id="drawerBody"></div></div>';
      document.body.appendChild(d);
      d.querySelector(".drawer__bg").addEventListener("click", function () { d.classList.remove("is-open"); });
      d.querySelector(".drawer__close").addEventListener("click", function () { d.classList.remove("is-open"); });
    }
    document.getElementById("drawerTitle").textContent = "Comprobante de pago · " + inv.number;
    document.getElementById("drawerBody").innerHTML = '\
<p class="muted" style="font-size:.85rem;margin-bottom:1rem">Transfiere <strong>' + fmt(inv.total) + '</strong> a la cuenta local de AND y adjunta la captura o PDF del comprobante. El equipo lo revisará y tu saldo se recargará con <strong>' + fmt(inv.amount) + '</strong>.</p>\
<div class="bank"><div><span>Banco</span><b>Banco Pichincha</b></div><div><span>Cuenta corriente</span><b>2100-123456-7</b></div><div><span>Titular</span><b>AND Technologies S.A.S.</b></div><div><span>RUC</span><b>1793000000001</b></div><div><span>Referencia</span><b>' + esc(inv.number) + '</b></div></div>\
<form id="receiptForm" class="pform" novalidate>\
<div class="pfield"><label>N.º de referencia / transacción</label><input class="pinput" id="rcRef" type="text" placeholder="Ej. TRX-58213" maxlength="40" /></div>\
<div class="pfield"><label>Archivo (JPG, PNG o PDF)</label><input class="pinput" id="rcFile" type="file" accept="image/*,application/pdf" /></div>\
<div id="rcPreview" class="rc-preview"></div>\
<div class="pform__actions"><button type="submit" class="pbtn pbtn--primary" id="rcSubmit">Enviar comprobante</button><span id="rcMsg" class="pmsg"></span></div></form>';
    d.classList.add("is-open");

    let pending = null;
    const fileEl = document.getElementById("rcFile"), prev = document.getElementById("rcPreview"), msg = document.getElementById("rcMsg");
    fileEl.addEventListener("change", function () {
      msg.textContent = ""; prev.innerHTML = ""; pending = null;
      readReceipt(fileEl.files[0]).then(function (r) {
        pending = r;
        prev.innerHTML = r.type === "application/pdf" ? '<div class="rc-pdf">📄 ' + esc(r.name) + '</div>' : '<img src="' + r.dataUrl + '" alt="Vista previa del comprobante" />';
      }).catch(function (err) { msg.className = "pmsg pmsg--bad"; msg.textContent = err; });
    });
    document.getElementById("receiptForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!pending) { msg.className = "pmsg pmsg--bad"; msg.textContent = "Adjunta el comprobante."; return; }
      pending.reference = document.getElementById("rcRef").value.trim();
      const r = S.uploadReceipt(inv.id, pending);
      if (r.error) { msg.className = "pmsg pmsg--bad"; msg.textContent = r.error; return; }
      d.classList.remove("is-open");
      toast("Comprobante enviado. AND lo revisará y recargará tu saldo.");
      render();
    });
  }

  window.addEventListener("storage", function (e) { if (e.key && e.key.indexOf("and_") === 0) render(); });
  render();
})();
