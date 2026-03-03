/* martech.js — extracted from original HTML
   Dep: config.js, auth.js, db.js, utils.js, nav.js */

// ── Globals ───────────────────────────────────────────────────────────────
let USER, clienteData;
let photos   = [];
let stream   = null;
let curMode  = 'mp';   // 'mp' | 'maq'
let curSKU    = null;
let curInspNo = null;   // human-readable: E260226-0021
let aiDone    = false;
let bultosRows = [];   // [{pn, desc, po, unidades, piezas, unitWeight, partModel, serial, tracking}]

// ── Init ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  USER = initPage('martech', ['admin','operador']);
  if (!USER) return;

  // Guard: Safran / non-Martech users → redirect to their entry module
  if (USER.rol !== 'admin' && USER.cliente_codigo && USER.cliente_codigo !== 'MARTECH') {
    location.href = 'ai-entry.html'; return;
  }

  // Load MARTECH client data
  const { data } = await db.schema('ideascan').from('clientes')
    .select('*').ilike('nombre','%martech%').maybeSingle();
  clienteData = data;

  await refreshSKU();
  startCamera();
});

// ── Mode ──────────────────────────────────────────────────────────────────
function setMode(mode) {
  curMode = mode;
  document.getElementById('cardMP').classList.toggle('active', mode==='mp');
  document.getElementById('cardMP').classList.toggle('mp', mode==='mp');
  document.getElementById('cardMAQ').classList.toggle('active', mode==='maq');

  const isMaq = mode === 'maq';
  document.getElementById('maqFields').style.display    = isMaq ? '' : 'none';
  document.getElementById('label43mSection').style.display = isMaq ? '' : 'none';
  document.getElementById('panelIcon').textContent      = isMaq ? '⚙️' : '🧪';
  document.getElementById('panelTitle').textContent     = isMaq ? 'Maquinaria — MARTECH' : 'Materia Prima — MARTECH';
  document.getElementById('tipoInfo').innerHTML         = isMaq
    ? '⚙️ Modo: Maquinaria — Label 6×4 + Label 4×3 + Excel'
    : '🧪 Modo: Materia Prima — Label 6×4 + Excel';
  document.getElementById('tipoInfo').style.background = isMaq ? 'rgba(13,43,122,.06)' : 'rgba(34,199,122,.06)';
  document.getElementById('tipoInfo').style.borderColor = isMaq ? 'rgba(13,43,122,.2)' : 'rgba(34,199,122,.2)';
  document.getElementById('tipoInfo').style.color       = isMaq ? '#0d2b7a' : '#16a34a';
  document.getElementById('l6title').textContent        = isMaq ? 'Maquinaria' : 'Materia Prima';

  // Rebuild bultos table headers
  buildBultosTable();
  if (aiDone) renderLabels();
}

// ── SKU / Inspection No. ─────────────────────────────────────────────────
async function refreshSKU() {
  document.getElementById('skuDisplay').textContent = '⏳';
  const prefix = 'MAR';
  curSKU = await generateSKU(prefix);   // MAR2602001 — stored in inventario.sku

  // Build human-readable Inspection No: E + YYMMDD + - + seq (for display & labels)
  const d   = new Date();
  const dd  = String(d.getDate()).padStart(2,'0');
  const mm  = String(d.getMonth()+1).padStart(2,'0');
  const yy  = String(d.getFullYear()).slice(2);
  const seq = curSKU.replace('MAR'+yy+mm,'').padStart(4,'0');  // "0001"
  curInspNo = `E${yy}${mm}${dd}-${seq}`;   // E260226-0021  (display only)

  document.getElementById('skuDisplay').textContent = curInspNo;
}

// ── Camera ────────────────────────────────────────────────────────────────
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 } }, audio:false
    });
    const v = document.getElementById('camVideo');
    v.srcObject = stream; await v.play();
    document.getElementById('camStatus').textContent = '✅ Listo — captura labels y packings';
    document.getElementById('captureBtn').disabled   = false;
  } catch {
    document.getElementById('camStatus').textContent = '📁 Sin cámara — usa "Subir imagen"';
  }
}

function capturePhoto() {
  const v = document.getElementById('camVideo');
  const c = document.createElement('canvas');
  c.width = v.videoWidth||1280; c.height = v.videoHeight||960;
  c.getContext('2d').drawImage(v,0,0);
  addPhoto(c.toDataURL('image/jpeg',0.85));
}

function uploadPhotos(input) {
  [...input.files].forEach(f => { const r=new FileReader(); r.onload=e=>addPhoto(e.target.result); r.readAsDataURL(f); });
  input.value='';
}

