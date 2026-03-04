/* ============================
   AI-SCAN.JS — Claude AI Vision
   ============================ */

let scannedData = null;
let imageBase64  = null;
let imageType    = 'image/jpeg';

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadClientesAI(), loadAlmacenesAI()]);
});

// ── IMAGE HANDLING ────────────────────────────────────────────────────────

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) loadImageFile(file);
}

function handleDrop(event) {
  event.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag-over');
  const file = event.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadImageFile(file);
}

function loadImageFile(file) {
  imageType = file.type || 'image/jpeg';
  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target.result;
    imageBase64  = result.split(',')[1];
    const img    = document.getElementById('preview-img');
    img.src      = result;
    img.classList.remove('hidden');
    document.getElementById('drop-content').style.display = 'none';
    document.getElementById('btn-scan').disabled = false;
    document.getElementById('scan-status').textContent = '✅ Imagen lista · Haz clic en "Escanear"';
  };
  reader.readAsDataURL(file);
}

// ── CAMERA ────────────────────────────────────────────────────────────────

let cameraStream = null;

async function openCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    document.getElementById('camera-video').srcObject = cameraStream;
    openModal('modal-camera');
  } catch {
    showToast('No se pudo acceder a la cámara', 'error');
  }
}

function closeCamera() {
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  closeModal('modal-camera');
}

function capturePhoto() {
  const video  = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const dataURL = canvas.toDataURL('image/jpeg');
  imageBase64   = dataURL.split(',')[1];
  imageType     = 'image/jpeg';

  const img = document.getElementById('preview-img');
  img.src   = dataURL;
  img.classList.remove('hidden');
  document.getElementById('drop-content').style.display = 'none';
  document.getElementById('btn-scan').disabled = false;
  closeCamera();
  showToast('Foto capturada · Listo para escanear', 'success');
}

// ── AI SCAN ───────────────────────────────────────────────────────────────

