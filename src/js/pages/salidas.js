/* ═══════════════════════════════════════════════════════
   salidas.js — Registro de salidas de mercancía
   Depende de: config.js, auth.js
   ═══════════════════════════════════════════════════════ */
'use strict';

let _salidasData = [];

async function initSalidas() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('sFecha').value = today;
  await loadSalidas();
}

async function loadSalidas() {
  const { data, error } = await sb()
    .from('salidas')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) { showToast('Error al cargar salidas', 'error'); return; }
  _salidasData = data || [];
  renderSalidas(_salidasData);
}

function renderSalidas(rows) {
  const tbody = document.getElementById('salidasBody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-300)">Sin salidas registradas</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const estado = r.estado || 'completado';
    return `
      <tr>
        <td><span class="font-mono font-bold text-sm">${r.folio || '—'}</span></td>
        <td class="text-sm">${fmtDate(r.fecha || r.created_at)}</td>
        <td><span class="font-mono">${r.sku || '—'}</span></td>
        <td><strong>${fmtNum(r.bultos)}</strong></td>
        <td>${r.destino || '—'}</td>
        <td>${r.transportista || '—'}</td>
        <td class="text-sm text-muted">${r.operador || '—'}</td>
        <td><span class="status-badge status-${estado}">${estado}</span></td>
      </tr>`;
  }).join('');
}

function filterSalidas() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  if (!q) { renderSalidas(_salidasData); return; }
  renderSalidas(_salidasData.filter(r =>
    (r.folio||'').toLowerCase().includes(q) ||
    (r.sku||'').toLowerCase().includes(q) ||
    (r.destino||'').toLowerCase().includes(q)
  ));
}

// ── Check stock al escribir SKU ───────────────────────────
let _checkTimeout;
function checkStock() {
  clearTimeout(_checkTimeout);
  _checkTimeout = setTimeout(async () => {
    const sku = document.getElementById('sSku').value.trim().toUpperCase();
    const infoEl = document.getElementById('stockInfo');
    if (!sku) { infoEl.style.display = 'none'; return; }
    const { data } = await sb().from('inventario').select('cantidad,descripcion').eq('sku', sku).single();
    if (data) {
      infoEl.style.display = 'block';
      infoEl.innerHTML = `📦 <strong>${data.descripcion}</strong> · Stock disponible: <strong>${fmtNum(data.cantidad)}</strong>`;
      infoEl.style.color = data.cantidad > 0 ? 'var(--text-500)' : '#dc2626';
    } else {
      infoEl.style.display = 'block';
      infoEl.innerHTML = `⚠️ SKU no encontrado`;
      infoEl.style.color = '#dc2626';
    }
  }, 400);
}

// ── Modal ─────────────────────────────────────────────────
function openModalSalida() {
  document.getElementById('modalSalida').classList.add('open');
  document.getElementById('sSku').focus();
}
function closeModalSalida() {
  document.getElementById('modalSalida').classList.remove('open');
  ['sSku','sDestino','sTransportista','sNotas'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('sBultos').value = '1';
  document.getElementById('stockInfo').style.display = 'none';
}

function genFolioSal() {
  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth()+1).padStart(2,'0'), d = String(now.getDate()).padStart(2,'0');
  return `SAL-${y}${m}${d}-${String(Math.floor(Math.random()*9000)+1000)}`;
}

async function guardarSalida() {
  const sku    = document.getElementById('sSku').value.trim().toUpperCase();
  const bultos = parseInt(document.getElementById('sBultos').value) || 0;
  if (!sku || bultos < 1) { showToast('SKU y bultos son requeridos', 'error'); return; }

  // Verificar stock
  const { data: inv } = await sb().from('inventario').select('id,cantidad').eq('sku', sku).single();
  if (!inv) { showToast('SKU no existe en inventario', 'error'); return; }
  if (inv.cantidad < bultos) { showToast(`Stock insuficiente. Disponible: ${inv.cantidad}`, 'error'); return; }

  const user  = currentUser();
  const folio = genFolioSal();

  const { error } = await sb().from('salidas').insert({
    folio,
    sku,
    bultos,
    fecha:         document.getElementById('sFecha').value,
    destino:       document.getElementById('sDestino').value.trim(),
    transportista: document.getElementById('sTransportista').value.trim(),
    notas:         document.getElementById('sNotas').value.trim(),
    operador:      user?.nombre || user?.username,
    estado:        'completado',
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }

  // Descontar del inventario
  await sb().from('inventario').update({ cantidad: inv.cantidad - bultos }).eq('sku', sku);

  showToast(`Salida ${folio} registrada ✓`, 'success');
  closeModalSalida();
  loadSalidas();
}
