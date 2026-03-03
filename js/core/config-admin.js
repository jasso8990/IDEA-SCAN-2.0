/* config-admin.js — extracted from original HTML
   Dep: config.js, auth.js, db.js, utils.js, nav.js */

// ── Globals ───────────────────────────────────────────────────────────────
let USER;
let currentTab = 'clientes';
let editingId  = null;
let selectedColor = '#2d6ef5';
let clientsList = [];
let almacenesList = [];

// All capturable fields for AI
const ALL_AI_FIELDS = [
  { key:'numero_parte',    label:'N° de Parte' },
  { key:'descripcion',     label:'Descripción' },
  { key:'po',              label:'PO' },
  { key:'cantidad',        label:'Cantidad/Piezas' },
  { key:'bultos',          label:'Bultos' },
  { key:'peso',            label:'Peso' },
  { key:'part_model',      label:'Part Model' },
  { key:'serial_number',   label:'Serial Number' },
  { key:'tracking_number', label:'Tracking Number' },
  { key:'vendor',          label:'Vendor' },
  { key:'origin',          label:'Origin' },
  { key:'ubicacion',       label:'Ubicación/Zona' },
];

const DEFAULT_FIELDS = ['numero_parte','descripcion','cantidad','bultos','tracking_number','vendor'];

// Role descriptions defined near toggleRolFields below

// ── Init ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  USER = initPage('config', ['admin']);
  if (!USER) return;
  await loadMeta();

  // Check URL param for direct tab navigation
  const params = new URLSearchParams(location.search);
  const tabParam = params.get('tab') || 'clientes';
  const tabEl = document.querySelector(`.config-tab[data-tab="${tabParam}"]`) || document.querySelector('.config-tab.active');
  switchTab(tabParam, tabEl || document.querySelector('.config-tab'));
});

async function loadMeta() {
  const [cls, alms] = await Promise.all([
    safeQuery(() => Q.from('clientes').select('*').order('nombre')),
    safeQuery(() => Q.from('almacenes').select('*').order('nombre')),
  ]);
  clientsList   = cls   || [];
  almacenesList = alms  || [];
}

// ── Tabs ──────────────────────────────────────────────────────────────────
function switchTab(tab, el) {
  currentTab = tab;
  document.querySelectorAll('.config-tab').forEach(t => t.classList.remove('active'));
  // Find tab element by data-tab if el not provided or wrong
  const targetEl = el?.dataset?.tab === tab ? el : document.querySelector(`.config-tab[data-tab="${tab}"]`);
  if (targetEl) targetEl.classList.add('active');
  if (tab === 'clientes')  renderClientes();
  if (tab === 'almacenes') renderAlmacenes();
  if (tab === 'usuarios')  renderUsuarios();
}

// ══════════════════════════════════════════════════════════════════════════
//  CLIENTES
// ══════════════════════════════════════════════════════════════════════════
function renderClientes() {
  document.getElementById('tabContent').innerHTML = `
    <div class="flex-between mb-16">
      <div class="section-title">🏢 Clientes Registrados</div>
      <button class="btn btn-primary btn-sm" onclick="openClientModal()">＋ Nuevo Cliente</button>
    </div>
    <div id="clientList">
      ${clientsList.length ? clientsList.map(c => clientCardHTML(c)).join('') :
        `<div class="empty-state"><div class="empty-icon">🏢</div><div class="empty-text">Sin clientes registrados</div></div>`}
    </div>`;
}

