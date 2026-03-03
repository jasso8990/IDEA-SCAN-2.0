/* reportes.js — extracted from original HTML
   Dep: config.js, auth.js, db.js, utils.js, nav.js */

// ── Globals ───────────────────────────────────────────────────────────────
let USER;
let currentReportType = null;
let currentReportData = [];
let currentFmt = 'xlsx';
let clientMap = {};
let almacenMap = {};

// ── Init ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  USER = initPage('reportes', ['admin', 'supervisor', 'cliente']);
  if (!USER) return;
  await loadMeta();
  // Set default date range: today
  const today = todayISO();
  document.getElementById('rDateFrom').value = today;
  document.getElementById('rDateTo').value   = today;
});

async function loadMeta() {
  const [cls, alms] = await Promise.all([
    safeQuery(() => Q.from('clientes').select('id,nombre,codigo,color')),
    safeQuery(() => Q.from('almacenes').select('id,nombre')),
  ]);
  (cls||[]).forEach(c => clientMap[c.id] = c);
  (alms||[]).forEach(a => almacenMap[a.id] = a.nombre);
}

// ── Open report modal ─────────────────────────────────────────────────────
const REPORT_CONFIG = {
  entradas: {
    icon:'📥', iconBg:'rgba(34,199,122,.1)',
    title:'Reporte de Entradas', sub:'Entradas registradas en el sistema',
    showDateRange: false, // defaults to today
    cols: ['SKU','N° Parte','Descripción','Cantidad','Bultos','Tracking','Cliente','Almacén','Operador','Fecha Entrada'],
    keys: ['sku','numero_parte','descripcion','cantidad','bultos','tracking_number','cliente','almacen','operador','fecha_entrada'],
  },
  salidas: {
    icon:'📤', iconBg:'rgba(239,68,68,.08)',
    title:'Reporte de Salidas', sub:'Órdenes de salida completadas',
    showDateRange: false,
    cols: ['SKU','Descripción','Cantidad','Orden','Transporte','Sello','Operador','Confirmado a las'],
    keys: ['sku','descripcion','cantidad','folio_orden','transporte','sello','operador','confirmado_at'],
  },
  inventario: {
    icon:'📦', iconBg:'rgba(13,43,122,.08)',
    title:'Reporte de Inventario', sub:'Estado del inventario por rango de fechas',
    showDateRange: true,
    cols: ['SKU','N° Parte','Descripción','Cantidad','Bultos','Peso','Tracking','PO','Vendor','Origin','Cliente','Almacén','Ubicación','Estado','Fecha Entrada'],
    keys: ['sku','numero_parte','descripcion','cantidad','bultos','peso','tracking_number','po','vendor','origin','cliente','almacen','ubicacion','estado','fecha_entrada'],
  },
  paqueteria: {
    icon:'📦', iconBg:'rgba(139,92,246,.08)',
    title:'Reporte de Paquetería', sub:'Paquetes despachados y en tránsito',
    showDateRange: false,
    cols: ['Código','Carrier','Tracking','Bultos','Cliente','Estado','Operador','Fecha'],
    keys: ['codigo','carrier','tracking_number','bultos','cliente','estado','operador','created_at'],
  },
};

function openReport(type) {
  currentReportType = type;
  currentReportData = [];
  const cfg = REPORT_CONFIG[type];

  document.getElementById('rIcon').textContent = cfg.icon;
  document.getElementById('rIcon').style.background = cfg.iconBg;
  document.getElementById('rTitle').textContent = cfg.title;
  document.getElementById('rSub').textContent   = cfg.sub;
  document.getElementById('rSummary').innerHTML = '';
  document.getElementById('rTableBody').innerHTML = `<tr><td colspan="${cfg.cols.length}" class="empty-state">
    <div class="empty-icon">📊</div>
    <div class="empty-text">Haz clic en "Generar" para cargar el reporte</div>
  </td></tr>`;

  // Set headers
  document.getElementById('rTableHead').innerHTML = `<tr>${cfg.cols.map(c => `<th>${c}</th>`).join('')}</tr>`;

  // Date range visibility
  const today = todayISO();
  document.getElementById('rDateFrom').value = today;
  document.getElementById('rDateTo').value   = today;

  document.getElementById('reportModal').classList.add('open');

  // Auto-load for non-inventory reports
  if (!cfg.showDateRange) loadReport();
}

