/* ai-entry.js — extracted from original HTML
   Dep: config.js, auth.js, db.js, utils.js, nav.js */

// ── Globals ───────────────────────────────────────────────────────────────
let USER, clienteData;
let photos   = [];    // [{dataUrl}]
let stream   = null;
let curSKU   = null;
let curArea  = 'OPS';
let aiDone   = false;

// ── Init ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  USER = initPage('ai_entry', ['admin','operador']);
  if (!USER) return;
  // Guard: Martech users → redirect to their entry module
  if (USER.rol !== 'admin' && USER.cliente_codigo === 'MARTECH') {
    location.href = 'martech-entry.html'; return;
  }
  await loadCliente();
  await refreshSKU();
  startCamera();
});

async function loadCliente() {
  if (!USER.cliente_id) {
    document.getElementById('clienteBadge').textContent = 'Sin cliente asignado';
    return;
  }
  const { data } = await db.schema('ideascan').from('clientes')
    .select('*').eq('id', USER.cliente_id).single();
  clienteData = data;
  if (!data) return;
  document.getElementById('clienteBadge').textContent = data.nombre;
  document.getElementById('panelTitle').textContent   = `Entrada — ${data.nombre}`;
  document.getElementById('panelSub').textContent     = `Cliente: ${data.nombre}  ·  Código SKU: ${data.codigo}`;
  // MARTECH export button
  const isMartech = (data.nombre||'').toUpperCase().includes('MARTECH')
                 || (data.codigo||'').toUpperCase().startsWith('MAR');
  if (isMartech) document.getElementById('martechSection').style.display = '';
}

async function refreshSKU() {
  document.getElementById('skuDisplay').textContent = '⏳';
  const codigo = clienteData?.codigo || 'IDX';
  curSKU = await generateSKU(codigo);
  document.getElementById('skuDisplay').textContent = curSKU;
}

// ── Camera ────────────────────────────────────────────────────────────────
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 }, height:{ ideal:960 } },
      audio:false
    });
    const v = document.getElementById('camVideo');
    v.srcObject = stream;
    await v.play();
    document.getElementById('camStatus').textContent  = '✅ Cámara lista — captura las etiquetas del paquete';
    document.getElementById('captureBtn').disabled    = false;
  } catch(e) {
    document.getElementById('camStatus').textContent = '📁 Sin cámara — usa "Subir imagen" para cargar fotos';
    document.getElementById('captureBtn').disabled   = true;
  }
}

function capturePhoto() {
  const v = document.getElementById('camVideo');
  const c = document.createElement('canvas');
  c.width = v.videoWidth || 1280; c.height = v.videoHeight || 960;
  c.getContext('2d').drawImage(v, 0, 0);
  const dataUrl = c.toDataURL('image/jpeg', 0.85);
  addPhoto(dataUrl);
}

function uploadPhotos(input) {
  [...input.files].forEach(file => {
    const r = new FileReader();
    r.onload = e => addPhoto(e.target.result);
    r.readAsDataURL(file);
  });
  input.value = '';
}

function addPhoto(dataUrl) {
  photos.push({ dataUrl });
  renderGallery();
  setStep(1, true); setStep(2);
  document.getElementById('analyzeBtn').disabled = false;
  const n = photos.length;
  document.getElementById('camStatus').textContent = `✅ Foto ${n} capturada — puedes capturar más`;
}

function removePhoto(i) {
  photos.splice(i, 1);
  renderGallery();
  if (!photos.length) document.getElementById('analyzeBtn').disabled = true;
}

function renderGallery() {
  const n = photos.length;
  document.getElementById('photoCount').textContent = n;
  document.getElementById('photoBadge').style.display    = n ? '' : 'none';
  document.getElementById('photoCountLabel').textContent = n ? `(${n})` : '';

  let html = photos.map((p, i) => `
    <div class="photo-thumb">
      <img src="${p.dataUrl}" alt="Foto ${i+1}">
      <button class="del-ph" onclick="removePhoto(${i})">✕</button>
      <div class="ph-num">${i+1}</div>
    </div>`).join('');

  html += `<label class="add-photo-btn">
    <div class="plus">＋</div><div>Agregar</div>
    <input type="file" accept="image/*" multiple style="display:none" onchange="uploadPhotos(this)">
  </label>`;

  document.getElementById('photoGallery').innerHTML = html;
}