function addPhoto(dataUrl) {
  photos.push({dataUrl});
  renderGallery();
  setStep(1,true); setStep(2);
  document.getElementById('analyzeBtn').disabled = false;
  document.getElementById('camStatus').textContent = `✅ Foto ${photos.length} capturada`;
}

function removePhoto(i) {
  photos.splice(i,1); renderGallery();
  if (!photos.length) document.getElementById('analyzeBtn').disabled = true;
}

function renderGallery() {
  const n = photos.length;
  document.getElementById('photoCount').textContent = n;
  document.getElementById('photoBadge').style.display = n?'':'none';
  document.getElementById('photoCountLabel').textContent = n?`(${n})`:'';
  let html = photos.map((p,i) => `
    <div class="photo-thumb">
      <img src="${p.dataUrl}">
      <button class="del-ph" onclick="removePhoto(${i})">✕</button>
      <div class="ph-num">${i+1}</div>
    </div>`).join('');
  html += `<label class="add-photo-btn"><div class="plus">＋</div><div>Agregar</div>
    <input type="file" accept="image/*" multiple style="display:none" onchange="uploadPhotos(this)"></label>`;
  document.getElementById('photoGallery').innerHTML = html;
}

// ── AI Analysis ───────────────────────────────────────────────────────────
async function analyzeWithAI() {
  if (!photos.length) { showToast('Captura al menos una foto','warning'); return; }
  document.getElementById('aiOverlay').classList.add('open');
  document.getElementById('analyzeBtn').disabled = true;
  setStep(2,true); setStep(3);

  const isMaq = curMode === 'maq';
  const prompt = `Eres un sistema WMS logístico. Analiza esta imagen de un label, packing list o etiqueta de carrier.

Extrae TODOS los datos visibles. Busca específicamente:
- PART NUMBER (PN, P/N, Part No, Part Number)
- PO (Purchase Order, P.O.#, PO#)
- DESCRIPCIÓN del material o equipo
- CANTIDAD / UNIDADES (QTY, Units, PCS, Piezas, Unidades)
- TRACKING NUMBER (código alfanumérico largo de carrier)
- CARRIER (FedEx, UPS, DHL, XPO, etc.)
- VENDOR / PROVEEDOR / SHIPPER
- ORIGIN (país/ciudad de origen)
- UNIT WEIGHT (peso por unidad en lbs/kg)
- PESO TOTAL (Total Weight, GW)
${isMaq ? `- PART MODEL (Model, Model No)
- SERIAL NUMBER (S/N, Serial, SER)` : ''}

Responde SOLO con este JSON exacto, sin markdown:
{
  "numero_parte": "string o null",
  "po": "string o null",
  "descripcion": "string o null",
  "cantidad": número_o_null,
  "tracking_number": "string o null",
  "carrier": "string o null",
  "vendor": "string o null",
  "origin": "string o null",
  "unit_weight": "string o null",
  "peso": "string o null",
  ${isMaq ? '"part_model": "string o null",\n  "serial_number": "string o null",' : ''}
  "confianza": número_0_100,
  "campos_detectados": ["lista","de","campos"]
}`;

  try {
    const results = [];
    for (let i=0; i<photos.length; i++) {
      document.getElementById('aiSub').textContent = `Analizando imagen ${i+1} de ${photos.length}...`;
      const base64 = photos[i].dataUrl.split(',')[1];
      const mime   = photos[i].dataUrl.split(';')[0].split(':')[1]||'image/jpeg';
      try {
        const raw    = await callVision(base64, mime, prompt);
        console.log(`[MARTECH AI] img ${i+1}:`, raw);
        if (raw?.error) { console.warn('EF error:', raw.message); continue; }
        const parsed = parseAIJson(raw);
        if (parsed && !parsed.error) results.push(parsed);
      } catch(e) { console.warn(`img ${i+1}:`, e); }
    }

    if (!results.length) {
      showToast('Sin resultados AI. Llena los campos manualmente.','warning');
    } else {
      const merged = mergeAll(results);
      fillForm(merged);
      showConf(merged.confianza||65, merged.campos_detectados||[]);
      aiDone = true;
      setStep(3,true); setStep(4);
      buildBultosTable();
      showToast(`✅ ${merged.campos_detectados?.length||0} campos detectados`,'success');
    }
  } catch(e) {
    showToast('Error AI: '+e.message,'error');
  } finally {
    document.getElementById('aiOverlay').classList.remove('open');
    document.getElementById('analyzeBtn').disabled = false;
  }
}

