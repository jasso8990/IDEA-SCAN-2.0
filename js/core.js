/* ═══════════════════════════════════════════════════════
   IDEA SCAN 2.0 — Core JS (auth, sidebar, utils)
   ═══════════════════════════════════════════════════════ */

'use strict';

// ── Supabase ──────────────────────────────────────────────────────────────
const SUPA_URL = 'https://usqugtxeynkozlobeojt.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzcXVndHhleW5rb3psb2Jlb2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTYxMzAsImV4cCI6MjA4NjY3MjEzMH0.zs4XiF8AgcE-l3ebtaxvoN7V9rf-6MHWNxMThiQUXKE';
const AI_VISION_URL = `${SUPA_URL}/functions/v1/ai-vision`;

let db;
function initDB() {
  if (!window.supabase) { console.error('Supabase SDK not loaded'); return; }
  db = window.supabase.createClient(SUPA_URL, SUPA_KEY);
}

// ── Session ───────────────────────────────────────────────────────────────
const SESSION_KEY = 'ideascan_session';

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}

function saveSession(user, remember = false) {
  const s = JSON.stringify(user);
  sessionStorage.setItem(SESSION_KEY, s);
  if (remember) localStorage.setItem(SESSION_KEY, s);
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

function requireAuth(allowedRoles = null) {
  const u = getSession();
  if (!u) { location.href = 'login.html'; return null; }
  if (allowedRoles && !allowedRoles.includes(u.rol)) { location.href = 'inventario.html'; return null; }
  return u;
}

function currentUser() { return getSession(); }

// ── Role permissions ──────────────────────────────────────────────────────
const ROLES = {
  admin:      { label:'Administrador', color:'#0d2b7a',  icon:'👑' },
  supervisor: { label:'Supervisor',    color:'#2d6ef5',  icon:'🔷' },
  cliente:    { label:'Cliente',       color:'#00c2ff',  icon:'🏢' },
  operador:   { label:'Operador',      color:'#22c77a',  icon:'⚙️' },
};

function canAccess(user, permission) {
  const perms = {
    admin: ['config','mapa','inventario','ordenes','ai_entry','martech','reportes','usuarios'],
    supervisor: ['inventario','ordenes','reportes','mapa_asignado'],
    cliente: ['inventario','ordenes','reportes'],
    operador: ['inventario','ordenes','ai_entry','martech','mapa_asignado'],
  };
  return (perms[user?.rol] || []).includes(permission);
}

// ── Sidebar nav items per role ─────────────────────────────────────────────
// ── Client codes that map to specific entry modules ──────────────────────
const CLIENT_ENTRY_MAP = {
  // codigo (uppercase) → which entry module they use
  SAFRAN:  'ai_entry',   // Safran  → Entrada con AI
  MARTECH: 'martech',    // Martech → Entrada MARTECH
  // Add more clients here as needed
};

function getNavItems(user) {
  const all = [
    { id:'inventario', label:'Inventario',    icon:'📦', href:'inventario.html',    roles:['admin','supervisor','cliente','operador'] },
    { id:'ordenes',    label:'Órdenes',        icon:'📋', href:'ordenes.html',       roles:['admin','supervisor','cliente','operador'] },
    { id:'ai_entry',   label:'Entrada con AI', icon:'🤖', href:'ai-entry.html',      roles:['admin','operador'] },
    { id:'martech',    label:'Entrada MARTECH',icon:'🏭', href:'martech-entry.html', roles:['admin','operador'] },
    { id:'reportes',   label:'Reportes',       icon:'📊', href:'reportes.html',      roles:['admin','supervisor','cliente'], desktopOnly:true },
    { id:'mapa',       label:'Mapa',           icon:'🗺️', href:'mapa.html',          roles:['admin','supervisor','operador'] },
    { id:'config',     label:'Configuración',  icon:'⚙️', href:'config.html',        roles:['admin'], section:'admin' },
    { id:'usuarios',   label:'Usuarios',       icon:'👥', href:'config.html?tab=usuarios', roles:['admin'], section:'admin' },
  ];

  // Step 1: filter by role
  let items = all.filter(n => n.roles.includes(user?.rol));

  // Step 2: admin sees everything — no further filtering
  if (user?.rol === 'admin') return items;

  // Step 3: For non-admins, filter entry modules by assigned client
  const clienteCodigo = (user?.cliente_codigo || '').toUpperCase();
  const assignedEntry = CLIENT_ENTRY_MAP[clienteCodigo]; // e.g. 'ai_entry' or 'martech'

  if (assignedEntry) {
    // Keep only the entry module that matches their client, remove the others
    const entryIds = ['ai_entry', 'martech'];
    items = items.filter(n => !entryIds.includes(n.id) || n.id === assignedEntry);
  }
  // If no client assigned (clienteCodigo empty) → show all entry modules they have role access to

  return items;
}

// ── Sidebar render ────────────────────────────────────────────────────────
function renderSidebar(currentPage) {
  const user = currentUser();
  if (!user) return;

  // Detect if we're on config?tab=usuarios → mark usuarios as active
  const urlParams = new URLSearchParams(location.search);
  const tabParam  = urlParams.get('tab');
  const effectivePage = (currentPage === 'config' && tabParam === 'usuarios') ? 'usuarios' : currentPage;

  const role = ROLES[user.rol] || ROLES.operador;
  const initials = (user.nombre || 'U').slice(0,1).toUpperCase();

  const sidebarEl = document.getElementById('sidebar');
  if (!sidebarEl) return;

  const navItems = getNavItems(user);
  const mainItems = navItems.filter(n => !n.section);
  const adminItems = navItems.filter(n => n.section === 'admin');

  let navHTML = mainItems.map(n => `
    <a href="${n.href}" class="nav-item ${effectivePage === n.id ? 'active' : ''}">
      <span class="nav-icon">${n.icon}</span>
      ${n.label}
    </a>`).join('');

  if (adminItems.length) {
    navHTML += `<div class="nav-section-label" style="margin-top:8px;">Administración</div>`;
    navHTML += adminItems.map(n => `
      <a href="${n.href}" class="nav-item ${effectivePage === n.id ? 'active' : ''}">
        <span class="nav-icon">${n.icon}</span>
        ${n.label}
      </a>`).join('');
  }

  sidebarEl.innerHTML = `
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon">📦</div>
      <div class="sidebar-logo-text">
        <div class="sidebar-logo-name">IDEA SCAN 2.0</div>
        <div class="sidebar-logo-company">CCA Group</div>
      </div>
    </div>
    <div class="sidebar-user">
      <div class="sidebar-user-avatar" style="background:${role.color}">${initials}</div>
      <div class="sidebar-user-info">
        <div class="sidebar-user-name">${user.nombre || user.username}</div>
        <div class="sidebar-user-role">${role.icon} ${role.label}</div>
        ${user.cliente_nombre ? `<div style="font-size:9px;color:rgba(255,255,255,.4);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">🏢 ${user.cliente_nombre}</div>` : ''}
      </div>
      <button class="sidebar-logout" onclick="logout()" title="Cerrar sesión">⇥</button>
    </div>
    <nav class="sidebar-nav">${navHTML}</nav>
    <div style="padding:14px 20px;border-top:1px solid rgba(255,255,255,.06);">
      <div style="font-size:9px;color:rgba(255,255,255,.2);text-align:center;letter-spacing:1px;">IDEA SCAN 2.0 © 2026 CCA Group</div>
    </div>`;
}

// ── Bottom nav render ─────────────────────────────────────────────────────
function renderBottomNav(currentPage) {
  const user = currentUser();
  if (!user) return;
  const navEl = document.getElementById('bottomNav');
  if (!navEl) return;

  const items = getNavItems(user).filter(n => !n.desktopOnly);

  // Show max 5 items in bottom nav
  const shown = items.slice(0,5);

  // FAB for AI entry if operador/admin
  const hasAI = items.some(n => n.id === 'ai_entry');
  let html = '<div class="bottom-nav-items">';

  const first2 = shown.filter(n => n.id !== 'ai_entry').slice(0,2);
  const last2  = shown.filter(n => n.id !== 'ai_entry').slice(2,4);

  first2.forEach(n => {
    html += `<a href="${n.href}" class="bottom-nav-item ${currentPage===n.id?'active':''}">
      <span class="bn-icon">${n.icon}</span>
      <span class="bn-label">${n.label}</span>
    </a>`;
  });

  if (hasAI) {
    html += `<a href="ai-entry.html" class="bottom-nav-item" style="flex:0.8">
      <button class="bottom-nav-fab">🤖</button>
    </a>`;
  }

  last2.forEach(n => {
    html += `<a href="${n.href}" class="bottom-nav-item ${currentPage===n.id?'active':''}">
      <span class="bn-icon">${n.icon}</span>
      <span class="bn-label">${n.label}</span>
    </a>`;
  });

  html += '</div>';
  navEl.innerHTML = html;
}

// ── Sidebar toggle ────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebarOverlay')?.classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

// ── Logout ────────────────────────────────────────────────────────────────
function logout() {
  clearSession();
  location.href = 'login.html';
}

// ── Toast ─────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3200) {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ── DB helpers ────────────────────────────────────────────────────────────
const Q = {
  schema: () => db.schema('ideascan'),
  from:   (t) => db.schema('ideascan').from(t),
};

async function safeQuery(queryFn) {
  try {
    const res = await queryFn();
    if (res.error) { console.error('DB error:', res.error); return null; }
    return res.data;
  } catch(e) { console.error('Query failed:', e); return null; }
}

// ── Dates ─────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0,10);
}
function dayStart() {
  const d = new Date(); d.setHours(0,0,0,0); return d.toISOString();
}
function dayEnd() {
  const d = new Date(); d.setHours(23,59,59,999); return d.toISOString();
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

// ── SKU generation ────────────────────────────────────────────────────────
// Format: CODIGO + YYMM + ### → SAF2602001, SAF2602002 ... resets each month
function skuMonthPart() {
  const d  = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth()+1).padStart(2,'0');
  return yy + mm;   // e.g. "2602"
}
function skuMonthPrefix(codigo) {
  return codigo + skuMonthPart();   // e.g. "SAF2602"
}
async function getNextSkuSeq(codigo) {
  const prefix = skuMonthPrefix(codigo);
  const { data } = await Q.from('inventario')
    .select('sku')
    .like('sku', prefix + '%');
  const nums = (data || []).map(r => {
    const tail = (r.sku || '').replace(prefix, '');
    return parseInt(tail) || 0;
  });
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return String(next).padStart(3,'0');
}
async function generateSKU(codigo) {
  const seq = await getNextSkuSeq(codigo);
  return skuMonthPrefix(codigo) + seq;   // SAF2602001
}

