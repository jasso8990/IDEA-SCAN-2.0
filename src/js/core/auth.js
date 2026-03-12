/* ═══════════════════════════════════════════════════════
   auth.js — Autenticación con Supabase
   Schema: ideascan | Tabla: usuarios
   ═══════════════════════════════════════════════════════ */
'use strict';

const SESSION_KEY = 'ideascan_user_v3';

function saveUser(u)   { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); }
function currentUser() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
  catch { return null; }
}
function clearUser() { localStorage.removeItem(SESSION_KEY); }

// requireAuth — simple, sin recargas automáticas
function requireAuth(redirectTo = 'login.html') {
  const u = currentUser();
  if (!u) { window.location.replace(redirectTo); return null; }
  return u;
}

// ── Login ─────────────────────────────────────────────
async function loginWithCredentials(username, password) {
  const { data, error } = await sb()
    .from('usuarios')
    .select('id, nombre, username, rol, cliente_id, almacen_id, color, password_hash, clientes(nombre)')
    .ilike('username', username.trim())
    .eq('estado', 'active')
    .single();

  if (error || !data) throw new Error('Usuario no encontrado o inactivo');

  const hash = data.password_hash;
  if (!hash) throw new Error('Usuario sin contraseña. Contacta al administrador.');

  let valid = (hash === password);
  if (!valid) {
    try { valid = (atob(hash) === password); } catch(e) {}
  }
  if (!valid) throw new Error('Contraseña incorrecta');

  await sb().from('usuarios')
    .update({ ultimo_acceso: new Date().toISOString() })
    .eq('id', data.id);

  const userObj = {
    id:             data.id,
    nombre:         data.nombre,
    username:       data.username,
    rol:            data.rol,
    cliente_id:     data.cliente_id      || null,
    cliente_nombre: data.clientes?.nombre || null,
    almacen_id:     data.almacen_id      || null,
    color:          data.color           || null,
  };
  saveUser(userObj);
  return userObj;
}

// ── Logout ─────────────────────────────────────────────
function logout() {
  clearUser();
  window.location.replace('login.html');
}

function can(action) {
  const u = currentUser();
  if (!u) return false;
  const perms = ROLES[u.rol]?.perms || [];
  return perms.includes('all') || perms.includes(action);
}
