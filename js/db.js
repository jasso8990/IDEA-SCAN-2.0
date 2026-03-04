/* ============================
   DB.JS — Data Layer (Supabase ideascan schema)
   ============================ */

// ── FORMAT HELPERS ────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric' })
       + ' ' + d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
}
function formatCurrency(n) {
  return new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(n || 0);
}
function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function generateFolio(prefix) {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2,5).toUpperCase();
  return `${prefix}-${ts}${rnd}`;
}

// ── INVENTARIO ────────────────────────────────────────────────────────────

async function dbGetInventario(filters = {}) {
  let q = 'select=*,clientes(nombre,color,emoji),almacenes(nombre,codigo)';
  if (filters.cliente_id) q += `&cliente_id=eq.${filters.cliente_id}`;
  if (filters.almacen_id) q += `&almacen_id=eq.${filters.almacen_id}`;
  if (filters.estado)     q += `&estado=eq.${filters.estado}`;
  q += '&order=created_at.desc';
  return sbGet('inventario', `?${q}`);
}

async function dbAddInventario(data) {
  const profile = getLocalProfile();
  return sbPost('inventario', {
    ...data,
    operador_id: profile?.id,
    estado:      'activo',
    created_at:  new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  });
}

async function dbUpdateInventario(id, data) {
  return sbPatch('inventario', `id=eq.${id}`, { ...data, updated_at: new Date().toISOString() });
}

async function dbDeleteInventario(id) {
  return sbDelete('inventario', `id=eq.${id}`);
}

// ── MOVIMIENTOS ───────────────────────────────────────────────────────────

async function dbGetMovimientos(filters = {}) {
  let q = 'select=*,clientes(nombre,color),almacenes(nombre),usuarios(nombre,apellido)&order=created_at.desc&limit=200';
  if (filters.tipo)       q += `&tipo=eq.${filters.tipo}`;
  if (filters.cliente_id) q += `&cliente_id=eq.${filters.cliente_id}`;
  if (filters.almacen_id) q += `&almacen_id=eq.${filters.almacen_id}`;
  return sbGet('movimientos', `?${q}`);
}

async function dbAddMovimiento(data) {
  const profile = getLocalProfile();
  return sbPost('movimientos', {
    ...data,
    usuario_id: profile?.id,
    folio:      data.folio || generateFolio(data.tipo === 'entrada' ? 'ENT' : 'SAL'),
    fecha:      data.fecha || new Date().toISOString(),
  });
}

// ── ORDENES ───────────────────────────────────────────────────────────────

async function dbGetOrdenes(filters = {}) {
  let q = 'select=*,clientes(nombre,color,emoji),almacenes!ordenes_almacen_id_fkey(nombre),orden_items(count)&order=created_at.desc&limit=100';
  if (filters.estado)     q += `&estado=eq.${filters.estado}`;
  if (filters.tipo)       q += `&tipo=eq.${filters.tipo}`;
  if (filters.cliente_id) q += `&cliente_id=eq.${filters.cliente_id}`;
  return sbGet('ordenes', `?${q}`);
}

async function dbGetOrdenItems(orden_id) {
  return sbGet('orden_items', `?orden_id=eq.${orden_id}&order=created_at.asc`);
}

async function dbAddOrden(data) {
  const profile = getLocalProfile();
  return sbPost('ordenes', {
    ...data,
    usuario_id: profile?.id,
    folio:      data.folio || generateFolio('ORD'),
    estado:     'pendiente',
  });
}

async function dbUpdateOrden(id, data) {
  return sbPatch('ordenes', `id=eq.${id}`, data);
}

// ── CLIENTES ──────────────────────────────────────────────────────────────

async function dbGetClientes() {
  return sbGet('clientes', '?activo=eq.true&order=nombre.asc&select=*');
}

// ── ALMACENES ─────────────────────────────────────────────────────────────

async function dbGetAlmacenes() {
  return sbGet('almacenes', '?activo=eq.true&order=nombre.asc&select=*');
}

// ── ZONAS ─────────────────────────────────────────────────────────────────

async function dbGetZonas(almacen_id) {
  let q = '?activo=eq.true&order=nombre.asc&select=*';
  if (almacen_id) q += `&almacen_id=eq.${almacen_id}`;
  return sbGet('zonas', q);
}

// ── USUARIOS ──────────────────────────────────────────────────────────────

async function dbGetUsuarios() {
  return sbGet('usuarios', '?select=id,username,nombre,apellido,rol,estado,color,ultimo_acceso,created_at&order=nombre.asc');
}

async function dbCreateUsuario(data) {
  // Uses the user-admin Edge Function (handles Auth + DB)
  return callFunction(CONFIG.functions.userAdmin, { action: 'create', ...data });
}

async function dbDeleteUsuario(userId) {
  return callFunction(CONFIG.functions.userAdmin, { action: 'delete', userId });
}

async function dbUpdateUsuarioDB(id, data) {
  return sbPatch('usuarios', `id=eq.${id}`, data);
}

// ── ALERTAS ───────────────────────────────────────────────────────────────

async function dbGetAlertas() {
  return sbGet('alertas', '?leida=eq.false&order=created_at.desc&limit=20');
}

async function dbMarcarAlertaLeida(id) {
  return sbPatch('alertas', `id=eq.${id}`, { leida: true });
}

// ── AI VISION ─────────────────────────────────────────────────────────────

async function callAIVision(base64Image, mediaType = 'image/jpeg', customPrompt = null) {
  const body = { base64Image, mediaType };
  if (customPrompt) body.prompt = customPrompt;
  return callFunction(CONFIG.functions.aiVision, body);
}

// ── STOCK STATUS HELPER ────────────────────────────────────────────────────

function getStockStatus(item) {
  if (!item.cantidad || item.cantidad <= 0)  return { label:'Sin Stock',   cls:'badge-red',    key:'out' };
  if (item.estado === 'salida_total')         return { label:'Salida Total', cls:'badge-gray',   key:'out' };
  if (item.estado === 'salida_parcial')       return { label:'Salida Parc.', cls:'badge-yellow', key:'low' };
  if (item.estado === 'reservado')            return { label:'Reservado',    cls:'badge-purple',  key:'res' };
  return                                             { label:'Activo',       cls:'badge-green',   key:'ok'  };
}