// ── XLSX export ───────────────────────────────────────────────────────────
function exportXLSX(data, filename) {
  if (!window.XLSX) { showToast('XLSX library not loaded', 'error'); return; }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ── Vision API call ───────────────────────────────────────────────────────
async function callVision(base64, mediaType = 'image/jpeg', promptOverride = null) {
  const resp = await fetch(AI_VISION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
    },
    body: JSON.stringify({
      base64Image: base64,
      mediaType,
      ...(promptOverride ? { prompt: promptOverride } : {}),
    }),
  });
  if (!resp.ok) throw new Error(`Vision API ${resp.status}`);
  return await resp.json();
}

// ── Print helper ──────────────────────────────────────────────────────────
function printElement(el) {
  const w = window.open('', '_blank', 'width=800,height=600');
  w.document.write(`<html><head><title>Imprimir</title>
    <style>body{font-family:Inter,sans-serif;padding:20px;} @media print{body{padding:0}}</style>
    </head><body>${el.innerHTML}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 300);
}

// ── Init page ─────────────────────────────────────────────────────────────
function initPage(pageId, allowedRoles = null) {
  initDB();
  const user = requireAuth(allowedRoles);
  if (!user) return null;
  renderSidebar(pageId);
  renderBottomNav(pageId);
  // Overlay click closes sidebar
  document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);
  return user;
}
