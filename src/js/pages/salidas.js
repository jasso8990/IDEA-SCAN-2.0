/* ═══════════════════════════════════════════════════════
   salidas.js — Módulo completo de Salidas
   IDEA SCAN 2.0
   Flujo:
   1. Subir órdenes (multi-foto/archivo) → IA genera orden por área
   2. Inspección → escanear labels de cajas → verificar vs orden
   3. Orden definitiva por SEAL → agrupar sub-órdenes
   4. Foto transporte + foto SEAL → IA confirma SEAL → salida completa
   ═══════════════════════════════════════════════════════ */
'use strict';

/* ── Estado global ── */
let _user        = null;
let _ordenes     = [];      // sub-órdenes detectadas por IA [{seal,area,items:[{sku,desc,bultos,qty}]}]
let _currentOrden= null;    // orden activa en inspección
let _escaneados  = [];      // bultos escaneados en inspección
let _sealFotos   = {};      // {transporte: b64, sello: b64}
let _folioSalida = '';
let _ordenDefin  = null;    // orden definitiva agrupada por SEAL
let _ordenFotos  = [];      // fotos de las órdenes subidas (b64)

/* ── Init ── */
async function initSalidas() {
  _user = requireAuth(); if (!_user) return;
  renderSidebar('salidas'); renderBottomNav('salidas');
  await loadOrdenesGuardadas();
}

/* ── Helpers AI ── */
async function callAI(messages, maxTokens=1000) {
  const res = await fetch(ANTHROPIC_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model:'claude-opus-4-20250514', max_tokens: maxTokens, messages })
  });
  const json = await res.json();
  return json.content?.[0]?.text || '{}';
}

function parseJSON(text) {
  try { return JSON.parse(text.replace(/```json|```/g,'').trim()); }
  catch(e) { return {}; }
}

/* ══════════════════════════════════════════════════════
   PASO 1 — SUBIR ÓRDENES DE SALIDA
   ══════════════════════════════════════════════════════ */

function addOrdenFoto(e) {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    const r = new FileReader();
    r.onload = ev => {
      _ordenFotos.push({ b64: ev.target.result.split(',')[1], dataUrl: ev.target.result, file });
      renderOrdenFotos();
    };
    r.readAsDataURL(file);
  });
  e.target.value = '';
  updateBtnAnalizar();
}

function removeOrdenFoto(idx) {
  _ordenFotos.splice(idx, 1);
  renderOrdenFotos();
  updateBtnAnalizar();
}

function renderOrdenFotos() {
  const grid = document.getElementById('ordenFotoGrid');
  const tags = ['Orden OPS','Orden ISS','Orden RMA','Orden MRO','Orden DEF','Orden 8106','Extra'];
  let html = _ordenFotos.map((p,i) => `
    <div class="photo-thumb">
      <img src="${p.dataUrl}" alt="Orden ${i+1}">
      <span class="ph-tag">${tags[i]||'Orden '+(i+1)}</span>
      <button class="ph-del" onclick="removeOrdenFoto(${i})">✕</button>
    </div>`).join('');
  html += `<div class="photo-add" onclick="document.getElementById('ordenFileInput').click()">
    <span>📄</span><small>Agregar orden</small>
  </div>`;
  grid.innerHTML = html;
  const cnt = document.getElementById('ordenFotoCount');
  if (cnt) cnt.textContent = _ordenFotos.length + ' orden' + (_ordenFotos.length!==1?'es':'');
}

function updateBtnAnalizar() {
  const btn = document.getElementById('btnAnalizarOrdenes');
  if (btn) btn.disabled = _ordenFotos.length === 0;
}

