/* ============================
   DASHBOARD.JS
   ============================ */

document.addEventListener('DOMContentLoaded', async () => {
  // Date
  document.getElementById('current-date').textContent =
    new Date().toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  await loadDashboard();
});

async function loadDashboard() {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [inventario, movimientos, ordenes, clientes, alertas] = await Promise.all([
      dbGetInventario(),
      dbGetMovimientos(),
      dbGetOrdenes({ estado: 'pendiente' }),
      dbGetClientes(),
      dbGetAlertas(),
    ]);

    const entradas = movimientos.filter(m => m.tipo === 'entrada' && m.created_at >= monthStart);
    const salidas  = movimientos.filter(m => m.tipo === 'salida'  && m.created_at >= monthStart);

    // KPIs
    setEl('kpi-inventario', inventario.length);
    setEl('kpi-entradas',   entradas.length);
    setEl('kpi-salidas',    salidas.length);
    setEl('kpi-ordenes',    ordenes.length);
    setEl('kpi-clientes',   clientes.length);
    setEl('kpi-alertas',    alertas.length);

    // Movimientos recientes
    renderRecentMovements(movimientos.slice(0, 8));

    // Alertas
    renderAlertas(alertas);

    // Inventario table
    renderInventarioTable(inventario.slice(0, 10));

  } catch (err) {
    console.error('Dashboard error:', err);
    showToast('Error al cargar datos: ' + err.message, 'error');
  }
}

function renderRecentMovements(movs) {
  const el = document.getElementById('recent-movements');
  if (!movs.length) {
    el.innerHTML = '<p class="empty-state">Sin movimientos recientes</p>'; return;
  }
  el.innerHTML = movs.map(m => {
    const isIn   = m.tipo === 'entrada';
    const cliente = m.clientes?.nombre || '—';
    return `
      <div class="activity-item">
        <div class="activity-dot ${isIn ? 'in' : 'out'}"></div>
        <div style="flex:1">
          <div class="activity-text">
            <strong>${m.folio}</strong> · ${m.descripcion || m.sku || '—'}
            <span style="color:var(--text-muted)"> · ${cliente}</span>
          </div>
          <div class="activity-meta">${formatDateTime(m.created_at)} · ${m.cantidad} ${m.unidad}</div>
        </div>
        <span class="badge ${isIn ? 'badge-green' : 'badge-red'}">${isIn ? 'Entrada' : 'Salida'}</span>
      </div>`;
  }).join('');
}

function renderAlertas(alertas) {
  const el = document.getElementById('alertas-list');
  if (!alertas.length) {
    el.innerHTML = '<p class="empty-state">✅ Sin alertas activas</p>'; return;
  }
  const nivMap = { danger:'badge-red', warn:'badge-yellow', info:'badge-blue' };
  el.innerHTML = alertas.map(a => `
    <div class="alert-item">
      <div>
        <div class="alert-item-name">${a.titulo}</div>
        <div class="alert-item-sku">${a.mensaje || ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="badge ${nivMap[a.nivel] || 'badge-gray'}">${a.nivel}</span>
        <button class="btn-icon" onclick="marcarLeida('${a.id}')">✓</button>
      </div>
    </div>`).join('');
}

function renderInventarioTable(items) {
  const tbody = document.getElementById('inventario-table');
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Sin registros</td></tr>'; return;
  }
  tbody.innerHTML = items.map(i => {
    const st     = getStockStatus(i);
    const cliente = i.clientes?.nombre || '—';
    const almacen = i.almacenes?.nombre || '—';
    return `
      <tr>
        <td><code style="color:var(--primary);font-size:11px">${i.sku}</code></td>
        <td>${i.descripcion || '—'}</td>
        <td>${cliente}</td>
        <td>${almacen}</td>
        <td><strong>${i.cantidad}</strong> ${i.unidad || 'pz'}</td>
        <td><span class="badge ${st.cls}">${st.label}</span></td>
        <td>${formatDate(i.fecha_entrada || i.created_at)}</td>
      </tr>`;
  }).join('');
}

async function marcarLeida(id) {
  try {
    await dbMarcarAlertaLeida(id);
    showToast('Alerta marcada como leída', 'success');
    await loadDashboard();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
