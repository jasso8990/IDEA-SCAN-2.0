/* ============================
   REPORTS.JS
   ============================ */

let currentReport = 'inventory';

document.addEventListener('DOMContentLoaded', () => {
  // Set date range default: current month
  const now  = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const to   = now.toISOString().split('T')[0];
  document.getElementById('report-date-from').value = from;
  document.getElementById('report-date-to').value   = to;

  // Populate category filter
  const products   = getProducts();
  const categories = [...new Set(products.map(p => p.category))].sort();
  const sel = document.getElementById('report-category');
  categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });

  generateReport();
});

function showReport(type) {
  currentReport = type;
  document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  generateReport();
}

function generateReport() {
  const from     = document.getElementById('report-date-from').value;
  const to       = document.getElementById('report-date-to').value;
  const category = document.getElementById('report-category').value;
  const genAt    = document.getElementById('report-generated-at');
  if (genAt) genAt.textContent = 'Generado: ' + formatDateTime(new Date().toISOString());

  switch (currentReport) {
    case 'inventory':   reportInventory(category); break;
    case 'movements':   reportMovements(from, to, category); break;
    case 'valuation':   reportValuation(category); break;
    case 'top-products':reportTopProducts(from, to); break;
  }
}

// ---- INVENTORY REPORT ----
function reportInventory(category) {
  document.getElementById('report-title').textContent = 'Reporte de Inventario';
  let products = getProducts();
  if (category) products = products.filter(p => p.category === category);

  const total    = products.length;
  const inStock  = products.filter(p => p.stock > p.minStock).length;
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
  const outStock = products.filter(p => p.stock <= 0).length;

  document.getElementById('report-summary').innerHTML = `
    <div class="report-stat"><div class="report-stat-value">${total}</div><div class="report-stat-label">Total productos</div></div>
    <div class="report-stat"><div class="report-stat-value" style="color:var(--green)">${inStock}</div><div class="report-stat-label">En stock</div></div>
    <div class="report-stat"><div class="report-stat-value" style="color:var(--yellow)">${lowStock}</div><div class="report-stat-label">Stock bajo</div></div>
    <div class="report-stat"><div class="report-stat-value" style="color:var(--red)">${outStock}</div><div class="report-stat-label">Sin stock</div></div>
  `;

  document.getElementById('report-thead').innerHTML = `
    <tr><th>SKU</th><th>Producto</th><th>Categoría</th><th>Stock</th><th>Stock Mín.</th><th>Unidad</th><th>Ubicación</th><th>Estado</th></tr>`;

  document.getElementById('report-tbody').innerHTML = products.map(p => {
    const status = getStockStatus(p);
    return `
      <tr>
        <td><code style="color:var(--primary)">${p.sku}</code></td>
        <td>${p.name}</td>
        <td>${p.category}</td>
        <td><strong>${p.stock}</strong></td>
        <td>${p.minStock}</td>
        <td>${p.unit}</td>
        <td>${p.location || '—'}</td>
        <td><span class="badge ${status.class}">${status.label}</span></td>
      </tr>`;
  }).join('') || '<tr><td colspan="8" class="empty-state">Sin datos</td></tr>';
}

// ---- MOVEMENTS REPORT ----
function reportMovements(from, to, category) {
  document.getElementById('report-title').textContent = 'Reporte de Movimientos';
  let movements = getMovements();
  if (from) movements = movements.filter(m => m.date >= from);
  if (to)   movements = movements.filter(m => m.date <= to);

  if (category) {
    const products = getProducts().filter(p => p.category === category).map(p => p.id);
    movements = movements.filter(m => products.includes(m.productId));
  }

  const entries = movements.filter(m => m.type === 'in');
  const exits   = movements.filter(m => m.type === 'out');
  const qtyIn   = entries.reduce((s, m) => s + parseInt(m.qty), 0);
  const qtyOut  = exits.reduce((s, m)   => s + parseInt(m.qty), 0);

  document.getElementById('report-summary').innerHTML = `
    <div class="report-stat"><div class="report-stat-value">${movements.length}</div><div class="report-stat-label">Total movimientos</div></div>
    <div class="report-stat"><div class="report-stat-value" style="color:var(--green)">${entries.length}</div><div class="report-stat-label">Entradas (${qtyIn} unids)</div></div>
    <div class="report-stat"><div class="report-stat-value" style="color:var(--red)">${exits.length}</div><div class="report-stat-label">Salidas (${qtyOut} unids)</div></div>
  `;

  document.getElementById('report-thead').innerHTML = `
    <tr><th>Folio</th><th>Tipo</th><th>Fecha</th><th>Producto</th><th>Cantidad</th><th>Proveedor/Destino</th><th>Referencia</th><th>Usuario</th></tr>`;

  document.getElementById('report-tbody').innerHTML = movements.map(m => `
    <tr>
      <td><code>${m.folio}</code></td>
      <td><span class="badge ${m.type==='in'?'badge-green':'badge-red'}">${m.type==='in'?'Entrada':'Salida'}</span></td>
      <td>${formatDate(m.date)}</td>
      <td>${m.productName}</td>
      <td><strong>${m.qty}</strong> ${m.unit||''}</td>
      <td>${m.supplier || m.destination || '—'}</td>
      <td>${m.ref || '—'}</td>
      <td>${m.userName}</td>
    </tr>`).join('') || '<tr><td colspan="8" class="empty-state">Sin movimientos en el período</td></tr>';
}

