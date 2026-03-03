/* ═══════════════════════════════════════════════════════
   auth.js — Sesión, autenticación y permisos
   Depende de: config.js
   ═══════════════════════════════════════════════════════ */

'use strict';

// ── Sesión ────────────────────────────────────────────────
function getSession() {
  try {
    return JSON.parse(
      sessionStorage.getItem(SESSION_KEY) ||
      localStorage.getItem(SESSION_KEY) ||
      'null'
    );
  } catch { return null; }
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

function currentUser() {
  return getSession();
}

// ── Guardia de autenticación ──────────────────────────────
// Redirige a login.html si no hay sesión activa.
// Si se pasan roles, verifica que el usuario tenga el rol requerido.
function requireAuth(allowedRoles = null) {
  const u = getSession();
  if (!u) { location.href = 'login.html'; return null; }
  if (allowedRoles && !allowedRoles.includes(u.rol)) {
    location.href = 'inventario.html';
    return null;
  }
  return u;
}

// ── Verificar permiso puntual ─────────────────────────────
function canAccess(user, permission) {
  return (ROLE_PERMISSIONS[user?.rol] || []).includes(permission);
}

// ── Logout ────────────────────────────────────────────────
function logout() {
  clearSession();
  location.href = 'login.html';
}

// ── Obtener items de nav filtrados por rol ────────────────
function getNavItems(user) {
  let items = NAV_ITEMS.filter(n => n.roles.includes(user?.rol));
  if (user?.rol === 'admin') return items;

  const clienteCodigo = (user?.cliente_codigo || '').toUpperCase();
  const assignedEntry = CLIENT_ENTRY_MAP[clienteCodigo];

  if (assignedEntry) {
    const entryIds = ['ai_entry', 'martech'];
    items = items.filter(n => !entryIds.includes(n.id) || n.id === assignedEntry);
  }
  return items;
}
