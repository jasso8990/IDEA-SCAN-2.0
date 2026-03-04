/* ============================
   STORAGE.JS — Data Layer (localStorage)
   ============================ */

// =========== PRODUCTS ===========

function getProducts() {
  const raw = localStorage.getItem('wms_products');
  if (raw) return JSON.parse(raw);
  // Demo seed data
  const demo = [
    { id: 'p1', sku: 'SKU-001', name: 'Cable HDMI 2m',       category: 'Electrónica',  stock: 45,  minStock: 10, unit: 'pza',  price: 150,  location: 'A-01-001', description: 'Cable HDMI de alta velocidad', createdAt: new Date().toISOString() },
    { id: 'p2', sku: 'SKU-002', name: 'Teclado USB',          category: 'Electrónica',  stock: 8,   minStock: 10, unit: 'pza',  price: 350,  location: 'A-01-002', description: 'Teclado USB estándar',        createdAt: new Date().toISOString() },
    { id: 'p3', sku: 'SKU-003', name: 'Papel Bond 75g',       category: 'Oficina',      stock: 0,   minStock: 5,  unit: 'caja', price: 480,  location: 'B-02-001', description: 'Resma papel bond tamaño carta', createdAt: new Date().toISOString() },
    { id: 'p4', sku: 'SKU-004', name: 'Silla Ergonómica',     category: 'Mobiliario',   stock: 12,  minStock: 2,  unit: 'pza',  price: 3200, location: 'C-03-001', description: 'Silla de oficina ergonómica',  createdAt: new Date().toISOString() },
    { id: 'p5', sku: 'SKU-005', name: 'Monitor 24"',          category: 'Electrónica',  stock: 3,   minStock: 5,  unit: 'pza',  price: 4500, location: 'A-02-001', description: 'Monitor LED Full HD',         createdAt: new Date().toISOString() },
    { id: 'p6', sku: 'SKU-006', name: 'Cinta de Embalaje',    category: 'Materiales',   stock: 200, minStock: 50, unit: 'pza',  price: 28,   location: 'D-01-001', description: 'Cinta adhesiva para embalaje', createdAt: new Date().toISOString() },
    { id: 'p7', sku: 'SKU-007', name: 'Cajas de Cartón Med.', category: 'Materiales',   stock: 4,   minStock: 20, unit: 'pza',  price: 45,   location: 'D-01-002', description: 'Caja de cartón mediana',      createdAt: new Date().toISOString() },
    { id: 'p8', sku: 'SKU-008', name: 'Laptop 15"',           category: 'Electrónica',  stock: 6,   minStock: 3,  unit: 'pza',  price: 18000,location: 'A-02-002', description: 'Laptop para oficina',         createdAt: new Date().toISOString() },
  ];
  localStorage.setItem('wms_products', JSON.stringify(demo));
  return demo;
}

function saveProducts(products) {
  localStorage.setItem('wms_products', JSON.stringify(products));
}

function getProductById(id) {
  return getProducts().find(p => p.id === id) || null;
}

function addProduct(product) {
  const products = getProducts();
  product.id = 'p' + Date.now();
  product.createdAt = new Date().toISOString();
  products.push(product);
  saveProducts(products);
  logActivity('in', `Producto creado: ${product.name} (${product.sku})`);
  return product;
}

function updateProduct(id, data) {
  const products = getProducts();
  const idx = products.findIndex(p => p.id === id);
  if (idx !== -1) {
    products[idx] = { ...products[idx], ...data, updatedAt: new Date().toISOString() };
    saveProducts(products);
    return products[idx];
  }
  return null;
}

function deleteProduct(id) {
  let products = getProducts();
  const prod = products.find(p => p.id === id);
  products = products.filter(p => p.id !== id);
  saveProducts(products);
  if (prod) logActivity('out', `Producto eliminado: ${prod.name}`);
}

// =========== MOVEMENTS ===========

function getMovements() {
  const raw = localStorage.getItem('wms_movements');
  return raw ? JSON.parse(raw) : [];
}

function saveMovements(movements) {
  localStorage.setItem('wms_movements', JSON.stringify(movements));
}