function closeReport() {
  document.getElementById('reportModal').classList.remove('open');
}

// ── Load report data ──────────────────────────────────────────────────────
async function loadReport() {
  const cfg = REPORT_CONFIG[currentReportType];
  if (!cfg) return;

  const fromDate = document.getElementById('rDateFrom').value || todayISO();
  const toDate   = document.getElementById('rDateTo').value   || todayISO();
  const from = new Date(fromDate).toISOString();
  const to   = new Date(toDate + 'T23:59:59').toISOString();

  const body = document.getElementById('rTableBody');
  body.innerHTML = `<tr><td colspan="${cfg.cols.length}" style="text-align:center;padding:20px;color:var(--text-300);">⏳ Generando reporte...</td></tr>`;

  try {
    if (currentReportType === 'entradas') {
      let q = Q.from('inventario')
        .select('*, clientes(nombre), almacenes(nombre), usuarios!operador_id(nombre,nombre_display)')
        .gte('created_at', from).lte('created_at', to).order('created_at', { ascending: false });
      if (USER.cliente_id) q = q.eq('cliente_id', USER.cliente_id);
      const data = await safeQuery(() => q);
      currentReportData = (data||[]).map(r => ({
        sku: r.sku, numero_parte: r.numero_parte, descripcion: r.descripcion,
        cantidad: r.cantidad, bultos: r.bultos, tracking_number: r.tracking_number,
        cliente: r.clientes?.nombre, almacen: r.almacenes?.nombre,
        operador: r.usuarios?.nombre_display || r.usuarios?.nombre,
        fecha_entrada: fmtDateTime(r.fecha_entrada || r.created_at),
      }));

    } else if (currentReportType === 'salidas') {
      const data = await safeQuery(() =>
        Q.from('orden_items')
          .select('*, ordenes!orden_id(folio,transporte,sello,numero_orden,usuarios!operador_id(nombre,nombre_display))')
          .eq('confirmado', true)
          .gte('confirmado_at', from).lte('confirmado_at', to)
          .order('confirmado_at', { ascending: false })
      );
      currentReportData = (data||[]).map(r => ({
        sku: r.sku, descripcion: r.descripcion, cantidad: r.cantidad,
        folio_orden: r.ordenes?.folio, transporte: r.ordenes?.transporte,
        sello: r.ordenes?.sello,
        operador: r.ordenes?.usuarios?.nombre_display || r.ordenes?.usuarios?.nombre,
        confirmado_at: fmtDateTime(r.confirmado_at),
      }));

    } else if (currentReportType === 'inventario') {
      let q = Q.from('inventario')
        .select('*, clientes(nombre), almacenes(nombre)')
        .gte('fecha_entrada', fromDate).lte('fecha_entrada', toDate)
        .order('created_at', { ascending: false });
      if (USER.cliente_id) q = q.eq('cliente_id', USER.cliente_id);
      const data = await safeQuery(() => q);
      currentReportData = (data||[]).map(r => ({
        sku: r.sku, numero_parte: r.numero_parte, descripcion: r.descripcion,
        cantidad: r.cantidad, bultos: r.bultos, peso: r.peso,
        tracking_number: r.tracking_number, po: r.po, vendor: r.vendor, origin: r.origin,
        cliente: r.clientes?.nombre, almacen: r.almacenes?.nombre,
        ubicacion: r.ubicacion || r.zona, estado: r.estado,
        fecha_entrada: fmtDate(r.fecha_entrada || r.created_at),
      }));

    } else if (currentReportType === 'paqueteria') {
      let q = Q.from('paqueteria')
        .select('*, clientes(nombre), usuarios!operador_id(nombre,nombre_display)')
        .gte('created_at', from).lte('created_at', to)
        .order('created_at', { ascending: false });
      if (USER.cliente_id) q = q.eq('cliente_id', USER.cliente_id);
      const data = await safeQuery(() => q);
      currentReportData = (data||[]).map(r => ({
        codigo: r.codigo, carrier: r.carrier, tracking_number: r.tracking_number,
        bultos: r.bultos, cliente: r.clientes?.nombre, estado: r.estado,
        operador: r.usuarios?.nombre_display || r.usuarios?.nombre,
        created_at: fmtDateTime(r.created_at),
      }));
    }

    renderReportTable();
    renderSummary();

  } catch(e) {
    body.innerHTML = `<tr><td colspan="${cfg.cols.length}" style="text-align:center;padding:20px;color:var(--danger);">Error: ${e.message}</td></tr>`;
  }
}

