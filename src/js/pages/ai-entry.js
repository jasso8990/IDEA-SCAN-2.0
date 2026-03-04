/* ═══════════════════════════════════════════════════════
   ai-entry.js — Análisis de imágenes con IA
   Depende de: config.js, auth.js
   NOTA: Requiere configurar ANTHROPIC_KEY en config.js
   ═══════════════════════════════════════════════════════ */
'use strict';

let _imageBase64 = null;
let _detectedSku = null;

function triggerUpload() {
  document.getElementById('fileInput').click();
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    _imageBase64  = dataUrl.split(',')[1]; // solo base64

    document.getElementById('previewImg').src = dataUrl;
    document.getElementById('previewWrap').style.display = 'block';
    document.getElementById('uploadArea').style.display  = 'none';
    document.getElementById('btnAnalyze').disabled       = false;
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  _imageBase64  = null;
  _detectedSku  = null;
  document.getElementById('fileInput').value         = '';
  document.getElementById('previewWrap').style.display = 'none';
  document.getElementById('uploadArea').style.display  = 'block';
  document.getElementById('btnAnalyze').disabled        = true;
  document.getElementById('skuVal').textContent         = '— — —';
  document.getElementById('skuBadge').textContent       = 'pendiente';
  document.getElementById('skuBadge').className         = 'badge badge-gray';
  document.getElementById('resultsCard').style.display  = 'none';
  document.getElementById('emptyCard').style.display    = 'block';
  document.getElementById('saveForm').style.display     = 'none';
}

// ── Análisis con IA (Claude Vision) ──────────────────────
async function analyzeImage() {
  if (!_imageBase64) return;

  document.getElementById('aiOverlay').classList.add('show');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: _imageBase64 }
            },
            {
              type: 'text',
              text: `Analiza esta imagen de un producto o caja de almacén. 
Extrae y responde SOLO con JSON sin ningún texto adicional:
{
  "sku": "código SKU o número de producto detectado (o null si no hay)",
  "descripcion": "descripción breve del producto o caja",
  "codigo_barras": "código de barras si está visible (o null)",
  "cantidad_detectada": número o null,
  "confianza": número del 0 al 100,
  "notas": "observaciones adicionales relevantes"
}`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';

    // Limpiar y parsear JSON
    const clean   = text.replace(/```json|```/g, '').trim();
    const result  = JSON.parse(clean);

    showResults(result);
  } catch (err) {
    console.error('Error IA:', err);
    showToast('Error al analizar la imagen', 'error');
  } finally {
    document.getElementById('aiOverlay').classList.remove('show');
  }
}

function showResults(r) {
  _detectedSku = r.sku;

  // Actualizar SKU display
  document.getElementById('skuVal').textContent = r.sku || '— — —';
  if (r.sku) {
    document.getElementById('skuBadge').textContent  = 'detectado';
    document.getElementById('skuBadge').className    = 'badge badge-success';
    document.getElementById('saveSku').value         = r.sku;
  } else {
    document.getElementById('skuBadge').textContent  = 'no detectado';
    document.getElementById('skuBadge').className    = 'badge badge-warning';
  }

  // Mostrar card de resultados
  document.getElementById('emptyCard').style.display    = 'none';
  document.getElementById('resultsCard').style.display  = 'block';
  document.getElementById('saveForm').style.display     = 'block';

  const conf = r.confianza || 0;
  document.getElementById('resultsBody').innerHTML = `
    <div class="ai-result-item">
      <span class="ai-result-label">SKU</span>
      <span class="ai-result-value">${r.sku || '—'}</span>
    </div>
    <div class="ai-result-item">
      <span class="ai-result-label">Descripción</span>
      <span class="ai-result-value" style="font-family:inherit;text-align:right;max-width:60%">${r.descripcion || '—'}</span>
    </div>
    <div class="ai-result-item">
      <span class="ai-result-label">Código de barras</span>
      <span class="ai-result-value">${r.codigo_barras || '—'}</span>
    </div>
    <div class="ai-result-item">
      <span class="ai-result-label">Cantidad detectada</span>
      <span class="ai-result-value">${r.cantidad_detectada ?? '—'}</span>
    </div>
    <div style="margin-top:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-400);margin-bottom:4px">
        <span>Confianza del análisis</span>
        <strong>${conf}%</strong>
      </div>
      <div class="conf-bar"><div class="conf-fill" style="width:${conf}%"></div></div>
    </div>
    ${r.notas ? `<div style="margin-top:10px;padding:8px;background:var(--surface2);border-radius:8px;font-size:12px;color:var(--text-500)">${r.notas}</div>` : ''}
  `;
}

// ── Guardar entrada desde IA ──────────────────────────────
async function guardarDesdeIA() {
  const sku    = document.getElementById('saveSku').value.trim().toUpperCase();
  const bultos = parseInt(document.getElementById('saveBultos').value) || 1;
  if (!sku) { showToast('Ingresa un SKU', 'error'); return; }

  const user  = currentUser();
  const folio = `ENT-IA-${Date.now()}`;
  const fecha = document.getElementById('saveFecha').value;

  // Verificar si existe en inventario
  const { data: inv } = await sb().from('inventario').select('id,cantidad').eq('sku', sku).single();

  if (inv) {
    // Actualizar stock existente
    await sb().from('inventario').update({ cantidad: (inv.cantidad||0) + bultos }).eq('sku', sku);
  } else {
    // Crear nuevo registro
    await sb().from('inventario').insert({ sku, cantidad: bultos, stock_minimo: 5 });
  }

  // Insertar entrada
  const { error } = await sb().from('entradas').insert({
    folio, sku, bultos, fecha,
    operador: user?.nombre || user?.username,
    notas: '📸 Registrado via análisis IA',
  });

  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast(`✓ Entrada ${folio} guardada`, 'success');
}
