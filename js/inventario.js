/* ============================
   INVENTARIO.JS
   ============================ */

let allItems = [];

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadClientes(), loadAlmacenes()]);
  await reloadData();
  document.getElementById('inv-fecha-entrada').value = todayISO();
});

async function reloadData() {
  try {
    allItems = await dbGetInventario();
    populateFilters();
    filterTable();
  } catch (e) {
    showToast('Error al cargar inventario: ' + e.message, 'error');
  }
}

function filterTable() {
  const search  = document.getElementById('search-input').value.toLowerCase();
  const cliente = document.getElementById('filter-cliente').value;
  const almacen = document.getElementById('filter-almacen').value;
  const estado  = document.getElementById('filter-estado').value;

  const filtered = allItems.filter(i => {
    const matchSearch = !search ||
      (i.sku         || '').toLowerCase().includes(search) ||
      (i.descripcion || '').toLowerCase().includes(search) ||
      (i.numero_parte|| '').toLowerCase().includes(search) ||
      (i.tracking_number || '').toLowerCase().includes(search) ||
      (i.po          || '').toLowerCase().includes(search);
    const matchCliente = !cliente || i.cliente_id === cliente;
    const matchAlmacen = !almacen || i.almacen_id === almacen;
    const matchEstado  = !estado  || i.estado === estado;
    return matchSearch && matchCliente && matchAlmacen && matchEstado;
  });

  renderTable(filtered);
}

function renderTable(items) {
  const tbody = document.getElementById('inv-body');
  const count = document.getElementById('table-count');
  if (count) count.textContent = `${items.length} registro${items.length !== 1 ? 's' : ''}`;

  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="14" class="empty-state">Sin registros</td></tr>'; return;
  }

  tbody.innerHTML = items.map(i => {
    const st      = getStockStatus(i);
    const cliente = i.clientes?.nombre || '—';
    const almacen = i.almacenes?.nombre || '—';
    return `
      <tr>
        <td><code style="color:var(--primary);font-size:11px">${i.sku}</code></td>
        <td>${i.numero_parte || '—'}</td>
        <td>${i.descripcion  || '—'}</td>
        <td><span style="font-weight:500">${cliente}</span></td>
        <td>${almacen}</td>
        <td>${i.zona || ''}${i.ubicacion ? ' · ' + i.ubicacion : ''}</td>
        <td><strong>${i.cantidad}</strong> ${i.unidad || 'pz'}</td>
        <td>${i.bultos || 0}</td>
        <td>${i.carrier || '—'}</td>
        <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis" title="${i.tracking_number || ''}">${i.tracking_number || '—'}</td>
        <td>${i.po || '—'}</td>
        <td><span class="badge ${st.cls}">${st.label}</span></td>
        <td>${formatDate(i.fecha_entrada)}</td>
        <td style="white-space:nowrap">
          <button class="btn-icon" onclick="editItem('${i.id}')" title="Editar">✏️</button>
          <button class="btn-icon" onclick="deleteItem('${i.id}')" title="Eliminar">🗑</button>
        </td>
      </tr>`;
  }).join('');
}

function populateFilters() {
  const clienteMap = {}, almacenMap = {};
  allItems.forEach(i => {
    if (i.cliente_id && i.clientes) clienteMap[i.cliente_id] = i.clientes.nombre;
    if (i.almacen_id && i.almacenes) almacenMap[i.almacen_id] = i.almacenes.nombre;
  });
  fillSelect('filter-cliente', clienteMap);
  fillSelect('filter-almacen', almacenMap);
}

function fillSelect(id, map) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const current = sel.value;
  while (sel.options.length > 1) sel.remove(1);
  Object.entries(map).forEach(([val, txt]) => {
    const o = document.createElement('option');
    o.value = val; o.textContent = txt;
    if (val === current) o.selected = true;
    sel.appendChild(o);
  });
}

async function loadClientes() {
  try {
    const clientes = await dbGetClientes();
    const sel = document.getElementById('inv-cliente');
    clientes.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.nombre;
      sel.appendChild(o);
    });
  } catch {}
}

async function loadAlmacenes() {
  try {
    const almacenes = await dbGetAlmacenes();
    const sel = document.getElementById('inv-almacen');
    almacenes.forEach(a => {
      const o = document.createElement('option');
      o.value = a.id; o.textContent = a.nombre;
      sel.appendChild(o);
    });
  } catch {}
}

function openNuevoRegistro() {
  clearForm();
  document.getElementById('modal-inv-title').textContent = 'Nuevo Registro de Inventario';
  document.getElementById('inv-fecha-entrada').value = todayISO();
  openModal('modal-inv');
}

