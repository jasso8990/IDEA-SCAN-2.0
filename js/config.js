/* ═══════════════════════════════════════════════════════
   config.js — Constantes globales de la aplicación
   ═══════════════════════════════════════════════════════ */

'use strict';

// ── Supabase ──────────────────────────────────────────────
const SUPA_URL = 'https://usqugtxeynkozlobeojt.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzcXVndHhleW5rb3psb2Jlb2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTYxMzAsImV4cCI6MjA4NjY3MjEzMH0.zs4XiF8AgcE-l3ebtaxvoN7V9rf-6MHWNxMThiQUXKE';
const AI_VISION_URL = `${SUPA_URL}/functions/v1/ai-vision`;

// ── App info ──────────────────────────────────────────────
const APP_NAME    = 'IDEA SCAN 2.0';
const APP_COMPANY = 'CCA Group';
const APP_VERSION = '2.0.0';

// ── Session key ───────────────────────────────────────────
const SESSION_KEY = 'ideascan_session';

// ── Roles del sistema ─────────────────────────────────────
const ROLES = {
  admin:      { label: 'Administrador', color: '#0d2b7a', icon: '👑' },
  supervisor: { label: 'Supervisor',    color: '#2d6ef5', icon: '🔷' },
  cliente:    { label: 'Cliente',       color: '#00c2ff', icon: '🏢' },
  operador:   { label: 'Operador',      color: '#22c77a', icon: '⚙️'  },
};

// ── Mapa de módulo de entrada por cliente ─────────────────
// codigo (uppercase) → módulo de entrada asignado
const CLIENT_ENTRY_MAP = {
  SAFRAN:  'ai_entry',  // Safran  → Entrada con AI
  MARTECH: 'martech',   // Martech → Entrada MARTECH
  // Agregar más clientes aquí
};

// ── Permisos por rol ──────────────────────────────────────
const ROLE_PERMISSIONS = {
  admin:      ['config','mapa','inventario','ordenes','salidas','ai_entry','martech','reportes','usuarios'],
  supervisor: ['inventario','ordenes','reportes','mapa_asignado'],
  cliente:    ['inventario','ordenes','reportes'],
  operador:   ['inventario','ordenes','salidas','ai_entry','martech','mapa_asignado'],
};

// ── Items de navegación ───────────────────────────────────
const NAV_ITEMS = [
  { id:'inventario', label:'Inventario',     icon:'📦', href:'inventario.html',          roles:['admin','supervisor','cliente','operador'] },
  { id:'ordenes',    label:'Órdenes',         icon:'📋', href:'ordenes.html',             roles:['admin'] },
  { id:'salidas',    label:'Salidas Scan',    icon:'📤', href:'salidas.html',             roles:['admin','supervisor','cliente','operador'] },
  { id:'ai_entry',   label:'Entrada con AI', icon:'🤖', href:'ai-entry.html',            roles:['admin','operador'] },
  { id:'martech',    label:'Entrada MARTECH',icon:'🏭', href:'martech-entry.html',       roles:['admin','operador'] },
  { id:'reportes',   label:'Reportes',        icon:'📊', href:'reportes.html',            roles:['admin','supervisor','cliente'], desktopOnly:true },
  { id:'mapa',       label:'Mapa',            icon:'🗺️', href:'mapa.html',               roles:['admin','supervisor','operador'] },
  { id:'config',     label:'Configuración',   icon:'⚙️', href:'config.html',             roles:['admin'], section:'admin' },
  { id:'usuarios',   label:'Usuarios',        icon:'👥', href:'config.html?tab=usuarios',roles:['admin'], section:'admin' },
];
