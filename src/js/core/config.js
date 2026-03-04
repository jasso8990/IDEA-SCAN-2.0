/* ═══════════════════════════════════════════════════════
   config.js — Configuración global IDEA SCAN 2.0
   ═══════════════════════════════════════════════════════ */
'use strict';

const SUPABASE_URL = 'https://usqugtxeynkozlobeojt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzcXVndHhleW5rb3psb2Jlb2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTYxMzAsImV4cCI6MjA4NjY3MjEzMH0.zs4XiF8AgcE-l3ebtaxvoN7V9rf-6MHWNxMThiQUXKE';
const DB_SCHEMA    = 'ideascan';

const APP_NAME    = 'IDEA SCAN';
const APP_VERSION = '2.0';
const APP_COMPANY = 'CCA Group';

let _sb = null;
function sb() {
  if (!_sb) _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    db: { schema: DB_SCHEMA }
  });
  return _sb;
}

const ROLES = {
  admin:    { label:'Administrador', icon:'👑', color:'#f97316', perms:['all'] },
  gerente:  { label:'Gerente',       icon:'📊', color:'#0d2b7a', perms:['read','write','reports'] },
  operador: { label:'Operador',      icon:'👷', color:'#22c77a', perms:['read','write'] },
  cliente:  { label:'Cliente',       icon:'🏢', color:'#8b5cf6', perms:['read'] },
};

function getNavItems(user) {
  const isAdmin   = user.rol === 'admin';
  const isGerente = user.rol === 'gerente';
  const items = [
    { id:'dashboard',  label:'Dashboard',  icon:'📊', href:'dashboard.html' },
    { id:'inventario', label:'Inventario', icon:'📦', href:'inventario.html' },
    { id:'entradas',   label:'Entradas',   icon:'📥', href:'entradas.html' },
    { id:'salidas',    label:'Salidas',    icon:'📤', href:'salidas.html' },
    { id:'ai_entry',   label:'IA Scan',    icon:'🤖', href:'ai-entry.html' },
    { id:'reportes',   label:'Reportes',   icon:'📈', href:'reportes.html', desktopOnly:true },
  ];
  if (isAdmin || isGerente) {
    items.push({ id:'config', label:'Configuración', icon:'⚙️', href:'config.html', section:'admin' });
  }
  return items;
}

function showToast(msg, type='info', duration=3000) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('es-MX');
}
