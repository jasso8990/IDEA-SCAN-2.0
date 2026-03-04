/* ============================
   MOVEMENTS.JS — Entradas & Salidas
   ============================ */

let movementType = 'in';

function initMovements(type) {
  movementType = type;
  loadMovements();
  populateProductSelect();
  populateLocationSelect(type === 'in' ? 'inbound-location' : null);

  // Set today's date
  const dateField = document.getElementById(type + '-date');
  if (dateField) dateField.value = todayISO();
}

function loadMovements() {
  const all = getMovements().filter(m => m.type === movementType);
  renderMovementsTable(all);
}

function renderMovementsTable(movements) {
  const tbody = document.getElementById('movements-body');
  const count = document.getElementById('table-count');
  const type  = movementType;
  if (count) count.textContent = `${movements.length} registro${movements.length !== 1 ? 's' : ''}`;

  if (movements.length === 0) {
    const cols = type === 'in' ? 9 : 8;
    tbody.innerHTML = `<tr><td colspan="${cols}" class="empty-state">Sin registros</td></tr>`;
    return;
  }

  tbody.innerHTML = movements.map(m => {
    if (type === 'in') {
      return `
        <tr>
          <td><code style="color:var(--green)">${m.folio}</code></td>
          <td>${formatDate(m.date)}</td>
          <td><strong>${m.productName}</strong></td>
          <td><strong>${m.qty}</strong> ${m.unit || ''}</td>
          <td>${m.supplier || '—'}</td>
          <td>${m.location || '—'}</td>
          <td>${m.ref || '—'}</td>
          <td>${m.userName}</td>
          <td>
            <button class="btn-icon" title="Ver detalle" onclick="viewMovement('${m.id}')">👁</button>
            <button class="btn-icon" title="Eliminar" onclick="deleteMovementConfirm('${m.id}')">🗑</button>
          </td>
        </tr>`;
    } else {
      return `
        <tr>
          <td><code style="color:var(--red)">${m.folio}</code></td>
          <td>${formatDate(m.date)}</td>
          <td><strong>${m.productName}</strong></td>
          <td><strong>${m.qty}</strong> ${m.unit || ''}</td>
          <td>${m.destination || '—'}</td>
          <td>${m.ref || '—'}</td>
          <td>${m.userName}</td>
          <td>
            <button class="btn-icon" title="Ver detalle" onclick="viewMovement('${m.id}')">👁</button>
          </td>
        </tr>`;
    }
  }).join('');
}

function filterMovements() {
  const search = document.getElementById('search-input')?.value.toLowerCase() || '';
  const from   = document.getElementById('filter-date-from')?.value || '';
  const to     = document.getElementById('filter-date-to')?.value   || '';

  let filtered = getMovements().filter(m => m.type === movementType);

  if (search) {
    filtered = filtered.filter(m =>
      (m.folio || '').toLowerCase().includes(search) ||
      (m.productName || '').toLowerCase().includes(search) ||
      (m.supplier || '').toLowerCase().includes(search) ||
      (m.destination || '').toLowerCase().includes(search)
    );
  }
  if (from) filtered = filtered.filter(m => m.date >= from);
  if (to)   filtered = filtered.filter(m => m.date <= to);

  renderMovementsTable(filtered);
}

