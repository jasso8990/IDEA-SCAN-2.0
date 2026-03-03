/* salidas.js — Salidas Scan con AI
   Dep: config.js, auth.js, db.js, utils.js, nav.js, vision.js, export.js */

'use strict';
// ═══════════════════════════════════════════════════════════
//  GLOBALS
// ═══════════════════════════════════════════════════════════
let USER = null;
let manifest = null;   // { dept, fecha, area, truck, plates, seal, entries:[{sku,bultos}] }
let scanPhotos = [];   // [{dataUrl, scanned:bool, foundSkus:[]}]
let manifestStream = null;
let scanStream     = null;

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  USER = initPage('salidas', ['admin','operador','supervisor','cliente']);
  if (!USER) return;
  startManifestCamera();
  loadBorradores();   // Load saved manifests on startup
});

// ═══════════════════════════════════════════════════════════
//  PHASE HELPERS
// ═══════════════════════════════════════════════════════════
function setPhase(n) {
  for (let i=1; i<=4; i++) {
    const el = document.getElementById('ph'+i);
    el.classList.remove('active','done');
    if (i < n) el.classList.add('done');
    else if (i === n) el.classList.add('active');
  }
}

// ═══════════════════════════════════════════════════════════
//  CAMERAS
// ═══════════════════════════════════════════════════════════
async function startManifestCamera() {
  try {
    manifestStream = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 } }, audio:false
    });
    const v = document.getElementById('manifestVideo');
    v.srcObject = manifestStream; await v.play();
    document.getElementById('manifestCamStatus').textContent = '✅ Listo — captura el manifiesto';
    document.getElementById('manifestCaptureBtn').disabled = false;
  } catch {
    document.getElementById('manifestCamStatus').textContent = '📁 Sin cámara — sube el archivo';
  }
}

async function startScanCamera() {
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 } }, audio:false
    });
    const v = document.getElementById('scanVideo');
    v.srcObject = scanStream; await v.play();
    document.getElementById('scanCamStatus').textContent = '✅ Listo — apunta a los bultos';
    document.getElementById('scanCaptureBtn').disabled = false;
  } catch {
    document.getElementById('scanCamStatus').textContent = '📁 Sin cámara — sube imágenes';
  }
}

function stopManifestCamera() {
  if (manifestStream) { manifestStream.getTracks().forEach(t=>t.stop()); manifestStream=null; }
}

// ═══════════════════════════════════════════════════════════
//  MANIFEST — UPLOAD / CAPTURE
// ═══════════════════════════════════════════════════════════
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('drag');
  const file = e.dataTransfer?.files?.[0];
  if (file) processManifestFile(file);
}

function handleFileInput(input) {
  const file = input.files?.[0];
  if (file) processManifestFile(file);
  input.value = '';
}

async function captureManifest() {
  const v = document.getElementById('manifestVideo');
  const c = document.createElement('canvas');
  c.width = v.videoWidth||1280; c.height = v.videoHeight||960;
  c.getContext('2d').drawImage(v,0,0);
  const dataUrl = c.toDataURL('image/jpeg',0.9);
  await analyzeManifestImage(dataUrl);
}

async function processManifestFile(file) {
  const ext = file.name.toLowerCase().split('.').pop();
  if (['xlsx','xls'].includes(ext)) {
    await parseExcelManifest(file);
  } else if (ext === 'csv') {
    await parseCSVManifest(file);
  } else if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => analyzeManifestImage(e.target.result);
    reader.readAsDataURL(file);
  } else {
    showToast('Formato no soportado. Usa .xlsx, .xls, .csv o imagen.','warning');
  }
}

// ── Parse Excel ────────────────────────────────────────────
async function parseExcelManifest(file) {
  showAI('Leyendo Excel...','Extrayendo entries del manifiesto');
  try {
    const buf = await file.arrayBuffer();
    const wb  = XLSX.read(buf, { type:'array' });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });

    const result = extractManifestFromRows(rows);
    if (!result.entries.length) throw new Error('No se encontraron entries (SKUs) en el archivo');
    loadManifest(result);
  } catch(e) {
    showToast('Error leyendo Excel: '+e.message,'error');
  } finally { hideAI(); }
}