function parseAIJson(raw) {
  if (raw && typeof raw==='object' && !raw.error) {
    if ('confianza' in raw || 'numero_parte' in raw || 'campos_detectados' in raw) return raw;
  }
  const text = raw?.content?.[0]?.text || raw?.text || JSON.stringify(raw);
  try {
    const clean = text.replace(/```json|```/g,'').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch { return null; }
}

function mergeAll(arr) {
  const keys = ['numero_parte','po','descripcion','cantidad','tracking_number','carrier','vendor','origin','unit_weight','peso','part_model','serial_number'];
  const merged = {};
  keys.forEach(k => {
    merged[k] = arr.map(r=>r[k]).find(v=>v && v!=='null' && String(v).trim()!='') ?? null;
  });
  merged.confianza = Math.max(...arr.map(r=>r.confianza||0));
  const all = new Set();
  arr.forEach(r=>(r.campos_detectados||[]).forEach(c=>all.add(c)));
  merged.campos_detectados = [...all];
  return merged;
}

function fillForm(d) {
  const map = {
    fPN: d.numero_parte, fPO: d.po, fDesc: d.descripcion,
    fUnidades: d.cantidad, fTracking: d.tracking_number,
    fVendor: d.vendor, fOrigin: d.origin,
    fUnitWeight: d.unit_weight, fPeso: d.peso,
    fPartModel: d.part_model, fSerial: d.serial_number,
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val) { el.value = val; el.classList.add('field-auto'); }
  });
  if (d.carrier) {
    const sel = document.getElementById('fCarrier');
    const match = ['FedEx','UPS','DHL','XPO'].find(o=>(d.carrier||'').toUpperCase().includes(o.toUpperCase()));
    sel.value = match || (d.carrier ? 'Otro' : '');
    if (sel.value) sel.classList.add('field-auto');
  }
}

function showConf(pct, campos) {
  document.getElementById('confSection').style.display = '';
  document.getElementById('confPct').textContent = pct+'%';
  const fill = document.getElementById('confFill');
  fill.style.width = pct+'%';
  fill.style.background = pct>=75?'#22c77a':pct>=50?'#f59e0b':'#ef4444';
  document.getElementById('confFields').textContent = campos.length ? 'Detectados: '+campos.join(', ') : '';
}

// ── Steps ─────────────────────────────────────────────────────────────────
function setStep(n, done=false) {
  const el=document.getElementById('s'+n);
  if (!el) return;
  el.classList.remove('active','done');
  el.classList.add(done?'done':'active');
}

// ── Bultos table ──────────────────────────────────────────────────────────
function onBultosChange() {
  buildBultosTable();
  onChg();
}

function buildBultosTable() {
  const n = parseInt(document.getElementById('fBultos').value) || 0;
  if (!n) { document.getElementById('bultosSection').style.display='none'; return; }
  document.getElementById('bultosSection').style.display = '';
  setStep(4,true); setStep(5);

  const isMaq = curMode === 'maq';

  // Build header
  const hdrs = ['#','P/N','Descripción','PO','Unidades','Piezas','Unit Weight lb'];
  if (isMaq) hdrs.push('Part Model','Serial');
  hdrs.push('Tracking');

  document.getElementById('bultosHead').innerHTML = `<tr>${hdrs.map(h=>`<th>${h}</th>`).join('')}</tr>`;

  // Preserve existing data
  while (bultosRows.length < n) {
    const prev = bultosRows[bultosRows.length-1] || {};
    bultosRows.push({
      pn:         prev.pn        || document.getElementById('fPN').value,
      desc:       prev.desc      || document.getElementById('fDesc').value,
      po:         prev.po        || document.getElementById('fPO').value,
      unidades:   prev.unidades  || document.getElementById('fUnidades').value,
      piezas:     prev.piezas    || document.getElementById('fPiezas').value,
      unitWeight: prev.unitWeight|| document.getElementById('fUnitWeight').value,
      partModel:  prev.partModel || document.getElementById('fPartModel')?.value||'',
      serial:     prev.serial    || document.getElementById('fSerial')?.value||'',
      tracking:   prev.tracking  || document.getElementById('fTracking').value,
    });
  }
  bultosRows = bultosRows.slice(0, n);

  let tbody = '';
  for (let i=0; i<n; i++) {
    const r = bultosRows[i];
    const cols = [
      `<td style="color:#666;font-weight:700;text-align:center">${i+1}</td>`,
      `<td><input value="${r.pn||''}" onchange="bultosRows[${i}].pn=this.value;onChg()" placeholder="P/N"></td>`,
      `<td><input value="${r.desc||''}" onchange="bultosRows[${i}].desc=this.value" placeholder="Descripción"></td>`,
      `<td><input value="${r.po||''}" onchange="bultosRows[${i}].po=this.value;onChg()" placeholder="PO"></td>`,
      `<td><input value="${r.unidades||''}" type="number" onchange="bultosRows[${i}].unidades=this.value" style="width:60px"></td>`,
      `<td><input value="${r.piezas||''}" type="number" onchange="bultosRows[${i}].piezas=this.value" style="width:55px"></td>`,
      `<td><input value="${r.unitWeight||''}" onchange="bultosRows[${i}].unitWeight=this.value" style="width:65px" placeholder="lbs"></td>`,
    ];
    if (isMaq) {
      cols.push(`<td><input value="${r.partModel||''}" onchange="bultosRows[${i}].partModel=this.value" placeholder="Model"></td>`);
      cols.push(`<td><input value="${r.serial||''}" onchange="bultosRows[${i}].serial=this.value" placeholder="S/N"></td>`);
    }
    cols.push(`<td><input value="${r.tracking||''}" onchange="bultosRows[${i}].tracking=this.value" placeholder="Tracking"></td>`);
    tbody += `<tr>${cols.join('')}</tr>`;
  }
  document.getElementById('bultosBody').innerHTML = tbody;
}