function renderSummary() {
  const cfg = REPORT_CONFIG[currentReportType];
  const summary = document.getElementById('rSummary');
  summary.innerHTML = `
    <div style="background:var(--surface2);border-radius:10px;padding:12px 16px;border:1px solid var(--border);">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-300);">Total Registros</div>
      <div style="font-family:'Exo 2',sans-serif;font-size:28px;font-weight:900;color:var(--navy);">${currentReportData.length}</div>
    </div>`;
}

function renderReportTable() {
  const cfg = REPORT_CONFIG[currentReportType];
  const body = document.getElementById('rTableBody');
  if (!currentReportData.length) {
    body.innerHTML = `<tr><td colspan="${cfg.cols.length}" class="empty-state">
      <div class="empty-icon">📭</div>
      <div class="empty-text">Sin registros en el período seleccionado</div>
    </td></tr>`;
    return;
  }
  body.innerHTML = currentReportData.map(row =>
    `<tr>${cfg.keys.map(k => `<td style="font-size:12px;">${row[k] || '—'}</td>`).join('')}</tr>`
  ).join('');
}

// ── Download ──────────────────────────────────────────────────────────────
function setFmt(fmt, el) {
  currentFmt = fmt;
  document.querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function downloadReport() {
  if (!currentReportData.length) { showToast('Genera el reporte primero', 'warning'); return; }
  const cfg = REPORT_CONFIG[currentReportType];
  const from = document.getElementById('rDateFrom').value;
  const to   = document.getElementById('rDateTo').value;
  const filename = `${currentReportType}_${from}_${to}`;

  if (currentFmt === 'csv') {
    const cfg2 = REPORT_CONFIG[currentReportType];
    let csv = cfg2.cols.join(',') + '\n';
    currentReportData.forEach(r => {
      csv += cfg2.keys.map(k => `"${(r[k]||'').toString().replace(/"/g,'""')}"`).join(',') + '\n';
    });
    const blob = new Blob([csv], { type:'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename + '.csv';
    a.click();
    return;
  }

  if (currentFmt === 'pdf') {
    // Print as PDF
    const printWin = window.open('', '_blank');
    const cfg2 = REPORT_CONFIG[currentReportType];
    printWin.document.write(`<html><head><title>${cfg2.title}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;font-size:11px;}
        h2{font-size:16px;margin-bottom:4px;}
        .sub{color:#666;margin-bottom:14px;}
        table{width:100%;border-collapse:collapse;}
        th{background:#0d2b7a;color:white;padding:6px 8px;text-align:left;font-size:9px;letter-spacing:0.5px;}
        td{padding:5px 8px;border-bottom:1px solid #eee;}
        tr:nth-child(even) td{background:#f8f9ff;}
        @media print{body{padding:10px} @page{margin:10mm}}
      </style></head><body>
      <h2>${cfg2.title}</h2>
      <div class="sub">Total: ${currentReportData.length} registros · Generado: ${fmtDate(new Date().toISOString())}</div>
      <table>
        <thead><tr>${cfg2.cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${currentReportData.map(r=>`<tr>${cfg2.keys.map(k=>`<td>${r[k]||'—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      </body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.print(); printWin.close(); }, 400);
    return;
  }

  // Default: XLSX
  exportXLSX(currentReportData, filename);
  showToast('📥 Descargando reporte...', 'success');
}

function printReport() {
  const cfg = REPORT_CONFIG[currentReportType];
  const el = document.getElementById('rTable');
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>${cfg?.title||'Reporte'}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:16px;font-size:11px;}
      table{width:100%;border-collapse:collapse;}
      th{background:#0d2b7a;color:white;padding:5px 8px;font-size:9px;}
      td{padding:4px 8px;border:1px solid #eee;}
      @media print{@page{margin:8mm}}
    </style></head><body onload="window.print()">
    ${el.outerHTML}
    </body></html>`);
  w.document.close();
}
