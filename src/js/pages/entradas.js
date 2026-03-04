/* ═══════════════════════════════════════════════════════
   entradas.js — Registro de entradas de mercancía
   Depende de: config.js, auth.js
   ═══════════════════════════════════════════════════════ */
'use strict';

let _entradasData = [];

async function initEntradas() {
  // Poner fecha de hoy por defecto
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('eFecha').value = today;
  await loadEntradas();
}

async function loadEntradas() {
  const { data, error } = await sb()
    .from('entradas')
    .select('*, clientes(nombre), usuarios(nombre)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) { showToast('Error al cargar entradas', 'error'); return; }
  _entradasData = data || [];
  renderEntradas(_entradasData);
}

function renderEntradas(rows) {
  const tbody = document.getElementById('entradasBody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-300)">Sin entradas registradas</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><span class="font-mono font-bold text-sm">${r.folio || '—'}</span></td>
      <td class="text-sm">${fmtDate(r.fecha || r.created_at)}</td>
      <td><span class="font-mono">${r.sku || '—'}</span></td>
      <td>${r.descripcion || '—'}</td>
      <td><strong>${fmtNum(r.bultos)}</strong></td>
      <td>${r.clientes?.nombre || '—'}</td>
      <td class="text-sm text-muted">${r.usuarios?.nombre || r.operador || '—'}</td>
    </tr>`).join('');
}

function filterEntradas() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  if (!q) { renderEntradas(_entradasData); return; }
  renderEntradas(_entradasData.filter(r =>
    (r.folio||'').toLowerCase().includes(q) ||
    (r.sku||'').toLowerCase().includes(q) ||
    (r.clientes?.nombre||'').toLowerCase().includes(q)
  ));
}

// ── Generar folio automático ──────────────────────────────
function genFolio() {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth()+1).padStart(2,'0');
  const d   = String(now.getDate()).padStart(2,'0');
  const r   = String(Math.floor(Math.random()*9000)+1000);
  return `ENT-${y}${m}${d}-${r}`;
}

// ── Modal ─────────────────────────────────────────────────
function openModalEntrada() {
  document.getElementById('modalEntrada').classList.add('open');
  document.getElementById('eSku').focus();
}
function closeModalEntrada() {
  document.getElementById('modalEntrada').classList.remove('open');
  ['eSku','eRef','eNotas'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('eBultos').value = '1';
}

async function guardarEntrada() {
  const sku    = document.getElementById('eSku').value.trim().toUpperCase();
  const bultos = parseInt(document.getElementById('eBultos').value) || 0;
  if (!sku || bultos < 1) { showToast('SKU y cantidad son requeridos', 'error'); return; }

  const user = currentUser();
  const folio = genFolio();

  // Verificar que el SKU exista
  const { data: inv } = await sb().from('inventario').select('id, cantidad, descripcion').eq('sku', sku).single();
  if (!inv) { showToast('SKU no encontrado en inventario', 'error'); return; }

  // Insertar entrada
  const { error } = await sb().from('entradas').insert({
    folio,
    sku,
    descripcion: inv.descripcion,
    bultos,
    fecha:       document.getElementById('eFecha').value,
    referencia:  document.getElementById('eRef').value.trim(),
    notas:       document.getElementById('eNotas').value.trim(),
    operador_id: user.id,
    operador:    user.nombre || user.username,
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }

  // Actualizar inventario
  await sb().from('inventario').update({ cantidad: (inv.cantidad||0) + bultos }).eq('sku', sku);

  showToast(`Entrada ${folio} registrada ✓`, 'success');
  closeModalEntrada();
  loadEntradas();
}
