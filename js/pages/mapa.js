/* mapa.js — extracted from original HTML
   Dep: config.js, auth.js, db.js, utils.js, nav.js */

// ── Globals ───────────────────────────────────────────────────────────────
let USER;
let isEditMode    = false;
let currentWHid   = null;
let zones         = [];       // [{id,nombre,codigo,tipo,pos_x,pos_y,ancho,alto,color,ocupacion,capacidad}]
let pendingType   = null;     // type to place on next click
let dragging      = null;     // {el, zoneIdx, offX, offY}
let resizing      = null;
let editingZoneIdx = null;
let pendingZonePos = null;    // {x,y} for new zone placement

const ZONE_TYPES = {
  almacenaje: { icon:'📦', color:'#3b82f6', label:'Almacenaje' },
  recepcion:  { icon:'📥', color:'#22c77a', label:'Recepción' },
  despacho:   { icon:'📤', color:'#ef4444', label:'Despacho' },
  cross_dock: { icon:'🔄', color:'#f59e0b', label:'Cross Dock' },
  refrigerado:{ icon:'❄️', color:'#00c2ff', label:'Refrigerado' },
  restringido:{ icon:'🔒', color:'#8b5cf6', label:'Restringido' },
};

// ── Init ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  USER = initPage('mapa', ['admin','supervisor','operador']);
  if (!USER) return;
  await loadWarehouses();
  renderPalette();
});

async function loadWarehouses() {
  let q = Q.from('almacenes').select('id,nombre').eq('activo', true).order('nombre');
  if (USER.almacen_id) q = q.eq('id', USER.almacen_id);
  const data = await safeQuery(() => q);
  const sel = document.getElementById('warehouseSel');
  sel.innerHTML = '<option value="">— Seleccionar almacén —</option>' +
    (data||[]).map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');
  if (data?.length === 1) { sel.value = data[0].id; loadWarehouseMap(); }
}

async function loadWarehouseMap() {
  currentWHid = document.getElementById('warehouseSel').value;
  if (!currentWHid) return;

  const data = await safeQuery(() =>
    Q.from('zonas').select('*').eq('almacen_id', currentWHid).eq('activo', true)
  );
  zones = data || [];
  renderZones();
  renderLegend();
  document.getElementById('mapEmpty').style.display = zones.length ? 'none' : 'flex';
}

// ── Render zones ──────────────────────────────────────────────────────────
function renderZones() {
  const layer = document.getElementById('zonesLayer');
  layer.innerHTML = '';
  zones.forEach((z, idx) => {
    const zt = ZONE_TYPES[z.tipo] || ZONE_TYPES.almacenaje;
    const occ = z.capacidad > 0 ? Math.round((z.ocupacion||0)/z.capacidad*100) : 0;
    const div = document.createElement('div');
    div.className = 'zone-block';
    div.dataset.idx = idx;
    div.style.cssText = `
      left:${z.pos_x}px; top:${z.pos_y}px;
      width:${z.ancho||120}px; height:${z.alto||80}px;
      background:${zt.color}22; color:${zt.color};
      border-color:${zt.color}66;`;
    div.innerHTML = `
      <button class="zone-del" onclick="deleteZone(${idx})">✕</button>
      <div class="zone-icon">${zt.icon}</div>
      <div class="zone-name">${z.nombre}</div>
      ${z.capacidad > 0 ? `<div class="zone-occ">${occ}% ocupado</div>` : ''}
      <div class="resize-handle"></div>`;
    div.addEventListener('mousedown', e => onZoneMouseDown(e, idx));
    div.addEventListener('dblclick', () => editZone(idx));
    layer.appendChild(div);
  });
}

function renderLegend() {
  const usedTypes = [...new Set(zones.map(z => z.tipo))];
  document.getElementById('zoneLegend').innerHTML = usedTypes.map(t => {
    const zt = ZONE_TYPES[t] || ZONE_TYPES.almacenaje;
    return `<div class="legend-item">
      <div class="legend-dot" style="background:${zt.color}"></div>
      ${zt.label}
    </div>`;
  }).join('');
}

function renderPalette() {
  document.getElementById('zonePalette').innerHTML = Object.entries(ZONE_TYPES).map(([k,v]) =>
    `<div class="palette-zone" style="background:${v.color}18;border-color:${v.color}44;color:${v.color};"
      id="pal_${k}" onclick="selectPaletteType('${k}')">
      ${v.icon} ${v.label}
    </div>`).join('');
}

function selectPaletteType(type) {
  pendingType = type;
  document.querySelectorAll('.palette-zone').forEach(el => el.style.outline = 'none');
  const zt = ZONE_TYPES[type];
  document.getElementById('pal_'+type).style.outline = `2px solid ${zt.color}`;
  document.getElementById('mapContainer').style.cursor = 'crosshair';
  document.getElementById('editHint').textContent = `Haz clic en el mapa para colocar zona: ${zt.label}`;
}

