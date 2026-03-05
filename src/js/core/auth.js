/* ═══════════════════════════════════════════════════════
   auth.js — Autenticación con Supabase
   Schema: ideascan | Tabla: usuarios
   Campos: username, password_hash, estado ('active'), rol
   ═══════════════════════════════════════════════════════ */
'use strict';

const SESSION_KEY = 'ideascan_user';

function saveUser(u)   { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); }
function currentUser() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
  catch { return null; }
}
function clearUser()   { localStorage.removeItem(SESSION_KEY); }

// ── Refresh sesión desde BD (corrige sesiones viejas sin cliente_nombre) ──
async function refreshSession() {
  const u = currentUser();
  if (!u?.id) return u;
  // Si ya tiene cliente_nombre cargado O no tiene cliente_id, no refrescar
  if (u.cliente_nombre !== undefined) return u;
  try {
    const { data } = await sb()
      .from('usuarios')
      .select('*, clientes(nombre)')
      .eq('id', u.id)
      .single();
    if (data) {
      const updated = {
        ...u,
        cliente_nombre: data.clientes?.nombre || null,
        cliente_id: data.cliente_id,
        rol: data.rol,
      };
      saveUser(updated);
      return updated;
    }
  } catch(e) { console.warn('refreshSession error:', e); }
  return u;
}

function requireAuth() {
  const u = currentUser();
  if (!u) { window.location.replace('login.html'); return null; }
  return u;
}

// ── Login ─────────────────────────────────────────────────
async function loginWithCredentials(username, password) {
  const { data, error } = await sb()
    .from('usuarios')
    .select('*, clientes(nombre)')
    .eq('username', username.trim().toLowerCase())
    .eq('estado', 'active')
    .single();

  if (error || !data) throw new Error('Usuario no encontrado o inactivo');

  const hash = data.password_hash;
  if (!hash) throw new Error('Usuario sin contraseña. Contacta al administrador.');

  // Comparar: primero texto plano, luego base64 decodificado
  let valid = (hash === password);
  if (!valid) {
    try { valid = (atob(hash) === password); } catch(e) {}
  }
  if (!valid) throw new Error('Contraseña incorrecta');

  // Actualizar último acceso
  await sb().from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', data.id);

  const userObj = {
    id:             data.id,
    nombre:         data.nombre_display || data.nombre,
    username:       data.username,
    rol:            data.rol,
    cliente_id:     data.cliente_id,
    cliente_nombre: data.clientes?.nombre || null,
    almacen_id:     data.almacen_id,
    color:          data.color,
  };
  saveUser(userObj);
  return userObj;
}

// ── Logout ────────────────────────────────────────────────
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