function populateProductSelect() {
  const products = getProducts();
  const type = movementType;
  const selId = type === 'in' ? 'inbound-product' : 'outbound-product';
  const sel = document.getElementById(selId);
  if (!sel) return;

  sel.innerHTML = '<option value="">Selecciona un producto...</option>';
  products.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.sku} — ${p.name} (Stock: ${p.stock} ${p.unit})`;
    sel.appendChild(opt);
  });
}

function fillProductInfo(type) {
  const selId    = type === 'in' ? 'inbound-product' : 'outbound-product';
  const infoId   = type + '-product-info';
  const stockId  = type + '-current-stock';
  const sel      = document.getElementById(selId);
  const infoBox  = document.getElementById(infoId);
  const stockEl  = document.getElementById(stockId);

  if (!sel || !sel.value) { if (infoBox) infoBox.style.display = 'none'; return; }

  const p = getProductById(sel.value);
  if (!p) return;

  if (infoBox)  infoBox.style.display = 'block';
  if (stockEl)  stockEl.textContent   = `${p.stock} ${p.unit}`;
}

function saveInbound() {
  const productId = document.getElementById('inbound-product').value;
  const qty       = parseInt(document.getElementById('inbound-qty').value);
  const date      = document.getElementById('inbound-date').value;

  if (!productId) { showToast('Selecciona un producto', 'error'); return; }
  if (!qty || qty < 1) { showToast('La cantidad debe ser mayor a 0', 'error'); return; }
  if (!date) { showToast('Selecciona la fecha', 'error'); return; }

  const product = getProductById(productId);
  addMovement({
    type:        'in',
    productId,
    productName: product.name,
    unit:        product.unit,
    qty,
    date,
    supplier:    document.getElementById('inbound-supplier').value.trim(),
    location:    document.getElementById('inbound-location').value,
    ref:         document.getElementById('inbound-ref').value.trim(),
    notes:       document.getElementById('inbound-notes').value.trim(),
  });

  showToast(`Entrada registrada: +${qty} ${product.unit} de ${product.name}`, 'success');
  closeModal('modal-inbound');
  clearInboundForm();
  loadMovements();
}

function saveOutbound() {
  const productId = document.getElementById('outbound-product').value;
  const qty       = parseInt(document.getElementById('outbound-qty').value);
  const date      = document.getElementById('outbound-date').value;

  if (!productId) { showToast('Selecciona un producto', 'error'); return; }
  if (!qty || qty < 1) { showToast('La cantidad debe ser mayor a 0', 'error'); return; }
  if (!date) { showToast('Selecciona la fecha', 'error'); return; }

  const product = getProductById(productId);
  if (qty > product.stock) {
    showToast(`Stock insuficiente. Disponible: ${product.stock} ${product.unit}`, 'error');
    return;
  }

  addMovement({
    type:        'out',
    productId,
    productName: product.name,
    unit:        product.unit,
    qty,
    date,
    destination: document.getElementById('outbound-destination').value.trim(),
    reason:      document.getElementById('outbound-reason').value,
    ref:         document.getElementById('outbound-ref').value.trim(),
    notes:       document.getElementById('outbound-notes').value.trim(),
  });

  showToast(`Salida registrada: -${qty} ${product.unit} de ${product.name}`, 'success');
  closeModal('modal-outbound');
  clearOutboundForm();
  loadMovements();
}

function viewMovement(id) {
  const m = getMovements().find(mv => mv.id === id);
  if (!m) return;
  const detail = `
    Folio: ${m.folio}
    Fecha: ${formatDate(m.date)}
    Producto: ${m.productName}
    Cantidad: ${m.qty} ${m.unit}
    ${m.supplier ? 'Proveedor: ' + m.supplier : ''}
    ${m.destination ? 'Destino: ' + m.destination : ''}
    ${m.ref ? 'Referencia: ' + m.ref : ''}
    ${m.notes ? 'Notas: ' + m.notes : ''}
    Registrado por: ${m.userName}
    Fecha registro: ${formatDateTime(m.createdAt)}
  `.split('\n').filter(l => l.trim()).map(l => l.trim()).join('\n');
  alert(detail);
}

function deleteMovementConfirm(id) {
  confirmDialog('¿Eliminar este movimiento? NOTA: El stock no se revertirá automáticamente.', () => {
    const movements = getMovements().filter(m => m.id !== id);
    saveMovements(movements);
    showToast('Movimiento eliminado', 'info');
    loadMovements();
  });
}

function clearInboundForm() {
  document.getElementById('inbound-product').value  = '';
  document.getElementById('inbound-qty').value      = '1';
  document.getElementById('inbound-supplier').value = '';
  document.getElementById('inbound-ref').value      = '';
  document.getElementById('inbound-notes').value    = '';
  document.getElementById('inbound-location').value = '';
  document.getElementById('inbound-date').value     = todayISO();
  const info = document.getElementById('inbound-product-info');
  if (info) info.style.display = 'none';
}

function clearOutboundForm() {
  document.getElementById('outbound-product').value    = '';
  document.getElementById('outbound-qty').value        = '1';
  document.getElementById('outbound-destination').value= '';
  document.getElementById('outbound-ref').value        = '';
  document.getElementById('outbound-notes').value      = '';
  document.getElementById('outbound-date').value       = todayISO();
  const info = document.getElementById('outbound-product-info');
  if (info) info.style.display = 'none';
}

function exportCSV() {
  const movements = getMovements().filter(m => m.type === movementType);
  const type      = movementType;
  let headers, rows;

  if (type === 'in') {
    headers = ['Folio','Fecha','Producto','Cantidad','Proveedor','Ubicación','Referencia','Usuario','Fecha Registro'];
    rows = movements.map(m => [m.folio, m.date, m.productName, m.qty, m.supplier||'', m.location||'', m.ref||'', m.userName, formatDateTime(m.createdAt)]);
  } else {
    headers = ['Folio','Fecha','Producto','Cantidad','Destino','Motivo','Referencia','Usuario','Fecha Registro'];
    rows = movements.map(m => [m.folio, m.date, m.productName, m.qty, m.destination||'', m.reason||'', m.ref||'', m.userName, formatDateTime(m.createdAt)]);
  }

  downloadCSV(type === 'in' ? 'entradas.csv' : 'salidas.csv', [headers, ...rows]);
}

function downloadCSV(filename, rows) {
  const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
