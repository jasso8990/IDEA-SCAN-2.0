/* ═══════════════════════════════════════════════════════
   pages/login.js — Autenticación de usuarios
   Depende de: src/js/core/config.js  (define SUPA_URL, SUPA_KEY, SESSION_KEY)
   Supabase SDK cargado en el HTML antes que este script.
   ═══════════════════════════════════════════════════════ */

'use strict';

// ── Cliente Supabase ───────────────────────────────────
const db = supabase.createClient(SUPA_URL, SUPA_KEY);

// ── Inicialización ─────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Si ya hay sesión activa, redirigir al inventario
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (raw && JSON.parse(raw)?.id) {
      location.href = 'inventario.html';
      return;
    }
  } catch { /* sesión corrupta — continuar */ }

  document.getElementById('username')?.focus();
});

// ── Toggle visibilidad de contraseña ──────────────────
function togglePassword() {
  const inp = document.getElementById('password');
  const btn = document.getElementById('togglePwd');
  if (!inp) return;
  if (inp.type === 'password') { inp.type = 'text';     btn.textContent = '🙈'; }
  else                         { inp.type = 'password'; btn.textContent = '👁'; }
}

// ── Helpers de UI ──────────────────────────────────────
function setError(msg) {
  const el = document.getElementById('errMsg');
  if (!el) return;
  document.getElementById('errText').textContent = msg;
  el.classList.add('show');
}

function clearError() {
  document.getElementById('errMsg')?.classList.remove('show');
}

function setLoading(loading) {
  const btn = document.getElementById('loginBtn');
  const txt = document.getElementById('loginBtnText');
  if (!btn || !txt) return;
  btn.disabled = loading;
  txt.innerHTML = loading
    ? '<div class="spinner"></div> Verificando...'
    : 'Iniciar Sesión';
}

// ── Login principal ────────────────────────────────────
async function doLogin() {
  clearError();

  const username = document.getElementById('username')?.value.trim();
  const password = document.getElementById('password')?.value;

  if (!username || !password) {
    setError('Ingresa tu usuario y contraseña');
    return;
  }

  setLoading(true);

  try {
    // 1. Obtener registro de usuario + datos del cliente
    const { data: users, error } = await db
      .schema('ideascan')
      .from('usuarios')
      .select('*, clientes(codigo, nombre)')
      .eq('username', username)
      .eq('estado', 'active')
      .limit(1);

    if (error || !users?.length) {
      setError('Usuario no encontrado o inactivo');
      return;
    }

    const user           = users[0];
    const clienteCodigo  = user.clientes?.codigo || '';
    const clienteNombre  = user.clientes?.nombre || '';
    let   authenticated  = false;

    // 2a. Intentar Supabase Auth con email interno (username@ideascan.wms)
    const internalEmail = `${username}@ideascan.wms`;
    const { error: authErr1 } = await db.auth.signInWithPassword({
      email: internalEmail,
      password,
    });
    if (!authErr1) { authenticated = true; }

    // 2b. Intentar con el email real si es diferente
    if (!authenticated && user.email && user.email !== internalEmail) {
      const { error: authErr2 } = await db.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (!authErr2) { authenticated = true; }
    }

    // 2c. Fallback: comparación de password_hash en texto plano (solo dev/setup inicial)
    if (!authenticated && user.password_hash) {
      if (user.password_hash === password) { authenticated = true; }
    }

    if (!authenticated) {
      setError('Contraseña incorrecta');
      return;
    }

    // 3. Construir objeto de sesión
    const session = {
      id:             user.id,
      username:       user.username,
      nombre:         user.nombre_display || user.nombre || user.username,
      rol:            user.rol,
      cliente_id:     user.cliente_id,
      cliente_codigo: clienteCodigo.toUpperCase(),  // e.g. 'SAFRAN' | 'MARTECH' | ''
      cliente_nombre: clienteNombre,
      almacen_id:     user.almacen_id,
      color:          user.color || '#0d2b7a',
      email:          user.email,
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    // 4. Actualizar último acceso (fire-and-forget, no bloquea la navegación)
    db.schema('ideascan')
      .from('usuarios')
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq('id', user.id)
      .then(() => {});

    // 5. Redirigir al inventario
    location.href = 'inventario.html';

  } catch (err) {
    console.error('[Login]', err);
    setError('Error de conexión. Verifica tu internet.');
  } finally {
    setLoading(false);
  }
}
