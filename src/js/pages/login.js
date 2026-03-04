/* ═══════════════════════════════════════════════════════
   login.js — Lógica de la pantalla de login
   Depende de: config.js, auth.js
   ═══════════════════════════════════════════════════════ */
'use strict';

// Si ya hay sesión activa, redirigir al dashboard
if (currentUser()) window.location.replace('dashboard.html');

// ── Login ─────────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const btn      = document.getElementById('loginBtn');
  const btnText  = document.getElementById('loginBtnText');
  const errMsg   = document.getElementById('errMsg');
  const errText  = document.getElementById('errText');

  if (!username || !password) {
    showErr('Ingresa usuario y contraseña');
    return;
  }

  // Loading state
  btn.disabled = true;
  btnText.innerHTML = '<div class="spinner"></div> Verificando...';
  errMsg.classList.remove('show');

  try {
    const user = await loginWithCredentials(username, password);
    btnText.innerHTML = '✓ Acceso concedido';
    setTimeout(() => window.location.replace('dashboard.html'), 600);
  } catch (e) {
    showErr(e.message || 'Error de autenticación');
    btn.disabled = false;
    btnText.textContent = 'Iniciar Sesión';
  }
}

function showErr(msg) {
  const errMsg  = document.getElementById('errMsg');
  const errText = document.getElementById('errText');
  errText.textContent = msg;
  errMsg.classList.add('show');
}

function togglePassword() {
  const pwd = document.getElementById('password');
  const btn = document.getElementById('togglePwd');
  if (pwd.type === 'password') {
    pwd.type = 'text';
    btn.textContent = '🙈';
  } else {
    pwd.type = 'password';
    btn.textContent = '👁';
  }
}