async function analizarOrdenes() {
  if (!_ordenFotos.length) return;
  showAI('Analizando ' + _ordenFotos.length + ' orden(es)...', 'La IA extrae SKUs, SEAL y áreas');

  try {
    // Build content array — images as image blocks, docs (Excel/PDF) as document blocks
    const imgContent = _ordenFotos.map(p => {
      if (p.isDoc) {
        // PDF supported natively; Excel/CSV sent as base64 document
        const mt = p.mimeType.includes('pdf') ? 'application/pdf' : 'text/plain';
        return { type:'document', source:{ type:'base64', media_type: mt, data: p.b64 } };
      }
      return { type:'image', source:{ type:'base64', media_type:'image/jpeg', data: p.b64 } };
    });

    const prompt = `Eres un experto en logística y almacén. Analiza TODAS las imágenes proporcionadas. 
Cada imagen puede ser una orden de salida de almacén para un área específica (OPS, ISS, RMA, MRO, DEF/Definitivo, 8106).
Todas pueden compartir el mismo SEAL o número de sello.

EXTRAE de cada orden:
1. SEAL o número de sello (puede estar en cualquier orden, es el mismo para todas)
2. Área de la orden (OPS, ISS, RMA, MRO, DEF, 8106)
3. Lista de SKUs con: número de parte/SKU, descripción, cantidad de piezas, número de bultos
4. Número de folio o referencia de la orden
5. Cliente o destinatario si aparece

Responde ÚNICAMENTE en JSON puro:
{
  "seal": "",
  "cliente": "",
  "ordenes": [
    {
      "area": "OPS",
      "folio_origen": "",
      "items": [
        {"sku": "", "numero_parte": "", "descripcion": "", "cantidad": 0, "bultos": 1}
      ]
    }
  ]
}
Si hay varias órdenes en imágenes diferentes, inclúyelas todas en el array "ordenes".
Cada orden tiene su área. El SEAL es único para todas.
Solo JSON puro, sin markdown.`;

    const rawText = await callAI([{role:'user', content:[...imgContent, {type:'text',text:prompt}]}], 1500);
    const data = parseJSON(rawText);

    if (!data.ordenes || !data.ordenes.length) {
      alert('No se detectaron órdenes. Verifica la calidad de las imágenes o llena los datos manualmente.');
      hideAI();
      goStep(2, true); // manual mode
      return;
    }

    _ordenes = data.ordenes;
    const seal = data.seal || '';
    document.getElementById('sealDetectado').textContent = seal || '—';
    document.getElementById('sealInput').value = seal;
    document.getElementById('clienteOrden').textContent = data.cliente || '—';

    renderOrdenesDetectadas();
    hideAI();
    goStep(2);

  } catch(err) {
    hideAI();
    alert('Error IA: ' + err.message + '\nPuedes llenar los datos manualmente.');
    goStep(2, true);
  }
}

