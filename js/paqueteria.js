/* ═══════════════════════════════════════════════════════
   pages/paqueteria.js — Módulo de paquetería (FedEx/UPS/DHL)
   Depende de: config.js, auth.js, db.js, utils.js, nav.js, export.js
   ═══════════════════════════════════════════════════════ */
'use strict';

let USER          = null;
let allPaquetes   = [];
let filtered      = [];
let activeStatus  = 'all';

// ── Init ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  USER = initPage('paqueteria');
  if (!USER) return;
  if (['admin','supervisor'].includes(USER.rol))
    document.getElementById('downloadBtn').style.display = '';
  await loadPaqueteria();
});

// ── Carga ─────────────────────────────────────────────────
async function loadPaqueteria() {
  let q = Q.from('paqueteria')
    .select('*, clientes(nombre,color), usuarios!operador_id(nombre,nombre_display)')
    .order('created_at', { ascending: false });
  if (USER.cliente_id) q = q.eq('cliente_id', USER.cliente_id);

  allPaquetes = await safeQuery(() => q) || [];
  filtered    = [...allPaquetes];
  loadKPIs();
  renderAll();
}

// ── KPIs ──────────────────────────────────────────────────
function loadKPIs() {
  const start = dayStart(), end = dayEnd();
  const hoy   = allPaquetes.filter(p => p.created_at >= start && p.created_at <= end);
  document.getElementById('kpiTotal').textContent    = hoy.length;
  document.getElementById('kpiPendiente').textContent = allPaquetes.filter(p => p.estado === 'pendiente').length;
  document.getElementById('kpiEntregado').textContent = allPaquetes.filter(p => p.estado === 'entregado').length;
  // Semana: últimos 7 días
  const semana = new Date(); semana.setDate(semana.getDate() - 7);
  document.getElementById('kpiSemana').textContent = allPaquetes.filter(p => new Date(p.created_at) >= semana).length;
}

// ── Filtros ───────────────────────────────────────────────
function setStatusTab(status, el) {
  document.querySelectorAll('[data-status]').forEach(t => t.classList.remove('tab-active'));
  el.classList.add('tab-active');
  activeStatus = status;
  filterPaqueteria(document.getElementById('searchInput').value || '');
}

function filterByKPI(type) {
  const tabEl = document.querySelector(`[data-status="${type}"]`);
  if (tabEl) setStatusTab(type, tabEl);
}