async function saveInventario() {
  const editId  = document.getElementById('inv-edit-id').value;
  const sku     = document.getElementById('inv-sku').value.trim();
  const cliente = document.getElementById('inv-cliente').value;
  const almacen = document.getElementById('inv-almacen').value;
  const cantidad= parseInt(document.getElementById('inv-cantidad').value) || 0;

  if (!sku || !cliente || !almacen) {
    showToast('SKU, Cliente y Almacén son obligatorios', 'error'); return;
  }

  const data = {
    sku,
    numero_parte:   document.getElementById('inv-numero-parte').value.trim(),
    descripcion:    document.getElementById('inv-descripcion').value.trim(),
    cliente_id:     cliente,
    almacen_id:     almacen,
    zona:           document.getElementById('inv-zona').value.trim(),
    ubicacion:      document.getElementById('inv-ubicacion').value.trim(),
    area:           document.getElementById('inv-area').value.trim() || 'OPS',
    cantidad,
    bultos:         parseInt(document.getElementById('inv-bultos').value) || 0,
    unidad:         document.getElementById('inv-unidad').value,
    carrier:        document.getElementById('inv-carrier').value.trim(),
    tracking_number:document.getElementById('inv-tracking').value.trim(),
    po:             document.getElementById('inv-po').value.trim(),
    serial_number:  document.getElementById('inv-serial').value.trim(),
    vendor:         document.getElementById('inv-vendor').value.trim(),
    origin:         document.getElementById('inv-origin').value.trim(),
    peso:           document.getElementById('inv-peso').value.trim(),
    lote:           document.getElementById('inv-lote').value.trim(),
    fecha_entrada:  document.getElementById('inv-fecha-entrada').value || null,
    estado:         document.getElementById('inv-estado').value,
  };

  try {
    if (editId) {
      await dbUpdateInventario(editId, data);
      showToast('Registro actualizado', 'success');
    } else {
      await dbAddInventario(data);
      showToast('Registro creado en Supabase', 'success');
    }
    closeModal('modal-inv');
    await reloadData();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

function editItem(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;
  document.getElementById('modal-inv-title').textContent = 'Editar Registro';
  document.getElementById('inv-edit-id').value    = item.id;
  document.getElementById('inv-sku').value         = item.sku || '';
  document.getElementById('inv-numero-parte').value= item.numero_parte || '';
  document.getElementById('inv-descripcion').value = item.descripcion  || '';
  document.getElementById('inv-cliente').value     = item.cliente_id   || '';
  document.getElementById('inv-almacen').value     = item.almacen_id   || '';
  document.getElementById('inv-zona').value        = item.zona         || '';
  document.getElementById('inv-ubicacion').value   = item.ubicacion    || '';
  document.getElementById('inv-area').value        = item.area         || 'OPS';
  document.getElementById('inv-cantidad').value    = item.cantidad     || 0;
  document.getElementById('inv-bultos').value      = item.bultos       || 0;
  document.getElementById('inv-unidad').value      = item.unidad       || 'pz';
  document.getElementById('inv-carrier').value     = item.carrier      || '';
  document.getElementById('inv-tracking').value    = item.tracking_number || '';
  document.getElementById('inv-po').value          = item.po           || '';
  document.getElementById('inv-serial').value      = item.serial_number|| '';
  document.getElementById('inv-vendor').value      = item.vendor       || '';
  document.getElementById('inv-origin').value      = item.origin       || '';
  document.getElementById('inv-peso').value        = item.peso         || '';
  document.getElementById('inv-lote').value        = item.lote         || '';
  document.getElementById('inv-fecha-entrada').value = item.fecha_entrada || '';
  document.getElementById('inv-estado').value      = item.estado       || 'activo';
  openModal('modal-inv');
}

async function deleteItem(id) {
  const item = allItems.find(i => i.id === id);
  confirmDialog(`¿Eliminar el registro "${item?.sku || id}"?`, async () => {
    try {
      await dbDeleteInventario(id);
      showToast('Registro eliminado', 'info');
      await reloadData();
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  });
}

function clearForm() {
  const ids = ['inv-edit-id','inv-sku','inv-numero-parte','inv-descripcion',
    'inv-zona','inv-ubicacion','inv-carrier','inv-tracking','inv-po',
    'inv-serial','inv-vendor','inv-origin','inv-peso','inv-lote'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('inv-cantidad').value = '0';
  document.getElementById('inv-bultos').value   = '0';
  document.getElementById('inv-area').value     = 'OPS';
  document.getElementById('inv-estado').value   = 'activo';
  document.getElementById('inv-cliente').value  = '';
  document.getElementById('inv-almacen').value  = '';
}

function exportCSV() {
  const rows = [['SKU','No.Parte','Descripción','Cliente','Almacén','Zona','Ubicación','Cantidad','Bultos','Carrier','Tracking','PO','Serial','Estado','F.Entrada']];
  allItems.forEach(i => rows.push([
    i.sku, i.numero_parte||'', i.descripcion||'',
    i.clientes?.nombre||'', i.almacenes?.nombre||'',
    i.zona||'', i.ubicacion||'', i.cantidad, i.bultos||0,
    i.carrier||'', i.tracking_number||'', i.po||'',
    i.serial_number||'', i.estado, i.fecha_entrada||''
  ]));
  const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'});
  const a    = Object.assign(document.createElement('a'), { href:URL.createObjectURL(blob), download:'inventario.csv' });
  a.click();
}