function renderOrdenesDetectadas() {
  const cont = document.getElementById('ordenesDetectadas');
  if (!cont) return;

  const areaColors = {OPS:'#0d2b7a',ISS:'#7c3aed',RMA:'#dc2626',MRO:'#d97706',DEF:'#16a34a','8106':'#0891b2',HOLD:'#6b7280'};
  const areaIcons  = {OPS:'⚙️',ISS:'✈️',RMA:'↩️',MRO:'🔧',DEF:'📋','8106':'🏭',HOLD:'⏸️'};

  cont.innerHTML = _ordenes.map((o, oi) => `
    <div class="orden-card" id="ordenCard${oi}" style="background:white;border-radius:12px;border:2px solid var(--border);overflow:hidden;margin-bottom:10px;">
      <div style="background:${areaColors[o.area]||'#0d2b7a'};padding:10px 14px;display:flex;align-items:center;gap:10px;">
        <span style="font-size:18px;">${areaIcons[o.area]||'📦'}</span>
        <span style="color:white;font-family:'Exo 2',sans-serif;font-size:14px;font-weight:800;">Área ${o.area}</span>
        ${o.folio_origen?`<span style="color:rgba(255,255,255,.6);font-size:11px;margin-left:4px;">Ref: ${o.folio_origen}</span>`:''}
        <span style="margin-left:auto;background:rgba(255,255,255,.15);color:white;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;">${(o.items||[]).length} items · ${(o.items||[]).reduce((a,i)=>a+(i.bultos||1),0)} bultos</span>
        <button onclick="toggleOrdenCard(${oi})" style="background:rgba(255,255,255,.15);border:none;color:white;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:12px;" id="toggleBtn${oi}">▼</button>
      </div>
      <div id="ordenBody${oi}" style="padding:12px;">
        ${(o.items||[]).map((item,ii) => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:7px;background:var(--surface2);margin-bottom:4px;" id="item_${oi}_${ii}">
            <span style="font-family:monospace;font-weight:700;color:var(--navy);font-size:12px;min-width:100px;">${item.sku||item.numero_parte||'—'}</span>
            <span style="flex:1;font-size:11px;color:var(--text-500);">${item.descripcion||''}</span>
            <span style="font-size:11px;color:var(--text-400);">Qty: ${item.cantidad||0}</span>
            <span class="badge badge-navy">B: ${item.bultos||1}</span>
            <span class="badge" id="itemStatus_${oi}_${ii}" style="background:var(--surface2);color:var(--text-400);">Pendiente</span>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

function toggleOrdenCard(oi) {
  const body = document.getElementById('ordenBody'+oi);
  const btn  = document.getElementById('toggleBtn'+oi);
  if (!body) return;
  const hidden = body.style.display === 'none';
  body.style.display = hidden ? 'block' : 'none';
  btn.textContent = hidden ? '▼' : '▶';
}

/* ══════════════════════════════════════════════════════
   PASO 2 — INSPECCIÓN: ESCANEAR LABELS DE CAJAS
   ══════════════════════════════════════════════════════ */

let _scanFotos = [];

function addScanFoto(e) {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    const r = new FileReader();
    r.onload = ev => {
      _scanFotos.push({ b64: ev.target.result.split(',')[1], dataUrl: ev.target.result, file });
      renderScanGrid();
      // Auto-verify immediately (real-time mode: one photo = one verification)
      if (_scanFotos.length > 0) {
        setTimeout(() => verificarBultos(), 300);
      }
    };
    r.readAsDataURL(file);
  });
  e.target.value = '';
}

function removeScanFoto(idx) {
  _scanFotos.splice(idx, 1);
  renderScanGrid();
  document.getElementById('btnVerificar').disabled = _scanFotos.length === 0;
}

function renderScanGrid() {
  const grid = document.getElementById('scanGrid');
  if (!grid) return;
  // Only show pending photos not yet verified
  grid.innerHTML = _scanFotos.map((p,i) => `
    <div class="photo-thumb" style="border-color:#f97316;">
      <img src="${p.dataUrl}" alt="Bulto ${i+1}">
      <span class="ph-tag" style="background:rgba(249,115,22,.85);">Verificando...</span>
      <button class="ph-del" onclick="removeScanFoto(${i})">✕</button>
    </div>`).join('');
  const cnt = document.getElementById('scanCount');
  // Show total scanned (verified + pending)
  const total = _escaneados.length + _scanFotos.length;
  if (cnt) cnt.textContent = total + ' bulto' + (total!==1?'s':'') + ' escaneado' + (total!==1?'s':'');
  // Show/hide verify button — only if photos pending
  const btn = document.getElementById('btnVerificar');
  if (btn) btn.disabled = _scanFotos.length === 0;
}

async function verificarBultos() {
  if (!_scanFotos.length) return;
  showAI('Verificando ' + _scanFotos.length + ' bulto(s)...', 'La IA lee los SKUs de cada label');

  try {
    // Build all order items for reference
    const todosItems = _ordenes.flatMap(o =>
      (o.items||[]).map(item => ({
        sku: item.sku||item.numero_parte||'',
        area: o.area,
        descripcion: item.descripcion||''
      }))
    ).filter(i => i.sku);

    const skusEsperados = todosItems.map(i => i.sku).join(', ');

    const imgContent = _scanFotos.map(p => ({
      type: 'image', source: { type:'base64', media_type:'image/jpeg', data: p.b64 }
    }));

    const prompt = `Analiza estas imágenes de labels/etiquetas de bultos de almacén.
Para CADA imagen extrae el SKU o código del producto que aparece en la etiqueta.

SKUs esperados en esta orden: ${skusEsperados}

Responde ÚNICAMENTE en JSON:
{
  "resultados": [
    {
      "imagen_num": 1,
      "sku_detectado": "",
      "descripcion": "",
      "coincide": true,
      "area_detectada": "",
      "notas": ""
    }
  ]
}
- "coincide" es true si el SKU detectado está en la lista de esperados
- Si detectas un SKU que NO está en la lista, pon coincide: false y en notas: "SKU NO SOLICITADO"
- imagen_num es el número de imagen (1, 2, 3...)
Solo JSON puro.`;

    const rawText = await callAI([{role:'user', content:[...imgContent, {type:'text',text:prompt}]}], 1500);
    const data = parseJSON(rawText);
    const resultados = data.resultados || [];

    _escaneados = [..._escaneados, ...resultados];
    renderResultadosInspeccion(resultados);
    _scanFotos = [];
    renderScanGrid();
    document.getElementById('btnVerificar').disabled = true;
    actualizarContadoresInspeccion();

  } catch(err) {
    alert('Error IA: ' + err.message);
  } finally {
    hideAI();
  }
}

function renderResultadosInspeccion(nuevos) {
  const cont = document.getElementById('resultadosInspeccion');

  nuevos.forEach((r, i) => {
    const ok = r.coincide === true;
    const esNoSolicitado = (r.notas||'').includes('NO SOLICITADO');

    // Alert if not requested
    if (esNoSolicitado) {
      showAlertaNoSolicitado(r.sku_detectado);
    }

    const div = document.createElement('div');
    div.style.cssText = `display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;
      border:2px solid ${esNoSolicitado?'#f97316':ok?'#22c77a':'#ef4444'};
      background:${esNoSolicitado?'rgba(249,115,22,.06)':ok?'rgba(34,199,122,.06)':'rgba(239,68,68,.06)'};
      margin-bottom:6px;`;
    div.innerHTML = `
      <span style="font-size:20px;">${esNoSolicitado?'⚠️':ok?'✅':'❌'}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-family:monospace;font-weight:700;color:var(--navy);font-size:13px;">${r.sku_detectado||'No detectado'}</div>
        <div style="font-size:11px;color:var(--text-400);">${r.descripcion||''}</div>
        ${r.notas?`<div style="font-size:10px;color:${esNoSolicitado?'#ea6500':'#dc2626'};font-weight:700;">${r.notas}</div>`:''}
      </div>
      <span class="badge ${esNoSolicitado?'badge-orange':ok?'badge-success':'badge-danger'}">
        ${esNoSolicitado?'⚠️ NO SOLICITADO':ok?'✓ OK':'✗ No coincide'}
      </span>`;
    cont.prepend(div);
  });
}

function showAlertaNoSolicitado(sku) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(239,68,68,.92);z-index:999;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
    backdrop-filter:blur(4px);animation:fadeIn .2s;`;
  overlay.innerHTML = `
    <div style="font-size:64px;">⚠️</div>
    <div style="color:white;font-family:'Exo 2',sans-serif;font-size:24px;font-weight:900;text-align:center;">
      ¡SKU NO SOLICITADO!
    </div>
    <div style="color:rgba(255,255,255,.9);font-family:monospace;font-size:20px;font-weight:700;
      background:rgba(0,0,0,.3);padding:8px 24px;border-radius:8px;">
      ${sku}
    </div>
    <div style="color:rgba(255,255,255,.8);font-size:14px;text-align:center;max-width:280px;">
      Este SKU no está en la orden de salida.<br>Verifica con el supervisor antes de continuar.
    </div>
    <button onclick="this.parentElement.remove()" style="background:white;color:#dc2626;border:none;
      padding:12px 32px;border-radius:10px;font-size:16px;font-weight:900;cursor:pointer;
      font-family:'Exo 2',sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3);">
      Entendido
    </button>`;
  document.body.appendChild(overlay);
}

function actualizarContadoresInspeccion() {
  const ok    = _escaneados.filter(r => r.coincide && !(r.notas||'').includes('NO SOLICITADO')).length;
  const warn  = _escaneados.filter(r => (r.notas||'').includes('NO SOLICITADO')).length;
  const fail  = _escaneados.filter(r => !r.coincide && !(r.notas||'').includes('NO SOLICITADO')).length;
  const total = _ordenes.flatMap(o=>o.items||[]).reduce((a,i)=>a+(i.bultos||1),0);

  const el = document.getElementById('inspeccionContador');
  if (el) el.innerHTML = `
    <span style="color:#16a34a;font-weight:700;">✅ ${ok} OK</span> &nbsp;
    <span style="color:#ea6500;font-weight:700;">${warn>0?'⚠️ '+warn+' no solicitado':''}</span> &nbsp;
    <span style="color:#dc2626;font-weight:700;">${fail>0?'❌ '+fail+' no coincide':''}</span>
    <span style="color:var(--text-400);font-size:11px;"> de ~${total} bultos esperados</span>`;

  // Enable next step button
  const btnNext = document.getElementById('btnIrOrdenDefinitiva');
  if (btnNext) btnNext.disabled = (_escaneados.length === 0);
}

/* ══════════════════════════════════════════════════════
   PASO 3 — ORDEN DEFINITIVA (agrupada por SEAL)
   ══════════════════════════════════════════════════════ */

async function generarOrdenDefinitiva() {
  showAI('Generando orden definitiva...', 'Agrupando todas las sub-órdenes por SEAL');
  try {
    const seal = document.getElementById('sealInput')?.value || '—';
    const now  = new Date();
    _folioSalida = `SAL-${String(now.getFullYear()).slice(2)}${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getTime()).slice(-6)}`;

    // Group all items by area
    const resumen = _ordenes.map(o => ({
      area: o.area,
      folio_origen: o.folio_origen||'',
      items: o.items||[],
      total_bultos: (o.items||[]).reduce((a,i)=>a+(i.bultos||1),0),
      total_qty: (o.items||[]).reduce((a,i)=>a+(i.cantidad||0),0),
    }));

    _ordenDefin = {
      folio: _folioSalida,
      seal,
      fecha: now.toISOString().split('T')[0],
      ordenes: resumen,
      total_bultos: resumen.reduce((a,o)=>a+o.total_bultos,0),
      total_items: resumen.reduce((a,o)=>a+o.items.length,0),
      inspeccion: {
        ok:    _escaneados.filter(r=>r.coincide).length,
        warn:  _escaneados.filter(r=>(r.notas||'').includes('NO SOLICITADO')).length,
        total: _escaneados.length
      }
    };

    // Save to DB
    const {error} = await sb().from('ordenes_salida').insert({
      folio: _folioSalida,
      seal,
      estado: 'pendiente_sello',
      cliente_id: _user.cliente_id || null,
      ordenes_json: JSON.stringify(resumen),
      inspeccion_json: JSON.stringify(_escaneados),
      operador_id: _user.id,
      fecha: now.toISOString()
    }).select();

    if (error && !error.message.includes('does not exist')) {
      console.warn('DB save warning:', error.message);
    }

    renderOrdenDefinitiva();
    hideAI();
    goStep(3);

  } catch(err) {
    hideAI();
    console.error(err);
    // Continue even if DB save fails
    renderOrdenDefinitiva();
    goStep(3);
  }
}

function renderOrdenDefinitiva() {
  if (!_ordenDefin) return;
  const areaColors = {OPS:'#0d2b7a',ISS:'#7c3aed',RMA:'#dc2626',MRO:'#d97706',DEF:'#16a34a','8106':'#0891b2'};

  document.getElementById('folioDefDisplay').textContent = _ordenDefin.folio;
  document.getElementById('sealDefDisplay').textContent  = _ordenDefin.seal;
  document.getElementById('fechaDefDisplay').textContent = _ordenDefin.fecha;

  const cont = document.getElementById('ordenDefinitivaDetalle');
  cont.innerHTML = _ordenDefin.ordenes.map(o => `
    <div style="border-radius:10px;overflow:hidden;border:1.5px solid var(--border);margin-bottom:8px;">
      <div style="background:${areaColors[o.area]||'#0d2b7a'};padding:8px 12px;display:flex;align-items:center;gap:8px;">
        <span style="color:white;font-weight:800;font-size:13px;">Área ${o.area}</span>
        ${o.folio_origen?`<span style="color:rgba(255,255,255,.5);font-size:10px;">Ref: ${o.folio_origen}</span>`:''}
        <span style="margin-left:auto;color:rgba(255,255,255,.8);font-size:11px;">${o.total_bultos} bultos · ${o.items.length} SKUs</span>
      </div>
      <div style="padding:8px 12px;">
        ${o.items.map(item=>`
          <div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);font-size:12px;">
            <span style="font-family:monospace;font-weight:700;color:var(--navy);min-width:90px;">${item.sku||item.numero_parte||'—'}</span>
            <span style="flex:1;color:var(--text-500);">${item.descripcion||''}</span>
            <span style="color:var(--text-400);">Q:${item.cantidad||0} B:${item.bultos||1}</span>
          </div>`).join('')}
      </div>
    </div>`).join('');

  // Stats
  document.getElementById('statTotalBultos').textContent = _ordenDefin.total_bultos;
  document.getElementById('statTotalItems').textContent  = _ordenDefin.total_items;
  document.getElementById('statBultosOK').textContent    = _ordenDefin.inspeccion.ok;
  const warn = _ordenDefin.inspeccion.warn;
  const warnEl = document.getElementById('statWarnings');
  if (warnEl) { warnEl.textContent = warn; warnEl.parentElement.style.display = warn>0?'block':'none'; }
}