async function parseCSVManifest(file) {
  const text = await file.text();
  const rows = text.split('\n').map(r => r.split(',').map(c=>c.trim().replace(/"/g,'')));
  const result = extractManifestFromRows(rows);
  if (!result.entries.length) { showToast('No se encontraron entries en el CSV','warning'); return; }
  loadManifest(result);
}

function extractManifestFromRows(rows) {
  const result = { dept:'', fecha:'', area:'', truck:'', plates:'', seal:'', entries:[] };
  const skuRe  = /SAF\d{6,}/i;
  const dateRe = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/;

  rows.forEach(row => {
    const flat = row.join(' ');
    // Date
    if (!result.fecha) { const m=flat.match(dateRe); if(m) result.fecha=m[0]; }
    // Area — look for OPS/ISS/RMA/MRO/8106
    if (!result.area) { const m=flat.match(/\b(OPS|ISS|RMA|MRO|8106)\b/); if(m) result.area=m[1]; }
    // Seal
    if (!result.seal) { const m=flat.match(/UL-[\w\d]+/i); if(m) result.seal=m[0]; }
    // Truck time
    if (!result.truck && /\d+:\d+\s*(a\.?m\.?|p\.?m\.?)/i.test(flat)) {
      const m=flat.match(/\d+:\d+\s*(a\.?m\.?|p\.?m\.?)/i); if(m) result.truck=m[0];
    }
    // Plates
    if (!result.plates && /\d{5}[A-Z]\d/i.test(flat)) {
      const m=flat.match(/\d{5}[A-Z]\d/i); if(m) result.plates=m[0];
    }
    // Dept
    if (!result.dept && /SAFRAN/i.test(flat)) result.dept='SAFRAN';
    // Entries: find SKUs + adjacent number (ECO/bultos)
    row.forEach((cell, ci) => {
      const sku = String(cell).match(skuRe);
      if (sku) {
        let bultos = 1;
        // Look in adjacent cells for a number
        for (let di=-2; di<=2; di++) {
          if (di===0) continue;
          const adj = String(row[ci+di]||'').trim();
          if (/^\d+$/.test(adj) && parseInt(adj)>0 && parseInt(adj)<1000) {
            bultos = parseInt(adj); break;
          }
        }
        result.entries.push({ sku: sku[0].toUpperCase(), bultos, found:false, scannedBultos:0 });
      }
    });
  });
  return result;
}

// ── Analyze manifest image with AI ────────────────────────
async function analyzeManifestImage(dataUrl) {
  showAI('📋 Analizando manifiesto...','La AI está leyendo el documento');
  const base64 = dataUrl.split(',')[1];
  const mime   = dataUrl.split(';')[0].split(':')[1]||'image/jpeg';

  const prompt = `Eres un sistema WMS. Analiza esta imagen de un manifiesto/documento de salida de almacén.

Extrae TODA la información visible. Busca:
- DEPARTMENT o cliente (ej: SAFRAN)
- FECHA (cualquier formato de fecha)
- ÁREA (busca exactamente: OPS, ISS, RMA, MRO, 8106 — aparece en esquina superior derecha)
- TRUCK (hora de llegada del camión)
- PLATES o PLACAS (número de placas del camión, ej: 67015B4)
- SEAL o sello (código alfanumérico, ej: UL-7409902)
- ENTRIES o ECOs: son códigos tipo SAF + números (ej: SAF26021301, SAF26021292)
- Para cada entry/SKU, busca el número de la columna ECO que indica cuántos bultos tiene

Responde SOLO con JSON exacto sin markdown:
{
  "dept": "string",
  "fecha": "string",
  "area": "string",
  "truck": "string",
  "plates": "string",
  "seal": "string",
  "entries": [
    {"sku": "SAF26021301", "bultos": 1},
    {"sku": "SAF26021292", "bultos": 1}
  ],
  "confianza": 85
}`;

  try {
    const raw    = await callVision(base64, mime, prompt);
    console.log('[MANIFEST AI]', raw);
    const parsed = parseAIResult(raw);
    if (!parsed || !parsed.entries?.length) throw new Error('AI no pudo leer entries del documento');

    const result = {
      dept:    parsed.dept    || '',
      fecha:   parsed.fecha   || '',
      area:    parsed.area    || '',
      truck:   parsed.truck   || '',
      plates:  parsed.plates  || '',
      seal:    parsed.seal    || '',
      entries: parsed.entries.map(e => ({
        sku:          (e.sku||'').toUpperCase(),
        bultos:       parseInt(e.bultos)||1,
        found:        false,
        scannedBultos:0,
      })).filter(e=>e.sku),
    };
    loadManifest(result);
    showToast(`✅ ${result.entries.length} entries detectados`,'success');
  } catch(e) {
    console.error(e);
    showToast('Error AI: '+e.message,'error');
  } finally { hideAI(); }
}

function parseAIResult(raw) {
  if (raw && typeof raw === 'object' && !raw.error && raw.entries) return raw;
  const text = raw?.content?.[0]?.text || raw?.text || JSON.stringify(raw);
  try {
    const clean = text.replace(/```json|```/g,'').trim();
    const m = clean.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════
//  LOAD MANIFEST → show phase 2
// ═══════════════════════════════════════════════════════════
function loadManifest(data) {
  manifest = data;
  stopManifestCamera();

  // Update header meta
  document.getElementById('manifestTitle').textContent = `Manifiesto — ${data.dept||'Salida'}`;
  document.getElementById('manifestSub').textContent   = `${data.entries.length} entries · ${data.fecha||'hoy'}`;
  document.getElementById('sealDisplay').textContent   = data.seal || '—';
  document.getElementById('metaDept').textContent      = data.dept  || '—';
  document.getElementById('metaFecha').textContent     = data.fecha || '—';
  document.getElementById('metaArea').textContent      = data.area  || '—';
  document.getElementById('metaTruck').textContent     = data.truck || '—';
  document.getElementById('metaPlates').textContent    = data.plates|| '—';
  document.getElementById('metaTotal').textContent     = data.entries.length;

  // Area badge
  if (data.area) {
    const ab = document.getElementById('areaBadge');
    ab.textContent = data.area; ab.style.display='';
  }

  renderSkuGrid();
  updateProgress();

  // Show phase 2
  document.getElementById('phase1').style.display  = 'none';
  document.getElementById('phase23').style.display = '';
  setPhase(2);
  startScanCamera();
}

// ═══════════════════════════════════════════════════════════
//  SKU GRID
// ═══════════════════════════════════════════════════════════
function renderSkuGrid() {
  const grid = document.getElementById('skuGrid');
  grid.innerHTML = manifest.entries.map((e,i) => `
    <div class="sku-chip ${e.found?'found':''}" id="chip-${i}" title="${e.sku} · ${e.bultos} bulto(s)">
      <div class="sku-dot"></div>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;">${e.sku}</span>
      <span class="sku-bultos">${e.found ? `✓${e.scannedBultos||e.bultos}` : e.bultos+'b'}</span>
    </div>`).join('');
}

function markFound(skuStr) {
  const idx = manifest.entries.findIndex(e => e.sku === skuStr.toUpperCase());
  if (idx === -1) return false;
  if (!manifest.entries[idx].found) {
    manifest.entries[idx].found = true;
    manifest.entries[idx].scannedBultos = manifest.entries[idx].bultos;
    // Animate chip
    const chip = document.getElementById('chip-'+idx);
    if (chip) {
      chip.classList.add('found');
      chip.scrollIntoView({ behavior:'smooth', block:'nearest' });
    }
    return true;
  }
  return false; // already found
}

// ═══════════════════════════════════════════════════════════
//  PROGRESS
// ═══════════════════════════════════════════════════════════
function updateProgress() {
  if (!manifest) return;
  const total  = manifest.entries.length;
  const found  = manifest.entries.filter(e=>e.found).length;
  const pct    = total ? Math.round(found/total*100) : 0;

  document.getElementById('progFill').style.width = pct+'%';
  document.getElementById('progText').textContent  = `${found} / ${total} identificados`;
  document.getElementById('progPct').textContent   = pct+'%';
  document.getElementById('statFound').textContent  = found;
  document.getElementById('statPending').textContent= total-found;
  document.getElementById('statTotal').textContent  = total;

  // Confirm button
  const confirmSec = document.getElementById('confirmSection');
  if (found > 0) {
    confirmSec.style.display = '';
    document.getElementById('confirmBadge').textContent = `${found} / ${total}`;
  }
  if (pct === 100) {
    setPhase(3);
    showScanToast('🎉 ¡Todos los entries identificados!','green');
    document.getElementById('confirmSection').style.display='';
  }
}

// ═══════════════════════════════════════════════════════════
//  SCAN PHOTOS
// ═══════════════════════════════════════════════════════════
function captureForScan() {
  const v = document.getElementById('scanVideo');
  const c = document.createElement('canvas');
  c.width = v.videoWidth||1280; c.height = v.videoHeight||960;
  c.getContext('2d').drawImage(v,0,0);
  addScanPhoto(c.toDataURL('image/jpeg',0.85));
}

function uploadScanPhotos(input) {
  [...input.files].forEach(f => {
    const r = new FileReader();
    r.onload = e => addScanPhoto(e.target.result);
    r.readAsDataURL(f);
  });
  input.value='';
}

function addScanPhoto(dataUrl) {
  scanPhotos.push({ dataUrl, scanned:false, foundSkus:[] });
  renderPhotoStrip();
  document.getElementById('scanAIBtn').disabled = false;
  document.getElementById('scanCamBadge').style.display = '';
  document.getElementById('scanPhotoCount').textContent = scanPhotos.length;
  document.getElementById('scanBadge').textContent = scanPhotos.length + ' fotos';
}

function renderPhotoStrip() {
  const strip = document.getElementById('photoStrip');
  strip.innerHTML = scanPhotos.map((p,i) => `
    <div class="pthumb ${p.scanned?'scanned':''}" id="pthumb-${i}" onclick="previewPhoto(${i})">
      <img src="${p.dataUrl}" alt="foto ${i+1}">
      ${p.scanned ? `<div class="pthumb-badge">✓${p.foundSkus.length}</div>` : ''}
      <button class="pthumb-del" onclick="event.stopPropagation();removePhoto(${i})">✕</button>
    </div>`).join('');
}

function removePhoto(i) {
  scanPhotos.splice(i,1);
  renderPhotoStrip();
  if (!scanPhotos.length) document.getElementById('scanAIBtn').disabled=true;
}

// ═══════════════════════════════════════════════════════════
//  AI SCAN — detect SKUs in photos
// ═══════════════════════════════════════════════════════════
async function scanAllPending() {
  const pending = scanPhotos.filter(p=>!p.scanned);
  if (!pending.length) { showScanToast('Todas las fotos ya fueron escaneadas','cyan'); return; }

  document.getElementById('scanAIBtn').disabled = true;
  const skuList = manifest.entries.filter(e=>!e.found).map(e=>e.sku).join(', ');

  for (let i=0; i<scanPhotos.length; i++) {
    const p = scanPhotos[i];
    if (p.scanned) continue;

    // Mark as scanning
    const thumb = document.getElementById('pthumb-'+i);
    if (thumb) thumb.classList.add('scanning');

    showAI(
      `🔍 Analizando foto ${i+1} de ${scanPhotos.length}`,
      `Buscando: ${skuList.substring(0,80)}${skuList.length>80?'...':''}`
    );

    const base64 = p.dataUrl.split(',')[1];
    const mime   = p.dataUrl.split(';')[0].split(':')[1]||'image/jpeg';

    const prompt = `Eres un sistema WMS de control de salidas. Analiza esta imagen de bultos/cajas en un almacén.

LISTA DE ENTRIES ESPERADOS (los que buscas):
${manifest.entries.map(e=>`- ${e.sku} (${e.bultos} bulto${e.bultos>1?'s':''})`).join('\n')}

Tu tarea:
1. Identifica TODOS los códigos/entries visibles en la imagen (etiquetas, stickers, labels)
2. Compara con la lista anterior
3. Para cada entry que encuentres, estima su posición aproximada en la imagen (como porcentaje: x%, y% desde esquina superior izquierda)

Responde SOLO con JSON exacto sin markdown:
{
  "encontrados": [
    {
      "sku": "SAF26021301",
      "en_lista": true,
      "posicion": {"x": 25, "y": 40},
      "confianza": 90
    }
  ],
  "no_identificados": ["SAF26021292"],
  "confianza_general": 85
}`;

    try {
      const raw    = await callVision(base64, mime, prompt);
      const parsed = parseAIResult(raw);
      const found  = parsed?.encontrados || [];

      // Update found chips in manifest
      const newFound = [];
      found.forEach(f => {
        if (f.en_lista && f.sku) {
          const wasNew = markFound(f.sku);
          if (wasNew) newFound.push(f.sku);
        }
      });

      p.scanned   = true;
      p.foundSkus = found.map(f=>f.sku);
      p.positions = found;

      // Update AI overlay with chips
      if (newFound.length) {
        const chipsEl = document.getElementById('aiFoundChips');
        chipsEl.innerHTML = newFound.map(s=>`<div class="ai-chip">✓ ${s}</div>`).join('');
        await new Promise(r=>setTimeout(r,600));
      }

      // Thumb done
      if (thumb) { thumb.classList.remove('scanning'); thumb.classList.add('scanned'); }
      renderPhotoStrip();
      updateProgress();
      renderSkuGrid();

      if (newFound.length) {
        showScanToast(`✅ ${newFound.length} nuevo${newFound.length>1?'s':''}: ${newFound.join(', ').substring(0,50)}`, 'green');
      }
    } catch(e) {
      console.error('scan photo', i, e);
      if (thumb) thumb.classList.remove('scanning');
    }
  }

  hideAI();
  document.getElementById('scanAIBtn').disabled = false;
  renderPhotoStrip();
  updateProgress();

  // Check if all done
  const remaining = manifest.entries.filter(e=>!e.found);
  if (remaining.length === 0) {
    showScanToast('🎉 ¡100% completado!', 'green');
  } else {
    showScanToast(`⚠️ Aún faltan: ${remaining.map(e=>e.sku).join(', ').substring(0,60)}`, 'cyan');
  }
}

// ═══════════════════════════════════════════════════════════
//  CONFIRM → EXPORT
// ═══════════════════════════════════════════════════════════
async function confirmAndExport() {
  if (!manifest) return;
  const found   = manifest.entries.filter(e=>e.found).length;
  const total   = manifest.entries.length;
  const missing = total - found;

  document.getElementById('expFound').textContent   = found;
  document.getElementById('expMissing').textContent  = missing;
  document.getElementById('expTotal').textContent    = total;
  document.getElementById('exportSub').textContent   = `${found} identificados · ${missing} pendientes`;

  // Build export SKU grid
  const grid = document.getElementById('exportSkuGrid');
  grid.innerHTML = manifest.entries.map(e => `
    <div class="sku-chip ${e.found?'found':''}" style="opacity:1;">
      <div class="sku-dot"></div>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;">${e.sku}</span>
      <span class="sku-bultos">${e.found ? '✓'+e.bultos : '⚠️'}</span>
    </div>`).join('');

  // ── Save to DB ───────────────────────────────────────────────────────────
  await saveExitToDB();

  // Show phase 4
  document.getElementById('phase23').style.display = 'none';
  document.getElementById('phase4').style.display  = '';
  setPhase(4);
}

async function saveExitToDB() {
  if (!manifest || !USER) return;
  const now      = new Date().toISOString();
  const fechaHoy = now.slice(0, 10);
  const folio    = `SAL-${manifest.seal || manifest.area || 'OUT'}-${fechaHoy}`;

  const foundEntries = manifest.entries.filter(e => e.found);
  if (!foundEntries.length) return;

  try {
    // 1. Insert one movimiento per found entry
    const movRows = foundEntries.map(e => ({
      tipo:       'salida',
      folio:       folio,
      sku:         e.sku,
      descripcion: `Salida ${manifest.dept||''} · Área: ${manifest.area||''} · Seal: ${manifest.seal||''}`,
      cantidad:    e.bultos,
      unidad:      'bultos',
      referencia:  manifest.seal || null,
      notas:       `Dept: ${manifest.dept||''} | Truck: ${manifest.truck||''} | Plates: ${manifest.plates||''} | Fecha doc: ${manifest.fecha||''}`,
      usuario_id:  USER.id,
      cliente_id:  USER.cliente_id || null,
      almacen_id:  USER.almacen_id || null,
      fecha:       now,
    }));

    const { error: movErr } = await db.schema('ideascan').from('movimientos').insert(movRows);
    if (movErr) console.error('[SALIDA] movimientos error:', movErr);

    // 2. Update inventario.estado for each found SKU → 'salida_total'
    for (const e of foundEntries) {
      const { error: invErr } = await db.schema('ideascan').from('inventario')
        .update({
          estado:       'salida_total',
          updated_at:   now,
        })
        .eq('sku', e.sku)
        .eq('estado', 'activo');   // only update active ones
      if (invErr) console.warn('[SALIDA] inventario update SKU:', e.sku, invErr);
    }

    // 3. Store folio for Excel
    manifest._folio = folio;
    console.log('[SALIDA] Saved to DB — folio:', folio, '| entries:', foundEntries.length);
    showToast(`✅ Salida registrada en inventario — ${folio}`, 'success', 5000);

    // Mark draft as completado
    if (currentDraftId) {
      await db.schema('ideascan').from('salidas_borradores')
        .update({ estado: 'completado', updated_at: now })
        .eq('id', currentDraftId)
        .catch(e => console.warn('[DRAFT COMPLETE]', e));
    }

  } catch(err) {
    console.error('[SALIDA] saveExitToDB error:', err);
    showToast('Aviso: salida guardada localmente, error al sincronizar BD', 'warning');
  }
}

// ═══════════════════════════════════════════════════════════
//  EXCEL EXPORT
// ═══════════════════════════════════════════════════════════
function downloadExcel() {
  if (!window.XLSX || !manifest) { showToast('XLSX no disponible','error'); return; }

  const wb = XLSX.utils.book_new();
  const now = new Date();
  const fechaExport = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;

  // ── Sheet 1: Summary ──────────────────────────────────────
  const summaryRows = [
    ['REPORTE DE SALIDA — IDEA SCAN 2.0','','','',''],
    ['','','','',''],
    ['Departamento:', manifest.dept||'—', '', 'Fecha:', manifest.fecha||fechaExport],
    ['Área:', manifest.area||'—', '', 'Truck:', manifest.truck||'—'],
    ['Plates:', manifest.plates||'—', '', 'Seal:', manifest.seal||'—'],
    ['Operador:', USER.nombre||USER.username||'—', '', 'Generado:', fechaExport],
    ['','','','',''],
    ['Total entries:', manifest.entries.length, '', 'Identificados:', manifest.entries.filter(e=>e.found).length],
    ['Pendientes:', manifest.entries.filter(e=>!e.found).length, '', 'Completado:', Math.round(manifest.entries.filter(e=>e.found).length/manifest.entries.length*100)+'%'],
    ['','','','',''],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{wch:18},{wch:22},{wch:4},{wch:16},{wch:22}];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

  // ── Sheet 2: Entries detail ───────────────────────────────
  const headers = ['#', 'ENTRY / SKU', 'ECO (Bultos)', 'Estado', 'Área', 'Fecha Escaneo'];
  const rows = [headers, ...manifest.entries.map((e,i) => [
    i+1,
    e.sku,
    e.bultos,
    e.found ? 'IDENTIFICADO' : 'PENDIENTE',
    manifest.area || '—',
    e.found ? fechaExport : '',
  ])];
  const wsDetail = XLSX.utils.aoa_to_sheet(rows);
  wsDetail['!cols'] = [{wch:5},{wch:18},{wch:14},{wch:16},{wch:10},{wch:16}];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Entries');

  // ── Sheet 3: Pending (not found) ─────────────────────────
  const pending = manifest.entries.filter(e=>!e.found);
  if (pending.length) {
    const wsPend = XLSX.utils.aoa_to_sheet([
      ['ENTRIES PENDIENTES'],[''],
      ['#','ENTRY / SKU','ECO (Bultos)'],
      ...pending.map((e,i)=>[i+1, e.sku, e.bultos])
    ]);
    wsPend['!cols'] = [{wch:5},{wch:18},{wch:14}];
    XLSX.utils.book_append_sheet(wb, wsPend, 'Pendientes');
  }

  const fecha = (manifest.fecha||fechaExport).replace(/\//g,'-');
  XLSX.writeFile(wb, `Salida_${manifest.dept||'Reporte'}_${fecha}_${manifest.seal||'NoSeal'}.xlsx`);
  showToast('✅ Excel descargado','success');
}

// ═══════════════════════════════════════════════════════════
//  EMAIL
// ═══════════════════════════════════════════════════════════
function sendEmail() {
  if (!manifest) return;
  const found   = manifest.entries.filter(e=>e.found);
  const missing = manifest.entries.filter(e=>!e.found);
  const subject = encodeURIComponent(`Reporte Salida ${manifest.dept||''} — ${manifest.fecha||''} — Seal: ${manifest.seal||''}`);
  const body    = encodeURIComponent(
    `Reporte de Salida IDEA Scan 2.0\n\n`+
    `Departamento: ${manifest.dept||'—'}\nFecha: ${manifest.fecha||'—'}\n`+
    `Área: ${manifest.area||'—'} | Truck: ${manifest.truck||'—'} | Plates: ${manifest.plates||'—'}\n`+
    `Seal: ${manifest.seal||'—'}\n\n`+
    `IDENTIFICADOS (${found.length}):\n`+
    found.map(e=>`  ✓ ${e.sku} — ${e.bultos} bulto(s)`).join('\n')+
    (missing.length ? `\n\nPENDIENTES (${missing.length}):\n`+missing.map(e=>`  ⚠️ ${e.sku} — ${e.bultos} bulto(s)`).join('\n') : '\n\n✅ Todos los entries identificados.')+
    `\n\nOperador: ${USER.nombre||USER.username||'—'}\nGenerado por IDEA Scan 2.0`
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
  showToast('📧 Abriendo cliente de correo...','info');
}

// ═══════════════════════════════════════════════════════════
//  BORRADORES — Save / Load / Delete manifests
// ═══════════════════════════════════════════════════════════
let currentDraftId = null;   // ID of the borrador being edited

async function loadBorradores() {
  const list = document.getElementById('borradoresList');
  const countEl = document.getElementById('borradoresCount');
  if (!list) return;

  list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-300);font-size:12px;">⏳ Cargando...</div>`;
  try {
    let q = db.schema('ideascan').from('salidas_borradores')
      .select('id,folio,dept,fecha_doc,area,seal,entries,estado,created_at,updated_at')
      .neq('estado','completado')
      .order('updated_at', { ascending: false })
      .limit(20);
    if (USER.cliente_id) q = q.eq('cliente_id', USER.cliente_id);

    const { data, error } = await q;
    if (error) throw error;

    const items = data || [];
    countEl.textContent = items.length;

    if (!items.length) {
      list.innerHTML = `<div style="padding:28px;text-align:center;color:var(--text-300);">
        <div style="font-size:28px;margin-bottom:8px;">📂</div>
        <div style="font-size:12px;">No hay manifiestos guardados</div>
        <div style="font-size:11px;margin-top:4px;">Carga un Excel o fotografía el documento y guarda el manifiesto para retomarlo después</div>
      </div>`;
      return;
    }

    list.innerHTML = items.map(b => {
      const entries = b.entries || [];
      const found   = entries.filter(e=>e.found).length;
      const total   = entries.length;
      const pct     = total ? Math.round(found/total*100) : 0;
      const stateIcon = { pendiente:'⏳', en_proceso:'🔄' }[b.estado] || '📋';
      const fecha = b.fecha_doc || fmtDate(b.created_at);
      return `<div class="borrador-item">
        <div class="borrador-icon ${b.estado}">${stateIcon}</div>
        <div class="borrador-info">
          <div class="borrador-folio">${b.folio}</div>
          <div class="borrador-meta">
            ${b.dept||''}${b.dept&&b.area?' · ':''}${b.area||''} · ${total} entries · ${fecha}
            ${b.seal ? ` · Seal: ${b.seal}` : ''}
          </div>
          <div class="borrador-progress">
            <div class="borrador-progress-fill" style="width:${pct}%"></div>
          </div>
          <div style="font-size:9px;color:var(--text-300);margin-top:2px;">${found}/${total} identificados (${pct}%)</div>
        </div>
        <div class="borrador-actions">
          <button class="borrador-btn open" onclick="event.stopPropagation();openDraft('${b.id}')">
            ${b.estado==='en_proceso'?'▶ Continuar':'▶ Abrir'}
          </button>
          <button class="borrador-btn del" onclick="event.stopPropagation();deleteDraft('${b.id}','${b.folio}')">🗑</button>
        </div>
      </div>`;
    }).join('');

  } catch(e) {
    console.error('[BORRADORES] load error:', e);
    list.innerHTML = `<div style="padding:20px;text-align:center;color:#dc2626;font-size:12px;">Error al cargar: ${e.message}</div>`;
  }
}

async function saveManifestDraft() {
  if (!manifest) return;
  const btn = document.getElementById('saveDraftBtn');
  btn.textContent = '⏳ Guardando...';
  btn.disabled = true;

  try {
    const now = new Date().toISOString();
    // Determine estado
    const found = manifest.entries.filter(e=>e.found).length;
    const estado = found > 0 ? 'en_proceso' : 'pendiente';
    const folio  = manifest._folio || `SAL-${manifest.seal||manifest.area||'OUT'}-${now.slice(0,10)}`;

    const payload = {
      folio,
      dept:       manifest.dept       || null,
      fecha_doc:  manifest.fecha      || null,
      area:       manifest.area       || null,
      truck:      manifest.truck      || null,
      plates:     manifest.plates     || null,
      seal:       manifest.seal       || null,
      entries:    manifest.entries,
      estado,
      cliente_id: USER.cliente_id     || null,
      almacen_id: USER.almacen_id     || null,
      operador_id: USER.id,
      updated_at: now,
    };

    let result;
    if (currentDraftId) {
      // Update existing
      result = await db.schema('ideascan').from('salidas_borradores')
        .update(payload)
        .eq('id', currentDraftId);
    } else {
      // Insert new
      result = await db.schema('ideascan').from('salidas_borradores')
        .insert(payload)
        .select('id')
        .single();
      if (result.data?.id) {
        currentDraftId = result.data.id;
        manifest._folio = folio;
      }
    }

    if (result.error) throw result.error;
    showToast('💾 Manifiesto guardado — puedes continuar después', 'success', 4000);
    btn.textContent = '✅ Guardado';
    setTimeout(() => { btn.textContent = '💾 Guardar'; btn.disabled = false; }, 2500);
  } catch(e) {
    console.error('[SAVE DRAFT]', e);
    showToast('Error al guardar: ' + e.message, 'error');
    btn.textContent = '💾 Guardar';
    btn.disabled = false;
  }
}

async function openDraft(id) {
  showAI('📂 Cargando manifiesto...', 'Restaurando entries guardados');
  try {
    const { data, error } = await db.schema('ideascan').from('salidas_borradores')
      .select('*').eq('id', id).single();
    if (error) throw error;

    currentDraftId = id;
    const restored = {
      dept:    data.dept    || '',
      fecha:   data.fecha_doc || '',
      area:    data.area    || '',
      truck:   data.truck   || '',
      plates:  data.plates  || '',
      seal:    data.seal    || '',
      entries: (data.entries || []).map(e => ({
        sku:           e.sku,
        bultos:        e.bultos   || 1,
        found:         e.found    || false,
        scannedBultos: e.scannedBultos || 0,
      })),
      _folio:  data.folio,
    };

    // Update estado to en_proceso
    await db.schema('ideascan').from('salidas_borradores')
      .update({ estado: 'en_proceso', updated_at: new Date().toISOString() })
      .eq('id', id);

    loadManifest(restored);
    showToast(`✅ Manifiesto restaurado — ${restored.entries.length} entries`, 'success', 3000);
  } catch(e) {
    console.error('[OPEN DRAFT]', e);
    showToast('Error al abrir: ' + e.message, 'error');
  } finally { hideAI(); }
}

async function deleteDraft(id, folio) {
  if (!confirm(`¿Eliminar el manifiesto "${folio}"?`)) return;
  try {
    const { error } = await db.schema('ideascan').from('salidas_borradores')
      .delete().eq('id', id);
    if (error) throw error;
    showToast('🗑 Manifiesto eliminado', 'info');
    loadBorradores();
  } catch(e) {
    showToast('Error al eliminar: ' + e.message, 'error');
  }
}

// Auto-save draft every 60 seconds if manifest is loaded
setInterval(async () => {
  if (manifest && currentDraftId) {
    const payload = {
      entries:    manifest.entries,
      estado:     manifest.entries.filter(e=>e.found).length > 0 ? 'en_proceso' : 'pendiente',
      updated_at: new Date().toISOString(),
    };
    await db.schema('ideascan').from('salidas_borradores')
      .update(payload).eq('id', currentDraftId)
      .catch(e => console.warn('[AUTOSAVE]', e));
  }
}, 60000);

// ═══════════════════════════════════════════════════════════
//  RESET
// ═══════════════════════════════════════════════════════════
function resetAll() {
  manifest       = null;
  scanPhotos     = [];
  currentDraftId = null;
  if (scanStream) { scanStream.getTracks().forEach(t=>t.stop()); scanStream=null; }

  document.getElementById('phase1').style.display  = '';
  document.getElementById('phase23').style.display = 'none';
  document.getElementById('phase4').style.display  = 'none';
  setTimeout(loadBorradores, 200);  // Refresh list after reset
  document.getElementById('areaBadge').style.display = 'none';
  document.getElementById('photoStrip').innerHTML  = '';
  document.getElementById('scanAIBtn').disabled    = true;
  document.getElementById('scanCaptureBtn').disabled=true;
  document.getElementById('confirmSection').style.display='none';
  document.getElementById('scanBadge').textContent = '0 fotos';
  document.getElementById('scanPhotoCount').textContent = '0';
  document.getElementById('scanCamBadge').style.display = 'none';
  setPhase(1);
  startManifestCamera();
}

// ═══════════════════════════════════════════════════════════
//  SCAN TOAST (top center)
// ═══════════════════════════════════════════════════════════
let toastTimer = null;
function showScanToast(msg, type='') {
  const el = document.getElementById('scanToast');
  el.textContent = msg;
  el.className   = 'scan-toast show' + (type?' '+type:'');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ el.classList.remove('show'); }, 3500);
}

// ═══════════════════════════════════════════════════════════
//  AI OVERLAY HELPERS
// ═══════════════════════════════════════════════════════════
function showAI(title, sub) {
  document.getElementById('aiOlText').textContent  = title;
  document.getElementById('aiOlSub').textContent   = sub;
  document.getElementById('aiFoundChips').innerHTML = '';
  document.getElementById('aiOverlay').classList.add('open');
}
function hideAI() {
  document.getElementById('aiOverlay').classList.remove('open');
}

// ═══════════════════════════════════════════════════════════
//  PREVIEW PHOTO (click thumbnail)
// ═══════════════════════════════════════════════════════════
function previewPhoto(i) {
  const p = scanPhotos[i];
  if (!p) return;
  const w = window.open('','_blank','width=800,height=700');
  const tags = (p.positions||[]).map(pos =>
    `<div style="position:absolute;left:${pos.posicion?.x||0}%;top:${pos.posicion?.y||0}%;
      transform:translate(-50%,-50%);background:rgba(34,199,122,.9);color:white;
      font-family:monospace;font-size:11px;font-weight:700;padding:3px 8px;
      border-radius:4px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.4);">
      ${pos.sku}
    </div>`
  ).join('');
  w.document.write(`<html><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;">
    <div style="position:relative;display:inline-block;">
      <img src="${p.dataUrl}" style="max-width:100%;max-height:90vh;display:block;">
      <div style="position:absolute;inset:0;">${tags}</div>
    </div>
  </body></html>`);
  w.document.close();
}
