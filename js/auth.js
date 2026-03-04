/* ============================
   AUTH.JS — Supabase Auth Real
   ============================ */

const AUTH_DOMAIN = 'ideascan.wms';
const BASE = window.location.pathname.includes('/pages/') ? '../' : '';

// Convert username → email for Supabase auth
function toEmail(username) {
  return username.trim().toLowerCase() + '@' + AUTH_DOMAIN;
}

// ── LOGIN ─────────────────────────────────────────────────────────────────
async function handleLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const btn      = document.querySelector('.btn-login');
  const errEl    = document.getElementById('login-error');

  if (!username || !password) {
    showLoginError('Ingresa usuario y contraseña'); return;
  }

  btn.disabled    = true;
  btn.textContent = 'Ingresando...';

  try {
    const email   = toEmail(username);
    const authData= await sbLogin(email, password);

    // Fetch user profile from ideascan.usuarios
    const profiles = await fetchWithAnonAuth(`/rest/v1/usuarios?username=eq.${encodeURIComponent(username)}&select=*&limit=1`);
    const profile  = profiles?.[0];

    if (!profile || profile.estado !== 'active') {
      await sbLogout(authData.access_token);
      showLoginError('Usuario inactivo o no encontrado'); return;
    }

    // Save session + profile
    saveLocalSession({ access_token: authData.access_token, user_id: authData.user.id });
    localStorage.setItem('wms_user_profile', JSON.stringify(profile));

    // Update last login
    updateLastLogin(authData.access_token, profile.id).catch(() => {});

    window.location.href = BASE + 'pages/dashboard.html';

  } catch (err) {
    showLoginError('Usuario o contraseña incorrectos');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Entrar al Sistema';
  }
}

async function fetchWithAnonAuth(path) {
  const res = await fetch(`${CONFIG.supabase.url}${path}`, {
    headers: {
      'apikey':          CONFIG.supabase.anonKey,
      'Authorization':   `Bearer ${CONFIG.supabase.anonKey}`,
      'Accept-Profile':  CONFIG.supabase.schema,
    }
  });
  return res.json();
}

async function updateLastLogin(token, userId) {
  await fetch(`${CONFIG.supabase.url}/rest/v1/usuarios?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'apikey':          CONFIG.supabase.anonKey,
      'Authorization':   `Bearer ${token}`,
      'Content-Type':    'application/json',
      'Accept-Profile':  CONFIG.supabase.schema,
      'Content-Profile': CONFIG.supabase.schema,
    },
    body: JSON.stringify({ ultimo_acceso: new Date().toISOString() })
  });
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  setTimeout(() => el?.classList.add('hidden'), 4000);
}

// ── SESSION ───────────────────────────────────────────────────────────────
function requireAuth() {
  const session = getLocalSession();
  const profile = getLocalProfile();
  if (!session || !profile) {
    window.location.href = BASE + 'index.html';
    return null;
  }
  return { session, profile };
}

function requireAdmin() {
  const auth = requireAuth();
  if (auth && auth.profile.rol !== 'admin') {
    window.location.href = 'dashboard.html';
  }
  return auth;
}

async function logout() {
  const session = getLocalSession();
  if (session?.access_token) {
    try { await sbLogout(session.access_token); } catch {}
  }
  clearLocalSession();
  window.location.href = BASE + 'index.html';
}

// ── SIDEBAR INFO ──────────────────────────────────────────────────────────
function setUserInfo() {
  const profile = getLocalProfile();
  if (!profile) return;

  const display = profile.nombre_display || `${profile.nombre} ${profile.apellido || ''}`.trim();
  const initials = display.charAt(0).toUpperCase();
  const roleMap  = { admin:'Administrador', supervisor:'Supervisor', operador:'Operador', cliente:'Cliente' };

  const avatarEl = document.getElementById('user-avatar');
  const nameEl   = document.getElementById('user-display-name');
  const roleEl   = document.getElementById('user-display-role');

  if (avatarEl) {
    avatarEl.textContent   = initials;
    avatarEl.style.background = profile.color || '#F59E0B';
  }
  if (nameEl) nameEl.textContent = display;
  if (roleEl) roleEl.textContent = roleMap[profile.rol] || profile.rol;

  // Hide admin-only nav items for non-admins
  if (profile.rol !== 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }
}

// ── UI HELPERS ────────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('collapsed');
}

function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
  }
});

function showToast(msg, type = 'info') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className   = `show toast-${type}`;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function confirmDialog(msg, onConfirm) {
  let el = document.getElementById('confirm-dialog');
  if (!el) {
    el = document.createElement('div');
    el.id = 'confirm-dialog';
    el.innerHTML = `
      <div class="confirm-box">
        <h3>⚠️ Confirmar acción</h3>
        <p id="confirm-msg"></p>
        <div class="confirm-actions">
          <button class="btn-secondary" id="confirm-cancel">Cancelar</button>
          <button class="btn-danger" id="confirm-ok">Confirmar</button>
        </div>
      </div>`;
    document.body.appendChild(el);
  }
  document.getElementById('confirm-msg').textContent = msg;
  el.style.display = 'flex';
  document.getElementById('confirm-cancel').onclick = () => el.style.display = 'none';
  document.getElementById('confirm-ok').onclick = () => { el.style.display = 'none'; onConfirm(); };
}

function getRoleLabel(rol) {
  return { admin:'Administrador', supervisor:'Supervisor', operador:'Operador', cliente:'Cliente' }[rol] || rol;
}

// ── AUTO-INIT on protected pages ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  const isLogin = path.endsWith('index.html') || path.endsWith('/');

  if (!isLogin) {
    const auth = requireAuth();
    if (auth) setUserInfo();
  }

  // Login page: Enter key
  document.getElementById('password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('username')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
});
