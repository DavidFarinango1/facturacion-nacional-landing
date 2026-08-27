/* =====================================================================
   AND Local Ads — Capa de datos compartida (localStorage)
   La usan: index.html (leads, registros, tasas de la calculadora),
   login.html / registro.html (autenticación), admin.html (panel) y
   empresa.html (panel de cliente).

   NOTA: es un almacenamiento local de demostración. Los datos viven en el
   navegador del usuario. Para producción real hay que reemplazar cada
   función por llamadas a un backend (ver "Punto de integración").
   ===================================================================== */
window.ANDStore = (function () {
  "use strict";

  const KEYS = {
    leads: "and_leads",
    companies: "and_companies",
    invoices: "and_invoices",
    admins: "and_admins",
    settings: "and_settings",
    session: "and_session",
    activity: "and_activity",
    seeded: "and_seeded_v1"
  };

  const DEFAULT_SETTINGS = {
    isd: 0.05,            // Impuesto a la Salida de Divisas
    iva: 0.15,            // IVA
    fee: 0.10,            // Comisión AND
    nonDeductible: 0.25,  // Gasto no deducible (informal)
    inviteCode: "AND2025" // Código para registrar nuevos administradores
  };

  /* ---------- utilidades ---------- */
  function read(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  function uid(prefix) { return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function now() { return new Date().toISOString(); }
  function daysAgo(n, hour) { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(hour || 10, 0, 0, 0); return d.toISOString(); }

  /* ---------- cálculo de ahorro (misma lógica que la landing) ---------- */
  function compute(inv, s) {
    s = s || getSettings();
    const isd = inv * s.isd;
    const iva1 = (inv + isd) * s.iva;
    const visible = inv + isd + iva1;
    const nonDeductible = visible * s.nonDeductible;
    const total1 = visible + nonDeductible;
    const fee = inv * s.fee;
    const iva2 = (inv + isd + fee) * s.iva;
    const total2 = inv + isd + fee + iva2;
    const saveMonth = total1 - total2;
    return {
      inv, isd, iva1, visible, nonDeductible, total1, fee, iva2, total2, saveMonth,
      savePct: total1 > 0 ? (saveMonth / total1) * 100 : 0,
      saveYear: saveMonth * 12,
      freeMonths: total1 > 0 ? (saveMonth * 12) / total1 : 0
    };
  }

  /* ---------- actividad ---------- */
  function logActivity(type, message) {
    const list = read(KEYS.activity, []);
    list.unshift({ id: uid("act"), type: type, message: message, at: now() });
    write(KEYS.activity, list.slice(0, 200));
  }
  function getActivity() { return read(KEYS.activity, []); }

  /* ---------- configuración ---------- */
  function getSettings() { return Object.assign({}, DEFAULT_SETTINGS, read(KEYS.settings, {})); }
  function saveSettings(patch) {
    const s = Object.assign(getSettings(), patch);
    write(KEYS.settings, s);
    logActivity("settings", "Configuración actualizada (ISD " + (s.isd * 100).toFixed(1) + "%, IVA " + (s.iva * 100).toFixed(1) + "%, comisión " + (s.fee * 100).toFixed(1) + "%)");
    return s;
  }

  /* ---------- leads (formulario de la calculadora) ---------- */
  function getLeads() { return read(KEYS.leads, []); }
  function addLead(data) {
    const leads = getLeads();
    const calc = compute(Number(data.monthlyBudget) || 0);
    const lead = {
      id: uid("lead"),
      fullName: data.fullName, companyName: data.companyName, email: data.email, phone: data.phone,
      monthlyBudget: Number(data.monthlyBudget) || 0,
      saveMonth: calc.saveMonth, saveYear: calc.saveYear,
      status: "nuevo", notes: "", createdAt: now()
    };
    leads.unshift(lead);
    write(KEYS.leads, leads);
    logActivity("lead", "Nuevo lead: " + lead.companyName + " (" + lead.fullName + ") — pauta $" + lead.monthlyBudget);
    return lead;
  }
  function updateLead(id, patch) {
    const leads = getLeads();
    const i = leads.findIndex(function (l) { return l.id === id; });
    if (i < 0) return null;
    leads[i] = Object.assign(leads[i], patch);
    write(KEYS.leads, leads);
    if (patch.status) logActivity("lead", "Lead " + leads[i].companyName + " marcado como " + patch.status);
    return leads[i];
  }
  function deleteLead(id) {
    const leads = getLeads();
    const l = leads.find(function (x) { return x.id === id; });
    write(KEYS.leads, leads.filter(function (x) { return x.id !== id; }));
    if (l) logActivity("lead", "Lead eliminado: " + l.companyName);
  }

  /* ---------- empresas (registro corporativo) ---------- */
  function getCompanies() { return read(KEYS.companies, []); }
  function findCompanyByEmail(email) {
    email = (email || "").trim().toLowerCase();
    return getCompanies().find(function (c) { return c.email.toLowerCase() === email; }) || null;
  }
  function addCompany(data) {
    if (findCompanyByEmail(data.email)) return { error: "Ya existe una empresa registrada con ese correo." };
    const companies = getCompanies();
    const c = {
      id: uid("emp"),
      company: data.company, email: data.email.trim(), ruc: data.ruc, phone: data.phone, city: data.city,
      password: data.password, // Punto de integración: nunca guardar en claro en producción
      status: "pendiente", balance: 0, createdAt: now()
    };
    companies.unshift(c);
    write(KEYS.companies, companies);
    logActivity("empresa", "Nuevo registro corporativo: " + c.company + " (" + c.city + ")");
    return c;
  }
  function updateCompany(id, patch) {
    const companies = getCompanies();
    const i = companies.findIndex(function (c) { return c.id === id; });
    if (i < 0) return null;
    companies[i] = Object.assign(companies[i], patch);
    write(KEYS.companies, companies);
    if (patch.status) logActivity("empresa", companies[i].company + " → " + patch.status);
    return companies[i];
  }
  function getCompany(id) { return getCompanies().find(function (c) { return c.id === id; }) || null; }

  /* ---------- facturas ---------- */
  function getInvoices() { return read(KEYS.invoices, []); }
  function nextInvoiceNumber() {
    const n = getInvoices().length + 1;
    return "001-001-" + String(n).padStart(9, "0");
  }
  function createInvoice(companyId, amount) {
    const c = getCompany(companyId);
    if (!c) return { error: "Empresa no encontrada." };
    amount = Number(amount) || 0;
    if (amount <= 0) return { error: "El monto debe ser mayor a 0." };
    const s = getSettings();
    const isd = amount * s.isd;
    const fee = amount * s.fee;
    const iva = (amount + isd + fee) * s.iva;
    const inv = {
      id: uid("fac"), number: nextInvoiceNumber(), companyId: c.id, companyName: c.company,
      amount: amount, isd: isd, fee: fee, iva: iva, total: amount + isd + fee + iva,
      status: "pendiente", createdAt: now(), paidAt: null
    };
    const list = getInvoices();
    list.unshift(inv);
    write(KEYS.invoices, list);
    logActivity("factura", "Factura " + inv.number + " emitida a " + c.company + " por $" + inv.total.toFixed(2));
    return inv;
  }
  function markInvoicePaid(id) {
    const list = getInvoices();
    const i = list.findIndex(function (f) { return f.id === id; });
    if (i < 0 || list[i].status === "pagada") return null;
    list[i].status = "pagada";
    list[i].paidAt = now();
    write(KEYS.invoices, list);
    // Al pagar, se recarga la pauta de la empresa (paso 4 del proceso)
    const c = getCompany(list[i].companyId);
    if (c) updateCompany(c.id, { balance: (c.balance || 0) + list[i].amount });
    logActivity("factura", "Factura " + list[i].number + " pagada — saldo de " + list[i].companyName + " recargado con $" + list[i].amount.toFixed(2));
    return list[i];
  }
  function requestRecharge(companyId, amount) {
    const c = getCompany(companyId);
    if (!c) return { error: "Empresa no encontrada." };
    logActivity("recarga", c.company + " solicitó una recarga de $" + Number(amount).toFixed(2));
    return createInvoice(companyId, amount);
  }

  /* ---------- administradores ---------- */
  function getAdmins() { return read(KEYS.admins, []); }
  function findAdminByEmail(email) {
    email = (email || "").trim().toLowerCase();
    return getAdmins().find(function (a) { return a.email.toLowerCase() === email; }) || null;
  }
  function addAdmin(data, inviteCode) {
    if (inviteCode !== getSettings().inviteCode) return { error: "Código de invitación incorrecto." };
    if (findAdminByEmail(data.email)) return { error: "Ya existe un administrador con ese correo." };
    const admins = getAdmins();
    const a = { id: uid("adm"), name: data.name, email: data.email.trim(), password: data.password, createdAt: now() };
    admins.push(a);
    write(KEYS.admins, admins);
    logActivity("admin", "Nuevo administrador: " + a.name);
    return a;
  }
  function removeAdmin(id) {
    const admins = getAdmins();
    if (admins.length <= 1) return { error: "Debe existir al menos un administrador." };
    const a = admins.find(function (x) { return x.id === id; });
    write(KEYS.admins, admins.filter(function (x) { return x.id !== id; }));
    if (a) logActivity("admin", "Administrador eliminado: " + a.name);
    return true;
  }

  /* ---------- sesión ---------- */
  function login(role, email, password) {
    if (role === "admin") {
      const a = findAdminByEmail(email);
      if (!a || a.password !== password) return { error: "Correo o contraseña de administrador incorrectos." };
      const s = { role: "admin", id: a.id, email: a.email, name: a.name, at: now() };
      write(KEYS.session, s);
      logActivity("sesion", "Inicio de sesión de administrador: " + a.name);
      return s;
    }
    const c = findCompanyByEmail(email);
    if (!c || c.password !== password) return { error: "Correo o contraseña incorrectos." };
    if (c.status === "pendiente") return { error: "Tu cuenta está pendiente de aprobación por el equipo de AND." };
    if (c.status === "rechazada") return { error: "Tu solicitud fue rechazada. Contacta a soporte." };
    if (c.status === "suspendida") return { error: "Tu cuenta está suspendida. Contacta a soporte." };
    const s = { role: "empresa", id: c.id, email: c.email, name: c.company, at: now() };
    write(KEYS.session, s);
    logActivity("sesion", "Inicio de sesión de empresa: " + c.company);
    return s;
  }
  function getSession() { return read(KEYS.session, null); }
  function logout() { try { localStorage.removeItem(KEYS.session); } catch (_) {} }

  /* ---------- datos de ejemplo (solo la primera vez) ---------- */
  function seed() {
    if (read(KEYS.seeded, false)) return;
    write(KEYS.admins, [{ id: "adm_root", name: "Administrador AND", email: "admin@and.com", password: "admin123", createdAt: daysAgo(30) }]);

    const companies = [
      { id: "emp_1", company: "Yaku Pura", email: "finanzas@yakupura.com", ruc: "1791234567001", phone: "+593 99 111 2233", city: "Quito", password: "empresa123", status: "aprobada", balance: 3200, createdAt: daysAgo(21) },
      { id: "emp_2", company: "Codex Digital", email: "admin@codex.ec", ruc: "0992345678001", phone: "+593 98 222 3344", city: "Guayaquil", password: "empresa123", status: "aprobada", balance: 850, createdAt: daysAgo(18) },
      { id: "emp_3", company: "HAE Group", email: "contacto@hae.com.ec", ruc: "0193456789001", phone: "+593 97 333 4455", city: "Cuenca", password: "empresa123", status: "aprobada", balance: 0, createdAt: daysAgo(12) },
      { id: "emp_4", company: "Nova Retail S.A.", email: "gerencia@novaretail.ec", ruc: "1794567890001", phone: "+593 96 444 5566", city: "Quito", password: "empresa123", status: "pendiente", balance: 0, createdAt: daysAgo(2) },
      { id: "emp_5", company: "Andes Coffee Co.", email: "hola@andescoffee.ec", ruc: "1795678901001", phone: "+593 95 555 6677", city: "Ambato", password: "empresa123", status: "pendiente", balance: 0, createdAt: daysAgo(1) },
      { id: "emp_6", company: "Tech Solutions S.A.C.", email: "contacto@techsolutions.ec", ruc: "0996789012001", phone: "+593 94 666 7788", city: "Guayaquil", password: "empresa123", status: "suspendida", balance: 120, createdAt: daysAgo(25) }
    ];
    write(KEYS.companies, companies);

    const leadSeed = [
      ["María Fernanda López", "Bella Piel Spa", "maria@bellapiel.ec", "+593 991234567", 800, "convertido", 6],
      ["Carlos Andrade", "Ferretería El Tornillo", "carlos@eltornillo.ec", "+593 982345678", 500, "contactado", 5],
      ["Daniela Ruiz", "Dulce Hogar Pastelería", "dani@dulcehogar.ec", "+593 973456789", 300, "contactado", 5],
      ["Jorge Salazar", "Salazar & Asociados", "jsalazar@abogados.ec", "+593 964567890", 1500, "nuevo", 4],
      ["Ana Castillo", "Moda Urbana", "ana@modaurbana.ec", "+593 955678901", 2000, "convertido", 4],
      ["Luis Peña", "AutoPeña", "luis@autopena.ec", "+593 946789012", 1200, "nuevo", 3],
      ["Paola Vega", "Clínica Vega", "paola@clinicavega.ec", "+593 937890123", 2500, "contactado", 2],
      ["Roberto Chávez", "Chávez Constructora", "rchavez@constructora.ec", "+593 928901234", 4000, "nuevo", 1],
      ["Gabriela Torres", "Torres Inmobiliaria", "gtorres@inmobiliaria.ec", "+593 919012345", 3000, "nuevo", 1],
      ["Alejandro Pérez", "And.inc", "alejandro@empresa.com", "+593 900123456", 1000, "nuevo", 0]
    ];
    const s = getSettings();
    write(KEYS.leads, leadSeed.map(function (r, i) {
      const calc = compute(r[4], s);
      return { id: "lead_" + (i + 1), fullName: r[0], companyName: r[1], email: r[2], phone: r[3], monthlyBudget: r[4], saveMonth: calc.saveMonth, saveYear: calc.saveYear, status: r[5], notes: "", createdAt: daysAgo(r[6], 9 + i) };
    }));

    function inv(n, cid, cname, amount, status, d) {
      const isd = amount * s.isd, fee = amount * s.fee, iva = (amount + isd + fee) * s.iva;
      return { id: "fac_" + n, number: "001-001-" + String(n).padStart(9, "0"), companyId: cid, companyName: cname, amount: amount, isd: isd, fee: fee, iva: iva, total: amount + isd + fee + iva, status: status, createdAt: daysAgo(d), paidAt: status === "pagada" ? daysAgo(d - 1) : null };
    }
    write(KEYS.invoices, [
      inv(6, "emp_2", "Codex Digital", 850, "pagada", 3),
      inv(5, "emp_3", "HAE Group", 1500, "pendiente", 4),
      inv(4, "emp_1", "Yaku Pura", 1200, "pagada", 7),
      inv(3, "emp_1", "Yaku Pura", 2000, "pagada", 14),
      inv(2, "emp_6", "Tech Solutions S.A.C.", 120, "pagada", 20),
      inv(1, "emp_2", "Codex Digital", 500, "pagada", 17)
    ]);

    write(KEYS.activity, [
      { id: "act_3", type: "factura", message: "Factura 001-001-000000006 pagada — saldo de Codex Digital recargado con $850.00", at: daysAgo(2) },
      { id: "act_2", type: "empresa", message: "Nuevo registro corporativo: Nova Retail S.A. (Quito)", at: daysAgo(2) },
      { id: "act_1", type: "empresa", message: "Nuevo registro corporativo: Andes Coffee Co. (Ambato)", at: daysAgo(1) }
    ]);
    write(KEYS.seeded, true);
  }
  seed();

  function resetDemo() {
    Object.keys(KEYS).forEach(function (k) { try { localStorage.removeItem(KEYS[k]); } catch (_) {} });
    seed();
  }

  return {
    compute: compute,
    getSettings: getSettings, saveSettings: saveSettings,
    getLeads: getLeads, addLead: addLead, updateLead: updateLead, deleteLead: deleteLead,
    getCompanies: getCompanies, getCompany: getCompany, addCompany: addCompany, updateCompany: updateCompany, findCompanyByEmail: findCompanyByEmail,
    getInvoices: getInvoices, createInvoice: createInvoice, markInvoicePaid: markInvoicePaid, requestRecharge: requestRecharge,
    getAdmins: getAdmins, addAdmin: addAdmin, removeAdmin: removeAdmin,
    login: login, logout: logout, getSession: getSession,
    getActivity: getActivity, logActivity: logActivity,
    resetDemo: resetDemo
  };
})();
