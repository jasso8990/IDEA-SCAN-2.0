/* ============================
   AUTH.JS — Login & Session
   ============================ */

// Determine base path (root vs /pages/)
const BASE = window.location.pathname.includes('/pages/') ? '../' : '';

// ---- HANDLE LOGIN ----
function handleLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  const users = getUsers();
  const user = users.find(u =>
    u.username === username &&
    u.password === password &&
    u.status === 'active'
  );

  if (user) {
    const session = {
      id: user.id,
      username: user.username,
      fullname: user.fullname,
      role: user.role,
      loginAt: new Date().toISOString()
    };
    localStorage.setItem('wms_session', JSON.stringify(session));
    // Update last login
    updateUserLastLogin(user.id);
    window.location.href = BASE + 'pages/dashboard.html';
  } else {
    document.getElementById('login-error').classList.remove('hidden');
    setTimeout(() => {
      document.getElementById('login-error').classList.add('hidden');
    }, 3000);
  }
}

// Allow Enter key on login
document.addEventListener('DOMContentLoaded', () => {
  const passwordInput = document.getElementById('password');
  if (passwordInput) {
    passwordInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleLogin();
    });
  }
  const usernameInput = document.getElementById('username');
  if (usernameInput) {
    usernameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleLogin();
    });
  }
});

// ---- GET CURRENT SESSION ----
function getSession() {
  const raw = localStorage.getItem('wms_session');
  if (!raw) return null;
  return JSON.parse(raw);
}

// ---- REQUIRE AUTH (call in protected pages) ----
function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = BASE + 'index.html';
    return null;
  }
  return session;
}

// ---- REQUIRE ADMIN ----
function requireAdmin() {
  const session = requireAuth();
  if (session && session.role !== 'admin') {
    window.location.href = 'dashboard.html';
  }
  return session;
}

// ---- LOGOUT ----
function logout() {
  localStorage.removeItem('wms_session');
  window.location.href = BASE + 'index.html';
}

// ---- SET USER INFO IN SIDEBAR ----
function setUserInfo() {
  const session = getSession();
  if (!session) return;

  const avatarEl = document.getElementById('user-avatar');
  const nameEl   = document.getElementById('user-display-name');
  const roleEl   = document.getElementById('user-display-role');

  if (avatarEl) avatarEl.textContent = session.fullname.charAt(0).toUpperCase();
  if (nameEl)   nameEl.textContent   = session.fullname;
  if (roleEl)   roleEl.textContent   = getRoleLabel(session.role);

  // Hide admin-only items for non-admins
  if (session.role !== 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }
}

function getRoleLabel(role) {
  const map = { admin: 'Administrador', operador: 'Operador', viewer: 'Solo lectura' };
  return map[role] || role;
}

// ---- TOGGLE SIDEBAR ----
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
}

// ---- TOAST NOTIFICATION ----
function showToast(msg, type = 'info') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `show toast-${type}`;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

// ---- CONFIRM DIALOG ----
function confirmDialog(message, onConfirm) {
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
  document.getElementById('confirm-msg').textContent = message;
  el.style.display = 'flex';
  document.getElementById('confirm-cancel').onclick = () => el.style.display = 'none';
  document.getElementById('confirm-ok').onclick = () => {
    el.style.display = 'none';
    onConfirm();
  };
}

// ---- MODAL HELPERS ----
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
  }
});

// ---- GET USERS (for auth) ----
function getUsers() {
  const raw = localStorage.getItem('wms_users');
  if (raw) return JSON.parse(raw);
  // Default users
  const defaults = [
    { id: 'u1', username: 'admin',    password: 'admin123', fullname: 'Administrador',   role: 'admin',    status: 'active', createdAt: new Date().toISOString(), lastLogin: null },
    { id: 'u2', username: 'operador', password: 'op123',    fullname: 'Operador General', role: 'operador', status: 'active', createdAt: new Date().toISOString(), lastLogin: null }
  ];
  localStorage.setItem('wms_users', JSON.stringify(defaults));
  return defaults;
}

function updateUserLastLogin(userId) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx !== -1) {
    users[idx].lastLogin = new Date().toISOString();
    localStorage.setItem('wms_users', JSON.stringify(users));
  }
}

// Auto-run on every protected page
document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.endsWith('index.html') &&
      !window.location.pathname.endsWith('/')) {
    const session = requireAuth();
    if (session) setUserInfo();
  }
});