/* ══════════════════════════════════════════════════════
   PASO 4 — FOTO TRANSPORTE + FOTO SELLO
   ══════════════════════════════════════════════════════ */

let _sealFotoB64 = { transporte: null, sello: null };

function addSealFoto(tipo, e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    _sealFotoB64[tipo] = ev.target.result.split(',')[1];
    document.getElementById(`${tipo}PreviewImg`).src = ev.target.result;
    document.getElementById(`${tipo}Preview`).style.display = 'block';
    document.getElementById(`${tipo}UploadArea`).style.display = 'none';
    updateBtnConfirmarSeal();
  };
  r.readAsDataURL(file);
  e.target.value = '';
}

function resetSealFoto(tipo) {
  _sealFotoB64[tipo] = null;
  document.getElementById(`${tipo}Preview`).style.display = 'none';
  document.getElementById(`${tipo}UploadArea`).style.display = 'block';
  updateBtnConfirmarSeal();
}

function updateBtnConfirmarSeal() {
  const btn = document.getElementById('btnConfirmarSeal');
  if (btn) btn.disabled = !(_sealFotoB64.sello); // transporte optional, sello required
}

async function confirmarSeal() {
  if (!_sealFotoB64.sello) { alert('Necesitas la foto del sello'); return; }
  showAI('Verificando sello...', 'La IA confirma que el número de sello coincide');
  try {
    const sealEsperado = _ordenDefin?.seal || document.getElementById('sealInput')?.value || '';
    const imgContent = [];
    if (_sealFotoB64.transporte) imgContent.push({type:'image',source:{type:'base64',media_type:'image/jpeg',data:_sealFotoB64.transporte}});
    imgContent.push({type:'image',source:{type:'base64',media_type:'image/jpeg',data:_sealFotoB64.sello}});

    const prompt = `Analiza ${_sealFotoB64.transporte?'estas imágenes':'esta imagen'}.
${_sealFotoB64.transporte?'La primera imagen es el transporte/troque cargado. La segunda imagen es el sello/seal.':'Esta imagen es el sello/seal del transporte.'}

SELLO ESPERADO según la orden de salida: "${sealEsperado}"

Extrae el número de sello visible en la imagen del sello y verifica si coincide con el esperado.
Responde ÚNICAMENTE en JSON:
{
  "sello_detectado": "",
  "coincide": true,
  "confianza": "alta/media/baja",
  "notas": ""
}
Solo JSON puro.`;

    const rawText = await callAI([{role:'user',content:[...imgContent,{type:'text',text:prompt}]}], 400);
    const data = parseJSON(rawText);

    if (data.coincide === true || data.confianza === 'alta') {
      await completarSalida(data);
    } else {
      hideAI();
      const confirmar = confirm(
        `⚠️ La IA detectó el sello: "${data.sello_detectado}"\n` +
        `Sello esperado: "${sealEsperado}"\n\n` +
        `${data.notas||'No coinciden exactamente.'}\n\n` +
        `¿Deseas completar la salida de todas formas?`
      );
      if (confirmar) await completarSalida(data);
    }
  } catch(err) {
    hideAI();
    alert('Error IA: ' + err.message);
  }
}