// ── onChange trigger ──────────────────────────────────────────────────────
function onChg() {
  if (document.getElementById('fBultos').value && aiDone) {
    renderLabels();
    document.getElementById('labelsSection').style.display = '';
    document.getElementById('saveBtn').disabled = false;
    document.getElementById('bultosCount64').textContent = document.getElementById('fBultos').value||1;
  }
}

// ── Gather form data ──────────────────────────────────────────────────────
function gd() {
  const d = new Date();
  return {
    inspNo:     curInspNo||curSKU||'—',
    tipo:       curMode==='maq' ? 'Maquinaria' : 'Materia Prima',
    pn:         document.getElementById('fPN').value,
    po:         document.getElementById('fPO').value,
    desc:       document.getElementById('fDesc').value,
    unidades:   document.getElementById('fUnidades').value,
    piezas:     document.getElementById('fPiezas').value,
    bultos:     document.getElementById('fBultos').value || '1',
    tipoBulto:  document.getElementById('fTipo').value,
    unitWeight: document.getElementById('fUnitWeight').value,
    tracking:   document.getElementById('fTracking').value,
    carrier:    document.getElementById('fCarrier').value,
    vendor:     document.getElementById('fVendor').value,
    origin:     document.getElementById('fOrigin').value,
    peso:       document.getElementById('fPeso').value,
    partModel:  document.getElementById('fPartModel')?.value||'',
    serial:     document.getElementById('fSerial')?.value||'',
    notas:      document.getElementById('fNotas').value,
    fecha:      `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`,
    fechaISO:   d.toISOString().slice(0,10),
    operador:   USER.nombre||USER.username||'—',
  };
}

// ── Labels ────────────────────────────────────────────────────────────────
function renderLabels() {
  const d = gd();
  render64(d, 1);
  if (curMode==='maq') render43m(d);
  document.getElementById('labelsSection').style.display = '';
  document.getElementById('bultosCount64').textContent  = d.bultos;
  document.getElementById('saveBtn').disabled = false;
  setStep(5,true); setStep(6);
}

