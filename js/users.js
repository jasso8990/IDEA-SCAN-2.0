/* ============================
   USERS.JS
   ============================ */

document.addEventListener('DOMContentLoaded', () => {
  // Only admins can access this page
  const session = getSession();
  if (!session || session.role !== 'admin') {
    window.location.href = 'dashboard.html';
    return;
  }
  loadUsers();
});

function loadUsers() {
  const users = getUsers();
  const tbody = document.getElementById('users-body');

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Sin usuarios</td></tr>';
    return;
  }

  const session = getSession();
  tbody.innerHTML = users.map(u => `
    <tr>
      <td><code style="color:var(--primary)">${u.username}</code></td>
      <td>${u.fullname}</td>
      <td>
        <span class="badge ${u.role === 'admin' ? 'badge-purple' : u.role === 'operador' ? 'badge-blue' : 'badge-gray'}">
          ${getRoleLabel(u.role)}
        </span>
      </td>
      <td>
        <span class="badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}">
          ${u.status === 'active' ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td>${u.lastLogin ? formatDateTime(u.lastLogin) : 'Nunca'}</td>
      <td>
        <button class="btn-icon" onclick="editUser('${u.id}')">✏️</button>
        ${u.id !== session.id ? `<button class="btn-icon" onclick="deleteUserConfirm('${u.id}')">🗑</button>` : ''}
      </td>
    </tr>`).join('');
}

function saveUser() {
  const editId   = document.getElementById('user-edit-id').value;
  const fullname = document.getElementById('user-fullname').value.trim();
  const username = document.getElementById('user-username').value.trim();
  const password = document.getElementById('user-password').value;
  const role     = document.getElementById('user-role').value;
  const status   = document.getElementById('user-status').value;

  if (!fullname || !username) {
    showToast('Completa los campos obligatorios', 'error');
    return;
  }

  const users = getUsers();

  if (!editId) {
    // New user
    if (!password || password.length < 4) {
      showToast('La contraseña debe tener al menos 4 caracteres', 'error');
      return;
    }
    const exists = users.find(u => u.username === username);
    if (exists) { showToast('El nombre de usuario ya existe', 'error'); return; }

    const newUser = {
      id: 'u' + Date.now(),
      username, fullname, password, role, status,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };
    users.push(newUser);
    localStorage.setItem('wms_users', JSON.stringify(users));
    showToast('Usuario creado correctamente', 'success');
  } else {
    // Edit user
    const idx = users.findIndex(u => u.id === editId);
    if (idx !== -1) {
      users[idx].fullname = fullname;
      users[idx].role     = role;
      users[idx].status   = status;
      if (password && password.length >= 4) users[idx].password = password;
      localStorage.setItem('wms_users', JSON.stringify(users));
      showToast('Usuario actualizado', 'success');
    }
  }

  closeModal('modal-user');
  clearUserForm();
  loadUsers();
}

function editUser(id) {
  const users = getUsers();
  const u = users.find(user => user.id === id);
  if (!u) return;

  document.getElementById('modal-user-title').textContent = 'Editar Usuario';
  document.getElementById('user-edit-id').value    = u.id;
  document.getElementById('user-fullname').value   = u.fullname;
  document.getElementById('user-username').value   = u.username;
  document.getElementById('user-password').value   = '';
  document.getElementById('user-role').value       = u.role;
  document.getElementById('user-status').value     = u.status;
  openModal('modal-user');
}

function deleteUserConfirm(id) {
  const users = getUsers();
  const u = users.find(user => user.id === id);
  if (!u) return;
  confirmDialog(`¿Eliminar al usuario "${u.fullname}"?`, () => {
    const updated = users.filter(user => user.id !== id);
    localStorage.setItem('wms_users', JSON.stringify(updated));
    showToast('Usuario eliminado', 'info');
    loadUsers();
  });
}

function clearUserForm() {
  document.getElementById('user-edit-id').value  = '';
  document.getElementById('modal-user-title').textContent = 'Nuevo Usuario';
  document.getElementById('user-fullname').value = '';
  document.getElementById('user-username').value = '';
  document.getElementById('user-password').value = '';
}