async function completarSalida(sealData) {
  showAI('Completando salida...', 'Registrando salida en inventario');
  try {
    const now = new Date();
    let salidas_ok = 0, salidas_manual = 0;

    for (const orden of (_ordenDefin?.ordenes || [])) {
      for (const item of (orden.items || [])) {
        const sku = item.sku || item.numero_parte;
        if (!sku) continue;

        // Check if SKU exists in inventory
        const {data: inv} = await sb().from('inventario')
          .select('id,cantidad,bultos,estado')
          .eq('sku', sku)
          .maybeSingle();

        if (inv) {
          // Update inventory status
          await sb().from('inventario').update({
            activo: false,
            estado: 'salida',
            fecha_salida: now.toISOString().split('T')[0],
            folio_salida: _folioSalida
          }).eq('id', inv.id);
          salidas_ok++;
        } else {
          // SKU not in system (pre-existing) — register movement only, no error
          salidas_manual++;
        }

        // Register movement
        await sb().from('movimientos').insert({
          tipo: 'salida',
          folio: _folioSalida,
          sku,
          cliente_id: _user.cliente_id || null,
          descripcion: item.descripcion || '',
          cantidad: item.cantidad || 1,
          usuario_id: _user.id,
          referencia: _ordenDefin?.seal || '',
          notas: inv ? 'inventario actualizado' : 'salida manual - SKU previo al sistema',
          fecha: now.toISOString()
        });
      }
    }

    // Update order status
    await sb().from('ordenes_salida').update({
      estado: 'completado',
      sello_confirmado: sealData.sello_detectado || _ordenDefin?.seal,
      foto_sello_url: null,
      completado_at: now.toISOString()
    }).eq('folio', _folioSalida);

    // Show final summary
    document.getElementById('folioFinal').textContent = _folioSalida;
    document.getElementById('sealFinal').textContent  = _ordenDefin?.seal || '—';
    document.getElementById('statFinalOK').textContent     = salidas_ok;
    document.getElementById('statFinalManual').textContent = salidas_manual;
    document.getElementById('statFinalBultos').textContent = _ordenDefin?.total_bultos || '—';
    document.getElementById('statFinalAreas').textContent  = (_ordenDefin?.ordenes||[]).map(o=>o.area).join(' + ');

    hideAI();
    goStep(4);

  } catch(err) {
    hideAI();
    alert('Error al completar: ' + err.message);
  }
}

