/* ═══════════════════════════════════════════════════════
   pages/inventario.js — Inventario WMS
   ═══════════════════════════════════════════════════════ */
'use strict';

let USER = null, allInventory = [], filteredInventory = [];
let activeClientFilter = 'all', clientMap = {}, almacenMap = {};
let currentDayType = null, dayModalData = [];

window.addEventListener('DOMContentLoaded', async () => {
  USER = initPage('inventario');
  if (!USER) return;
  if (['admin','supervisor'].includes(USER.rol))
    document.getElementById('downloadBtn').style.display = '';
  await loadMeta();
  await loadInventory();
  loadKPIs();
  loadAlerts();
});

async function loadMeta() {
  const [cls, alms] = await Promise.all([
    safeQuery(() => Q.from('clientes').select('id,nombre,codigo,color,campos_captura')),
    safeQuery(() => Q.from('almacenes').select('id,nombre')),
  ]);
  (cls||[]).forEach(c => clientMap[c.id] = c);
  (alms||[]).forEach(a => almacenMap[a.id] = a.nombre);
  const chips = document.getElementById('clientChips');
  (cls||[]).filter(c => ['admin','supervisor'].includes(USER.rol) || c.id === USER.cliente_id)
    .forEach(c => {
      const d = document.createElement('div');
      d.className = 'chip'; d.dataset.filter = c.id;
      d.style.borderColor = c.color || '#2d6ef5';
      d.innerHTML = `<span class="client-dot" style="background:${c.color||'#2d6ef5'}"></span>${c.nombre}`;
      d.onclick = () => setClientFilter(c.id, d);
      chips.appendChild(d);
    });
}

async function loadInventory() {
  let q = Q.from('inventario')
    .select('*, clientes(nombre,codigo,color,campos_captura), almacenes(nombre), usuarios!operador_id(nombre,nombre_display)')
    .eq('activo', true).in('estado',['activo','salida_total','salida_parcial','reservado'])
    .order('created_at', { ascending: false });
  if (USER.rol === 'cliente'  && USER.cliente_id) q = q.eq('cliente_id', USER.cliente_id);
  if (USER.rol === 'operador' && USER.cliente_id) q = q.eq('cliente_id', USER.cliente_id);
  if (USER.rol === 'operador' && USER.almacen_id) q = q.eq('almacen_id', USER.almacen_id);
  allInventory = await safeQuery(() => q) || [];
  filteredInventory = [...allInventory];
  renderInventory();
}

async function loadKPIs() {
  const start = dayStart(), end = dayEnd();
  document.getElementById('kpiTotal').textContent = allInventory.filter(i => i.estado !== 'salida_total').length;
  let qe = Q.from('inventario').select('id',{count:'exact',head:true}).gte('created_at',start).lte('created_at',end);
  if (USER.cliente_id) qe = qe.eq('cliente_id', USER.cliente_id);
  const {count:ent} = await qe;
  document.getElementById('kpiEntradas').textContent = ent || 0;
  let qs = Q.from('movimientos').select('id',{count:'exact',head:true}).eq('tipo','salida').gte('fecha',start).lte('fecha',end);
  if (USER.cliente_id) qs = qs.eq('cliente_id', USER.cliente_id);
  const {count:sal} = await qs;
  document.getElementById('kpiSalidas').textContent = sal || 0;
  let qp = Q.from('paqueteria').select('id',{count:'exact',head:true}).gte('created_at',start).lte('created_at',end);
  if (USER.cliente_id) qp = qp.eq('cliente_id', USER.cliente_id);
  const {count:pkg} = await qp;
  document.getElementById('kpiPkg').textContent = pkg || 0;
}

async function loadAlerts() {
  const sin = allInventory.filter(i => !i.ubicacion && !i.zona && i.estado === 'activo').length;
  if (sin > 0) {
    document.getElementById('alertCount').textContent = sin;
    document.getElementById('alertCount').style.display = '';
    document.getElementById('alertBtn').style.color = 'var(--warning)';
  }
}

function openAlerts() {
  const sin = allInventory.filter(i => !i.ubicacion && !i.zona && i.estado === 'activo');
  document.getElementById('alertsBody').innerHTML = sin.length
    ? sin.map(i => `<div style="padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:800;color:var(--navy);">${i.sku}</div>
        <div style="font-size:11px;color:var(--text-500);">${i.descripcion||'—'} — sin ubicación</div></div>`).join('')
    : `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">Sin alertas</div></div>`;
  document.getElementById('alertsModal').classList.add('open');
}
function closeAlerts() { document.getElementById('alertsModal').classList.remove('open'); }