// ── Area ──────────────────────────────────────────────────────────────────
function selArea(el, val) {
  document.querySelectorAll('.area-chip').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  curArea = val;
  if (aiDone) renderLabels();
}

function onChg() {
  if (aiDone) {
    renderLabels();
    document.getElementById('bultosCount').textContent = document.getElementById('fBultos').value || 1;
  }
}

// ── AI Analysis ───────────────────────────────────────────────────────────
async function analyzeWithAI() {
  if (!photos.length) { showToast('Captura al menos una foto primero', 'warning'); return; }

  document.getElementById('aiOverlay').classList.add('open');
  document.getElementById('analyzeBtn').disabled = true;
  setStep(2, true); setStep(3);

  const prompt = `Eres un sistema de WMS logístico. Analiza CUIDADOSAMENTE esta imagen de un paquete, etiqueta de envío, factura o guía.

Extrae TODA la información visible. Busca específicamente:
- TRACKING NUMBER: cualquier código alfanumérico largo de 12-30 caracteres (ej. 794644792798, 1Z999AA10123456784)
- CARRIER: FedEx, UPS, DHL, XPO, USPS, u otro carrier
- PART NUMBER (PN, P/N, Part No, Item): código alfanumérico del artículo
- PO (Purchase Order, Orden de Compra, P.O.#)
- SERIAL NUMBER (S/N, Serial, SER)
- DESCRIPCIÓN: nombre o descripción del artículo
- CANTIDAD (QTY, Piezas, Units, Pieces, EA)
- PESO TOTAL (Total Weight, GW, Gross Weight - busca en el panel del carrier)
- VENDOR / SHIPPER / PROVEEDOR: nombre de empresa que envía
- ORIGIN: país o ciudad de origen

Responde SOLO con este JSON exacto (sin markdown, sin texto adicional):
{
  "tracking_number": "string o null",
  "carrier": "FedEx|UPS|DHL|XPO|Otro|null",
  "numero_parte": "string o null",
  "po": "string o null",
  "serial_number": "string o null",
  "descripcion": "string o null",
  "cantidad": "número o null",
  "peso": "string con unidad o null",
  "vendor": "string o null",
  "origin": "string o null",
  "confianza": número_entre_0_y_100,
  "campos_detectados": ["lista", "de", "campos", "encontrados"]
}`;

  try {
    const results = [];
    for (let i = 0; i < photos.length; i++) {
      document.getElementById('aiSub').textContent = `Analizando imagen ${i+1} de ${photos.length}...`;
      const base64 = photos[i].dataUrl.split(',')[1];
      const mime   = photos[i].dataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
      try {
        const raw = await callVision(base64, mime, prompt);
        console.log(`[AI] Imagen ${i+1} raw response:`, raw);

        // Check for EF-level errors
        if (raw?.error) {
          console.warn(`[AI] EF error img ${i+1}:`, raw.error, raw.message);
          showToast('Error AI: ' + (raw.message || raw.error), 'error');
          continue;
        }

        const text   = extractText(raw);
        const parsed = parseJSON(text);
        console.log(`[AI] Imagen ${i+1} parsed:`, parsed);
        if (parsed && !parsed.error) results.push(parsed);
        else if (parsed?.error) console.warn('[AI] Parse error:', parsed);
      } catch(err) {
        console.error(`[AI] Imagen ${i+1} exception:`, err);
      }
    }

    if (!results.length) {
      showToast('No se pudo analizar. Llena los campos manualmente.', 'warning');
    } else {
      const merged = mergeAll(results);
      fillForm(merged);
      showConf(merged.confianza || 65, merged.campos_detectados || []);
      aiDone = true;
      setStep(3, true); setStep(4);
      renderLabels();
      document.getElementById('labelsSection').style.display = '';
      document.getElementById('bultosCount').textContent = document.getElementById('fBultos').value || 1;
      document.getElementById('saveBtn').disabled = false;
      showToast(`✅ AI detectó ${merged.campos_detectados?.length || 0} campos`, 'success');
    }
  } catch(e) {
    showToast('Error AI: ' + e.message, 'error');
  } finally {
    document.getElementById('aiOverlay').classList.remove('open');
    document.getElementById('analyzeBtn').disabled = false;
  }
}

