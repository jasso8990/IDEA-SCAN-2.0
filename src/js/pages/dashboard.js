/* ═══════════════════════════════════════════════════════
   dashboard.js — Dashboard principal IDEA SCAN 2.0
   Tablas reales: inventario, movimientos, ordenes, paqueteria
   ═══════════════════════════════════════════════════════ */
'use strict';

let _dashUser = null;

async function loadDashboard() {
  _dashUser = currentUser();
  await Promise.all([loadKPIs(), loadActividad(), loadAlertas()]);
}

// ── Helpers de filtro por cliente ─────────────────────────
function clienteFilter(query) {
  if (_dashUser && _dashUser.rol !== 'admin' && _dashUser.cliente_id) {
    return query.eq('cliente_id', _dashUser.cliente_id);
  }
  return query;
}

function fmtHora(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
function fmtFechaHora(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short' }) + ' ' +
         d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
}

// ── KPIs ──────────────────────────────────────────────────
async function loadKPIs() {
  const hoy   = new Date().toISOString().split('T')[0];
  const hoyTs = hoy + 'T00:00:00';

  // Entradas hoy: movimientos tipo 'entrada' o inventario creado hoy
  let qEnt = sb().from('inventario').select('*', { count:'exact', head:true })
    .gte('created_at', hoyTs);
  if (_dashUser?.rol !== 'admin' && _dashUser?.cliente_id)
    qEnt = qEnt.eq('cliente_id', _dashUser.cliente_id);
  const { count: entradas } = await qEnt;

  // Salidas hoy: movimientos tipo 'salida' creados hoy
  let qSal = sb().from('movimientos').select('*', { count:'exact', head:true })
    .eq('tipo', 'salida').gte('created_at', hoyTs);
  if (_dashUser?.rol !== 'admin' && _dashUser?.cliente_id)
    qSal = qSal.eq('cliente_id', _dashUser.cliente_id);
  const { count: salidas } = await qSal;

  // SKUs activos en inventario
  let qSku = sb().from('inventario').select('*', { count:'exact', head:true }).eq('activo', true);
  if (_dashUser?.rol !== 'admin' && _dashUser?.cliente_id)
    qSku = qSku.eq('cliente_id', _dashUser.cliente_id);
  const { count: skus } = await qSku;

  // Bultos totales
  let qBul = sb().from('inventario').select('bultos').eq('activo', true);
  if (_dashUser?.rol !== 'admin' && _dashUser?.cliente_id)
    qBul = qBul.eq('cliente_id', _dashUser.cliente_id);
  const { data: bulArr } = await qBul;
  const totalBultos = (bulArr || []).reduce((s, r) => s + (r.bultos || 0), 0);

  document.getElementById('kpiEntradas').textContent    = fmtNum(entradas || 0);
  document.getElementById('kpiSalidas').textContent     = fmtNum(salidas  || 0);
  document.getElementById('kpiSKUs').textContent        = fmtNum(skus     || 0);
  document.getElementById('kpiBultos').textContent      = fmtNum(totalBultos);
  document.getElementById('kpiEntradasSub').textContent = 'registros hoy';
  document.getElementById('kpiSalidasSub').textContent  = 'despachos hoy';
}

// ── Actividad reciente (entradas y salidas del día) ───────
async function loadActividad() {
  const hoyTs = new Date().toISOString().split('T')[0] + 'T00:00:00';
  const el    = document.getElementById('actividadReciente');

  // Entradas del día: inventario creado hoy
  let qEnt = sb().from('inventario')
    .select('id,sku,descripcion,vendor,bultos,area,created_at,cliente_id,clientes:cliente_id(nombre)')
    .gte('created_at', hoyTs)
    .order('created_at', { ascending: false })
    .limit(15);
  if (_dashUser?.rol !== 'admin' && _dashUser?.cliente_id)
    qEnt = qEnt.eq('cliente_id', _dashUser.cliente_id);

  // Salidas del día: movimientos tipo salida de hoy
  let qSal = sb().from('movimientos')
    .select('id,sku,descripcion,folio,cantidad,created_at,cliente_id,clientes:cliente_id(nombre)')
    .eq('tipo', 'salida')
    .gte('created_at', hoyTs)
    .order('created_at', { ascending: false })
    .limit(15);
  if (_dashUser?.rol !== 'admin' && _dashUser?.cliente_id)
    qSal = qSal.eq('cliente_id', _dashUser.cliente_id);

  const [{ data: entradas }, { data: salidas }] = await Promise.all([qEnt, qSal]);

  // Mezclar y ordenar por fecha desc
  const items = [
    ...(entradas || []).map(e => ({ ...e, _tipo: 'entrada' })),
    ...(salidas  || []).map(s => ({ ...s, _tipo: 'salida'  })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);

  if (!items.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-text">Sin actividad hoy</div>
    </div>`;
    return;
  }

  el.innerHTML = items.map(a => {
    const isEnt    = a._tipo === 'entrada';
    const hora     = fmtHora(a.created_at);
    const cli      = a.clientes?.nombre || '';
    const icon     = isEnt ? '📥' : '📤';
    const badgeCss = isEnt ? 'badge-success' : 'badge-danger';
    const badgeTxt = isEnt ? 'Entrada' : 'Salida';
    const sub      = isEnt
      ? `${a.vendor || ''} · ${a.bultos || 1} bulto${(a.bultos||1)!==1?'s':''} · ${a.area || ''}`
      : `Folio: ${a.folio || '—'} · ${a.cantidad || ''} pzas`;
    return `<div class="day-item act-row" style="cursor:pointer;" onclick="verDetalleActividad('${a.id}','${a._tipo}')">
      <div class="day-item-time">${hora}</div>
      <div class="day-item-content">
        <div style="display:flex;align-items:center;gap:6px;">
          <span>${icon}</span>
          <span class="day-item-sku">${a.sku || a.folio || '—'}</span>
          <span class="badge ${badgeCss}" style="font-size:9px;">${badgeTxt}</span>
          ${cli ? `<span class="badge badge-navy" style="font-size:9px;">${cli}</span>` : ''}
        </div>
        <div class="day-item-meta">${a.descripcion || sub}</div>
        <div class="day-item-by" style="font-size:10px;color:var(--text-300);">${sub}</div>
      </div>
      <div style="font-size:16px;color:var(--text-300);">›</div>
    </div>`;
  }).join('');
}

// ── Alertas: órdenes y salidas pendientes ─────────────────
async function loadAlertas() {
  const el = document.getElementById('alertasStock');

  // 1. Órdenes pendientes (tipo salida con estado pendiente/procesando)
  let qOrd = sb().from('ordenes')
    .select('id,folio,estado,prioridad,cliente_id,created_at,clientes:cliente_id(nombre)')
    .in('estado', ['pendiente', 'procesando', 'en_proceso'])
    .order('created_at', { ascending: false })
    .limit(20);
  if (_dashUser?.rol !== 'admin' && _dashUser?.cliente_id)
    qOrd = qOrd.eq('cliente_id', _dashUser.cliente_id);

  // 2. Paquetería pendiente
  let qPkg = sb().from('paqueteria')
    .select('id,codigo,estado,carrier,tracking_number,cliente_id,created_at,clientes:cliente_id(nombre)')
    .in('estado', ['pendiente', 'en_proceso', 'verificando'])
    .order('created_at', { ascending: false })
    .limit(10);
  if (_dashUser?.rol !== 'admin' && _dashUser?.cliente_id)
    qPkg = qPkg.eq('cliente_id', _dashUser.cliente_id);

  // 3. Salidas borradores sin completar
  let qBor = sb().from('salidas_borradores')
    .select('id,folio,estado,cliente_id,created_at,clientes:cliente_id(nombre)')
    .neq('estado', 'completado')
    .order('created_at', { ascending: false })
    .limit(10);
  if (_dashUser?.rol !== 'admin' && _dashUser?.cliente_id)
    qBor = qBor.eq('cliente_id', _dashUser.cliente_id);

  const [{ data: ordenes }, { data: paquetes }, { data: borradores }] = await Promise.all([qOrd, qPkg, qBor]);

  const totalAlertas = (ordenes?.length || 0) + (paquetes?.length || 0) + (borradores?.length || 0);

  if (!totalAlertas) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">✅</div>
      <div class="empty-text">Sin pendientes</div>
    </div>`;
    return;
  }

  let html = '';

  // Órdenes pendientes
  if (ordenes?.length) {
    html += `<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--text-400);padding:6px 0 4px;">📋 Órdenes de Salida Pendientes</div>`;
    html += (ordenes).map(o => {
      const { icon, css } = estadoInfo(o.estado);
      const cli  = o.clientes?.nombre || '';
      const hora = fmtFechaHora(o.created_at);
      const pri  = o.prioridad === 'alta' ? '🔴' : o.prioridad === 'media' ? '🟡' : '🟢';
      return `<div class="alerta-row" onclick="irA('salidas.html')">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
          <span style="font-size:16px;">${icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:13px;color:var(--navy);display:flex;align-items:center;gap:5px;">
              ${o.folio || '—'} ${pri}
            </div>
            <div style="font-size:11px;color:var(--text-400);">${cli} · ${hora}</div>
          </div>
        </div>
        <span class="badge ${css}">${fmtEstado(o.estado)}</span>
        <span style="color:var(--text-300);font-size:16px;">›</span>
      </div>`;
    }).join('');
  }

  // Borradores de salida
  if (borradores?.length) {
    html += `<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--text-400);padding:10px 0 4px;">📤 Salidas Sin Completar</div>`;
    html += borradores.map(b => {
      const cli  = b.clientes?.nombre || '';
      const hora = fmtFechaHora(b.created_at);
      return `<div class="alerta-row" onclick="irA('salidas.html')">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
          <span style="font-size:16px;">⏳</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:13px;color:var(--navy);">${b.folio || 'Borrador'}</div>
            <div style="font-size:11px;color:var(--text-400);">${cli} · ${hora}</div>
          </div>
        </div>
        <span class="badge badge-warning">${fmtEstado(b.estado || 'pendiente')}</span>
        <span style="color:var(--text-300);font-size:16px;">›</span>
      </div>`;
    }).join('');
  }

  // Paquetería pendiente
  if (paquetes?.length) {
    html += `<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--text-400);padding:10px 0 4px;">🚚 Paquetería Pendiente</div>`;
    html += paquetes.map(p => {
      const cli  = p.clientes?.nombre || '';
      const hora = fmtFechaHora(p.created_at);
      return `<div class="alerta-row" onclick="irA('paqueteria.html')">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
          <span style="font-size:16px;">📦</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:13px;color:var(--navy);">${p.codigo || p.tracking_number || '—'}</div>
            <div style="font-size:11px;color:var(--text-400);">${p.carrier || ''} · ${cli} · ${hora}</div>
          </div>
        </div>
        <span class="badge badge-orange">Pendiente</span>
        <span style="color:var(--text-300);font-size:16px;">›</span>
      </div>`;
    }).join('');
  }

  el.innerHTML = html;
}

// ── Ver detalle al click en actividad ────────────────────
async function verDetalleActividad(id, tipo) {
  if (tipo === 'entrada') {
    // Buscar en inventario y mostrar modal tipo inventario
    const { data } = await sb().from('inventario')
      .select('*,clientes:cliente_id(nombre,codigo)').eq('id', id).single();
    if (data) mostrarModalEntrada(data);
  } else {
    // Salida: ir a salidas con folio
    window.location.href = 'salidas.html';
  }
}

function mostrarModalEntrada(item) {
  // Reusar la lógica del modal de inventario si ya está cargada, o crear mini-modal
  const existe = document.getElementById('modalDetalleEntry');
  if (existe) existe.remove();

  const campos = [
    ['SKU',           item.sku],
    ['Folio Entrada', item.folio_entrada],
    ['N° Parte',      item.numero_parte],
    ['Descripción',   item.descripcion],
    ['Vendor',        item.vendor],
    ['Carrier',       item.carrier],
    ['Tracking #',    item.tracking_number],
    ['PO',            item.po],
    ['Bultos',        item.bultos],
    ['Área',          item.area],
    ['Cliente',       item.clientes?.nombre],
    ['Fecha',         item.fecha_entrada],
  ];

  const imgs = item.imagenes || [];

  const modal = document.createElement('div');
  modal.id = 'modalDetalleEntry';
  modal.className = 'modal-overlay open';
  modal.style.cssText = 'padding:16px;align-items:flex-start;overflow-y:auto;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;width:100%;max-width:600px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(13,43,122,.25);">
      <div style="padding:18px 20px;background:var(--navy);border-radius:16px 16px 0 0;border-bottom:3px solid #f97316;display:flex;align-items:center;gap:10px;">
        <div style="flex:1;">
          <div style="font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1px;">Entrada</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:900;color:white;">${item.sku||'—'}</div>
        </div>
        <a href="inventario.html" class="btn btn-sm" style="background:rgba(255,255,255,.15);color:white;border:1px solid rgba(255,255,255,.2);">Ver en Inventario →</a>
        <button onclick="document.getElementById('modalDetalleEntry').remove()" class="modal-close">✕</button>
      </div>
      <div style="padding:20px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin-bottom:16px;">
          ${campos.map(([l,v]) => `
            <div style="background:var(--surface2);border-radius:8px;padding:8px 12px;">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-400);margin-bottom:2px;">${l}</div>
              <div style="font-size:13px;font-weight:600;color:var(--navy);">${v||'—'}</div>
            </div>`).join('')}
        </div>
        ${imgs.length ? `
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-400);margin-bottom:8px;">📷 Fotos (${imgs.length})</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;">
            ${imgs.map(url => `
              <div style="border-radius:8px;overflow:hidden;border:2px solid var(--border);aspect-ratio:1;cursor:pointer;" onclick="window.open('${url}','_blank')">
                <img src="${url}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">
              </div>`).join('')}
          </div>` : ''}
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ── Helpers ───────────────────────────────────────────────
function irA(url) { window.location.href = url; }

function estadoInfo(estado) {
  const map = {
    pendiente:   { icon: '⏳', css: 'badge-warning'  },
    procesando:  { icon: '⚙️',  css: 'badge-navy'     },
    en_proceso:  { icon: '⚙️',  css: 'badge-navy'     },
    completado:  { icon: '✅', css: 'badge-success'  },
    cancelado:   { icon: '❌', css: 'badge-danger'   },
    verificando: { icon: '🔍', css: 'badge-purple'   },
  };
  return map[estado] || { icon: '📋', css: 'badge-gray' };
}

function fmtEstado(e) {
  const map = {
    pendiente:   'Pendiente',
    procesando:  'Procesando',
    en_proceso:  'En proceso',
    completado:  'Completado',
    cancelado:   'Cancelado',
    verificando: 'Verificando',
  };
  return map[e] || e;
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('es-MX');
}

// ── Actualizar badge de alertas ───────────────────────────
async function updateAlertCount() {
  const hoyTs = new Date().toISOString().split('T')[0] + 'T00:00:00';
  let qOrd = sb().from('ordenes').select('*',{count:'exact',head:true}).in('estado',['pendiente','procesando','en_proceso']);
  let qBor = sb().from('salidas_borradores').select('*',{count:'exact',head:true}).neq('estado','completado');
  if (_dashUser?.rol !== 'admin' && _dashUser?.cliente_id) {
    qOrd = qOrd.eq('cliente_id', _dashUser.cliente_id);
    qBor = qBor.eq('cliente_id', _dashUser.cliente_id);
  }
  const [{count: c1},{count: c2}] = await Promise.all([qOrd, qBor]);
  const total = (c1||0)+(c2||0);
  const badge = document.getElementById('alertaCount');
  if (badge) badge.textContent = total > 0 ? total : '';
}
