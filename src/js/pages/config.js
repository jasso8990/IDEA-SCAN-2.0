/* ═══════════════════════════════════════════════════════
   config.js (page) — Gestión de usuarios y clientes
   Depende de: config.js (core), auth.js
   ═══════════════════════════════════════════════════════ */
'use strict';

// ── Tabs ──────────────────────────────────────────────────
function showTab(tab, btn) {
  ['usuarios','clientes','sistema'].forEach(t => {
    document.getElementById(`tab-${t}`).style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');

  if (tab === 'usuarios')  loadUsuarios();
  if (tab === 'clientes')  loadClientes();
}

// ── Usuarios ──────────────────────────────────────────────
async function loadUsuarios() {
  const { data } = await sb().from('usuarios').select('*').order('nombre');
  const tbody = document.getElementById('usuariosBody');
  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-300)">Sin usuarios</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(u => {
    const role = ROLES[u.rol] || ROLES.operador;
    return `
      <tr>
        <td><strong>${u.nombre || '—'}</strong></td>
        <td class="font-mono text-sm">${u.username}</td>
        <td><span class="badge badge-navy">${role.icon} ${role.label}</span></td>
        <td><span class="badge ${u.activo ? 'badge-success' : 'badge-gray'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
      </tr>`;
  }).join('');
}

function openModalUsuario()  { document.getElementById('modalUsuario').classList.add('open'); }
function closeModalUsuario() { document.getElementById('modalUsuario').classList.remove('open'); }

async function guardarUsuario() {
  const nombre   = document.getElementById('uNombre').value.trim();
  const username = document.getElementById('uUsername').value.trim().toLowerCase();
  const password = document.getElementById('uPassword').value;
  const rol      = document.getElementById('uRol').value;

  if (!nombre || !username || !password) { showToast('Todos los campos son requeridos', 'error'); return; }

  const { error } = await sb().from('usuarios').insert({ nombre, username, password, rol, activo: true });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }

  showToast('Usuario creado ✓', 'success');
  closeModalUsuario();
  loadUsuarios();
}

// ── Clientes ──────────────────────────────────────────────
async function loadClientes() {
  const { data } = await sb().from('clientes').select('*').order('nombre');
  const tbody = document.getElementById('clientesBody');
  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-300)">Sin clientes</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(c => `
    <tr>
      <td><strong>${c.nombre}</strong></td>
      <td class="font-mono text-sm">${c.rfc || '—'}</td>
      <td>${c.contacto || '—'}</td>
      <td><span class="badge ${c.activo !== false ? 'badge-success' : 'badge-gray'}">${c.activo !== false ? 'Sí' : 'No'}</span></td>
    </tr>`).join('');
}

function openModalCliente()  { document.getElementById('modalCliente').classList.add('open'); }
function closeModalCliente() { document.getElementById('modalCliente').classList.remove('open'); }

async function guardarCliente() {
  const nombre = document.getElementById('cNombre').value.trim();
  if (!nombre) { showToast('El nombre es requerido', 'error'); return; }

  const { error } = await sb().from('clientes').insert({
    nombre,
    rfc:      document.getElementById('cRfc').value.trim().toUpperCase(),
    contacto: document.getElementById('cContacto').value.trim(),
    telefono: document.getElementById('cTel').value.trim(),
    activo:   true,
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }

  showToast('Cliente guardado ✓', 'success');
  closeModalCliente();
  loadClientes();
}