// ─── Label 6×4 (Materia Prima & Maquinaria) ───────────────────────────────
function render64(d, bNum) {
  const total   = parseInt(d.bultos)||1;
  const bStr    = `${bNum} / ${total}`;
  const rowData = bultosRows[bNum-1] || {};
  const pn      = rowData.pn || d.pn;
  const po      = rowData.po || d.po;
  const piezas  = rowData.piezas || d.piezas;
  const tracking= rowData.tracking || d.tracking;

  // Partida No = zero-padded bulto number
  const partidaNo = String(bNum).padStart(6,'0');

  const html = `
    <div class="label-6x4" id="lbl64">
      <!-- Header: logo + Inspection No -->
      <div class="l6-head">
        <div class="l6-logo-wrap">
          <div class="l6-logo-icon">🌐</div>
          <div class="l6-logo-name">CCA</div>
          <div class="l6-logo-name" style="font-size:9px;">GROUP</div>
          <div class="l6-logo-sub">Connecting Markets</div>
        </div>
        <div class="l6-insp-no">
          <div class="l6-insp-label">Inspection No.</div>
          <div class="l6-insp-val">${d.inspNo}</div>
        </div>
        <div style="text-align:right;">
          <canvas id="qr64" width="72" height="72"></canvas>
        </div>
      </div>

      <!-- Main body: QR left, data right -->
      <div class="l6-body">
        <div class="l6-left">
          <div style="font-size:8px;font-weight:700;color:#666;text-align:center;">QTY BARCODE</div>
          <svg id="bcQty64"></svg>
        </div>
        <div class="l6-right">
          <!-- PN + barcode -->
          <div class="l6-pn-row">
            <div>
              <div class="l6-pn-label">Part Number</div>
              <div class="l6-pn-val">${pn||'—'}</div>
            </div>
            <div class="l6-pn-bc"><svg id="bcPN64"></svg></div>
          </div>
          <!-- QTY -->
          <div class="l6-qty-row">
            <div class="l6-qty-label">QTY</div>
            <svg id="bcQtySmall" style="height:20px;max-width:70px;"></svg>
            <div class="l6-qty-val">${piezas ? Number(piezas).toLocaleString() : '—'}</div>
          </div>
          <!-- Inspection No + Partida -->
          <div class="l6-info-row">
            <div class="l6-info-cell"><span class="l6-ik">Inspection No.</span><span class="l6-iv">${d.inspNo}</span></div>
            <div class="l6-info-cell"><span class="l6-ik">PARTIDA No.</span><span class="l6-iv">${partidaNo}</span></div>
          </div>
          <!-- PO + barcode -->
          <div class="l6-po-row">
            <span class="l6-po-label">PO</span>
            <span class="l6-po-val">${po||'—'}</span>
            <svg id="bcPO64" style="height:22px;max-width:90px;margin-left:6px;"></svg>
          </div>
          <!-- Company -->
          <div class="l6-company">${d.vendor||'MARTECH MEDICAL PRODUCTS'}</div>
        </div>
      </div>

      <!-- Tracking -->
      <div class="l6-track-row">
        <span class="l6-track-label">TRACKING:</span>
        <span class="l6-track-val">${tracking||'—'}</span>
      </div>

      <!-- Footer: date + description -->
      <div class="l6-footer">
        <div class="l6-fecha-wrap">
          <div class="l6-fecha-label">Fecha Entrada</div>
          <div class="l6-fecha-val">${d.fechaISO}</div>
        </div>
        <div class="l6-desc">${d.desc||'—'}</div>
        <div style="font-size:10px;font-weight:700;color:#666;white-space:nowrap;">${bStr}</div>
      </div>
    </div>`;

  document.getElementById('label64Container').innerHTML = html;

  // Barcodes
  const skuForQR = `INSP:${d.inspNo}|PN:${pn}|QTY:${piezas}|PO:${po}|TRACKING:${tracking}|FECHA:${d.fechaISO}`;
  try { QRCode.toCanvas(document.getElementById('qr64'), skuForQR, { width:72, margin:1 }); } catch {}

  const bcTarget = pn||d.inspNo;
  try { JsBarcode('#bcPN64',   bcTarget,          { format:'CODE128', width:1.2, height:28, displayValue:true,  fontSize:9,  textMargin:2, margin:0 }); } catch {}
  try { JsBarcode('#bcQty64',  String(piezas||'1'),{ format:'CODE128', width:1.4, height:40, displayValue:true,  fontSize:10, textMargin:2, margin:0 }); } catch {}
  try { JsBarcode('#bcQtySmall',String(piezas||'1'),{format:'CODE128', width:1.0, height:20, displayValue:false, margin:0 }); } catch {}
  try { JsBarcode('#bcPO64',   po||'000000',       { format:'CODE128', width:1.0, height:22, displayValue:true,  fontSize:9,  textMargin:2, margin:0 }); } catch {}
}