async function runScan() {
  if (!imageBase64) { showToast('Selecciona una imagen primero', 'error'); return; }

  const btn    = document.getElementById('btn-scan');
  const status = document.getElementById('scan-status');
  btn.disabled    = true;
  btn.textContent = '⟳ Analizando con Claude AI...';
  status.innerHTML = '<div class="scan-loading"><span class="spin">⟳</span> Claude AI está analizando la imagen...</div>';

  document.getElementById('results-body').innerHTML = `
    <div class="ai-scanning">
      <div class="scan-animation">🤖</div>
      <p>Claude AI está extrayendo datos...</p>
    </div>`;

  try {
    const result = await callAIVision(imageBase64, imageType);
    scannedData  = result;
    renderResults(result);
    document.getElementById('save-card').classList.remove('hidden');
    status.innerHTML = '✅ Análisis completo';
    showToast('Datos extraídos correctamente', 'success');
  } catch (err) {
    status.innerHTML = `❌ Error: ${err.message}`;
    document.getElementById('results-body').innerHTML =
      `<div class="ai-placeholder"><p style="color:var(--red)">Error al conectar con Claude AI:</p><p>${err.message}</p></div>`;
    showToast('Error en AI Scanner: ' + err.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = '🤖 Escanear de nuevo';
  }
}

function renderResults(data) {
  const body = document.getElementById('results-body');
  const conf = data.confianza || 0;

  // Confidence badge
  const confEl = document.getElementById('confidence-badge');
  confEl.innerHTML = `<span class="badge ${conf >= 80 ? 'badge-green' : conf >= 50 ? 'badge-yellow' : 'badge-red'}">
    Confianza: ${conf}%
  </span>`;

  const fields = [
    { key:'tracking_number', label:'🔢 Tracking Number', color:'var(--primary)' },
    { key:'carrier',         label:'🚚 Carrier' },
    { key:'numero_parte',    label:'🔧 No. de Parte' },
    { key:'po',              label:'📄 Purchase Order (PO)' },
    { key:'serial_number',   label:'🔑 Serial Number' },
    { key:'descripcion',     label:'📦 Descripción' },
    { key:'cantidad',        label:'🔢 Cantidad' },
    { key:'peso',            label:'⚖️ Peso' },
    { key:'vendor',          label:'🏭 Vendor/Proveedor' },
    { key:'origin',          label:'🌍 Origen' },
  ];

  body.innerHTML = `
    <div class="results-grid">
      ${fields.map(f => {
        const val = data[f.key];
        const hasVal = val !== null && val !== undefined && val !== '';
        return `
          <div class="result-field ${hasVal ? 'has-value' : 'no-value'}">
            <div class="result-label">${f.label}</div>
            <div class="result-value" style="${f.color ? 'color:' + f.color : ''}">${hasVal ? val : '<span style="color:var(--text-muted)">No detectado</span>'}</div>
          </div>`;
      }).join('')}
    </div>
    ${data.campos_detectados?.length ? `
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
        <span style="font-size:11px;color:var(--text-muted)">Campos detectados: </span>
        ${data.campos_detectados.map(c => `<span class="badge badge-blue" style="margin:2px">${c}</span>`).join('')}
      </div>` : ''}`;

  // Pre-fill save form
  if (data.cantidad) document.getElementById('save-cantidad').value = data.cantidad;
}

// ── SAVE TO SUPABASE ──────────────────────────────────────────────────────

async function saveToInventario() {
  if (!scannedData) { showToast('Primero escanea una imagen', 'error'); return; }

  const cliente = document.getElementById('save-cliente').value;
  const almacen = document.getElementById('save-almacen').value;

  if (!cliente || !almacen) {
    showToast('Selecciona cliente y almacén', 'error'); return;
  }

  try {
    const record = {
      sku:             scannedData.numero_parte || scannedData.tracking_number?.slice(-8) || 'AI-' + Date.now(),
      numero_parte:    scannedData.numero_parte    || null,
      descripcion:     scannedData.descripcion      || null,
      carrier:         scannedData.carrier          || null,
      tracking_number: scannedData.tracking_number  || null,
      po:              scannedData.po               || null,
      serial_number:   scannedData.serial_number    || null,
      vendor:          scannedData.vendor           || null,
      origin:          scannedData.origin           || null,
      peso:            String(scannedData.peso || ''),
      cantidad:        parseInt(document.getElementById('save-cantidad').value) || 1,
      bultos:          parseInt(document.getElementById('save-bultos').value)   || 1,
      zona:            document.getElementById('save-zona').value.trim(),
      ubicacion:       document.getElementById('save-ubicacion').value.trim(),
      area:            document.getElementById('save-area').value.trim() || 'OPS',
      cliente_id:      cliente,
      almacen_id:      almacen,
      fecha_entrada:   todayISO(),
      estado:          'activo',
      unidad:          'pz',
    };

    await dbAddInventario(record);
    showToast('✅ Guardado en Supabase (inventario)', 'success');
    document.getElementById('save-card').classList.add('hidden');

    // Also register as entrada movement
    const profile = getLocalProfile();
    await dbAddMovimiento({
      tipo:        'entrada',
      sku:         record.sku,
      descripcion: record.descripcion || record.sku,
      cantidad:    record.cantidad,
      unidad:      record.unidad,
      cliente_id:  cliente,
      almacen_id:  almacen,
      referencia:  record.tracking_number || '',
      notas:       'Registrado vía AI Scanner',
    });

    showToast('Movimiento de entrada registrado', 'success');
  } catch (err) {
    showToast('Error al guardar: ' + err.message, 'error');
  }
}

async function loadClientesAI() {
  try {
    const c   = await dbGetClientes();
    const sel = document.getElementById('save-cliente');
    c.forEach(cl => { const o = document.createElement('option'); o.value = cl.id; o.textContent = cl.nombre; sel.appendChild(o); });
  } catch {}
}

async function loadAlmacenesAI() {
  try {
    const a   = await dbGetAlmacenes();
    const sel = document.getElementById('save-almacen');
    a.forEach(al => { const o = document.createElement('option'); o.value = al.id; o.textContent = al.nombre; sel.appendChild(o); });
  } catch {}
}