function extractText(raw) {
  // EF returns parsed JSON directly — check if it has our expected fields
  if (raw && typeof raw === 'object' && !raw.error) {
    if ('confianza' in raw || 'tracking_number' in raw || 'numero_parte' in raw || 'campos_detectados' in raw) {
      return JSON.stringify(raw); // already parsed object, re-stringify for parseJSON
    }
  }
  // Fallback: unwrap Anthropic wrapper or stringify
  if (raw?.content?.[0]?.text) return raw.content[0].text;
  if (raw?.text)                return raw.text;
  if (typeof raw === 'string')  return raw;
  return JSON.stringify(raw);
}

function parseJSON(text) {
  try {
    // Direct parse first (EF returns clean JSON object)
    if (typeof text === 'string') {
      const direct = JSON.parse(text);
      if (direct && typeof direct === 'object' && !direct.error) return direct;
    }
  } catch {}
  try {
    const clean = (typeof text === 'string' ? text : JSON.stringify(text)).replace(/```json|```/g,'').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch { return null; }
}

function mergeAll(arr) {
  const keys = ['tracking_number','carrier','numero_parte','po','serial_number','descripcion','cantidad','peso','vendor','origin'];
  const merged = {};
  keys.forEach(k => {
    merged[k] = arr.map(r => r[k]).find(v => v && v !== 'null' && String(v).trim() !== '') ?? null;
  });
  merged.confianza = Math.max(...arr.map(r => r.confianza || 0));
  const all = new Set();
  arr.forEach(r => (r.campos_detectados || []).forEach(c => all.add(c)));
  merged.campos_detectados = [...all];
  return merged;
}

function fillForm(d) {
  const map = { fPN: d.numero_parte, fPO: d.po, fSerial: d.serial_number, fDesc: d.descripcion, fTracking: d.tracking_number, fVendor: d.vendor, fPeso: d.peso };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val) { el.value = val; el.classList.add('field-auto'); }
  });
  if (d.carrier) {
    const sel = document.getElementById('fCarrier');
    const match = ['FedEx','UPS','DHL','XPO'].find(o => (d.carrier||'').toUpperCase().includes(o.toUpperCase()));
    sel.value = match || (d.carrier ? 'Otro' : '');
    if (sel.value) sel.classList.add('field-auto');
  }
  if (d.cantidad) {
    const n = parseInt(d.cantidad);
    if (!isNaN(n)) { document.getElementById('fPiezas').value = n; document.getElementById('fPiezas').classList.add('field-auto'); }
  }
}

function showConf(pct, campos) {
  document.getElementById('confSection').style.display = '';
  document.getElementById('confPct').textContent = pct + '%';
  const fill = document.getElementById('confFill');
  fill.style.width      = pct + '%';
  fill.style.background = pct >= 75 ? '#22c77a' : pct >= 50 ? '#f59e0b' : '#ef4444';
  document.getElementById('confFields').textContent = campos.length
    ? 'Detectados: ' + campos.join(', ')
    : 'No se detectaron campos con certeza';
}

// ── Steps ─────────────────────────────────────────────────────────────────
function setStep(num, done = false) {
  const el = document.getElementById('s'+num);
  if (!el) return;
  el.classList.remove('active','done');
  el.classList.add(done ? 'done' : 'active');
}

// ── Labels ────────────────────────────────────────────────────────────────
function gd() {
  return {
    sku:     curSKU || '—',
    area:    curArea,
    pn:      document.getElementById('fPN').value,
    po:      document.getElementById('fPO').value,
    serial:  document.getElementById('fSerial').value,
    desc:    document.getElementById('fDesc').value,
    piezas:  document.getElementById('fPiezas').value,
    bultos:  document.getElementById('fBultos').value,
    tipo:    document.getElementById('fTipo').value,
    track:   document.getElementById('fTracking').value,
    carrier: document.getElementById('fCarrier').value,
    vendor:  document.getElementById('fVendor').value,
    peso:    document.getElementById('fPeso').value,
    fecha:   (() => {
      const n = new Date();
      return String(n.getMonth()+1).padStart(2,'0') + '/' + String(n.getDate()).padStart(2,'0') + '/' + n.getFullYear();
    })(),
    cliente: clienteData?.nombre || 'CCA Group',
  };
}