// ─── Label 4×3 Maquinaria ─────────────────────────────────────────────────
function render43m(d) {
  const total = parseInt(d.bultos)||1;
  // Build parts rows from bultosRows
  const partsRows = bultosRows.length
    ? bultosRows.map((r,i) => `
        <tr>
          <td>${r.po||d.po||'—'}</td>
          <td>${r.pn||d.pn||'—'}</td>
          <td style="text-align:right;">${r.piezas||d.piezas||''} ${r.piezas||d.piezas?'PCS':''}</td>
        </tr>`)
    : [`<tr><td>${d.po||'—'}</td><td>${d.pn||'—'}</td><td style="text-align:right;">${d.piezas||''} ${d.piezas?'PCS':''}</td></tr>`];

  document.getElementById('label43mContainer').innerHTML = `
    <div class="label-4x3m" id="lbl43m">
      <!-- Header -->
      <div class="l4m-head">
        <div class="l4m-logo">
          <div class="l4m-logo-icon">🌐</div>
          <div class="l4m-logo-name">CCA GROUP</div>
          <div class="l4m-logo-sub">Connecting Markets</div>
        </div>
        <div class="l4m-ref">
          <div class="l4m-ref-label">Ref / Inspection No.</div>
          <div class="l4m-ref-val">${d.inspNo}</div>
        </div>
      </div>

      <!-- Parts table -->
      <table class="l4m-parts-table">
        <thead>
          <tr>
            <th style="width:90px;">Po</th>
            <th>Part. No</th>
            <th style="width:60px;text-align:right;">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${partsRows.join('')}
        </tbody>
      </table>

      <!-- Bulto count centered -->
      <div style="text-align:center;padding:4px;font-size:12px;font-weight:900;border-bottom:1px solid #ccc;">
        ${total} / ${total}
      </div>

      <!-- Footer -->
      <div class="l4m-footer">
        <div>
          <div class="l4m-fk">Fecha:</div>
          <div class="l4m-fv">${d.fecha.replace(/\//g,'/')}</div>
        </div>
        <div>
          <div class="l4m-fk">Ref:</div>
          <div class="l4m-fv">${d.inspNo}</div>
        </div>
      </div>
    </div>`;
}

// ── Print functions ────────────────────────────────────────────────────────
const PRINT_CSS = `
  body{margin:6px;font-family:Arial,sans-serif;}
  @media print{@page{margin:3mm}}
  .label-6x4,.label-4x3m{background:white;border:1.5px solid #ccc;border-radius:4px;overflow:hidden;page-break-inside:avoid;}
  .l6-head{display:flex;align-items:center;padding:6px 10px;gap:10px;border-bottom:1.5px solid #000;}
  .l6-logo-wrap{display:flex;flex-direction:column;align-items:center;min-width:70px;}
  .l6-logo-name{font-weight:900;font-size:13px;color:#000;line-height:1;}
  .l6-logo-sub{font-size:7px;color:#555;letter-spacing:1px;}
  .l6-insp-no{flex:1;text-align:center;}
  .l6-insp-label{font-size:9px;font-weight:700;color:#555;text-transform:uppercase;}
  .l6-insp-val{font-family:monospace;font-size:20px;font-weight:900;color:#000;}
  .l6-body{display:grid;grid-template-columns:70px 1fr;}
  .l6-left{border-right:1.5px solid #000;padding:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;}
  .l6-right{padding:6px 10px;}
  .l6-pn-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px;}
  .l6-pn-label{font-size:8px;font-weight:700;color:#555;text-transform:uppercase;}
  .l6-pn-val{font-family:monospace;font-size:13px;font-weight:900;color:#000;}
  .l6-pn-bc svg,.l6-po-bc svg{height:28px;max-width:130px;}
  .l6-qty-row{display:flex;align-items:baseline;gap:10px;margin:4px 0;}
  .l6-qty-label{font-size:9px;font-weight:700;color:#555;width:50px;}
  .l6-qty-val{font-size:28px;font-weight:900;color:#000;margin-left:auto;}
  .l6-info-row{display:flex;gap:16px;font-size:10px;margin-top:4px;}
  .l6-info-cell{display:flex;gap:4px;}
  .l6-ik{font-weight:700;color:#333;} .l6-iv{color:#111;}
  .l6-po-row{display:flex;align-items:center;gap:8px;margin-top:3px;}
  .l6-po-label{font-size:8px;font-weight:700;color:#555;min-width:20px;}
  .l6-po-val{font-size:11px;font-weight:700;color:#000;}
  .l6-company{font-size:10px;font-weight:700;color:#000;border-top:1px solid #ddd;padding-top:2px;margin-top:3px;}
  .l6-track-row{border-top:1.5px solid #000;padding:4px 10px;display:flex;align-items:center;gap:8px;}
  .l6-track-label{font-size:10px;font-weight:700;color:#000;min-width:70px;}
  .l6-track-val{font-size:14px;font-weight:900;color:#000;font-family:monospace;}
  .l6-footer{display:flex;align-items:center;gap:8px;border-top:1.5px solid #000;padding:4px 10px;font-size:10px;}
  .l6-fecha-wrap{display:flex;flex-direction:column;}
  .l6-fecha-label{font-size:7px;font-weight:700;color:#555;}
  .l6-fecha-val{font-size:10px;font-weight:700;color:#000;}
  .l6-desc{font-size:10px;font-weight:700;color:#000;flex:1;}
  /* 4x3 maq */
  .l4m-head{display:flex;align-items:center;padding:5px 8px;border-bottom:1.5px solid #000;gap:8px;}
  .l4m-logo{display:flex;flex-direction:column;align-items:center;min-width:55px;}
  .l4m-logo-name{font-weight:900;font-size:10px;color:#000;}
  .l4m-logo-sub{font-size:6px;color:#555;}
  .l4m-ref{flex:1;text-align:center;}
  .l4m-ref-label{font-size:8px;color:#555;}
  .l4m-ref-val{font-family:monospace;font-size:15px;font-weight:900;color:#000;}
  .l4m-parts-table{width:100%;border-collapse:collapse;font-size:9px;}
  .l4m-parts-table th{background:#f0f0f0;border:1px solid #ccc;padding:3px 6px;font-weight:700;font-size:8px;}
  .l4m-parts-table td{border:1px solid #ccc;padding:3px 6px;}
  .l4m-footer{display:grid;grid-template-columns:1fr 1fr;border-top:1.5px solid #000;padding:4px 8px;gap:4px;font-size:9px;}
  .l4m-fk{font-weight:700;color:#333;} .l4m-fv{color:#000;}
`;

