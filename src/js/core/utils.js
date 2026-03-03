/* ═══════════════════════════════════════════════════════
   utils.js — Utilidades: fechas, toast, XLSX, print
   ═══════════════════════════════════════════════════════ */

'use strict';

// ── Toast global ──────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3200) {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  void toast.offsetWidth;             // fuerza reflow para reiniciar animación
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ── Fechas ────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function dayStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
}
function dayEnd() {
  const d = new Date(); d.setHours(23, 59, 59, 999); return d.toISOString();
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

// ── XLSX export ───────────────────────────────────────────
function exportXLSX(data, filename) {
  if (!window.XLSX) { showToast('XLSX library not loaded', 'error'); return; }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ── Print helper ──────────────────────────────────────────
function printElement(el) {
  const w = window.open('', '_blank', 'width=800,height=600');
  w.document.write(`
    <html><head><title>Imprimir</title>
    <style>
      body { font-family: Inter, sans-serif; padding: 20px; }
      @media print { body { padding: 0; } }
    </style>
    </head><body>${el.innerHTML}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 300);
}

// ── Helpers de texto ──────────────────────────────────────
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function truncate(str, max = 40) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ── Debounce ──────────────────────────────────────────────
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── Inicializar página ────────────────────────────────────
// Punto de entrada estándar para todas las páginas
function initPage(pageId, allowedRoles = null) {
  initDB();
  const user = requireAuth(allowedRoles);
  if (!user) return null;
  renderSidebar(pageId);
  renderBottomNav(pageId);
  document.getElementById('sidebarOverlay')
    ?.addEventListener('click', closeSidebar);
  return user;
}
