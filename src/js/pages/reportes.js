/* ═══════════════════════════════════════════════════════
   reportes.js — Reportes y exportación
   Depende de: config.js, auth.js
   ═══════════════════════════════════════════════════════ */
'use strict';

let _movimientos = [];

async function loadReportes() {
  const desde = document.getElementById('fechaDesde').value;
  const hasta = document.getElementById('fechaHasta').value + 'T23:59:59';

  const [entRes, salRes] = await Promise.all([
    sb().from('entradas').select('*').gte('created_at', desde).lte('created_at', hasta).order('created_at', { ascending: false }),
    sb().from('salidas').select('*').gte('created_at', desde).lte('created_at', hasta).order('created_at', { ascending: false }),
  ]);

  const entradas = entRes.data || [];
  const salidas  = salRes.data || [];

  // KPIs
  const bultosE = entradas.reduce((s, r) => s + (r.bultos || 0), 0);
  const bultosS = salidas.reduce((s, r) => s + (r.bultos || 0), 0);
  document.getElementById('rEntradas').textContent = fmtNum(entradas.length);
  document.getElementById('rSalidas').textContent  = fmtNum(salidas.length);
  document.getElementById('rBultosE').textContent  = fmtNum(bultosE);
  document.getElementById('rBultosS').textContent  = fmtNum(bultosS);

  // Tabla combinada
  _movimientos = [
    ...entradas.map(r => ({ ...r, tipo: 'entrada' })),
    ...salidas.map(r  => ({ ...r, tipo: 'salida'  })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  renderTabla(_movimientos);
}

function renderTabla(rows) {
  const tbody = document.getElementById('reporteBody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-300)">Sin movimientos en el período</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><span class="badge ${r.tipo === 'entrada' ? 'badge-success' : 'badge-danger'}">${r.tipo}</span></td>
      <td><span class="font-mono text-sm">${r.folio || '—'}</span></td>
      <td class="text-sm">${fmtDate(r.fecha || r.created_at)}</td>
      <td><span class="font-mono">${r.sku || '—'}</span></td>
      <td><strong>${fmtNum(r.bultos)}</strong></td>
      <td class="text-sm text-muted">${r.operador || '—'}</td>
    </tr>`).join('');
}

// ── Export CSV ────────────────────────────────────────────
async function exportCSV(tabla) {
  showToast('Preparando exportación...', '');
  const { data, error } = await sb().from(tabla).select('*').order('created_at', { ascending: false });
  if (error || !data?.length) { showToast('Sin datos para exportar', 'error'); return; }

  const headers = Object.keys(data[0]);
  const rows    = data.map(r => headers.map(h => `"${(r[h]??'').toString().replace(/"/g,'""')}"`).join(','));
  const csv     = [headers.join(','), ...rows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${tabla}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`✓ ${tabla}.csv descargado`, 'success');
}