function doPrint(html, title='') {
  const w = window.open('','_blank','width=620,height=820');
  w.document.write(`<html><head><title>${title}</title>
    <style>${PRINT_CSS}</style>
    </head><body onload="window.print()">${html}</body></html>`);
  w.document.close();
}

function printLabel64() {
  const el = document.getElementById('lbl64');
  if (!el) { showToast('Analiza con AI primero','warning'); return; }
  doPrint(el.outerHTML, 'Label 6x4 — '+curSKU);
}

function printAll64() {
  const d      = gd();
  const total  = parseInt(d.bultos)||1;
  let html     = '';

  for (let i=0; i<total; i++) {
    // Re-render with bulto number
    render64(d, i+1);
    const el = document.getElementById('lbl64');
    if (el) html += `<div style="page-break-after:${i<total-1?'always':'auto'}">${el.outerHTML}</div>`;
  }
  // Restore preview to bulto 1
  render64(d, 1);
  doPrint(html, `Labels 6x4 × ${total} — ${curSKU}`);
}

function printLabel43m() {
  const el = document.getElementById('lbl43m');
  if (!el) { showToast('Analiza con AI primero','warning'); return; }
  doPrint(el.outerHTML, 'Label 4x3 Maquinaria — '+curSKU);
}

// ── Excel Export — Merchandise Inspection Report ──────────────────────────
function exportExcel() {
  if (!window.XLSX) { showToast('XLSX no cargado','error'); return; }
  const d     = gd();
  const total = parseInt(d.bultos)||1;
  const isMaq = curMode === 'maq';

  // Use XLSX to create HTML-style workbook matching the original format
  const wb = XLSX.utils.book_new();

  // Build rows array: header block + column headers + data rows
  const rows = [];

  // Title row
  rows.push([`Merchandise Inspection Report — ${d.inspNo}`,'','','','','','','','','','','','']);

  // Info row 1
  rows.push([`Fecha: ${d.fecha}`, '', '', '',
             `Carrier: ${d.carrier||''}`, '', '',
             `Tipo: ${d.tipo}`, '', '',
             `Bultos: ${d.bultos} (${d.tipoBulto||'—'})`, '', '']);

  // Info row 2
  rows.push([`Peso Total: ${d.peso||'—'}`, '', '', '',
             `Operador: ${d.operador}`, '', '', '', '', '', '', '', '']);

  // Empty row
  rows.push(Array(13).fill(''));

  // Column headers
  const hdrs = ['#','Part Number','Descripcion','PO','Unidades','Piezas',
                'unit weight lb','Part Model','Serial number','Tracking Number',
                'Vendor','Origin'];
  if (!isMaq) hdrs.push('Notas');
  rows.push(hdrs);

  // Data rows — one per bulto
  for (let i=0; i<total; i++) {
    const r   = bultosRows[i] || {};
    const row = [
      i+1,
      r.pn        || d.pn,
      r.desc      || d.desc,
      r.po        || d.po,
      r.unidades  || d.unidades,
      r.piezas    || d.piezas,
      r.unitWeight|| d.unitWeight,
      isMaq ? (r.partModel||d.partModel) : '',
      isMaq ? (r.serial||d.serial) : '',
      r.tracking  || d.tracking,
      d.vendor,
      d.origin,
    ];
    if (!isMaq) row.push(d.notas);
    rows.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    {wch:5},{wch:16},{wch:32},{wch:14},{wch:10},{wch:10},
    {wch:14},{wch:16},{wch:18},{wch:22},{wch:22},{wch:14},{wch:20}
  ];

  // Merge title row across 13 cols
  ws['!merges'] = [
    {s:{r:0,c:0}, e:{r:0,c:12}},
    {s:{r:1,c:0}, e:{r:1,c:3}},
    {s:{r:1,c:4}, e:{r:1,c:6}},
    {s:{r:1,c:7}, e:{r:1,c:9}},
    {s:{r:1,c:10},e:{r:1,c:12}},
    {s:{r:2,c:0}, e:{r:2,c:3}},
    {s:{r:2,c:4}, e:{r:2,c:12}},
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
  XLSX.writeFile(wb, `Martech_${d.inspNo}_${d.fechaISO}.xlsx`);
  showToast('✅ Excel descargado: Martech_'+d.inspNo+'.xlsx','success');
}

// ── Save to Supabase ──────────────────────────────────────────────────────
async function saveEntry() {
  const d = gd();
  if (!d.pn) { showToast('Ingresa el Part Number','warning'); return; }
  if (!d.bultos||d.bultos<1) { showToast('Ingresa cantidad de bultos','warning'); return; }

  const btn = document.getElementById('saveBtn');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';

  try {
    const fechaHoy = new Date().toISOString().slice(0, 10);  // DATE type: YYYY-MM-DD

    const payload = {
      sku:             curSKU,                               // MAR2602001
      folio_entrada:   curInspNo || curSKU,                  // E260226-0021
      cliente_id:      clienteData?.id || USER.cliente_id || null,
      almacen_id:      USER.almacen_id || null,
      numero_parte:    d.pn     || null,
      po:              d.po     || null,
      serial_number:   d.serial || null,
      descripcion:     d.desc   || null,
      cantidad:        parseInt(d.unidades) || 0,
      bultos:          parseInt(d.bultos)   || 1,
      tipo_bulto:      d.tipoBulto || null,
      tracking_number: d.tracking  || null,
      carrier:         d.carrier   || null,
      vendor:          d.vendor    || null,
      peso:            d.peso      || null,
      part_model:      d.partModel || null,
      area:            'OPS',
      estado:          'activo',
      operador_id:     USER.id,
      fecha_entrada:   fechaHoy,            // DATE not TIMESTAMP
    };

    console.log('[MARTECH SAVE] payload:', payload);
    const { error } = await db.schema('ideascan').from('inventario').insert(payload);
    if (error) throw error;

    // Movement record — fire and forget
    db.schema('ideascan').from('movimientos').insert({
      tipo:       'entrada',
      folio:       curInspNo || curSKU,
      sku:         curSKU,
      cliente_id:  clienteData?.id || USER.cliente_id || null,
      almacen_id:  USER.almacen_id || null,
      cantidad:    parseInt(d.unidades) || 0,
      usuario_id:  USER.id,
      referencia:  d.tracking || d.po || null,
      notas:      `MARTECH ${d.tipo} · ${d.vendor||''} · ${curInspNo||''}`,
      fecha:       new Date().toISOString(),
    }).catch(e => console.warn('movimiento:', e));

    setStep(6,true);
    showToast(`✅ Entrada guardada — ${curInspNo||curSKU}`,'success',5000);
    btn.textContent = '✅ Guardado';

    setTimeout(() => { if (confirm('¿Registrar otra entrada?')) resetAll(); }, 3500);
  } catch(e) {
    console.error('[MARTECH SAVE ERROR]', e);
    showToast('Error al guardar: ' + (e.message || JSON.stringify(e)), 'error');
    btn.disabled = false; btn.textContent = '💾 Guardar Entrada en Inventario';
  }
}

// ── Reset ─────────────────────────────────────────────────────────────────
async function resetAll() {
  if (stream) { stream.getTracks().forEach(t=>t.stop()); stream=null; }
  photos=[]; aiDone=false; curSKU=null; curInspNo=null; bultosRows=[];

  ['fPN','fPO','fDesc','fUnidades','fPiezas','fBultos','fUnitWeight',
   'fTracking','fVendor','fOrigin','fPeso','fNotas','fPartModel','fSerial'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.value='';el.classList.remove('field-auto');}
  });
  document.getElementById('fCarrier').value='';
  document.getElementById('fTipo').value='';
  document.getElementById('bultosSection').style.display='none';
  document.getElementById('labelsSection').style.display='none';
  document.getElementById('confSection').style.display='none';
  document.getElementById('saveBtn').disabled=true;
  document.getElementById('analyzeBtn').disabled=true;

  for(let i=1;i<=6;i++){
    const el=document.getElementById('s'+i);
    el.classList.remove('active','done');
    if(i===1) el.classList.add('active');
  }

  await refreshSKU();
  startCamera();
  showToast('🔄 Lista para nueva entrada','info');
}