function setEstadoTab(estado, el) {
  document.querySelectorAll('[data-estado]').forEach(c => {
    c.classList.remove('tab-active'); c.style.background = c.style.color = c.style.borderColor = '';
  });
  el.classList.add('tab-active');
  if (estado === 'activo') { el.style.background='rgba(34,199,122,.12)'; el.style.color='#15803d'; el.style.borderColor='rgba(34,199,122,.3)'; }
  else                     { el.style.background='rgba(239,68,68,.12)';  el.style.color='#dc2626'; el.style.borderColor='rgba(239,68,68,.3)'; }
  filterInventory(document.getElementById('searchInput')?.value||'');
}

function setClientFilter(clientId, el) {
  document.querySelectorAll('#clientChips .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active'); activeClientFilter = clientId;
  filterInventory(document.getElementById('searchInput')?.value||'');
}

function filterInventory(query) {
  const tab = document.querySelector('[data-estado].tab-active')?.dataset?.estado||'activo';
  const q   = (query||'').toLowerCase().trim();
  const sc  = document.getElementById('searchClear');
  if (sc) sc.style.display = q ? 'block' : 'none';
  filteredInventory = allInventory.filter(item => {
    if (tab === 'activo'  && !['activo','reservado','salida_parcial'].includes(item.estado)) return false;
    if (tab === 'salidas' && !['salida_total','salida_parcial'].includes(item.estado))       return false;
    if (activeClientFilter !== 'all' && item.cliente_id !== activeClientFilter)              return false;
    if (q && !([item.sku,item.numero_parte,item.tracking_number,item.descripcion,item.po,item.vendor].join(' ').toLowerCase().includes(q))) return false;
    return true;
  });
  renderInventory();
}
function clearSearch() { document.getElementById('searchInput').value=''; filterInventory(''); }

const SL = { activo:'✓ Activo', reservado:'⏸ Reservado', salida_parcial:'↗ Salida Parcial', salida_total:'↑ Salida Total' };

function renderInventory() {
  renderTable(); renderCards();
  document.getElementById('tableCount').textContent = `${filteredInventory.length} registros`;
}

function renderTable() {
  const tbody = document.getElementById('invTableBody');
  if (!filteredInventory.length) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Sin registros</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = filteredInventory.map((item, i) => {
    const cl = clientMap[item.cliente_id]||{};
    const dot = cl.color ? `<span class="client-dot" style="background:${cl.color}"></span>` : '';
    return `<tr class="inv-row" onclick="openItem(${i})">
      <td class="sku-cell">${item.sku}</td>
      <td>${dot}${cl.nombre||'—'}</td>
      <td class="mono" style="font-size:11px;">${item.numero_parte||'—'}</td>
      <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.descripcion||'—'}</td>
      <td style="text-align:center;font-weight:700;">${item.cantidad||0}</td>
      <td style="text-align:center;">${item.bultos||'—'}</td>
      <td style="font-size:11px;">${item.ubicacion||item.zona||'—'}</td>
      <td class="mono" style="font-size:11px;">${item.tracking_number||'—'}</td>
      <td style="font-size:11px;">${almacenMap[item.almacen_id]||'—'}</td>
      <td style="font-size:11px;">${fmtDate(item.fecha_entrada||item.created_at)}</td>
      <td><span class="badge status-${item.estado}">${SL[item.estado]||item.estado}</span></td>
    </tr>`;
  }).join('');
}

function renderCards() {
  const c = document.getElementById('invCards');
  if (!filteredInventory.length) { c.innerHTML=`<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Sin registros</div></div>`; return; }
  c.innerHTML = filteredInventory.map((item, i) => {
    const cl = clientMap[item.cliente_id]||{};
    return `<div class="inv-card" onclick="openItem(${i})">
      <div class="flex-between"><div class="inv-card-sku">${item.sku}</div><span class="badge status-${item.estado}">${SL[item.estado]||item.estado}</span></div>
      <div style="font-size:12px;color:var(--text-500);margin-top:2px;">${item.descripcion||'—'}</div>
      <div class="inv-card-meta">
        ${cl.nombre?`<span class="badge badge-navy"><span class="client-dot" style="background:${cl.color||'#2d6ef5'}"></span>${cl.nombre}</span>`:''}
        ${item.numero_parte?`<span class="badge badge-info">📋 ${item.numero_parte}</span>`:''}
        ${item.cantidad?`<span class="badge badge-navy">🔢 ${item.cantidad} ud</span>`:''}
        ${item.tracking_number?`<span class="badge badge-navy">🔖 ${item.tracking_number.slice(-8)}</span>`:''}
        <span class="badge badge-navy">📅 ${fmtDate(item.fecha_entrada||item.created_at)}</span>
      </div></div>`;
  }).join('');
}

