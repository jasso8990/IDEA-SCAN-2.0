/* ═══════════════════════════════════════════════════════
   export.js — Exportación XLSX, PDF y Print
   Depende de: utils.js (showToast)
   ═══════════════════════════════════════════════════════ */

'use strict';

// ── Exportar array de objetos a XLSX ──────────────────────
function exportToXLSX(data, filename, sheetName = 'Reporte') {
  if (!window.XLSX) { showToast('Librería XLSX no cargada', 'error'); return; }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
  showToast(`✅ Descargado: ${filename}.xlsx`, 'success');
}

// ── Exportar tabla HTML a XLSX ────────────────────────────
function exportTableToXLSX(tableEl, filename) {
  if (!window.XLSX) { showToast('Librería XLSX no cargada', 'error'); return; }
  const wb = XLSX.utils.table_to_book(tableEl, { sheet: 'Datos' });
  XLSX.writeFile(wb, `${filename}.xlsx`);
  showToast(`✅ Descargado: ${filename}.xlsx`, 'success');
}

// ── Exportar XLSX desde AOA (Array of Arrays) ─────────────
function exportAOAtoXLSX(aoa, filename, colWidths = [], merges = []) {
  if (!window.XLSX) { showToast('Librería XLSX no cargada', 'error'); return; }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (colWidths.length) ws['!cols'] = colWidths;
  if (merges.length)    ws['!merges'] = merges;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
  XLSX.writeFile(wb, `${filename}.xlsx`);
  showToast(`✅ Descargado: ${filename}.xlsx`, 'success');
}

// ── Imprimir elemento HTML ────────────────────────────────
function printElement(el) {
  const w = window.open('', '_blank', 'width=800,height=600');
  w.document.write(`
    <html><head><title>Imprimir</title>
    <style>
      body { font-family: Inter, sans-serif; padding: 20px; }
      table { border-collapse: collapse; width: 100%; }
      td, th { border: 1px solid #ccc; padding: 6px 10px; font-size: 12px; }
      @media print { body { padding: 0; } }
    </style>
    </head><body>${el.innerHTML}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 300);
}