/* ══════════════════════════════════════════════════════
   CARGAR ÓRDENES GUARDADAS (borradores)
   ══════════════════════════════════════════════════════ */

async function loadOrdenesGuardadas() {
  try {
    const {data} = await sb().from('ordenes_salida')
      .select('*')
      .neq('estado','completado')
      .order('created_at',{ascending:false})
      .limit(5);
    if (!data || !data.length) return;
    const cont = document.getElementById('borradorList');
    if (!cont) return;
    cont.innerHTML = data.map(o => `
      <div onclick="cargarBorrador('${o.id}')" style="display:flex;align-items:center;gap:10px;
        padding:10px 12px;border-radius:9px;border:1.5px solid var(--border);background:white;
        cursor:pointer;margin-bottom:6px;transition:all .18s;"
        onmouseover="this.style.borderColor='#f97316'" onmouseout="this.style.borderColor='var(--border)'">
        <span style="font-size:18px;">📋</span>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:13px;color:var(--navy);">${o.folio}</div>
          <div style="font-size:11px;color:var(--text-400);">SEAL: ${o.seal||'—'} · ${new Date(o.fecha||o.created_at).toLocaleDateString('es-MX')}</div>
        </div>
        <span class="badge badge-warning">${o.estado}</span>
      </div>`).join('');
    document.getElementById('borradorSection').style.display = 'block';
  } catch(e) { console.warn('No se cargaron borradores:', e.message); }
}