// ── Map click: place zone ─────────────────────────────────────────────────
function handleMapClick(e) {
  if (!isEditMode || !pendingType) return;
  if (e.target.closest('.zone-block')) return;
  const rect = document.getElementById('mapContainer').getBoundingClientRect();
  const x = Math.round((e.clientX - rect.left) / 40) * 40;
  const y = Math.round((e.clientY - rect.top)  / 40) * 40;
  pendingZonePos = { x: Math.max(0,x), y: Math.max(0,y) };
  openZoneModal();
}

// ── Zone modal ────────────────────────────────────────────────────────────
function openZoneModal(editIdx = null) {
  editingZoneIdx = editIdx;
  if (editIdx !== null) {
    const z = zones[editIdx];
    document.getElementById('zmTitle').textContent = `Editar: ${z.nombre}`;
    document.getElementById('zmNombre').value = z.nombre;
    document.getElementById('zmCodigo').value = z.codigo || '';
    document.getElementById('zmTipo').value   = z.tipo   || 'almacenaje';
    document.getElementById('zmCap').value    = z.capacidad || '';
    document.getElementById('zmIcon').textContent = ZONE_TYPES[z.tipo]?.icon || '📦';
  } else {
    document.getElementById('zmTitle').textContent = 'Nueva Zona';
    document.getElementById('zmNombre').value = '';
    document.getElementById('zmCodigo').value = '';
    document.getElementById('zmTipo').value   = pendingType || 'almacenaje';
    document.getElementById('zmCap').value    = '';
    document.getElementById('zmIcon').textContent = ZONE_TYPES[pendingType]?.icon || '📦';
  }
  document.getElementById('zoneModal').classList.add('open');
}
function closeZoneModal() { document.getElementById('zoneModal').classList.remove('open'); }
function editZone(idx) { if (isEditMode) openZoneModal(idx); }

function saveZone() {
  const nombre = document.getElementById('zmNombre').value.trim();
  if (!nombre) { showToast('Ingresa un nombre para la zona', 'warning'); return; }

  const tipo = document.getElementById('zmTipo').value;
  const zt   = ZONE_TYPES[tipo];

  if (editingZoneIdx !== null) {
    zones[editingZoneIdx] = {
      ...zones[editingZoneIdx],
      nombre,
      codigo:    document.getElementById('zmCodigo').value.trim().toUpperCase(),
      tipo,
      color:     zt.color,
      capacidad: parseInt(document.getElementById('zmCap').value)||0,
    };
  } else if (pendingZonePos) {
    zones.push({
      id: null, almacen_id: currentWHid,
      nombre,
      codigo:    document.getElementById('zmCodigo').value.trim().toUpperCase(),
      tipo,      color: zt.color,
      pos_x:     pendingZonePos.x, pos_y: pendingZonePos.y,
      ancho: 120, alto: 80,
      capacidad: parseInt(document.getElementById('zmCap').value)||0,
      ocupacion: 0, activo: true,
    });
    pendingZonePos = null;
  }

  closeZoneModal();
  pendingType = null;
  document.querySelectorAll('.palette-zone').forEach(el => el.style.outline = 'none');
  document.getElementById('mapContainer').style.cursor = 'crosshair';
  document.getElementById('editHint').textContent = 'Selecciona un tipo de zona para agregar';
  renderZones();
  renderLegend();
  document.getElementById('mapEmpty').style.display = zones.length ? 'none' : 'flex';
}

function deleteZone(idx) {
  if (!confirm('¿Eliminar esta zona?')) return;
  zones[idx]._delete = true;
  zones.splice(idx, 1);
  renderZones();
  renderLegend();
}

// ── Drag & resize ─────────────────────────────────────────────────────────
function onZoneMouseDown(e, idx) {
  if (!isEditMode) return;
  e.stopPropagation();
  const el = e.currentTarget;
  if (e.target.classList.contains('resize-handle')) {
    resizing = { el, idx, startW: zones[idx].ancho, startH: zones[idx].alto, startX: e.clientX, startY: e.clientY };
  } else {
    const rect = el.getBoundingClientRect();
    dragging = { el, idx, offX: e.clientX - rect.left, offY: e.clientY - rect.top };
    el.classList.add('selected');
  }
}

