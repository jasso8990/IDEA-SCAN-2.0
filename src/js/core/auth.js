/* ═══════════════════════════════════════════════════════
   auth.js — Autenticación con Supabase
   Depende de: config.js
   ═══════════════════════════════════════════════════════ */
'use strict';

// ── Session storage key ───────────────────────────────────
const SESSION_KEY = 'ideascan_user';

// ── Guardar / leer usuario ────────────────────────────────
function saveUser(u) { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); }
function currentUser() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
  catch { return null; }
}
function clearUser() { localStorage.removeItem(SESSION_KEY); }

// ── Verificar sesión activa ───────────────────────────────
function requireAuth() {
  const u = currentUser();
  if (!u) { window.location.replace('login.html'); return null; }
  return u;
}

// ── Login ─────────────────────────────────────────────────
async function loginWithCredentials(username, password) {
  const { data, error } = await sb()
    .from('usuarios')
    .select('*')
    .eq('username', username.trim().toLowerCase())
    .eq('activo', true)
    .single();

  if (error || !data) throw new Error('Usuario no encontrado o inactivo');

  // Comparar contraseña (texto plano — en producción usar bcrypt/hash)
  if (data.password !== password) throw new Error('Contraseña incorrecta');

  // Obtener nombre del cliente si aplica
  let cliente_nombre = null;
  if (data.cliente_id) {
    const { data: cl } = await sb()
      .from('clientes')
      .select('nombre')
      .eq('id', data.cliente_id)
      .single();
    cliente_nombre = cl?.nombre || null;
  }

  const userObj = { ...data, cliente_nombre };
  saveUser(userObj);
  return userObj;
}

// ── Logout ────────────────────────────────────────────────
function logout() {
  clearUser();
  window.location.replace('login.html');
}

// ── Verificar permiso ─────────────────────────────────────
function can(action) {
  const u = currentUser();
  if (!u) return false;
  const perms = ROLES[u.rol]?.perms || [];
  return perms.includes('all') || perms.includes(action);
}