async function cargarBorrador(id) {
  const {data} = await sb().from('ordenes_salida').select('*').eq('id',id).single();
  if (!data) return;
  _ordenes = JSON.parse(data.ordenes_json||'[]');
  _escaneados = JSON.parse(data.inspeccion_json||'[]');
  document.getElementById('sealInput').value = data.seal||'';
  document.getElementById('sealDetectado').textContent = data.seal||'—';
  renderOrdenesDetectadas();
  goStep(2);
}

/* ── Nav ── */
function goStep(n, manual=false) {
  [1,2,3,4].forEach(i => {
    document.getElementById('panelStep'+i).style.display = i===n?'block':'none';
    document.getElementById('step'+i).className = 'step '+(i<n?'done':i===n?'active':'');
  });
  if (n===2) actualizarContadoresInspeccion();
  if (n===3) { generarOrdenDefinitiva(); return; }
}

function nuevaSalida() {
  _ordenes=[]; _escaneados=[]; _scanFotos=[]; _ordenFotos=[];
  _ordenDefin=null; _sealFotoB64={transporte:null,sello:null};
  renderOrdenFotos(); renderScanGrid();
  ['transportePreview','selloPreview'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.style.display='none';
  });
  ['transporteUploadArea','selloUploadArea'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.style.display='block';
  });
  const ri=document.getElementById('resultadosInspeccion'); if(ri) ri.innerHTML='';
  goStep(1);
}

/* ── AI overlay ── */
function showAI(t,s){
  document.getElementById('aiText').textContent=t;
  document.getElementById('aiSub').textContent=s;
  document.getElementById('aiOverlay').classList.add('show');
}
function hideAI(){ document.getElementById('aiOverlay').classList.remove('show'); }

/* ── Excel / PDF / multi-file upload for orders ── */
async function addOrdenArchivo(e) {
  const files = Array.from(e.target.files);
  for (const file of files) {
    const isImage = file.type.startsWith('image/');
    const r = new FileReader();
    await new Promise(resolve => {
      r.onload = ev => {
        if (isImage) {
          _ordenFotos.push({ b64: ev.target.result.split(',')[1], dataUrl: ev.target.result, file });
        } else {
          // For Excel/PDF: store as base64 document, will be sent to AI as document
          _ordenFotos.push({
            b64: ev.target.result.split(',')[1],
            dataUrl: 'data:application/octet-stream;base64,' + ev.target.result.split(',')[1],
            file,
            isDoc: true,
            mimeType: file.type || 'application/octet-stream'
          });
        }
        resolve();
      };
      r.readAsDataURL(file);
    });
  }
  renderOrdenFotos();
  updateBtnAnalizar();
  e.target.value = '';
}
