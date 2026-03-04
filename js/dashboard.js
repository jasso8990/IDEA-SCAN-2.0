/* ============================
   DASHBOARD.JS
   ============================ */

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  // Update date
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }
});

function loadDashboard() {
  const products  = getProducts();
  const movements = getMovements();
  const today     = todayISO();

  // KPIs
  const total   = products.length;
  const inStock = products.filter(p => p.stock > p.minStock).length;
  const lowStock= products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
  const outStock= products.filter(p => p.stock <= 0).length;

  const entriesT = movements.filter(m => m.type === 'in'  && m.date === today).length;
  const exitsT   = movements.filter(m => m.type === 'out' && m.date === today).length;

  setEl('kpi-total-products', total);
  setEl('kpi-in-stock',       inStock);
  setEl('kpi-low-stock',      lowStock);
  setEl('kpi-out-stock',      outStock);
  setEl('kpi-entries-today',  entriesT);
  setEl('kpi-exits-today',    exitsT);

  // Stock alerts
  const alertsEl = document.getElementById('stock-alerts');
  const alertProducts = products
    .filter(p => p.stock <= p.minStock)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8);

  if (alertProducts.length === 0) {
    alertsEl.innerHTML = '<p class="empty-state" style="padding:20px">✅ Sin alertas de stock</p>';
  } else {
    alertsEl.innerHTML = alertProducts.map(p => {
      const status = getStockStatus(p);
      return `
        <div class="alert-item">
          <div>
            <div class="alert-item-name">${p.name}</div>
            <div class="alert-item-sku">${p.sku} · ${p.location || '—'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="alert-item-stock" style="color:${p.stock<=0?'var(--red)':'var(--yellow)'}">${p.stock}</span>
            <span class="badge ${status.class}">${status.label}</span>
          </div>
        </div>`;
    }).join('');
  }

  // Recent activity
  const actEl    = document.getElementById('recent-activity');
  const activity = getActivityLog().slice(0, 10);

  if (activity.length === 0) {
    actEl.innerHTML = '<p class="empty-state" style="padding:20px">Sin actividad registrada</p>';
  } else {
    actEl.innerHTML = activity.map(a => `
      <div class="activity-item">
        <div class="activity-dot ${a.type}"></div>
        <div>
          <div class="activity-text">${a.message}</div>
          <div class="activity-meta">${formatDateTime(a.timestamp)}</div>
        </div>
      </div>`).join('');
  }

  // Products table
  const tbody = document.getElementById('top-products-table');
  const display = products.slice(0, 12);
  if (display.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay productos</td></tr>';
  } else {
    tbody.innerHTML = display.map(p => {
      const status = getStockStatus(p);
      return `
        <tr>
          <td><code style="font-size:11px;color:var(--primary)">${p.sku}</code></td>
          <td><strong>${p.name}</strong></td>
          <td>${p.category}</td>
          <td><strong>${p.stock}</strong> ${p.unit}</td>
          <td>${p.location || '—'}</td>
          <td><span class="badge ${status.class}">${status.label}</span></td>
        </tr>`;
    }).join('');
  }
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