// ---- VALUATION REPORT ----
function reportValuation(category) {
  document.getElementById('report-title').textContent = 'Reporte de Valorización';
  let products = getProducts();
  if (category) products = products.filter(p => p.category === category);

  const totalValue = products.reduce((s, p) => s + (p.stock * p.price), 0);
  const grouped    = {};
  products.forEach(p => {
    if (!grouped[p.category]) grouped[p.category] = 0;
    grouped[p.category] += p.stock * p.price;
  });

  document.getElementById('report-summary').innerHTML = `
    <div class="report-stat"><div class="report-stat-value">${formatCurrency(totalValue)}</div><div class="report-stat-label">Valor total inventario</div></div>
    <div class="report-stat"><div class="report-stat-value">${products.length}</div><div class="report-stat-label">Productos valuados</div></div>
  `;

  document.getElementById('report-thead').innerHTML = `
    <tr><th>SKU</th><th>Producto</th><th>Categoría</th><th>Stock</th><th>Precio Unit.</th><th>Valor Total</th><th>% del total</th></tr>`;

  document.getElementById('report-tbody').innerHTML = products
    .sort((a,b) => (b.stock*b.price) - (a.stock*a.price))
    .map(p => {
      const val = p.stock * p.price;
      const pct = totalValue > 0 ? ((val/totalValue)*100).toFixed(1) : 0;
      return `
        <tr>
          <td><code style="color:var(--primary)">${p.sku}</code></td>
          <td>${p.name}</td>
          <td>${p.category}</td>
          <td>${p.stock} ${p.unit}</td>
          <td>${formatCurrency(p.price)}</td>
          <td><strong>${formatCurrency(val)}</strong></td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:60px;background:var(--bg3);border-radius:4px;height:6px">
                <div style="width:${pct}%;background:var(--primary);height:100%;border-radius:4px"></div>
              </div>
              <span style="font-size:11px">${pct}%</span>
            </div>
          </td>
        </tr>`;
    }).join('') || '<tr><td colspan="7" class="empty-state">Sin datos</td></tr>';
}

// ---- TOP PRODUCTS REPORT ----
function reportTopProducts(from, to) {
  document.getElementById('report-title').textContent = 'Top Productos por Movimiento';
  let movements = getMovements();
  if (from) movements = movements.filter(m => m.date >= from);
  if (to)   movements = movements.filter(m => m.date <= to);

  const stats = {};
  movements.forEach(m => {
    if (!stats[m.productId]) {
      stats[m.productId] = { name: m.productName, unit: m.unit, in: 0, out: 0, total: 0 };
    }
    if (m.type === 'in')  stats[m.productId].in    += parseInt(m.qty);
    else                  stats[m.productId].out   += parseInt(m.qty);
    stats[m.productId].total += parseInt(m.qty);
  });

  const list = Object.values(stats).sort((a,b) => b.total - a.total);

  document.getElementById('report-summary').innerHTML = `
    <div class="report-stat"><div class="report-stat-value">${list.length}</div><div class="report-stat-label">Productos con movimiento</div></div>
    <div class="report-stat"><div class="report-stat-value">${movements.length}</div><div class="report-stat-label">Total movimientos</div></div>
  `;

  document.getElementById('report-thead').innerHTML = `
    <tr><th>#</th><th>Producto</th><th>Unidad</th><th>Total Entradas</th><th>Total Salidas</th><th>Total Movimientos</th></tr>`;

  document.getElementById('report-tbody').innerHTML = list.map((p, i) => `
    <tr>
      <td><strong>#${i+1}</strong></td>
      <td>${p.name}</td>
      <td>${p.unit}</td>
      <td style="color:var(--green)"><strong>+${p.in}</strong></td>
      <td style="color:var(--red)"><strong>-${p.out}</strong></td>
      <td><strong>${p.total}</strong></td>
    </tr>`).join('') || '<tr><td colspan="6" class="empty-state">Sin movimientos en el período</td></tr>';
}

function exportReportCSV() {
  const rows = [];
  const thead = document.getElementById('report-thead');
  const tbody = document.getElementById('report-tbody');

  const headers = Array.from(thead.querySelectorAll('th')).map(th => th.textContent);
  rows.push(headers);

  tbody.querySelectorAll('tr').forEach(tr => {
    const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
    if (cells.length > 0 && !cells[0].includes('Sin datos')) rows.push(cells);
  });

  const csv  = rows.map(r => r.map(v => `"${v.replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `reporte-${currentReport}.csv`; a.click();
  URL.revokeObjectURL(url);
}