function filterPaqueteria(query) {
  const q  = (query || '').toLowerCase().trim();
  const sc = document.getElementById('searchClear');
  if (sc) sc.style.display = q ? 'block' : 'none';

  filtered = allPaquetes.filter(p => {
    if (activeStatus !== 'all' && p.estado !== activeStatus) return false;
    if (q) {
      const hay = [p.tracking_number, p.destinatario, p.carrier, p.descripcion, p.folio].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  renderAll();
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  filterPaqueteria('');
}

// ── Render ────────────────────────────────────────────────
const STATUS_LBL = { recibido:'📥 Recibido', pendiente:'⏳ Pendiente', entregado:'✅ Entregado' };

function renderAll() {
  renderTable();
  renderCards();
  document.getElementById('tableCount').textContent = `${filtered.length} registros`;
}

function renderTable() {
  const tbody = document.getElementById('pkgTableBody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📦</div><div class="empty-text">Sin paquetes registrados</div><div class="empty-sub">Registra paquetes recibidos de FedEx, UPS, DHL u otros carriers</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map((p, i) => `
    <tr class="inv-row" onclick="openItem(${i})">
      <td class="mono" style="font-size:11px;">${p.folio || '—'}</td>
      <td class="tracking-cell">${p.tracking_number || '—'}</td>
      <td><span class="carrier-badge">📮 ${p.carrier || '—'}</span></td>
      <td>${p.destinatario || '—'}</td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.descripcion || '—'}</td>
      <td style="text-align:center;">${p.bultos || 1}</td>
      <td><span class="badge status-${p.estado}">${STATUS_LBL[p.estado] || p.estado}</span></td>
      <td style="font-size:11px;">${fmtDate(p.created_at)}</td>
    </tr>`).join('');
}

function renderCards() {
  const c = document.getElementById('pkgCards');
  if (!filtered.length) { c.innerHTML = ''; return; }
  c.innerHTML = filtered.map((p, i) => `
    <div class="pkg-card" onclick="openItem(${i})">
      <div class="flex-between">
        <div class="pkg-card-tracking">${p.tracking_number || '—'}</div>
        <span class="badge status-${p.estado}">${STATUS_LBL[p.estado] || p.estado}</span>
      </div>
      <div style="font-size:12px;color:var(--text-500);margin-top:4px;">${p.destinatario || '—'}</div>
      <div class="pkg-card-meta">
        ${p.carrier    ? `<span class="badge badge-navy">📮 ${p.carrier}</span>` : ''}
        ${p.descripcion? `<span class="badge badge-info">${p.descripcion}</span>` : ''}
        ${p.bultos     ? `<span class="badge badge-navy">📦 ${p.bultos} bulto(s)</span>` : ''}
        <span class="badge badge-navy">📅 ${fmtDate(p.created_at)}</span>
      </div>
    </div>`).join('');
}

// ── Drawer de detalle ─────────────────────────────────────
function openItem(idx) {
  const p = filtered[idx]; if (!p) return;
  document.getElementById('dTracking').textContent = p.tracking_number || '—';
  document.getElementById('dStatus').innerHTML = `<span class="badge status-${p.estado}">${STATUS_LBL[p.estado] || p.estado}</span>`;

  document.getElementById('drawerBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-field"><div class="detail-label">Folio</div><div class="detail-value mono">${p.folio || '—'}</div></div>
      <div class="detail-field"><div class="detail-label">Tracking</div><div class="detail-value mono">${p.tracking_number || '—'}</div></div>
      <div class="detail-field"><div class="detail-label">Carrier</div><div class="detail-value">${p.carrier || '—'}</div></div>
      <div class="detail-field"><div class="detail-label">Destinatario</div><div class="detail-value">${p.destinatario || '—'}</div></div>
      <div class="detail-field"><div class="detail-label">Descripción</div><div class="detail-value">${p.descripcion || '—'}</div></div>
      <div class="detail-field"><div class="detail-label">Bultos</div><div class="detail-value">${p.bultos || 1}</div></div>
      <div class="detail-field"><div class="detail-label">Notas</div><div class="detail-value">${p.notas || '—'}</div></div>
      <div class="detail-field"><div class="detail-label">Operador</div><div class="detail-value">${p.usuarios?.nombre_display || p.usuarios?.nombre || '—'}</div></div>
      <div class="detail-field"><div class="detail-label">Fecha Registro</div><div class="detail-value">${fmtDateTime(p.created_at)}</div></div>
      ${p.fecha_entrega ? `<div class="detail-field"><div class="detail-label">Fecha Entrega</div><div class="detail-value">${fmtDateTime(p.fecha_entrega)}</div></div>` : ''}
    </div>`;

  let footer = `<button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Cerrar</button>`;
  if (p.estado !== 'entregado' && ['admin','supervisor','operador'].includes(USER.rol)) {
    footer += `<button class="btn-deliver" onclick="marcarEntregado('${p.id}', ${idx})">✅ Marcar Entregado</button>`;
  }
  document.getElementById('drawerFooter').innerHTML = footer;

  document.getElementById('itemDrawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('open');
}

function closeDrawer() {
  document.getElementById('itemDrawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
}

// ── Marcar como entregado ─────────────────────────────────
async function marcarEntregado(id, idx) {
  const now = new Date().toISOString();
  const { error } = await Q.from('paqueteria')
    .update({ estado: 'entregado', fecha_entrega: now, updated_at: now })
    .eq('id', id);
  if (error) { showToast('Error al actualizar: ' + error.message, 'error'); return; }
  showToast('✅ Paquete marcado como entregado', 'success');
  closeDrawer();
  await loadPaqueteria();
}

// ── Modal nuevo ───────────────────────────────────────────
function openNewModal() {
  ['fTracking','fDestinatario','fDesc','fNotas'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; });
  document.getElementById('fCarrier').value = '';
  document.getElementById('fBultos').value  = '1';
  document.getElementById('fEstado').value  = 'recibido';
  document.getElementById('newModal').classList.add('open');
  document.getElementById('fTracking').focus();
}

function closeNewModal() {
  document.getElementById('newModal').classList.remove('open');
}

async function savePaquete() {
  const tracking     = document.getElementById('fTracking').value.trim();
  const destinatario = document.getElementById('fDestinatario').value.trim();
  if (!tracking)     { showToast('Ingresa el número de tracking', 'warning'); return; }
  if (!destinatario) { showToast('Ingresa el destinatario',       'warning'); return; }

  const btn = document.getElementById('saveBtn');
  btn.disabled = true;

  const now    = new Date();
  const fecha  = now.toISOString().slice(0,10).replace(/-/g,'');
  const seq    = String(Math.floor(Math.random() * 9000) + 1000);
  const folio  = `PKG-${fecha}-${seq}`;

  const payload = {
    folio,
    tracking_number: tracking,
    carrier:         document.getElementById('fCarrier').value || null,
    destinatario,
    descripcion:     document.getElementById('fDesc').value.trim()    || null,
    bultos:          parseInt(document.getElementById('fBultos').value) || 1,
    estado:          document.getElementById('fEstado').value,
    notas:           document.getElementById('fNotas').value.trim()   || null,
    cliente_id:      USER.cliente_id  || null,
    almacen_id:      USER.almacen_id  || null,
    operador_id:     USER.id,
    created_at:      now.toISOString(),
  };

  const result = await safeInsert('paqueteria', payload);
  btn.disabled = false;

  if (result) {
    showToast(`✅ Paquete registrado — ${folio}`, 'success');
    closeNewModal();
    await loadPaqueteria();
  } else {
    showToast('Error al guardar el paquete', 'error');
  }
}

// ── Export ────────────────────────────────────────────────
function exportPaqueteria() {
  exportXLSX(filtered.map(p => ({
    Folio:           p.folio,
    Tracking:        p.tracking_number,
    Carrier:         p.carrier,
    Destinatario:    p.destinatario,
    Descripción:     p.descripcion,
    Bultos:          p.bultos,
    Estado:          p.estado,
    Notas:           p.notas,
    'Fecha Registro':fmtDate(p.created_at),
    'Fecha Entrega': p.fecha_entrega ? fmtDate(p.fecha_entrega) : '',
  })), `paqueteria_${todayISO()}`);
}
