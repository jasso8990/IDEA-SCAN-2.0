/* ═══════════════════════════════════════════════════════
   inventario.js — Gestión de inventario
   Depende de: config.js, auth.js
   ═══════════════════════════════════════════════════════ */
'use strict';

let _invData = [];

async function loadInventario() {
  const { data, error } = await sb()
    .from('inventario')
    .select('*, clientes(nombre)')
    .order('sku');

  if (error) { showToast('Error al cargar inventario', 'error'); return; }
  _invData = data || [];
  renderTable(_invData);
}

function renderTable(rows) {
  const tbody = document.getElementById('invBody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-300)">Sin registros en inventario</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const qty   = r.cantidad || 0;
    const min   = r.stock_minimo || 0;
    let badge   = `<span class="badge badge-success">OK</span>`;
    if (qty === 0)      badge = `<span class="badge badge-danger">Sin stock</span>`;
    else if (qty <= min) badge = `<span class="badge badge-warning">Bajo</span>`;
    return `
      <tr>
        <td><span class="font-mono font-bold">${r.sku}</span></td>
        <td>${r.descripcion || '—'}</td>
        <td>${r.clientes?.nombre || '—'}</td>
        <td><strong>${fmtNum(qty)}</strong></td>
        <td>${r.ubicacion || '—'}</td>
        <td class="text-sm text-muted">${fmtDate(r.updated_at)}</td>
        <td>${badge}</td>
      </tr>`;
  }).join('');
}

function filterInventario() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  if (!q) { renderTable(_invData); return; }
  renderTable(_invData.filter(r =>
    (r.sku||'').toLowerCase().includes(q) ||
    (r.descripcion||'').toLowerCase().includes(q) ||
    (r.clientes?.nombre||'').toLowerCase().includes(q)
  ));
}

// ── Modal Nuevo SKU ───────────────────────────────────────
function openModalNuevo() {
  document.getElementById('modalNuevo').classList.add('open');
  document.getElementById('newSku').focus();
}
function closeModalNuevo() {
  document.getElementById('modalNuevo').classList.remove('open');
  ['newSku','newDesc','newUbicacion'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('newCantidad').value = '0';
  document.getElementById('newStockMin').value = '5';
}

async function guardarSKU() {
  const sku  = document.getElementById('newSku').value.trim().toUpperCase();
  const desc = document.getElementById('newDesc').value.trim();
  if (!sku || !desc) { showToast('SKU y descripción son requeridos', 'error'); return; }

  const payload = {
    sku,
    descripcion:  desc,
    cantidad:     parseInt(document.getElementById('newCantidad').value) || 0,
    stock_minimo: parseInt(document.getElementById('newStockMin').value) || 5,
    ubicacion:    document.getElementById('newUbicacion').value.trim(),
  };

  const { error } = await sb().from('inventario').insert(payload);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }

  showToast('SKU guardado correctamente', 'success');
  closeModalNuevo();
  loadInventario();
}
