/* ordenes.js — extracted from original HTML
   Dep: config.js, auth.js, db.js, utils.js, nav.js */

// ── Globals ───────────────────────────────────────────────────────────────
let USER;
let allOrders  = [];
let salItems   = []; // [{sku, cantidad, descripcion}] for new order
let currentFilter = 'all';

// AI globals
let aiOrderId   = null;
let aiOrderFolio = null;
let aiSkus      = []; // [{sku, cantidad, descripcion, confirmado, item_id}]
let aiStream    = null;
let aiSelIdx    = 0;

// ── Init ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  USER = initPage('ordenes');
  if (!USER) return;
  await loadClients();
  await loadOrders();
});

// ── Load clients for dropdown ─────────────────────────────────────────────
async function loadClients() {
  let q = Q.from('clientes').select('id,nombre,codigo').eq('activo', true).order('nombre');
  if (USER.cliente_id) q = q.eq('id', USER.cliente_id);
  const data = await safeQuery(() => q);
  const sel = document.getElementById('noCliente');
  sel.innerHTML = '<option value="">— Seleccionar cliente —</option>' +
    (data || []).map(c => `<option value="${c.id}">${c.nombre}${c.codigo ? ' ('+c.codigo+')':''}</option>`).join('');
  if (USER.cliente_id && data?.length === 1) sel.value = data[0].id;
}

// ── Load orders ───────────────────────────────────────────────────────────
async function loadOrders() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let q = Q.from('ordenes')
    .select(`*, clientes(nombre,color), usuarios!operador_id(nombre,nombre_display)`)
    .gte('created_at', monthStart)
    .order('created_at', { ascending: false });
  if (USER.cliente_id) q = q.eq('cliente_id', USER.cliente_id);
  if (USER.almacen_id) q = q.eq('almacen_origen', USER.almacen_id);

  const data = await safeQuery(() => q);
  allOrders = data || [];
  renderKPIs();
  renderOrders();

  // Pending count for alert badge
  const pend = allOrders.filter(o => o.estado === 'pendiente').length;
  if (pend > 0) {
    document.getElementById('pendingCount').style.display = '';
    document.getElementById('pendingCount').textContent = pend;
  }
}

function renderKPIs() {
  const now = new Date();
  const start = dayStart();
  const hoy = allOrders.filter(o => new Date(o.created_at) >= new Date(start));
  document.getElementById('kpiMes').textContent  = allOrders.length;
  document.getElementById('kpiHoy').textContent  = hoy.length;
  document.getElementById('kpiPend').textContent = allOrders.filter(o=>o.estado==='pendiente').length;
  document.getElementById('kpiComp').textContent = allOrders.filter(o=>o.estado==='completada').length;
}