function openItem(idx) {
  const item = filteredInventory[idx]; if (!item) return;
  const cl   = clientMap[item.cliente_id]||{};
  const camp = cl.campos_captura||['sku','numero_parte','descripcion','cantidad','bultos','peso','po','serial_number','tracking_number','vendor','origin'];
  const fm   = { sku:['SKU',item.sku], numero_parte:['N° de Parte',item.numero_parte], descripcion:['Descripción',item.descripcion], cantidad:['Cantidad',item.cantidad], bultos:['Bultos',item.bultos], peso:['Peso',item.peso], po:['PO',item.po], serial_number:['Serial',item.serial_number], tracking_number:['Tracking',item.tracking_number], vendor:['Vendor',item.vendor], origin:['Origin',item.origin], part_model:['Part Model',item.part_model] };
  const mono = new Set(['sku','numero_parte','tracking_number','serial_number','po','part_model']);
  document.getElementById('dSku').textContent = item.sku;
  document.getElementById('dStatus').innerHTML = `<span class="badge status-${item.estado}">${SL[item.estado]||item.estado}</span>`;
  let html = '<div class="detail-grid">';
  camp.forEach(k => { const [l,v]=fm[k]||[k,item[k]]; if (!v) return; html+=`<div class="detail-field"><div class="detail-label">${l}</div><div class="detail-value${mono.has(k)?' mono':''}">${v}</div></div>`; });
  html += `</div><div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">
    <div class="detail-field"><div class="detail-label">Cliente</div><div class="detail-value">${cl.nombre||'—'}</div></div>
    <div class="detail-field"><div class="detail-label">Almacén</div><div class="detail-value">${almacenMap[item.almacen_id]||'—'}</div></div>
    <div class="detail-field"><div class="detail-label">Ubicación</div><div class="detail-value">${item.ubicacion||item.zona||'—'}</div></div>
    <div class="detail-field"><div class="detail-label">Fecha Entrada</div><div class="detail-value">${fmtDateTime(item.fecha_entrada||item.created_at)}</div></div>
  </div>`;
  const imgs = item.imagenes||[];
  if (imgs.length) html += `<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);"><div class="detail-label">📷 Imágenes (${imgs.length})</div><div class="img-gallery">${imgs.map(u=>`<div class="img-thumb" onclick="openLightbox('${u}')"><img src="${u}" loading="lazy"></div>`).join('')}</div></div>`;
  document.getElementById('drawerBody').innerHTML = html;
  let foot = `<button class="btn btn-ghost btn-sm" onclick="closeDrawer()">Cerrar</button>`;
  foot    += `<button class="btn btn-primary btn-sm" onclick="downloadItemExcel(${idx})">📥 Excel</button>`;
  if (imgs.length) foot += `<button class="btn btn-ghost btn-sm" onclick="downloadImages(${idx})">📷 Imgs</button>`;
  if (['admin','supervisor','operador'].includes(USER.rol)) foot += `<button class="btn btn-ghost btn-sm" onclick="reprintLabel(${idx})">🖨️ Label</button>`;
  document.getElementById('drawerFooter').innerHTML = foot;
  document.getElementById('itemDrawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('open');
}
function closeDrawer() {
  document.getElementById('itemDrawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
}

function exportInventory() {
  exportXLSX(filteredInventory.map(i => ({
    SKU: i.sku, Cliente: clientMap[i.cliente_id]?.nombre||'—', 'N° Parte': i.numero_parte,
    Descripción: i.descripcion, Cantidad: i.cantidad, Bultos: i.bultos, Peso: i.peso,
    Tracking: i.tracking_number, PO: i.po, Vendor: i.vendor,
    Almacén: almacenMap[i.almacen_id]||'—', Ubicación: i.ubicacion||i.zona,
    Estado: i.estado, 'Fecha Entrada': fmtDate(i.fecha_entrada||i.created_at),
  })), `inventario_${todayISO()}`);
}

function downloadItemExcel(idx) {
  const item = filteredInventory[idx];
  const row  = {}; (clientMap[item.cliente_id]?.campos_captura||Object.keys(item)).forEach(k => row[k] = item[k]);
  exportXLSX([row], `${item.sku}_detalle`);
}

function downloadImages(idx) {
  (filteredInventory[idx]?.imagenes||[]).forEach((u,i) => { const a=document.createElement('a'); a.href=u; a.download=`img_${i+1}.png`; a.target='_blank'; a.click(); });
}

function reprintLabel(idx) {
  const item = filteredInventory[idx];
  const w    = window.open('','_blank','width=400,height=300');
  w.document.write(`<html><head><style>body{font-family:monospace;padding:20px}.lb{border:3px solid #000;padding:16px;border-radius:4px}h2{font-size:22px;font-weight:900}.row{display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px}</style></head><body onload="window.print()"><div class="lb"><h2>📦 ${item.sku}</h2><div class="row"><span>Cliente:</span><span>${clientMap[item.cliente_id]?.nombre||'—'}</span></div><div class="row"><span>N° Parte:</span><span>${item.numero_parte||'—'}</span></div><div class="row"><span>Cantidad:</span><span>${item.cantidad||'—'}</span></div><div class="row"><span>Tracking:</span><span>${item.tracking_number||'—'}</span></div></div></body></html>`);
  w.document.close();
}

function openLightbox(url) {
  document.getElementById('lightboxImg').src = url;
  document.getElementById('lightboxDownload').href = url;
  document.getElementById('lightboxModal').classList.add('open');
}
function closeLightbox() { document.getElementById('lightboxModal').classList.remove('open'); }

async function openDayModal(type) {
  currentDayType = type;
  const start  = dayStart(), end = dayEnd();
  const today  = new Date().toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'});
  const body   = document.getElementById('dayModalBody');
  const icons  = { entradas:['📥','rgba(34,199,122,.1)','Entradas del Día'], salidas:['📤','rgba(239,68,68,.08)','Salidas del Día'], paqueteria:['📦','rgba(139,92,246,.08)','Paquetería del Día'] };
  const [ico, bg, ttl] = icons[type]||['📊','rgba(13,43,122,.08)',type];
  document.getElementById('dayModalIcon').textContent = ico;
  document.getElementById('dayModalIcon').style.background = bg;
  document.getElementById('dayModalTitle').textContent = ttl;
  document.getElementById('dayModalSub').textContent = today;
  document.getElementById('dayModal').classList.add('open');
  body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-300);">⏳ Cargando...</div>';

  if (type === 'entradas') {
    let q = Q.from('inventario').select('sku,descripcion,cantidad,created_at,usuarios!operador_id(nombre,nombre_display)').gte('created_at',start).lte('created_at',end).order('created_at',{ascending:false});
    if (USER.cliente_id) q = q.eq('cliente_id', USER.cliente_id);
    const data = await safeQuery(() => q); dayModalData = data||[];
    body.innerHTML = !data?.length ? `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Sin entradas hoy</div></div>` :
      '<div style="padding:4px 0;">' + data.map(r => `<div class="day-item"><div class="day-item-time">${fmtTime(r.created_at)}</div><div class="day-item-content"><div class="day-item-sku">${r.sku}</div><div class="day-item-meta">${r.descripcion||'—'} · ${r.cantidad||0} ud</div><div class="day-item-by">👤 ${r.usuarios?.nombre_display||r.usuarios?.nombre||'—'}</div></div></div>`).join('') + '</div>';
  } else if (type === 'salidas') {
    let q = Q.from('movimientos').select('sku,descripcion,cantidad,folio,fecha,usuarios!usuario_id(nombre,nombre_display)').eq('tipo','salida').gte('fecha',start).lte('fecha',end).order('fecha',{ascending:false});
    if (USER.cliente_id) q = q.eq('cliente_id', USER.cliente_id);
    const data = await safeQuery(() => q); dayModalData = data||[];
    body.innerHTML = !data?.length ? `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Sin salidas hoy</div></div>` :
      '<div style="padding:4px 0;">' + data.map(r => `<div class="day-item"><div class="day-item-time">${fmtTime(r.fecha)}</div><div class="day-item-content"><div class="day-item-sku">${r.sku}</div><div class="day-item-meta">${r.descripcion||'—'} · ${r.cantidad||0} ud</div><div class="day-item-by">👤 ${r.usuarios?.nombre_display||'—'} · ${r.folio||'—'}</div></div></div>`).join('') + '</div>';
  } else {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-text">Sin datos de paquetería</div></div>`;
  }
}
function closeDayModal() { document.getElementById('dayModal').classList.remove('open'); }
function exportDayReport() { if (dayModalData.length) exportXLSX(dayModalData, `${currentDayType}_${todayISO()}`); }