function clientCardHTML(c) {
  const campos = Array.isArray(c.campos_captura) ? c.campos_captura : JSON.parse(c.campos_captura||'[]');
  return `<div class="entity-card">
    <div class="entity-icon" style="background:${c.color||'#2d6ef5'}22;">
      <span style="font-size:20px;">${c.emoji||'🏢'}</span>
    </div>
    <div style="width:10px;height:40px;border-radius:4px;background:${c.color||'#2d6ef5'};flex-shrink:0;"></div>
    <div class="entity-info">
      <div class="entity-name">${c.nombre} <span class="mono" style="font-size:11px;color:var(--cyan);margin-left:4px;">[${c.codigo}]</span></div>
      <div class="entity-meta">${c.contacto||''} ${c.email?'· '+c.email:''}</div>
      <div class="entity-meta" style="margin-top:3px;">
        <span style="color:var(--text-300);">Campos AI:</span>
        ${campos.slice(0,5).map(k => {
          const f = ALL_AI_FIELDS.find(f=>f.key===k);
          return `<span class="badge badge-navy" style="font-size:9px;margin-right:3px;">${f?.label||k}</span>`;
        }).join('')}
        ${campos.length > 5 ? `<span class="badge badge-info" style="font-size:9px;">+${campos.length-5}</span>` : ''}
      </div>
    </div>
    <div class="entity-actions">
      <button class="btn btn-ghost btn-xs" onclick="openClientModal('${c.id}')">✏️ Editar</button>
      <button class="btn btn-xs" style="background:rgba(239,68,68,.08);color:var(--danger);border:1px solid rgba(239,68,68,.2);"
        onclick="confirmDelete('cliente','${c.id}','${c.nombre}')">🗑</button>
    </div>
  </div>`;
}

function openClientModal(id = null) {
  editingId = id;
  selectedColor = '#2d6ef5';

  // Build AI field checkboxes
  const defaultChecked = DEFAULT_FIELDS;
  document.getElementById('fieldChecks').innerHTML = ALL_AI_FIELDS.map(f => `
    <label class="field-check" id="fc_${f.key}" onclick="toggleField(this,'${f.key}')">
      <input type="checkbox" id="chk_${f.key}" ${defaultChecked.includes(f.key)?'checked':''}>
      <span class="field-check-label">${f.label}</span>
    </label>`).join('');
  // Apply checked class
  ALL_AI_FIELDS.forEach(f => {
    if (defaultChecked.includes(f.key)) document.getElementById('fc_'+f.key)?.classList.add('checked');
  });

  if (id) {
    const c = clientsList.find(c => c.id === id);
    if (!c) return;
    document.getElementById('cmTitle').textContent    = `Editar: ${c.nombre}`;
    document.getElementById('cmNombre').value         = c.nombre;
    document.getElementById('cmCodigo').value         = c.codigo;
    document.getElementById('cmContacto').value       = c.contacto || '';
    document.getElementById('cmEmail').value          = c.email    || '';
    document.getElementById('cmTel').value            = c.telefono || '';
    document.getElementById('cmRfc').value            = c.rfc      || '';
    document.getElementById('cmNotas').value          = c.notas    || '';

    selectedColor = c.color || '#2d6ef5';
    document.querySelectorAll('.color-opt').forEach(el => {
      el.classList.toggle('selected', el.dataset.color === selectedColor);
    });

    // Set field checkboxes from saved config
    const campos = Array.isArray(c.campos_captura) ? c.campos_captura : (JSON.parse(c.campos_captura||'[]'));
    ALL_AI_FIELDS.forEach(f => {
      const chk = document.getElementById('chk_'+f.key);
      const fc  = document.getElementById('fc_'+f.key);
      if (chk) chk.checked = campos.includes(f.key);
      if (fc)  fc.classList.toggle('checked', campos.includes(f.key));
    });

    document.getElementById('cmSaveBtn').textContent = 'Actualizar';
  } else {
    document.getElementById('cmTitle').textContent = 'Nuevo Cliente';
    document.getElementById('cmNombre').value  = '';
    document.getElementById('cmCodigo').value  = '';
    document.getElementById('cmContacto').value= '';
    document.getElementById('cmEmail').value   = '';
    document.getElementById('cmTel').value     = '';
    document.getElementById('cmRfc').value     = '';
    document.getElementById('cmNotas').value   = '';
    document.getElementById('cmSaveBtn').textContent = 'Guardar';
  }
  updateSkuPreview();
  document.getElementById('clientModal').classList.add('open');
}

