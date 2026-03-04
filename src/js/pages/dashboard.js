/* ═══════════════════════════════════════════════════════
   dashboard.js — Lógica del dashboard principal
   Depende de: config.js, auth.js
   ═══════════════════════════════════════════════════════ */
'use strict';

async function loadDashboard() {
  await Promise.all([loadKPIs(), loadActividad(), loadAlertas()]);
}

// ── KPIs ──────────────────────────────────────────────────
async function loadKPIs() {
  const hoy = new Date().toISOString().split('T')[0];

  // Entradas hoy
  const { count: entradas } = await sb()
    .from('entradas')
    .select('*', { count:'exact', head:true })
    .gte('created_at', hoy);

  // Salidas hoy
  const { count: salidas } = await sb()
    .from('salidas')
    .select('*', { count:'exact', head:true })
    .gte('created_at', hoy);

  // SKUs activos
  const { count: skus } = await sb()
    .from('inventario')
    .select('*', { count:'exact', head:true })
    .gt('cantidad', 0);

  // Bultos totales
  const { data: bultos } = await sb()
    .from('inventario')
    .select('cantidad');
  const totalBultos = (bultos || []).reduce((s, r) => s + (r.cantidad || 0), 0);

  document.getElementById('kpiEntradas').textContent    = fmtNum(entradas || 0);
  document.getElementById('kpiSalidas').textContent     = fmtNum(salidas  || 0);
  document.getElementById('kpiSKUs').textContent        = fmtNum(skus     || 0);
  document.getElementById('kpiBultos').textContent      = fmtNum(totalBultos);
  document.getElementById('kpiEntradasSub').textContent = `registros hoy`;
  document.getElementById('kpiSalidasSub').textContent  = `despachos hoy`;
}

// ── Actividad reciente ────────────────────────────────────
async function loadActividad() {
  const { data } = await sb()
    .from('actividad_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(8);

  const el = document.getElementById('actividadReciente');
  if (!data || !data.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Sin actividad reciente</div></div>`;
    return;
  }

  el.innerHTML = data.map(a => `
    <div class="day-item">
      <div class="day-item-time">${fmtDateTime(a.created_at)}</div>
      <div class="day-item-content">
        <div class="day-item-sku">${a.sku || '—'}</div>
        <div class="day-item-meta">${a.descripcion || ''}</div>
        <div class="day-item-by">👤 ${a.usuario || 'Sistema'}</div>
      </div>
    </div>`).join('');
}

// ── Alertas de stock ──────────────────────────────────────
async function loadAlertas() {
  const { data } = await sb()
    .from('inventario')
    .select('sku, descripcion, cantidad, stock_minimo')
    .filter('cantidad', 'lte', 'stock_minimo');

  const el = document.getElementById('alertasStock');
  if (!data || !data.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">Sin alertas de stock</div></div>`;
    return;
  }

  el.innerHTML = data.map(r => `
    <div class="sku-item ${r.cantidad === 0 ? 'missing' : 'found'}">
      <div>
        <div class="sku-code">${r.sku}</div>
        <div style="font-size:11px;color:var(--text-400)">${r.descripcion || ''}</div>
      </div>
      <span class="badge ${r.cantidad === 0 ? 'badge-danger' : 'badge-warning'}">
        ${r.cantidad === 0 ? 'Sin stock' : `${r.cantidad} uds`}
      </span>
    </div>`).join('');
}
