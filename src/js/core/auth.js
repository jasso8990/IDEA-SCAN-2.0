/* ═══════════════════════════════════════════════════════
   auth.js — Autenticación con Supabase
   Schema: ideascan | Tabla: usuarios
   ═══════════════════════════════════════════════════════ */
'use strict';

const SESSION_KEY = 'ideascan_user_v2'; // v2 fuerza re-login con cliente_nombre

function saveUser(u)   { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); }
function currentUser() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
  catch { return null; }
}
function clearUser() { localStorage.removeItem(SESSION_KEY); }

// ── requireAuth — verifica sesión, refresca si es vieja ──
function requireAuth(redirectTo = 'login.html') {
  const u = currentUser();
  if (!u) { window.location.replace(redirectTo); return null; }

  // Sesión vieja = no tiene la propiedad 'cliente_nombre' explícita
  if (!Object.prototype.hasOwnProperty.call(u, 'cliente_nombre')) {
    refreshSession().then(fresh => {
      if (fresh) window.location.reload();
    });
  }
  return u;
}

// ── Refresh sesión — trae datos frescos de BD ─────────
async function refreshSession() {
  const u = currentUser();
  if (!u?.id) return u;
  try {
    const { data } = await sb()
      .from('usuarios')
      .select('id, nombre, username, rol, cliente_id, almacen_id, color, clientes(nombre)')
      .eq('id', u.id)
      .single();
    if (data) {
      const fresh = {
        id:             data.id,
        nombre:         data.nombre,
        username:       data.username,
        rol:            data.rol,
        cliente_id:     data.cliente_id     || null,
        cliente_nombre: data.clientes?.nombre || null,
        almacen_id:     data.almacen_id     || null,
        color:          data.color          || null,
      };
      saveUser(fresh);
      return fresh;
    }
  } catch(e) { console.warn('refreshSession:', e.message); }
  return u;
}

// ── Login ─────────────────────────────────────────────
async function loginWithCredentials(username, password) {
  const { data, error } = await sb()
    .from('usuarios')
    .select('id, nombre, username, rol, cliente_id, almacen_id, color, password_hash, clientes(nombre)')
    .eq('username', username.trim().toLowerCase())
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
    cliente_id:     data.cliente_id     || null,
    cliente_nombre: data.clientes?.nombre || null,
    almacen_id:     data.almacen_id     || null,
    color:          data.color          || null,
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