function closeClientModal() { document.getElementById('clientModal').classList.remove('open'); }

function toggleField(el, key) {
  const chk = el.querySelector('input[type=checkbox]');
  chk.checked = !chk.checked;
  el.classList.toggle('checked', chk.checked);
}

function checkAll(val) {
  ALL_AI_FIELDS.forEach(f => {
    const chk = document.getElementById('chk_'+f.key);
    const fc  = document.getElementById('fc_'+f.key);
    if (chk) chk.checked = val;
    if (fc)  fc.classList.toggle('checked', val);
  });
}

function selectColor(color, el) {
  selectedColor = color;
  document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

function updateSkuPreview() {
  const cod = document.getElementById('cmCodigo')?.value || '???';
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  document.getElementById('skuPreview').textContent = `${cod}${yy}${mm}${dd}001`;
}

async function saveClient() {
  const nombre = document.getElementById('cmNombre').value.trim();
  const codigo = document.getElementById('cmCodigo').value.trim().toUpperCase();
  if (!nombre || !codigo) { showToast('Nombre y código son obligatorios', 'warning'); return; }

  const campos = ALL_AI_FIELDS.map(f => f.key).filter(k => document.getElementById('chk_'+k)?.checked);

  const payload = {
    nombre, codigo,
    color:         selectedColor,
    contacto:      document.getElementById('cmContacto').value.trim() || null,
    email:         document.getElementById('cmEmail').value.trim() || null,
    telefono:      document.getElementById('cmTel').value.trim() || null,
    rfc:           document.getElementById('cmRfc').value.trim() || null,
    notas:         document.getElementById('cmNotas').value.trim() || null,
    campos_captura: campos,
    activo:        true,
  };

  const btn = document.getElementById('cmSaveBtn');
  btn.disabled = true; btn.textContent = 'Guardando...';

  try {
    if (editingId) {
      const { error } = await Q.from('clientes').update(payload).eq('id', editingId);
      if (error) throw error;
      showToast('✅ Cliente actualizado', 'success');
    } else {
      const { error } = await Q.from('clientes').insert(payload);
      if (error) throw error;
      showToast('✅ Cliente creado', 'success');
    }
    closeClientModal();
    await loadMeta();
    renderClientes();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = editingId ? 'Actualizar' : 'Guardar';
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  ALMACENES
// ══════════════════════════════════════════════════════════════════════════
function renderAlmacenes() {
  document.getElementById('tabContent').innerHTML = `
    <div class="flex-between mb-16">
      <div class="section-title">🏭 Almacenes Registrados</div>
      <button class="btn btn-primary btn-sm" onclick="openWarehouseModal()">＋ Nuevo Almacén</button>
    </div>
    <div id="warehouseList">
      ${almacenesList.length ? almacenesList.map(a => warehouseCardHTML(a)).join('') :
        `<div class="empty-state"><div class="empty-icon">🏭</div><div class="empty-text">Sin almacenes registrados</div></div>`}
    </div>`;
}

function warehouseCardHTML(a) {
  return `<div class="entity-card">
    <div class="entity-icon" style="background:rgba(13,43,122,.08)">🏭</div>
    <div class="entity-info">
      <div class="entity-name">${a.nombre} <span class="mono" style="font-size:11px;color:var(--cyan);margin-left:4px;">[${a.codigo}]</span></div>
      <div class="entity-meta">${a.direccion||'Sin dirección'}</div>
      <div class="entity-meta">${a.encargado?'👤 '+a.encargado+' · ':''} ${a.superficie_m2?'📐 '+a.superficie_m2+' m² · ':''}${a.capacidad?'📦 Cap. '+a.capacidad:''}</div>
    </div>
    <div class="entity-actions">
      <button class="btn btn-ghost btn-xs" onclick="openWarehouseModal('${a.id}')">✏️ Editar</button>
      <button class="btn btn-xs" style="background:rgba(239,68,68,.08);color:var(--danger);border:1px solid rgba(239,68,68,.2);"
        onclick="confirmDelete('almacen','${a.id}','${a.nombre}')">🗑</button>
    </div>
  </div>`;
}

function openWarehouseModal(id = null) {
  editingId = id;
  if (id) {
    const a = almacenesList.find(a => a.id === id);
    if (!a) return;
    document.getElementById('wmTitle').textContent = `Editar: ${a.nombre}`;
    document.getElementById('wmNombre').value = a.nombre;
    document.getElementById('wmCodigo').value = a.codigo;
    document.getElementById('wmDir').value    = a.direccion   || '';
    document.getElementById('wmTel').value    = a.telefono    || '';
    document.getElementById('wmEnc').value    = a.encargado   || '';
    document.getElementById('wmSup').value    = a.superficie_m2 || '';
    document.getElementById('wmCap').value    = a.capacidad   || '';
    document.getElementById('wmSaveBtn').textContent = 'Actualizar';
  } else {
    document.getElementById('wmTitle').textContent = 'Nuevo Almacén';
    ['wmNombre','wmCodigo','wmDir','wmTel','wmEnc','wmSup','wmCap'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('wmSaveBtn').textContent = 'Guardar';
  }
  document.getElementById('warehouseModal').classList.add('open');
}

function closeWarehouseModal() { document.getElementById('warehouseModal').classList.remove('open'); }

async function saveWarehouse() {
  const nombre = document.getElementById('wmNombre').value.trim();
  const codigo = document.getElementById('wmCodigo').value.trim().toUpperCase();
  if (!nombre || !codigo) { showToast('Nombre y código son obligatorios', 'warning'); return; }

  const payload = {
    nombre, codigo,
    direccion:    document.getElementById('wmDir').value.trim() || null,
    telefono:     document.getElementById('wmTel').value.trim() || null,
    encargado:    document.getElementById('wmEnc').value.trim() || null,
    superficie_m2: parseInt(document.getElementById('wmSup').value) || 0,
    capacidad:    parseInt(document.getElementById('wmCap').value) || 0,
    activo: true,
  };

  const btn = document.getElementById('wmSaveBtn');
  btn.disabled = true; btn.textContent = 'Guardando...';

  try {
    if (editingId) {
      const { error } = await Q.from('almacenes').update(payload).eq('id', editingId);
      if (error) throw error;
      showToast('✅ Almacén actualizado', 'success');
    } else {
      const { error } = await Q.from('almacenes').insert(payload);
      if (error) throw error;
      showToast('✅ Almacén creado', 'success');
    }
    closeWarehouseModal();
    await loadMeta();
    renderAlmacenes();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = editingId ? 'Actualizar' : 'Guardar';
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  USUARIOS
// ══════════════════════════════════════════════════════════════════════════
async function renderUsuarios() {
  document.getElementById('tabContent').innerHTML = `
    <div class="flex-between mb-16">
      <div class="section-title">👥 Usuarios del Sistema</div>
      <button class="btn btn-primary btn-sm" onclick="openUserModal()">＋ Nuevo Usuario</button>
    </div>
    <div id="userList"><div style="text-align:center;padding:20px;color:var(--text-300);">⏳ Cargando...</div></div>`;

  const data = await safeQuery(() => Q.from('usuarios').select('*').eq('estado','active').order('nombre'));
  if (!data) return;

  const ROLE_LABEL = { admin:'👑 Admin', supervisor:'🔷 Supervisor', cliente:'🏢 Cliente', operador:'⚙️ Operador' };
  const ROLE_COLOR = { admin:'#0d2b7a', supervisor:'#2d6ef5', cliente:'#00c2ff', operador:'#22c77a' };

  document.getElementById('userList').innerHTML = data.length
    ? data.map(u => `<div class="entity-card">
        <div class="entity-icon" style="background:${ROLE_COLOR[u.rol]||'#666'}22;">
          <div style="width:36px;height:36px;border-radius:9px;background:${u.color||ROLE_COLOR[u.rol]||'#666'};display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:800;">
            ${(u.nombre||'U').slice(0,1).toUpperCase()}
          </div>
        </div>
        <div class="entity-info">
          <div class="entity-name">${u.nombre_display||u.nombre||u.username}
            <span class="badge" style="font-size:9px;background:${ROLE_COLOR[u.rol]||'#666'}22;color:${ROLE_COLOR[u.rol]||'#666'};margin-left:6px;">${ROLE_LABEL[u.rol]||u.rol}</span>
          </div>
          <div class="entity-meta mono">@${u.username||'—'}</div>
          <div class="entity-meta">${u.email||''} ${u.ultimo_acceso?'· Último acceso: '+fmtDate(u.ultimo_acceso):''}</div>
        </div>
        <div class="entity-actions">
          <button class="btn btn-ghost btn-xs" onclick="openUserModal('${u.id}')">✏️</button>
          <button class="btn btn-xs" style="background:rgba(239,68,68,.08);color:var(--danger);border:1px solid rgba(239,68,68,.2);"
            onclick="confirmDelete('usuario','${u.id}','${u.username||u.nombre}')">🗑</button>
        </div>
      </div>`).join('')
    : `<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">Sin usuarios registrados</div></div>`;
}

function openUserModal(id = null) {
  editingId = id;

  // Populate dropdowns
  document.getElementById('umCliente').innerHTML = '<option value="">— Sin cliente —</option>' +
    clientsList.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  document.getElementById('umAlmacen').innerHTML = '<option value="">— Sin almacén —</option>' +
    almacenesList.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');

  if (id) {
    // Edit mode: load user async
    Q.from('usuarios').select('*').eq('id', id).single().then(({ data: u }) => {
      if (!u) return;
      document.getElementById('umTitle').textContent    = `Editar: ${u.nombre||u.username}`;
      document.getElementById('umNombre').value         = u.nombre    || '';
      document.getElementById('umApellido').value       = u.apellido  || '';
      document.getElementById('umUsername').value       = u.username  || '';
      document.getElementById('umEmail').value          = u.email     || '';
      document.getElementById('umPassword').value       = '';
      document.getElementById('umRol').value            = u.rol       || '';
      document.getElementById('umCliente').value        = u.cliente_id || '';
      document.getElementById('umAlmacen').value        = u.almacen_id || '';
      document.getElementById('umSaveBtn').textContent  = 'Actualizar';
      toggleRolFields();
    });
  } else {
    document.getElementById('umTitle').textContent = 'Nuevo Usuario';
    ['umNombre','umApellido','umUsername','umEmail','umPassword'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('umRol').value = '';
    document.getElementById('umCliente').value = '';
    document.getElementById('umAlmacen').value = '';
    document.getElementById('umSaveBtn').textContent = 'Crear Usuario';
    document.getElementById('rolDesc').style.display = 'none';
    toggleRolFields();
  }

  document.getElementById('userModal').classList.add('open');
}

function closeUserModal() { document.getElementById('userModal').classList.remove('open'); }

function updateUsername() {
  const nombre   = document.getElementById('umNombre').value.trim().toLowerCase().replace(/\s+/g,'');
  const apellido = document.getElementById('umApellido').value.trim().toLowerCase().split(' ')[0] || '';
  if (!nombre) return;
  document.getElementById('umUsername').value = `${nombre}${apellido ? '.'+apellido : ''}`.slice(0, 20);
}

function toggleRolFields() {
  const rol = document.getElementById('umRol').value;
  const needsClient  = ['supervisor','cliente','operador'].includes(rol);
  const needsAlmacen = ['supervisor','operador'].includes(rol);
  document.getElementById('clienteField').style.display  = needsClient  ? '' : 'none';
  document.getElementById('almacenField').style.display  = needsAlmacen ? '' : 'none';
  const desc = document.getElementById('rolDesc');
  if (ROL_DESC[rol]) { desc.style.display=''; desc.textContent=ROL_DESC[rol]; }
  else desc.style.display = 'none';
}

const ROL_DESC = {
  admin:'Acceso completo al sistema: inventario, SKUs, clientes, almacenes, usuarios, mapas y configuración.',
  supervisor:'Ver, imprimir, descargar y subir reportes para su almacén/cliente asignado. Puede modificar el mapa de su almacén. Sin acceso a configuración.',
  cliente:'Solo puede ver, imprimir y descargar reportes para los almacenes asignados. Sin acceso a configuración ni Entrada AI.',
  operador:'Puede modificar inventario y SKUs de su cliente/almacén asignado. Usa Entrada AI y ve reportes de su asignación.',
};

async function saveUser() {
  const nombre    = document.getElementById('umNombre').value.trim();
  const apellido  = document.getElementById('umApellido').value.trim();
  const username  = document.getElementById('umUsername').value.trim().toLowerCase();
  const password  = document.getElementById('umPassword').value;
  const emailInp  = document.getElementById('umEmail').value.trim();
  const rol       = document.getElementById('umRol').value;
  const clienteId = document.getElementById('umCliente').value || null;
  const almacenId = document.getElementById('umAlmacen').value || null;

  if (!nombre || !username || !rol) { showToast('Nombre, usuario y rol son obligatorios', 'warning'); return; }
  if (!editingId && !password)      { showToast('Ingresa una contraseña temporal', 'warning'); return; }

  const btn = document.getElementById('umSaveBtn');
  btn.disabled = true; btn.textContent = 'Guardando...';

  const email = emailInp || `${username}@ideascan.wms`;

  try {
    if (!editingId) {
      // 1. Create Supabase Auth user so login works
      const { data: authData, error: authErr } = await db.auth.signUp({
        email, password,
        options: { data: { username, nombre, rol } }
      });
      // authErr is ok if user already exists - we still insert in usuarios table
      if (authErr && !authErr.message?.includes('already registered')) {
        console.warn('Auth signup warning:', authErr.message);
      }
    }

    const payload = {
      nombre,
      apellido:      apellido || null,
      nombre_display: `${nombre}${apellido ? ' '+apellido : ''}`.trim(),
      username,
      email,
      rol,
      cliente_id:    clienteId,
      almacen_id:    almacenId,
      estado:        'active',
      password_hash: password || undefined,
    };
    // Remove undefined fields
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    if (editingId) {
      if (!password) delete payload.password_hash; // don't overwrite pw if not changed
      const { error } = await Q.from('usuarios').update(payload).eq('id', editingId);
      if (error) throw error;
      showToast('✅ Usuario actualizado correctamente', 'success');
    } else {
      const { error } = await Q.from('usuarios').insert(payload);
      if (error) throw error;
      showToast(`✅ Usuario @${username} creado — contraseña: ${password}`, 'success', 5000);
    }
    closeUserModal();
    renderUsuarios();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = editingId ? 'Actualizar' : 'Crear Usuario';
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  DELETE
// ══════════════════════════════════════════════════════════════════════════
let deleteCallback = null;
function confirmDelete(type, id, name) {
  document.getElementById('delTitle').textContent = `¿Eliminar ${type}?`;
  document.getElementById('delSub').textContent = name;
  deleteCallback = async () => {
    const tableMap = { cliente:'clientes', almacen:'almacenes', usuario:'usuarios' };
    const table = tableMap[type];
    if (!table) return;
    const { error } = type === 'usuario'
      ? await Q.from(table).update({ estado:'inactive' }).eq('id', id)
      : await Q.from(table).update({ activo: false }).eq('id', id);
    if (error) { showToast('Error: '+error.message, 'error'); return; }
    showToast('✅ Eliminado correctamente', 'success');
    closeDelete();
    await loadMeta();
    if (currentTab === 'clientes')  renderClientes();
    if (currentTab === 'almacenes') renderAlmacenes();
    if (currentTab === 'usuarios')  renderUsuarios();
  };
  document.getElementById('delConfirmBtn').onclick = deleteCallback;
  document.getElementById('deleteModal').classList.add('open');
}
function closeDelete() { document.getElementById('deleteModal').classList.remove('open'); }
