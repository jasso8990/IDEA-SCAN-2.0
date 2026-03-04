/* ============================
   MOVIMIENTOS.JS — Entradas & Salidas (Supabase)
   ============================ */

let movType  = 'entrada';
let allMovs  = [];

async function initMov(tipo) {
  movType = tipo;
  await Promise.all([loadClientesMov(), loadAlmacenesMov()]);
  await reloadMov();
}

async function reloadMov() {
  try {
    const all = await dbGetMovimientos({ tipo: movType });
    allMovs   = all;
    filterMov();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

function filterMov() {
  const search = document.getElementById('search-input')?.value.toLowerCase() || '';
  const from   = document.getElementById('filter-from')?.value || '';
  const to     = document.getElementById('filter-to')?.value   || '';

  let filtered = allMovs.filter(m => {
    const date = m.fecha ? m.fecha.split('T')[0] : '';
    return (!search || (m.folio||'').toLowerCase().includes(search) || (m.sku||'').toLowerCase().includes(search) || (m.clientes?.nombre||'').toLowerCase().includes(search))
        && (!from || date >= from)
        && (!to   || date <= to);
  });

  renderMovTable(filtered);
}

function renderMovTable(movs) {
  const tbody = document.getElementById('mov-body');
  const count = document.getElementById('table-count');
  if (count) count.textContent = `${movs.length} registro${movs.length !== 1 ? 's' : ''}`;

  if (!movs.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">Sin registros de ${movType === 'entrada' ? 'entradas' : 'salidas'}</td></tr>`; return;
  }

  tbody.innerHTML = movs.map(m => `
    <tr>
      <td><code style="color:${movType==='entrada'?'var(--green)':'var(--red)'}">${m.folio}</code></td>
      <td>${formatDate(m.fecha)}</td>
      <td><code style="font-size:11px;color:var(--primary)">${m.sku || '—'}</code></td>
      <td>${m.descripcion || '—'}</td>
      <td>${m.clientes?.nombre || '—'}</td>
      <td>${m.almacenes?.nombre || '—'}</td>
      <td><strong>${m.cantidad}</strong> ${m.unidad || 'pz'}</td>
      <td>${m.referencia || '—'}</td>
      <td>${m.notas || '—'}</td>
    </tr>`).join('');
}

async function saveMov() {
  const sku     = document.getElementById('mov-sku').value.trim();
  const cliente = document.getElementById('mov-cliente').value;
  const almacen = document.getElementById('mov-almacen').value;
  const cantidad= parseInt(document.getElementById('mov-cantidad').value) || 0;

  if (!sku || !cliente || !almacen || cantidad < 1) {
    showToast('SKU, Cliente, Almacén y Cantidad son obligatorios', 'error'); return;
  }

  try {
    await dbAddMovimiento({
      tipo:       movType,
      sku,
      descripcion: document.getElementById('mov-desc').value.trim(),
      cliente_id:  cliente,
      almacen_id:  almacen,
      cantidad,
      unidad:      document.getElementById('mov-unidad').value,
      referencia:  document.getElementById('mov-ref').value.trim(),
      ubicacion:   document.getElementById('mov-ubicacion').value.trim(),
      notas:       document.getElementById('mov-notas').value.trim(),
    });
    showToast(`${movType === 'entrada' ? 'Entrada' : 'Salida'} registrada en Supabase`, 'success');
    closeModal('modal-mov');
    clearMovForm();
    await reloadMov();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

function clearMovForm() {
  ['mov-sku','mov-desc','mov-ref','mov-ubicacion','mov-notas'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('mov-cantidad').value = '1';
  document.getElementById('mov-cliente').value  = '';
  document.getElementById('mov-almacen').value  = '';
}

async function loadClientesMov() {
  try {
    const c = await dbGetClientes();
    const s = document.getElementById('mov-cliente');
    c.forEach(cl => { const o = document.createElement('option'); o.value = cl.id; o.textContent = cl.nombre; s.appendChild(o); });
  } catch {}
}

async function loadAlmacenesMov() {
  try {
    const a = await dbGetAlmacenes();
    const s = document.getElementById('mov-almacen');
    a.forEach(al => { const o = document.createElement('option'); o.value = al.id; o.textContent = al.nombre; s.appendChild(o); });
  } catch {}
}

function exportCSV() {
  const rows = [['Folio','Fecha','SKU','Descripción','Cliente','Almacén','Cantidad','Unidad','Referencia','Notas']];
  allMovs.forEach(m => rows.push([
    m.folio, formatDate(m.fecha), m.sku||'', m.descripcion||'',
    m.clientes?.nombre||'', m.almacenes?.nombre||'',
    m.cantidad, m.unidad||'pz', m.referencia||'', m.notas||''
  ]));
  const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'});
  const a    = Object.assign(document.createElement('a'), { href:URL.createObjectURL(blob), download:`${movType}s.csv` });
  a.click();
}