function addMovement(movement) {
  const movements = getMovements();
  movement.id = 'mv' + Date.now();
  movement.folio = generateFolio(movement.type);
  movement.createdAt = new Date().toISOString();
  const session = getSession();
  movement.userId   = session ? session.id : 'unknown';
  movement.userName = session ? session.fullname : 'Sistema';
  movements.unshift(movement);
  saveMovements(movements);

  // Update product stock
  const products = getProducts();
  const idx = products.findIndex(p => p.id === movement.productId);
  if (idx !== -1) {
    if (movement.type === 'in') {
      products[idx].stock += parseInt(movement.qty);
    } else {
      products[idx].stock = Math.max(0, products[idx].stock - parseInt(movement.qty));
    }
    if (movement.location) products[idx].location = movement.location;
    saveProducts(products);
  }

  logActivity(movement.type, `${movement.type === 'in' ? 'Entrada' : 'Salida'}: ${movement.productName} x${movement.qty}`);
  return movement;
}

function generateFolio(type) {
  const prefix = type === 'in' ? 'ENT' : 'SAL';
  const num = String(getMovements().length + 1).padStart(5, '0');
  return `${prefix}-${num}`;
}

// =========== LOCATIONS ===========

function getLocations() {
  const raw = localStorage.getItem('wms_locations');
  if (raw) return JSON.parse(raw);
  const demo = [
    { id: 'l1', zone: 'A', aisle: '01', position: '001', type: 'rack',  capacity: 100, status: 'active', description: 'Rack electrónica' },
    { id: 'l2', zone: 'A', aisle: '01', position: '002', type: 'rack',  capacity: 100, status: 'active', description: '' },
    { id: 'l3', zone: 'A', aisle: '02', position: '001', type: 'rack',  capacity: 80,  status: 'active', description: '' },
    { id: 'l4', zone: 'A', aisle: '02', position: '002', type: 'rack',  capacity: 80,  status: 'active', description: '' },
    { id: 'l5', zone: 'B', aisle: '02', position: '001', type: 'piso',  capacity: 500, status: 'active', description: 'Área papel/oficina' },
    { id: 'l6', zone: 'C', aisle: '03', position: '001', type: 'piso',  capacity: 50,  status: 'active', description: 'Mobiliario' },
    { id: 'l7', zone: 'D', aisle: '01', position: '001', type: 'rack',  capacity: 200, status: 'active', description: 'Materiales' },
    { id: 'l8', zone: 'D', aisle: '01', position: '002', type: 'rack',  capacity: 200, status: 'active', description: '' },
    { id: 'l9', zone: 'E', aisle: '01', position: '001', type: 'especial', capacity: 20, status: 'inactive', description: 'Zona restringida' },
  ];
  localStorage.setItem('wms_locations', JSON.stringify(demo));
  return demo;
}

function saveLocations(locations) {
  localStorage.setItem('wms_locations', JSON.stringify(locations));
}

function addLocation(location) {
  const locations = getLocations();
  location.id = 'l' + Date.now();
  location.code = `${location.zone}-${location.aisle}-${location.position}`;
  locations.push(location);
  saveLocations(locations);
  return location;
}

function updateLocation(id, data) {
  const locations = getLocations();
  const idx = locations.findIndex(l => l.id === id);
  if (idx !== -1) {
    locations[idx] = { ...locations[idx], ...data };
    locations[idx].code = `${locations[idx].zone}-${locations[idx].aisle}-${locations[idx].position}`;
    saveLocations(locations);
    return locations[idx];
  }
  return null;
}

function deleteLocation(id) {
  let locations = getLocations();
  locations = locations.filter(l => l.id !== id);
  saveLocations(locations);
}

function getLocationCode(loc) {
  return `${loc.zone}-${loc.aisle}-${loc.position}`;
}

// =========== ACTIVITY LOG ===========

function getActivityLog() {
  const raw = localStorage.getItem('wms_activity');
  return raw ? JSON.parse(raw) : [];
}

function logActivity(type, message) {
  const log = getActivityLog();
  log.unshift({ type, message, timestamp: new Date().toISOString() });
  if (log.length > 200) log.splice(200); // Keep last 200
  localStorage.setItem('wms_activity', JSON.stringify(log));
}

// =========== HELPERS ===========

function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function formatDateTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric' }) +
    ' ' + d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);
}

function getStockStatus(product) {
  if (product.stock <= 0)                 return { label: 'Sin Stock', class: 'badge-red',    key: 'out' };
  if (product.stock <= product.minStock)  return { label: 'Stock Bajo', class: 'badge-yellow', key: 'low' };
  return                                         { label: 'En Stock',   class: 'badge-green',  key: 'ok'  };
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}
