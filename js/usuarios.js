/* ============================
   USUARIOS.JS — Supabase Auth via user-admin Edge Function
   ============================ */

let allUsers = [];

document.addEventListener('DOMContentLoaded', async () => {
  const auth = requireAdmin();
  if (!auth) return;
  await loadUsers();
});

async function loadUsers() {
  try {
    allUsers = await dbGetUsuarios();
    renderUsers(allUsers);
  } catch (e) {
    showToast('Error al cargar usuarios: ' + e.message, 'error');
  }
}

function renderUsers(users) {
  const tbody   = document.getElementById('users-body');
  const profile = getLocalProfile();

  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Sin usuarios</td></tr>'; return;
  }

  const rolCls = { admin:'badge-purple', supervisor:'badge-blue', operador:'badge-green', cliente:'badge-gray' };

  tbody.innerHTML = users.map(u => {
    const display = `${u.nombre || ''}${u.apellido ? ' ' + u.apellido : ''}`.trim();
    const isSelf  = u.id === profile?.id;
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:28px;height:28px;border-radius:50%;background:${u.color||'#F59E0B'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#0F1117">${(display||u.username||'?').charAt(0).toUpperCase()}</div>
            <code style="color:var(--primary)">${u.username || '—'}</code>
            ${isSelf ? '<span class="badge badge-blue" style="font-size:9px">Tú</span>' : ''}
          </div>
        </td>
        <td>${display || '—'}</td>
        <td><span class="badge ${rolCls[u.rol] || 'badge-gray'}">${getRoleLabel(u.rol)}</span></td>
        <td><span class="badge ${u.estado === 'active' ? 'badge-green' : 'badge-red'}">${u.estado === 'active' ? 'Activo' : 'Inactivo'}</span></td>
        <td>${u.ultimo_acceso ? formatDateTime(u.ultimo_acceso) : 'Nunca'}</td>
        <td>
          <button class="btn-icon" onclick="editUser('${u.id}')" title="Editar">✏️</button>
          ${!isSelf ? `<button class="btn-icon" onclick="deleteUser('${u.id}')" title="Eliminar">🗑</button>` : ''}
        </td>
      </tr>`;
  }).join('');
}

async function saveUser() {
  const editId   = document.getElementById('user-edit-id').value;
  const nombre   = document.getElementById('user-nombre').value.trim();
  const apellido = document.getElementById('user-apellido').value.trim();
  const username = document.getElementById('user-username').value.trim();
  const password = document.getElementById('user-password').value;
  const rol      = document.getElementById('user-rol').value;
  const color    = document.getElementById('user-color').value;

  if (!nombre || !username) {
    showToast('Nombre y usuario son obligatorios', 'error'); return;
  }

  const btn = document.getElementById('user-save-btn');
  btn.disabled    = true;
  btn.textContent = 'Guardando...';

  try {
    if (editId) {
      // Update via DB (role, estado, color)
      const updates = { nombre, apellido, rol, color };
      await dbUpdateUsuarioDB(editId, updates);

      // If password provided, use edge function to update (create new won't work, need password reset)
      showToast('Usuario actualizado en Supabase', 'success');
    } else {
      // Create via edge function (creates Auth + DB)
      if (!password || password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres', 'error'); return;
      }
      await dbCreateUsuario({ username, password, nombre, apellido, rol, color, estado: 'active' });
      showToast(`Usuario "${username}" creado en Supabase`, 'success');
    }
    closeModal('modal-user');
    clearUserForm();
    await loadUsers();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = editId ? 'Actualizar' : 'Crear Usuario';
  }
}

function editUser(id) {
  const u = allUsers.find(u => u.id === id);
  if (!u) return;
  document.getElementById('modal-user-title').textContent = 'Editar Usuario';
  document.getElementById('user-save-btn').textContent    = 'Actualizar';
  document.getElementById('user-edit-id').value  = u.id;
  document.getElementById('user-nombre').value   = u.nombre   || '';
  document.getElementById('user-apellido').value = u.apellido || '';
  document.getElementById('user-username').value = u.username || '';
  document.getElementById('user-password').value = '';
  document.getElementById('user-rol').value      = u.rol      || 'operador';
  document.getElementById('user-color').value    = u.color    || '#F59E0B';
  document.getElementById('edit-note').classList.remove('hidden');
  openModal('modal-user');
}

function deleteUser(id) {
  const u = allUsers.find(u => u.id === id);
  confirmDialog(`¿Eliminar al usuario "${u?.username}"? Esto eliminará su acceso al sistema.`, async () => {
    try {
      await dbDeleteUsuario(id);
      showToast('Usuario eliminado de Supabase', 'info');
      await loadUsers();
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  });
}

function clearUserForm() {
  ['user-edit-id','user-nombre','user-apellido','user-username','user-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('modal-user-title').textContent = 'Nuevo Usuario';
  document.getElementById('user-save-btn').textContent    = 'Crear Usuario';
  document.getElementById('user-color').value = '#F59E0B';
  document.getElementById('user-rol').value   = 'operador';
  document.getElementById('edit-note').classList.add('hidden');
}

// Reset form on new user
document.querySelector('.btn-primary.header-actions')?.addEventListener('click', clearUserForm);
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('[onclick="openModal(\'modal-user\')"]')?.addEventListener('click', clearUserForm);
});