// ── Render order list ─────────────────────────────────────────────────────
function setFilter(f, el) {
  currentFilter = f;
  document.querySelectorAll('.chip-row .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderOrders();
}

function renderOrders() {
  const orders = currentFilter === 'all'
    ? allOrders
    : allOrders.filter(o => o.estado === currentFilter);

  const container = document.getElementById('ordersList');
  if (!orders.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-text">Sin órdenes ${currentFilter !== 'all' ? currentFilter+'s' : ''}</div>
      <div class="empty-sub">Las órdenes cargadas via Excel aparecerán aquí</div>
    </div>`;
    return;
  }

  const stateIcon = { pendiente:'⏳', proceso:'🔄', completada:'✅', cancelada:'✕' };
  const stateBadge = { pendiente:'badge-warning', proceso:'badge-info', completada:'badge-success', cancelada:'badge-danger' };
  const stateColor = { pendiente:'rgba(245,158,11,.1)', proceso:'rgba(0,194,255,.1)', completada:'rgba(34,199,122,.1)', cancelada:'rgba(239,68,68,.1)' };

  container.innerHTML = orders.map((o, i) => {
    const cl = o.clientes || {};
    const op = o.usuarios?.nombre_display || o.usuarios?.nombre || '—';
    const prog = o.estado === 'completada' ? 100 : o.estado === 'proceso' ? 50 : 0;
    return `<div class="order-card" onclick="openOrderDrawer('${o.id}')">
      <div class="order-type-icon" style="background:${stateColor[o.estado]}">${stateIcon[o.estado]||'📋'}</div>
      <div class="order-info">
        <div class="order-folio">${o.folio || o.id.slice(0,8)}</div>
        <div class="order-meta">
          ${cl.nombre ? `<span class="client-dot" style="background:${cl.color||'#2d6ef5'}"></span>${cl.nombre} · ` : ''}
          ${fmtDateTime(o.created_at)}
        </div>
        <div class="order-meta">Ref: ${o.referencia||o.numero_orden||'—'} · ${op}</div>
        ${prog > 0 ? `<div class="progress-bar"><div class="progress-fill" style="width:${prog}%;background:${prog===100?'var(--success)':'var(--cyan)'}"></div></div>` : ''}
      </div>
      <div class="order-status">
        <span class="badge ${stateBadge[o.estado]}">${o.estado}</span>
      </div>
    </div>`;
  }).join('');
}

// ── New order modal ───────────────────────────────────────────────────────
function openNewOrderModal() {
  salItems = [];
  document.getElementById('salPreview').style.display = 'none';
  document.getElementById('salDropZone').innerHTML = `
    <div style="font-size:26px;margin-bottom:6px;">📂</div>
    <div style="font-size:13px;font-weight:700;color:var(--sal-color);">Arrastra el Excel aquí o haz clic</div>
    <div style="font-size:11px;color:var(--text-300);margin-top:2px;">.xlsx · .xls · .csv</div>
    <input type="file" id="salFile" accept=".xlsx,.xls,.csv" style="display:none" onchange="handleSalExcel(this.files[0])">`;
  document.getElementById('newOrderModal').classList.add('open');
}
function closeNewOrderModal() {
  document.getElementById('newOrderModal').classList.remove('open');
}

function handleSalExcel(file) {
  if (!file) return;
  const dz = document.getElementById('salDropZone');
  dz.innerHTML = `<div style="font-size:22px;">⏳</div><div style="font-size:12px;font-weight:700;color:var(--text-500);">Leyendo ${file.name}...</div>`;

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const wb   = XLSX.read(ev.target.result, { type:'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval:'' });
      if (!json.length) { showToast('El archivo está vacío', 'warning'); return; }

      const keys = Object.keys(json[0]);
      const find = (pats) => keys.find(k => pats.some(p => p.test(k.toLowerCase()))) || keys[0];
      const skuKey  = find([/^sku$/i, /folio|c[oó]digo|n[°º]?\s*parte|part/i]);
      const qtyKey  = find([/cantidad|qty|piezas|units?|bultos?|pcs/i]);
      const descKey = keys.find(k => /desc|product|nombre|artíc/i.test(k.toLowerCase()));

      salItems = json.map(r => ({
        sku:         String(r[skuKey]||'').trim(),
        cantidad:    parseInt(r[qtyKey])||1,
        descripcion: descKey ? String(r[descKey]||'').trim() : '',
      })).filter(r => r.sku);

      if (!salItems.length) { showToast('No se detectaron SKUs', 'warning'); return; }

      dz.innerHTML = `<div style="font-size:22px;">✅</div>
        <div style="font-size:12px;font-weight:700;color:var(--success);">${file.name}</div>
        <div style="font-size:11px;color:var(--text-300);">${salItems.length} SKUs detectados ·
          <span style="color:var(--sal-color);cursor:pointer;font-weight:700;" onclick="document.getElementById('salFile2').click()">Cambiar archivo</span></div>
        <input type="file" id="salFile2" accept=".xlsx,.xls,.csv" style="display:none" onchange="handleSalExcel(this.files[0])">`;

      renderSalPreview();
    } catch(e) { showToast('Error leyendo el archivo', 'error'); }
  };
  reader.readAsArrayBuffer(file);
}

function renderSalPreview() {
  const preview = document.getElementById('salPreview');
  preview.style.display = 'block';
  document.getElementById('salSkuCount').textContent = `${salItems.length} SKU${salItems.length!==1?'s':''}`;
  document.getElementById('salSkuBody').innerHTML = salItems.map((r,i) => `
    <tr>
      <td><input style="border:none;background:none;font-family:monospace;font-size:12px;font-weight:700;color:var(--navy);width:100%;outline:none;"
        value="${r.sku}" oninput="salItems[${i}].sku=this.value"></td>
      <td style="text-align:center;"><input type="number" min="1" style="border:none;background:none;font-weight:800;font-size:14px;width:48px;outline:none;text-align:center;"
        value="${r.cantidad}" oninput="salItems[${i}].cantidad=+this.value||1"></td>
      <td><input style="border:none;background:none;font-size:11px;color:var(--text-400);width:100%;outline:none;"
        value="${r.descripcion}" placeholder="—" oninput="salItems[${i}].descripcion=this.value"></td>
      <td><div style="width:20px;height:20px;border-radius:5px;border:1px solid var(--border);background:white;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;color:var(--text-300);"
        onclick="salItems.splice(${i},1);renderSalPreview()">✕</div></td>
    </tr>`).join('');
}

function addManualSku() {
  salItems.push({ sku:'', cantidad:1, descripcion:'' });
  renderSalPreview();
}

async function saveNewOrder() {
  const clientId = document.getElementById('noCliente').value;
  const ref      = document.getElementById('noRef').value.trim();
  const transporte = document.getElementById('noTransporte').value.trim();
  const numOrden = document.getElementById('noNumOrden').value.trim();
  const notas    = document.getElementById('noNotas').value.trim();
  const items    = salItems.filter(r => r.sku);

  if (!clientId) { showToast('Selecciona un cliente', 'warning'); return; }
  if (!items.length) { showToast('Carga un Excel o agrega SKUs', 'warning'); return; }

  const btn = document.querySelector('#newOrderModal .btn-danger');
  btn.disabled = true; btn.textContent = 'Guardando...';

  try {
    // Generate folio
    const { data: last } = await Q.from('ordenes').select('folio').like('folio','SAL-%').order('folio',{ascending:false}).limit(1);
    const lastNum = last?.[0]?.folio ? parseInt(last[0].folio.replace(/\D/g,''))||0 : 0;
    const folio = `SAL-${String(lastNum+1).padStart(4,'0')}`;

    // Create order
    const { data: newOrd, error: ordErr } = await Q.from('ordenes').insert({
      folio, tipo:'salida', estado:'pendiente',
      cliente_id: clientId,
      referencia: ref||null, transporte: transporte||null,
      numero_orden: numOrden||null, notas: notas||null,
      operador_id: USER.id,
      ...(USER.almacen_id ? { almacen_origen: USER.almacen_id } : {}),
    }).select('id').single();
    if (ordErr) throw ordErr;

    // Insert items
    await Q.from('orden_items').insert(
      items.map(r => ({
        orden_id: newOrd.id,
        sku: r.sku, cantidad: r.cantidad,
        descripcion: r.descripcion||null, confirmado: false,
      }))
    );

    // Create alert for operators
    await Q.from('alertas').insert({
      tipo: 'operacion', nivel: 'info',
      titulo: `Nueva orden de salida: ${folio}`,
      mensaje: `${items.length} SKUs pendientes de confirmación`,
    });

    showToast(`✅ Orden ${folio} creada con ${items.length} SKUs`, 'success');
    closeNewOrderModal();
    loadOrders();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '✓ Crear Orden de Salida';
  }
}

// ── Order drawer ──────────────────────────────────────────────────────────
async function openOrderDrawer(orderId) {
  const o = allOrders.find(o => o.id === orderId);
  if (!o) return;

  document.getElementById('dFolio').textContent = o.folio || o.id.slice(0,8);
  const stateLbl = { pendiente:'⏳ Pendiente', proceso:'🔄 En proceso', completada:'✅ Completada', cancelada:'✕ Cancelada' };
  const stateCls = { pendiente:'badge-warning', proceso:'badge-info', completada:'badge-success', cancelada:'badge-danger' };
  document.getElementById('dStatus').innerHTML = `<span class="badge ${stateCls[o.estado]}">${stateLbl[o.estado]}</span>`;

  // Load items
  const items = await safeQuery(() => Q.from('orden_items').select('*').eq('orden_id', o.id).order('created_at'));

  const cl = o.clientes || {};
  const body = document.getElementById('drawerBody');

  let html = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      <div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-300);">Cliente</div>
        <div style="font-size:13px;font-weight:600;margin-top:2px;">${cl.nombre||'—'}</div></div>
      <div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-300);">Referencia</div>
        <div style="font-size:13px;font-weight:600;margin-top:2px;">${o.referencia||'—'}</div></div>
      <div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-300);">Transporte</div>
        <div style="font-size:13px;font-weight:600;margin-top:2px;">${o.transporte||'—'}</div></div>
      <div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-300);">Sello</div>
        <div style="font-size:13px;font-weight:600;margin-top:2px;">${o.sello||'—'}</div></div>
      <div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-300);">Creada</div>
        <div style="font-size:12px;margin-top:2px;">${fmtDateTime(o.created_at)}</div></div>
      <div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-300);">Notas</div>
        <div style="font-size:12px;margin-top:2px;">${o.notas||'—'}</div></div>
    </div>`;

  if (items?.length) {
    const confirmed = items.filter(i => i.confirmado).length;
    html += `<div style="margin-bottom:8px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-300);margin-bottom:6px;">
      SKUs (${confirmed}/${items.length} confirmados)</div>`;
    html += `<div class="progress-bar" style="margin-bottom:10px;"><div class="progress-fill" style="width:${items.length?Math.round(confirmed/items.length*100):0}%;background:${confirmed===items.length?'var(--success)':'var(--cyan)'}"></div></div>`;
    items.forEach(item => {
      html += `<div class="sku-scan-item ${item.confirmado?'confirmed':''}">
        <span style="font-size:18px;">${item.confirmado?'✅':'⏳'}</span>
        <div style="flex:1;">
          <div style="font-family:monospace;font-size:12px;font-weight:800;color:var(--navy);">${item.sku}</div>
          <div style="font-size:10px;color:var(--text-500);">${item.descripcion||''} · Cant: ${item.cantidad}</div>
          ${item.confirmado ? `<div style="font-size:9px;color:var(--success);">✓ ${fmtTime(item.confirmado_at)}</div>` : ''}
        </div>
      </div>`;
    });
    html += '</div>';
  }

  body.innerHTML = html;

  // Footer
  let footer = `<button class="btn btn-ghost btn-sm" onclick="closeOrderDrawer()">Cerrar</button>`;
  if (o.estado !== 'completada' && o.estado !== 'cancelada') {
    footer += `<button class="btn btn-sm" style="background:linear-gradient(135deg,var(--navy),var(--cyan));color:white;box-shadow:0 3px 12px rgba(0,194,255,.3);"
      onclick="startAIVerification('${o.id}', '${o.folio||o.id.slice(0,8)}')">📸 Confirmar con IA</button>`;
  }
  if (['admin','supervisor'].includes(USER.rol)) {
    footer += `<button class="btn btn-ghost btn-sm" onclick="exportOrder('${o.id}')">📥</button>`;
  }
  document.getElementById('drawerFooter').innerHTML = footer;

  document.getElementById('orderDrawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('open');
}

function closeOrderDrawer() {
  document.getElementById('orderDrawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
}

async function exportOrder(orderId) {
  const items = await safeQuery(() => Q.from('orden_items').select('*').eq('orden_id', orderId));
  if (!items?.length) { showToast('Sin items para exportar', 'warning'); return; }
  exportXLSX(items, `orden_${orderId.slice(0,8)}`);
}

// ══════════════════════════════════════════════════════════════════════════
//  AI VERIFICATION
// ══════════════════════════════════════════════════════════════════════════
async function startAIVerification(orderId, folio) {
  closeOrderDrawer();
  aiOrderId    = orderId;
  aiOrderFolio = folio;
  aiSkus       = [];
  aiSelIdx     = 0;

  // Load items
  const items = await safeQuery(() => Q.from('orden_items').select('*').eq('orden_id', orderId).order('created_at'));
  if (!items?.length) { showToast('No hay SKUs en esta orden', 'warning'); return; }

  aiSkus = items.map(r => ({
    sku: r.sku, cantidad: r.cantidad,
    descripcion: r.descripcion||'', confirmado: r.confirmado||false, item_id: r.id,
  }));

  document.getElementById('aiFolio').textContent = folio;
  renderAiSkuList();
  document.getElementById('aiOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  startCamera();
}

function renderAiSkuList() {
  const list = document.getElementById('aiSkuList');
  list.innerHTML = aiSkus.map((s,i) => `
    <div id="aiS${i}" onclick="selectAiSku(${i})"
      style="border-radius:9px;padding:9px 11px;cursor:pointer;border:1.5px solid ${s.confirmado?'rgba(34,199,122,.4)':'#e4eaf8'};
        background:${s.confirmado?'rgba(34,199,122,.06)':'white'};margin-bottom:6px;transition:all .15s;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-family:monospace;font-size:12px;font-weight:800;color:${s.confirmado?'#16a34a':'var(--navy)'};">${s.sku}</span>
        <span>${s.confirmado?'✅':'⏳'}</span>
      </div>
      <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${s.cantidad} ud${s.descripcion?' · '+s.descripcion.slice(0,28):''}</div>
    </div>`).join('');

  const confirmed = aiSkus.filter(s => s.confirmado).length;
  const total = aiSkus.length;
  const pct = total ? Math.round(confirmed/total*100) : 0;
  document.getElementById('aiProgressBar').style.width = pct + '%';
  document.getElementById('aiProgressLbl').textContent = `${confirmed} / ${total} SKUs confirmados`;
  document.getElementById('aiPct').textContent = pct + '%';
  document.getElementById('aiCompleteBtn').style.display = confirmed === total && total > 0 ? '' : 'none';

  // Auto-select first pending
  const next = aiSkus.findIndex(s => !s.confirmado);
  if (next >= 0) selectAiSku(next);
}

function selectAiSku(idx) {
  aiSelIdx = idx;
  document.querySelectorAll('[id^="aiS"]').forEach((el,i) => {
    el.style.outline = i === idx ? '2px solid var(--cyan)' : 'none';
  });
  const s = aiSkus[idx];
  if (s) document.getElementById('aiStatus').textContent =
    s.confirmado ? `✅ ${s.sku} ya confirmado` : `Apunta al SKU: ${s.sku}`;
}

async function startCamera() {
  try {
    aiStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal:'environment' }, width: { ideal:1280 } }
    });
    document.getElementById('aiVideo').srcObject = aiStream;
    document.getElementById('aiStatus').textContent = 'Cámara lista — apunta al código del bulto';
  } catch(e) {
    document.getElementById('aiStatus').textContent = '⚠️ Sin cámara — usa "Subir Foto"';
  }
}

function stopCamera() {
  aiStream?.getTracks().forEach(t => t.stop());
  aiStream = null;
}

async function aiCapture() {
  const video = document.getElementById('aiVideo');
  const canvas = document.getElementById('aiCanvas');
  if (!video.videoWidth) { showToast('Cámara no disponible', 'warning'); return; }
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  await aiAnalyze(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
}

async function aiUploadPhoto(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => await aiAnalyze(ev.target.result.split(',')[1]);
  reader.readAsDataURL(file);
}

async function aiAnalyze(base64) {
  const scanline  = document.getElementById('aiScanline');
  const captureBtn = document.getElementById('aiCaptureBtn');
  const status    = document.getElementById('aiStatus');
  const resultEl  = document.getElementById('aiResult');

  scanline.style.display = 'block';
  captureBtn.disabled = true;
  captureBtn.textContent = '🔍 Analizando...';
  status.textContent = 'Enviando a Claude Vision...';
  resultEl.innerHTML = '<div style="font-size:24px;margin-bottom:8px;">⏳</div><div style="font-size:11px;color:rgba(255,255,255,.4);">Analizando imagen...</div>';

  const pending  = aiSkus.filter(s => !s.confirmado).map(s => s.sku);
  const allSkus  = aiSkus.map(s => s.sku);

  try {
    const prompt = `Eres un sistema WMS de verificación de almacén.

SKUs de la orden: ${allSkus.join(', ')}
SKUs pendientes: ${pending.join(', ')}

Analiza la imagen y lee TODOS los textos, etiquetas y códigos visibles.
Identifica qué SKU de la lista PENDIENTE aparece en la imagen.

Responde SOLO con este JSON (sin markdown):
{"sku_detectado":"texto exacto visto o null","sku_coincide":"SKU de la lista que coincide o null","coincidencia":true/false,"confianza":"alta/media/baja","texto_visible":"todo el texto legible","razon":"explicación breve"}`;

    const data = await callVision(base64, 'image/jpeg', prompt);

    // Parse response — handles both structured and text formats
    let parsed = null;
    const candidates = [data, data?.text, data?.content].filter(Boolean);
    for (const c of candidates) {
      if (typeof c === 'object' && c.coincidencia !== undefined) { parsed = c; break; }
      if (typeof c === 'string') {
        try {
          const m = c.match(/\{[\s\S]*?\}/);
          if (m) { const p = JSON.parse(m[0]); if (p.coincidencia !== undefined) { parsed = p; break; } }
        } catch {}
      }
    }

    // Fallback if EF returned structured inventory data (sku field)
    if (!parsed && (data?.sku || data?.text)) {
      const det = data.sku || '';
      const matched = pending.find(s => s === det || s.toLowerCase() === det.toLowerCase() || s.includes(det) || det.includes(s));
      parsed = { sku_detectado: det||null, sku_coincide: matched||null, coincidencia: !!matched,
        confianza: data.confidence > 0.8 ? 'alta' : 'media',
        texto_visible: data.text || det, razon: 'Detectado por Vision' };
    }

    if (!parsed) {
      resultEl.innerHTML = `<div style="color:#ef4444;padding:10px;font-size:12px;">No se pudo interpretar la respuesta AI.<br><small style="color:rgba(255,255,255,.3)">${JSON.stringify(data).slice(0,200)}</small></div>`;
      status.textContent = '⚠️ Intenta de nuevo con mejor iluminación';
      return;
    }

    // Display result
    const match = parsed.coincidencia === true;
    const confColor = { alta:'#22c77a', media:'#f59e0b', baja:'#ef4444' }[parsed.confianza] || '#94a3b8';
    resultEl.innerHTML = `
      <div style="text-align:center;padding:14px 0 10px;">
        <div style="font-size:36px;">${match?'✅':'❌'}</div>
        <div style="font-size:13px;font-weight:800;color:${match?'#22c77a':'#ef4444'};margin-top:6px;">${match?'✓ SKU Confirmado':'✕ Sin coincidencia'}</div>
        ${parsed.sku_detectado ? `<div style="font-family:monospace;font-size:11px;background:rgba(255,255,255,.06);padding:3px 10px;border-radius:6px;margin-top:5px;display:inline-block;color:white;">${parsed.sku_detectado}</div>` : ''}
      </div>
      <div style="font-size:11px;color:rgba(255,255,255,.5);padding:0 4px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span>Confianza</span>
          <span style="font-weight:700;color:${confColor}">${parsed.confianza}</span>
        </div>
        ${parsed.sku_coincide ? `<div style="margin-bottom:5px;"><span>Coincide:</span> <strong style="font-family:monospace;color:#00c2ff">${parsed.sku_coincide}</strong></div>` : ''}
        <div style="color:rgba(255,255,255,.3);margin-bottom:4px;">Texto detectado:</div>
        <div style="font-family:monospace;font-size:10px;color:rgba(255,255,255,.6);word-break:break-all;background:rgba(255,255,255,.05);padding:5px;border-radius:5px;margin-bottom:6px;">${parsed.texto_visible||'—'}</div>
        <div style="font-size:10px;border-top:1px solid rgba(255,255,255,.08);padding-top:5px;color:rgba(255,255,255,.3);">${parsed.razon||''}</div>
      </div>`;

    if (match && parsed.sku_coincide) {
      const idx = aiSkus.findIndex(s => s.sku === parsed.sku_coincide && !s.confirmado);
      if (idx >= 0) {
        aiSkus[idx].confirmado = true;
        renderAiSkuList();
        persistConfirmation(aiSkus[idx]);
        const remaining = aiSkus.filter(s => !s.confirmado).length;
        status.textContent = remaining > 0 ? `✅ ${parsed.sku_coincide} — ${remaining} restantes` : '🎉 ¡Todos confirmados!';
      }
    } else {
      status.textContent = parsed.sku_detectado
        ? `❌ "${parsed.sku_detectado}" no está en la orden`
        : '❌ Sin SKU detectado — ajusta el ángulo';
    }
  } catch(e) {
    resultEl.innerHTML = `<div style="color:#ef4444;font-size:12px;padding:10px;">Error de red: ${e.message}</div>`;
    status.textContent = '⚠️ Error de conexión';
  } finally {
    scanline.style.display = 'none';
    captureBtn.disabled = false;
    captureBtn.textContent = '📸 Tomar Foto y Verificar';
  }
}

async function persistConfirmation(item) {
  if (!item.item_id) return;
  try {
    await Q.from('orden_items')
      .update({ confirmado: true, confirmado_at: new Date().toISOString() })
      .eq('id', item.item_id);
  } catch(e) { console.warn('Persist failed:', e.message); }
}

async function completeOrder() {
  const confirmed = aiSkus.filter(s => s.confirmado);
  const pending   = aiSkus.filter(s => !s.confirmado);
  if (pending.length > 0) {
    if (!confirm(`${pending.length} SKU(s) sin confirmar. ¿Completar la orden de todas formas?`)) return;
  }

  try {
    // Update order status
    await Q.from('ordenes').update({ estado:'completada', fecha_completada: new Date().toISOString() }).eq('id', aiOrderId);

    // Update inventory status for confirmed SKUs
    for (const item of confirmed) {
      await Q.from('inventario').update({ estado:'salida_total' }).eq('sku', item.sku);
    }

    // Generate Excel report
    const reportData = aiSkus.map(s => ({
      SKU: s.sku, Cantidad: s.cantidad, Descripción: s.descripcion,
      Confirmado: s.confirmado ? 'Sí' : 'No',
      'Confirmado a las': s.confirmado_at ? fmtTime(s.confirmado_at) : '—',
    }));
    exportXLSX(reportData, `orden_${aiOrderFolio}_confirmacion`);

    showToast(`✅ Orden ${aiOrderFolio} completada — ${confirmed.length} salidas registradas`, 'success', 4000);
    closeAI();
    loadOrders();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
  }
}

function closeAI() {
  stopCamera();
  document.getElementById('aiOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