document.addEventListener('mousemove', e => {
  if (dragging) {
    const container = document.getElementById('mapContainer').getBoundingClientRect();
    let x = Math.round((e.clientX - container.left - dragging.offX) / 40) * 40;
    let y = Math.round((e.clientY - container.top  - dragging.offY) / 40) * 40;
    x = Math.max(0, Math.min(x, container.width  - (zones[dragging.idx]?.ancho||120)));
    y = Math.max(0, Math.min(y, container.height - (zones[dragging.idx]?.alto ||80)));
    zones[dragging.idx].pos_x = Math.round(x);
    zones[dragging.idx].pos_y = Math.round(y);
    dragging.el.style.left = x + 'px';
    dragging.el.style.top  = y + 'px';
  }
  if (resizing) {
    const dw = e.clientX - resizing.startX;
    const dh = e.clientY - resizing.startY;
    const w = Math.max(80, Math.round((resizing.startW + dw) / 40) * 40);
    const h = Math.max(60, Math.round((resizing.startH + dh) / 40) * 40);
    zones[resizing.idx].ancho = Math.round(w);
    zones[resizing.idx].alto  = Math.round(h);
    resizing.el.style.width  = w + 'px';
    resizing.el.style.height = h + 'px';
  }
});

document.addEventListener('mouseup', () => {
  if (dragging) { dragging.el.classList.remove('selected'); dragging = null; }
  if (resizing) { resizing = null; }
});

// ── Edit mode toggle ──────────────────────────────────────────────────────
function toggleEdit() {
  const canEdit = USER.rol === 'admin' ||
    (USER.rol === 'supervisor' && USER.almacen_id === currentWHid) ||
    (USER.rol === 'operador'   && USER.almacen_id === currentWHid);

  if (!canEdit) { showToast('No tienes permisos para editar este mapa', 'warning'); return; }

  isEditMode = !isEditMode;
  const btn     = document.getElementById('editBtn');
  const palette = document.getElementById('palette');
  const saveBtn = document.getElementById('saveMapBtn');
  const cont    = document.getElementById('mapContainer');

  btn.style.background     = isEditMode ? 'rgba(0,194,255,.1)' : '';
  btn.style.borderColor    = isEditMode ? 'var(--cyan)' : '';
  palette.style.display    = isEditMode ? '' : 'none';
  saveBtn.style.display    = isEditMode ? '' : 'none';
  cont.style.cursor        = isEditMode ? 'crosshair' : 'default';

  // Toggle delete buttons
  document.querySelectorAll('.zone-del').forEach(el => {
    el.style.display = isEditMode ? '' : 'none';
  });

  if (isEditMode) {
    document.getElementById('editHint').textContent = 'Modo edición activo — selecciona un tipo de zona para agregar';
    showToast('✏️ Modo edición activado', 'info');
  } else {
    pendingType = null;
    document.getElementById('editHint').textContent = '';
    showToast('Vista guardada temporalmente', 'info');
  }
}

// ── Save map to Supabase ──────────────────────────────────────────────────
async function saveMap() {
  if (!currentWHid) return;
  const btn = document.getElementById('saveMapBtn');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';

  try {
    // Delete existing zones for this warehouse
    await Q.from('zonas').update({ activo: false }).eq('almacen_id', currentWHid);

    // Upsert all current zones
    const toSave = zones.map(z => ({
      ...(z.id ? { id: z.id } : {}),
      almacen_id: currentWHid,
      nombre:     z.nombre, codigo: z.codigo || z.nombre.slice(0,4).toUpperCase(),
      tipo:       z.tipo,   color:  ZONE_TYPES[z.tipo]?.color || '#3b82f6',
      pos_x:      Math.round(z.pos_x || 0),  pos_y: Math.round(z.pos_y || 0),
      ancho:      Math.round(z.ancho || 120),  alto:  Math.round(z.alto  || 80),
      capacidad:  z.capacidad || 0, ocupacion: z.ocupacion || 0,
      activo:     true,
    }));

    if (toSave.length) {
      const { error } = await Q.from('zonas').upsert(toSave, { onConflict: 'id' });
      if (error) throw error;
    }

    showToast('✅ Mapa guardado correctamente', 'success');
    isEditMode = false;
    document.getElementById('editBtn').style.background = '';
    document.getElementById('editBtn').style.borderColor = '';
    document.getElementById('palette').style.display = 'none';
    btn.style.display = 'none';
    document.getElementById('editHint').textContent = '';
    document.getElementById('mapContainer').style.cursor = 'default';
    await loadWarehouseMap();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Guardar mapa';
  }
}

// ── Print map ─────────────────────────────────────────────────────────────
function printMap() {
  const container = document.getElementById('mapContainer');
  const w = window.open('', '_blank');
  const almNombre = document.getElementById('warehouseSel').options[document.getElementById('warehouseSel').selectedIndex]?.text || 'Almacén';
  w.document.write(`<html><head><title>Mapa ${almNombre}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;}
      h2{font-size:18px;margin-bottom:12px;}
      .map-container{background:#f0f4ff;border:2px solid #ccc;border-radius:12px;overflow:hidden;position:relative;min-height:520px;}
      @media print{@page{margin:10mm}}
    </style></head><body onload="window.print()">
    <h2>🗺️ Mapa: ${almNombre}</h2>
    <div class="map-container">${container.innerHTML}</div>
    </body></html>`);
  w.document.close();
}