function renderLabels() {
  const d = gd();
  render43(d);
  render32(d);
  setStep(4, true); setStep(5);
}

function render43(d, bNum) {
  const totalBultos = parseInt(d.bultos) || 1;
  bNum = bNum || 1;
  const footerStr = `${bNum} / ${totalBultos}`;

  document.getElementById('label43Container').innerHTML = `
    <div class="label-4x3" id="lbl43">

      <!-- Header: CCA Group -->
      <div class="l4-header">${d.cliente || 'CCA Group'}</div>

      <!-- SKU bold + QR top-right -->
      <div class="l4-top">
        <div class="l4-sku-big">${d.sku}</div>
        <div class="l4-qr"><canvas id="qr43"></canvas></div>
      </div>

      <!-- Barcode full-width with SKU text -->
      <div class="l4-bc"><svg id="bc43"></svg></div>

      <!-- Info grid: 2 columns -->
      <div class="l4-info">
        ${d.vendor ? `<div class="l4-row full"><span class="l4-k">Vendor:</span><span class="l4-v">&nbsp;${d.vendor}</span></div>` : ''}
        ${d.track  ? `<div class="l4-row full"><span class="l4-k">Tracking #:</span><span class="l4-v">&nbsp;${d.track}</span></div>` : ''}
        ${d.fecha  ? `<div class="l4-row"><span class="l4-k">Date:</span><span class="l4-v">&nbsp;${d.fecha}</span></div>` : ''}
        ${d.carrier? `<div class="l4-row"><span class="l4-k">Carrier:</span><span class="l4-v">&nbsp;${d.carrier}</span></div>` : ''}
        ${d.pn     ? `<div class="l4-row"><span class="l4-k">P/N:</span><span class="l4-v">&nbsp;${d.pn}</span></div>` : ''}
        ${d.po     ? `<div class="l4-row"><span class="l4-k">PO:</span><span class="l4-v">&nbsp;${d.po}</span></div>` : ''}
        ${d.serial ? `<div class="l4-row"><span class="l4-k">S/N:</span><span class="l4-v">&nbsp;${d.serial}</span></div>` : ''}
        ${d.peso   ? `<div class="l4-row"><span class="l4-k">Peso:</span><span class="l4-v">&nbsp;${d.peso}</span></div>` : ''}
      </div>

      <!-- Area -->
      <div class="l4-area-wrap">
        <div class="l4-area-label">Area</div>
        <div class="l4-area-val">${d.area || 'OPS'}</div>
      </div>

      <!-- Footer: bulto counter -->
      <div class="l4-footer" id="l4footer">${footerStr}</div>

    </div>`;

  // Barcode — SKU text shown below bars
  try {
    JsBarcode('#bc43', d.sku, {
      format:'CODE128', width:1.8, height:44,
      displayValue:true, fontSize:11, fontOptions:'',
      font:'monospace', textMargin:3, margin:0,
    });
  } catch(e) { console.warn('Barcode 4x3:', e); }

  // QR — all key info
  try {
    const qrData = [d.sku, d.area, d.vendor, d.track, d.carrier, d.fecha, d.pn, d.po, d.serial]
      .filter(Boolean).join('|');
    QRCode.toCanvas(document.getElementById('qr43'), qrData || d.sku, {
      width:68, margin:1, color:{ dark:'#000', light:'#fff' }
    });
  } catch(e) { console.warn('QR 4x3:', e); }
}

function render32(d) {
  // Same layout as 4x3 but NO QR code. Always 1 per entry (no per-bulto numbering).
  document.getElementById('label32Container').innerHTML = `
    <div class="label-3x2" id="lbl32">

      <!-- Header -->
      <div class="l4-header">${d.cliente || 'CCA Group'}</div>

      <!-- SKU big (no QR) -->
      <div class="l4-top" style="justify-content:flex-start;">
        <div class="l4-sku-big">${d.sku}</div>
      </div>

      <!-- Barcode -->
      <div class="l4-bc"><svg id="bc32"></svg></div>

      <hr class="l4-divider">

      <!-- Info rows -->
      <div class="l4-info">
        ${d.vendor  ? `<div class="l4-row"><span class="l4-k">Vendor:</span><span class="l4-v">${d.vendor}</span></div>` : ''}
        <div class="l4-row"><span class="l4-k">Date:</span><span class="l4-v">${d.fecha}</span></div>
        ${d.track   ? `<div class="l4-row"><span class="l4-k">Tracking #:</span><span class="l4-v">${d.track}</span></div>` : ''}
        ${d.carrier ? `<div class="l4-row"><span class="l4-k">Carrier:</span><span class="l4-v">${d.carrier}</span></div>` : ''}
        ${d.pn      ? `<div class="l4-row"><span class="l4-k">P/N:</span><span class="l4-v">${d.pn}</span></div>` : ''}
        ${d.po      ? `<div class="l4-row"><span class="l4-k">PO:</span><span class="l4-v">${d.po}</span></div>` : ''}
      </div>

      <!-- Area -->
      <div class="l4-area-wrap">
        <div class="l4-area-label">Area</div>
        <div class="l4-area-val">${d.area}</div>
      </div>

      <!-- Footer: total bultos (no per-label number) -->
      <div class="l4-footer">${d.bultos ? d.bultos + (d.tipo ? ' ' + d.tipo : '') + (parseInt(d.bultos)>1 ? 's' : '') : ''}</div>

    </div>`;

  try {
    JsBarcode('#bc32', d.sku, {
      format:'CODE128', width:1.6, height:48,
      displayValue:true, fontSize:12, font:'monospace',
      textMargin:4, margin:0,
    });
  } catch(e) { console.warn('bc32:', e); }
}

// ── Print ─────────────────────────────────────────────────────────────────
const LABEL_CSS = `
  /* ── Label 4×3 print ── */
  .label-4x3,.label-3x2{
    font-family:Arial,sans-serif;background:white;
    border:1px solid #ddd;border-radius:6px;
    overflow:hidden;page-break-inside:avoid;
  }
  .l4-header{
    text-align:center;padding:6px 10px 5px;
    font-size:12px;font-weight:700;color:#333;
    border-bottom:1px solid #ddd;background:#fff;
  }
  .l4-top{display:flex;align-items:center;justify-content:space-between;padding:8px 12px 2px;gap:8px;}
  .l4-sku-big{font-family:Arial,sans-serif;font-size:24px;font-weight:900;color:#000;letter-spacing:.5px;line-height:1;flex:1;}
  .l4-qr{flex-shrink:0;}
  .l4-qr canvas{width:68px!important;height:68px!important;display:block;}
  .l4-bc{padding:2px 12px 4px;text-align:center;}
  .l4-bc svg{width:100%;height:44px;display:block;}
  .l4-info{border-top:1px solid #ddd;padding:5px 12px 4px;display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;}
  .l4-row{display:flex;align-items:baseline;gap:4px;min-width:0;}
  .l4-row.full{grid-column:span 2;}
  .l4-k{font-size:10.5px;font-weight:700;color:#000;white-space:nowrap;}
  .l4-v{font-size:10.5px;font-weight:400;color:#111;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .l4-area-wrap{border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:3px 12px;text-align:center;}
  .l4-area-label{font-size:9px;font-style:italic;color:#555;margin-bottom:1px;}
  .l4-area-val{font-size:28px;font-weight:900;color:#000;letter-spacing:3px;}
  .l4-footer{padding:3px 12px;font-size:10px;color:#555;text-align:right;}
`;

function canvasToImg(container) {
  // Replace every <canvas> in the HTML with <img src=dataURL>
  // so they survive serialization into a new window
  const clone = container.cloneNode ? container.cloneNode(true) : (() => {
    const d = document.createElement('div');
    d.innerHTML = container; return d;
  })();
  const origCanvases = container.querySelectorAll ? container.querySelectorAll('canvas')
                                                   : [];
  const cloneCanvases = clone.querySelectorAll('canvas');
  origCanvases.forEach((c, i) => {
    try {
      const img = document.createElement('img');
      img.src    = c.toDataURL('image/png');
      img.width  = c.width  || 68;
      img.height = c.height || 68;
      img.style.cssText = c.style.cssText;
      cloneCanvases[i]?.replaceWith(img);
    } catch(e) { console.warn('canvas→img:', e); }
  });
  return clone.innerHTML || clone.outerHTML;
}

function doPrint(html, title='Label') {
  // html may contain canvas elements — convert them to <img> first
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  // Replace canvases inside tmp
  tmp.querySelectorAll('canvas').forEach(c => {
    try {
      const img = document.createElement('img');
      img.src = c.toDataURL('image/png');
      img.style.width  = (c.offsetWidth  || 68) + 'px';
      img.style.height = (c.offsetHeight || 68) + 'px';
      img.style.display = 'block';
      c.replaceWith(img);
    } catch(e) {}
  });
  const finalHtml = tmp.innerHTML;

  const w = window.open('','_blank','width=640,height=820');
  if (!w) { showToast('Permite ventanas emergentes para imprimir','warning'); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body{margin:8px;font-family:Arial,sans-serif;}
      @media print{@page{margin:3mm}body{margin:0}}
      ${LABEL_CSS}
    </style>
    </head><body onload="setTimeout(()=>window.print(),300)">${finalHtml}</body></html>`);
  w.document.close();
}

function printLabel43() {
  const el = document.getElementById('lbl43');
  if (!el) { showToast('Primero analiza con AI', 'warning'); return; }
  // Convert canvas to img before serializing
  const tmp = el.cloneNode(true);
  el.querySelectorAll('canvas').forEach((c,i) => {
    try {
      const img = document.createElement('img');
      img.src = c.toDataURL('image/png');
      img.style.width  = (c.offsetWidth  || 68) + 'px';
      img.style.height = (c.offsetHeight || 68) + 'px';
      img.style.display = 'block';
      tmp.querySelectorAll('canvas')[i]?.replaceWith(img);
    } catch(e) {}
  });
  doPrint(tmp.outerHTML, 'Label 4x3 — ' + curSKU);
}

function printLabel32() {
  const el = document.getElementById('lbl32');
  if (!el) { showToast('Primero analiza con AI', 'warning'); return; }
  doPrint(el.outerHTML, 'Label 3x2 — ' + curSKU);  // 3x2 has no canvas
}

async function printAllLabels() {
  const d      = gd();
  const bultos = parseInt(d.bultos) || 1;
  let html     = '';

  for (let i = 0; i < bultos; i++) {
    const num = i + 1; // 1-based
    const footerText = `${num} / ${bultos}`; // "1 / 3", "2 / 3", "3 / 3"

    // Re-render label with correct bulto number, convert canvas→img, grab HTML
    render43(d, num);
    await new Promise(r => setTimeout(r, 80)); // let QR render
    const el43 = document.getElementById('lbl43');
    if (el43) {
      const tmp43 = el43.cloneNode(true);
      el43.querySelectorAll('canvas').forEach((c, i) => {
        try {
          const img = document.createElement('img');
          img.src = c.toDataURL('image/png');
          img.style.width  = (c.offsetWidth  || 68) + 'px';
          img.style.height = (c.offsetHeight || 68) + 'px';
          img.style.display = 'block';
          tmp43.querySelectorAll('canvas')[i]?.replaceWith(img);
        } catch(e) {}
      });
      html += `<div style="page-break-after:${i < bultos-1 ? 'always' : 'auto'}">${tmp43.outerHTML}</div>`;
    }
  }

  // 3x2 — ALWAYS only 1 per entry, appended after all 4x3 labels
  const el32 = document.getElementById('lbl32');
  if (el32) {
    html += `<div style="page-break-before:always;">${el32.outerHTML}</div>`;
  }

  doPrint(html, `Labels × ${bultos} — ${curSKU}`);
}

// ── Martech Excel ─────────────────────────────────────────────────────────
function exportMartech() {
  if (!window.XLSX) { showToast('XLSX no cargado', 'error'); return; }
  const d = gd();
  const row = {
    'SKU': d.sku, 'Fecha': d.fecha, 'Área': d.area,
    'Part Number': d.pn, 'PO': d.po, 'Serial Number': d.serial,
    'Descripción': d.desc, 'Piezas': d.piezas, 'Bultos': d.bultos,
    'Tipo Bulto': d.tipo, 'Tracking Number': d.track,
    'Carrier': d.carrier, 'Vendor': d.vendor, 'Peso': d.peso,
    'Cliente': d.cliente, 'Operador': USER.nombre || USER.username,
  };
  const ws = XLSX.utils.json_to_sheet([row]);
  ws['!cols'] = Object.keys(row).map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Entrada');
  XLSX.writeFile(wb, `MARTECH_${d.sku}_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast('✅ Excel MARTECH descargado', 'success');
}

// ── Save ──────────────────────────────────────────────────────────────────
async function saveEntry() {
  const d = gd();
  if (!d.piezas || d.piezas < 1) { showToast('Ingresa cantidad de piezas', 'warning'); return; }
  if (!d.bultos || d.bultos < 1) { showToast('Ingresa cantidad de bultos', 'warning'); return; }

  const btn = document.getElementById('saveBtn');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';

  try {
    // fecha_entrada is DATE type — send only YYYY-MM-DD
    const fechaHoy = new Date().toISOString().slice(0, 10);

    const payload = {
      sku:             curSKU,
      cliente_id:      clienteData?.id || USER.cliente_id || null,
      almacen_id:      USER.almacen_id || null,
      numero_parte:    d.pn     || null,
      po:              d.po     || null,
      serial_number:   d.serial || null,
      descripcion:     d.desc   || null,
      cantidad:        parseInt(d.piezas) || 0,
      bultos:          parseInt(d.bultos) || 1,
      tipo_bulto:      d.tipo   || null,
      tracking_number: d.track  || null,
      carrier:         d.carrier|| null,
      vendor:          d.vendor || null,
      peso:            d.peso   || null,
      area:            curArea  || 'OPS',
      estado:          'activo',
      operador_id:     USER.id,
      fecha_entrada:   fechaHoy,          // DATE not TIMESTAMP
    };

    console.log('[SAVE] payload:', payload);
    const { error } = await db.schema('ideascan').from('inventario').insert(payload);
    if (error) throw error;

    // Movement record — fire and forget (no .catch() — not supported in Supabase v2)
    (async () => {
      try {
        await db.schema('ideascan').from('movimientos').insert({
          tipo:       'entrada',
          folio:       curSKU,
          sku:         curSKU,
          cliente_id:  clienteData?.id || USER.cliente_id || null,
          almacen_id:  USER.almacen_id || null,
          cantidad:    parseInt(d.piezas) || 0,
          usuario_id:  USER.id,
          referencia:  d.track || d.po || null,
          notas:      `AI Entry · ${d.carrier||''} · ${d.vendor||''}`,
          fecha:       new Date().toISOString(),
        });
      } catch(e) { console.warn('movimiento:', e); }
    })();

    setStep(5, true);
    showToast(`✅ Entrada guardada — SKU: ${curSKU}`, 'success', 5000);
    btn.textContent = '✅ Guardado';

    setTimeout(() => {
      if (confirm('¿Registrar otra entrada?')) resetAll();
    }, 3500);
  } catch(e) {
    console.error('[SAVE ERROR]', e);
    showToast('Error al guardar: ' + (e.message || JSON.stringify(e)), 'error');
    btn.disabled = false;
    btn.textContent = '💾 Guardar Entrada en Inventario';
  }
}

// ── Reset ─────────────────────────────────────────────────────────────────
async function resetAll() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  photos = []; aiDone = false; curSKU = null;

  ['fPN','fPO','fSerial','fDesc','fPiezas','fBultos','fTracking','fVendor','fPeso','fNotas'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value=''; el.classList.remove('field-auto'); }
  });
  ['fCarrier','fTipo'].forEach(id => {
    const el=document.getElementById(id); if(el){el.value='';el.classList.remove('field-auto');}
  });

  document.querySelectorAll('.area-chip').forEach(c=>c.classList.remove('sel'));
  document.querySelector('.area-chip')?.classList.add('sel');
  curArea = 'OPS';

  renderGallery();
  document.getElementById('labelsSection').style.display  = 'none';
  document.getElementById('confSection').style.display    = 'none';
  document.getElementById('saveBtn').disabled             = true;
  document.getElementById('analyzeBtn').disabled          = true;

  for(let i=1;i<=5;i++){
    const el=document.getElementById('s'+i);
    el.classList.remove('active','done');
    if(i===1) el.classList.add('active');
  }

  await refreshSKU();
  startCamera();
  showToast('🔄 Lista para nueva entrada', 'info');
}
