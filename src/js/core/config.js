/* ═══════════════════════════════════════════════════════
   config.js — Configuración global de IDEA SCAN 2.0
   ═══════════════════════════════════════════════════════ */
'use strict';

// ── Supabase ──────────────────────────────────────────────
const SUPABASE_URL  = 'https://usqugtxeynkozlobeojt.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzcXVndHhleW5rb3psb2Jlb2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTYxMzAsImV4cCI6MjA4NjY3MjEzMH0.zs4XiF8AgcE-l3ebtaxvoN7V9rf-6MHWNxMThiQUXKE';

// ── Anthropic — Proxy seguro via Supabase Edge Function ───
// La API key vive en Supabase Secrets, NUNCA en el código
const ANTHROPIC_PROXY = 'https://usqugtxeynkozlobeojt.supabase.co/functions/v1/claude-proxy';

// ── Schema de la base de datos ────────────────────────────
const DB_SCHEMA = 'ideascan';

// ── App Info ──────────────────────────────────────────────
const APP_NAME      = 'IDEA SCAN 2.0';
const APP_COMPANY   = 'CCA Group';
const APP_VERSION   = '2.0.0';

// ── Supabase Client ───────────────────────────────────────
let _sb = null;
function sb() {
  if (!_sb) _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    db: { schema: DB_SCHEMA }
  });
  return _sb;
}

// ── Roles ─────────────────────────────────────────────────
const ROLES = {
  admin:    { label:'Administrador', icon:'👑', color:'#f97316', perms:['all'] },
  gerente:  { label:'Gerente',       icon:'🏢', color:'#0d2b7a', perms:['view','edit','report'] },
  operador: { label:'Operador',      icon:'👷', color:'#22c77a', perms:['view','edit'] },
  cliente:  { label:'Cliente',       icon:'👤', color:'#8b5cf6', perms:['view'] },
};

// ── Nav items por rol ─────────────────────────────────────
function getNavItems(user) {
  const rol      = user?.rol || 'operador';
  const clienteN = (user?.cliente_nombre || '').toLowerCase();
  const esMartech = clienteN.includes('martech');
  const esSafran  = clienteN.includes('safran');
  const esAdmin   = rol === 'admin';
  const esCliente = rol === 'cliente';

  // Base items disponibles para todos
  const base = [
    { id:'dashboard',  icon:'📊', label:'Dashboard',   href:'dashboard.html' },
    { id:'inventario', icon:'📦', label:'Inventario',   href:'inventario.html' },
  ];

  // IA Scan: admin, usuarios Safran, y operadores SIN cliente (internos CCA)
  // Martech NUNCA ve IA Scan
  const esOperadorInterno = !user?.cliente_id; // sin cliente = personal interno CCA
  if (!esMartech && (esAdmin || esSafran || esOperadorInterno)) {
    base.push({ id:'ai_entry',   icon:'🤖', label:'IA Scan',      href:'ai-entry.html' });
  }

  // AI Martech: solo admin y usuarios con cliente Martech
  if (esAdmin || esMartech) {
    base.push({ id:'ai_martech', icon:'🟠', label:'AI Martech',   href:'ai-martech.html' });
  }

  // Salidas y Paquetería: todos excepto cliente (solo lectura)
  if (!esCliente) {
    base.push({ id:'salidas',    icon:'📤', label:'Salidas',       href:'salidas.html' });
    base.push({ id:'paqueteria', icon:'🚚', label:'Paquetería',    href:'paqueteria.html' });
  } else {
    // El cliente solo puede subir órdenes (ver salidas/paquetería en modo lectura)
    base.push({ id:'salidas',    icon:'📤', label:'Mis Salidas',   href:'salidas.html' });
    base.push({ id:'paqueteria', icon:'🚚', label:'Mi Paquetería', href:'paqueteria.html' });
  }

  const admin = [
    { id:'reportes',   icon:'📈', label:'Reportes',      href:'reportes.html',  section:'admin' },
    { id:'config',     icon:'⚙️',  label:'Configuración', href:'config.html',    section:'admin', desktopOnly:true },
  ];

  // Reportes para supervisor/operador también
  const supervisor = [
    { id:'reportes',   icon:'📈', label:'Reportes',      href:'reportes.html',  section:'admin' },
  ];

  if (esAdmin) return [...base, ...admin];
  if (rol === 'supervisor' || rol === 'operador') return [...base, ...supervisor];
  return base;
}

// ── Toast helper ──────────────────────────────────────────
function showToast(msg, type='', duration=3000) {
  let t = document.getElementById('globalToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'globalToast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ── Format helpers ────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}
function fmtNum(n) {
  return Number(n||0).toLocaleString('es-MX');
}
