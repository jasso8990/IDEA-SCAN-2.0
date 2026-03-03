/* ═══════════════════════════════════════════════════════
   nav.js — Sidebar y Bottom Nav
   Depende de: config.js, auth.js
   ═══════════════════════════════════════════════════════ */

'use strict';

// ── Render Sidebar ────────────────────────────────────────
function renderSidebar(currentPage) {
  const user = currentUser();
  if (!user) return;

  const urlParams    = new URLSearchParams(location.search);
  const tabParam     = urlParams.get('tab');
  const effectivePage = (currentPage === 'config' && tabParam === 'usuarios') ? 'usuarios' : currentPage;

  const role     = ROLES[user.rol] || ROLES.operador;
  const initials = (user.nombre || 'U').slice(0, 1).toUpperCase();

  const sidebarEl = document.getElementById('sidebar');
  if (!sidebarEl) return;

  const navItems  = getNavItems(user);
  const mainItems = navItems.filter(n => !n.section);
  const adminItems = navItems.filter(n => n.section === 'admin');

  let navHTML = mainItems.map(n => `
    <a href="${n.href}" class="nav-item ${effectivePage === n.id ? 'active' : ''}">
      <span class="nav-icon">${n.icon}</span>
      ${n.label}
    </a>`).join('');

  if (adminItems.length) {
    navHTML += `<div class="nav-section-label" style="margin-top:8px;">Administración</div>`;
    navHTML += adminItems.map(n => `
      <a href="${n.href}" class="nav-item ${effectivePage === n.id ? 'active' : ''}">
        <span class="nav-icon">${n.icon}</span>
        ${n.label}
      </a>`).join('');
  }

  sidebarEl.innerHTML = `
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon">📦</div>
      <div class="sidebar-logo-text">
        <div class="sidebar-logo-name">${APP_NAME}</div>
        <div class="sidebar-logo-company">${APP_COMPANY}</div>
      </div>
    </div>
    <div class="sidebar-user">
      <div class="sidebar-user-avatar" style="background:${role.color}">${initials}</div>
      <div class="sidebar-user-info">
        <div class="sidebar-user-name">${user.nombre || user.username}</div>
        <div class="sidebar-user-role">${role.icon} ${role.label}</div>
        ${user.cliente_nombre
          ? `<div style="font-size:9px;color:rgba(255,255,255,.4);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">🏢 ${user.cliente_nombre}</div>`
          : ''}
      </div>
      <button class="sidebar-logout" onclick="logout()" title="Cerrar sesión">⇥</button>
    </div>
    <nav class="sidebar-nav">${navHTML}</nav>
    <div style="padding:14px 20px;border-top:1px solid rgba(255,255,255,.06);">
      <div style="font-size:9px;color:rgba(255,255,255,.2);text-align:center;letter-spacing:1px;">
        ${APP_NAME} © 2026 ${APP_COMPANY}
      </div>
    </div>`;
}

// ── Render Bottom Nav (móvil) ────────────────────────────
function renderBottomNav(currentPage) {
  const user = currentUser();
  if (!user) return;
  const navEl = document.getElementById('bottomNav');
  if (!navEl) return;

  const items  = getNavItems(user).filter(n => !n.desktopOnly);
  const shown  = items.slice(0, 5);
  const hasAI  = items.some(n => n.id === 'ai_entry');

  let html = '<div class="bottom-nav-items">';

  const first2 = shown.filter(n => n.id !== 'ai_entry').slice(0, 2);
  const last2  = shown.filter(n => n.id !== 'ai_entry').slice(2, 4);

  first2.forEach(n => {
    html += `<a href="${n.href}" class="bottom-nav-item ${currentPage === n.id ? 'active' : ''}">
      <span class="bn-icon">${n.icon}</span>
      <span class="bn-label">${n.label}</span>
    </a>`;
  });

  if (hasAI) {
    html += `<a href="ai-entry.html" class="bottom-nav-item" style="flex:0.8">
      <button class="bottom-nav-fab">🤖</button>
    </a>`;
  }

  last2.forEach(n => {
    html += `<a href="${n.href}" class="bottom-nav-item ${currentPage === n.id ? 'active' : ''}">
      <span class="bn-icon">${n.icon}</span>
      <span class="bn-label">${n.label}</span>
    </a>`;
  });

  html += '</div>';
  navEl.innerHTML = html;
}

// ── Toggle / Close Sidebar ────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebarOverlay')?.classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}
