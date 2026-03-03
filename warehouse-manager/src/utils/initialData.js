export const INITIAL_PRODUCTS = [
  { id: 1, sku: 'PRD-001', name: 'Laptop Dell XPS 15', category: 'Electronics', stock: 25, minStock: 5, price: 1299.99, supplier: 'Tech Supplies Co', location: 'A-01-01', unit: 'pcs', createdAt: '2024-01-10T10:00:00Z' },
  { id: 2, sku: 'PRD-002', name: 'Monitor LG 27"', category: 'Electronics', stock: 3, minStock: 5, price: 349.99, supplier: 'Tech Supplies Co', location: 'A-01-02', unit: 'pcs', createdAt: '2024-01-12T10:00:00Z' },
  { id: 3, sku: 'PRD-003', name: 'Teclado Mecánico', category: 'Accessories', stock: 80, minStock: 10, price: 89.99, supplier: 'Peripherals Plus', location: 'B-02-01', unit: 'pcs', createdAt: '2024-01-14T10:00:00Z' },
  { id: 4, sku: 'PRD-004', name: 'Mouse Inalámbrico', category: 'Accessories', stock: 2, minStock: 10, price: 45.00, supplier: 'Peripherals Plus', location: 'B-02-02', unit: 'pcs', createdAt: '2024-01-15T10:00:00Z' },
  { id: 5, sku: 'PRD-005', name: 'Silla Ergonómica', category: 'Furniture', stock: 12, minStock: 3, price: 599.00, supplier: 'Office World', location: 'C-01-01', unit: 'pcs', createdAt: '2024-01-16T10:00:00Z' },
  { id: 6, sku: 'PRD-006', name: 'Escritorio Ajustable', category: 'Furniture', stock: 0, minStock: 2, price: 799.00, supplier: 'Office World', location: 'C-01-02', unit: 'pcs', createdAt: '2024-01-17T10:00:00Z' },
  { id: 7, sku: 'PRD-007', name: 'Cámara Web HD', category: 'Electronics', stock: 45, minStock: 8, price: 129.99, supplier: 'Tech Supplies Co', location: 'A-02-01', unit: 'pcs', createdAt: '2024-01-18T10:00:00Z' },
  { id: 8, sku: 'PRD-008', name: 'Auriculares Noise Cancel', category: 'Electronics', stock: 18, minStock: 5, price: 249.99, supplier: 'Audio Direct', location: 'A-02-02', unit: 'pcs', createdAt: '2024-01-19T10:00:00Z' },
  { id: 9, sku: 'PRD-009', name: 'Cable HDMI 2m', category: 'Cables', stock: 150, minStock: 20, price: 12.99, supplier: 'Cable Express', location: 'D-01-01', unit: 'pcs', createdAt: '2024-01-20T10:00:00Z' },
  { id: 10, sku: 'PRD-010', name: 'Hub USB-C 7 puertos', category: 'Accessories', stock: 4, minStock: 8, price: 59.99, supplier: 'Peripherals Plus', location: 'B-03-01', unit: 'pcs', createdAt: '2024-01-21T10:00:00Z' },
]

export const INITIAL_ORDERS = [
  { id: 'ORD-1001', type: 'incoming', supplier: 'Tech Supplies Co', status: 'completed', items: [{ productId: 1, name: 'Laptop Dell XPS 15', qty: 10, price: 1299.99 }], total: 12999.90, createdAt: '2024-01-20T09:00:00Z' },
  { id: 'ORD-1002', type: 'outgoing', customer: 'Empresa ABC', status: 'pending', items: [{ productId: 3, name: 'Teclado Mecánico', qty: 5, price: 89.99 }], total: 449.95, createdAt: '2024-01-22T14:00:00Z' },
  { id: 'ORD-1003', type: 'incoming', supplier: 'Office World', status: 'processing', items: [{ productId: 5, name: 'Silla Ergonómica', qty: 6, price: 599.00 }], total: 3594.00, createdAt: '2024-01-23T10:00:00Z' },
  { id: 'ORD-1004', type: 'outgoing', customer: 'Cliente XYZ', status: 'completed', items: [{ productId: 7, name: 'Cámara Web HD', qty: 3, price: 129.99 }], total: 389.97, createdAt: '2024-01-24T11:00:00Z' },
  { id: 'ORD-1005', type: 'incoming', supplier: 'Peripherals Plus', status: 'pending', items: [{ productId: 4, name: 'Mouse Inalámbrico', qty: 20, price: 45.00 }], total: 900.00, createdAt: '2024-01-25T08:00:00Z' },
]

export const INITIAL_SUPPLIERS = [
  { id: 1, name: 'Tech Supplies Co', contact: 'John Smith', email: 'john@techsupplies.com', phone: '+1-555-0100', category: 'Electronics', status: 'active', createdAt: '2024-01-01T00:00:00Z' },
  { id: 2, name: 'Peripherals Plus', contact: 'María García', email: 'maria@peripherals.com', phone: '+1-555-0200', category: 'Accessories', status: 'active', createdAt: '2024-01-01T00:00:00Z' },
  { id: 3, name: 'Office World', contact: 'Carlos López', email: 'carlos@officeworld.com', phone: '+1-555-0300', category: 'Furniture', status: 'active', createdAt: '2024-01-01T00:00:00Z' },
  { id: 4, name: 'Audio Direct', contact: 'Lisa Chen', email: 'lisa@audiodirect.com', phone: '+1-555-0400', category: 'Electronics', status: 'active', createdAt: '2024-01-01T00:00:00Z' },
  { id: 5, name: 'Cable Express', contact: 'Ahmed Hassan', email: 'ahmed@cableexpress.com', phone: '+1-555-0500', category: 'Cables', status: 'inactive', createdAt: '2024-01-01T00:00:00Z' },
]

export const CATEGORIES = ['Electronics', 'Accessories', 'Furniture', 'Cables', 'Tools', 'Office Supplies', 'Other']
export const UNITS = ['pcs', 'kg', 'lts', 'boxes', 'sets', 'rolls']
export const LOCATIONS = ['A-01-01', 'A-01-02', 'A-02-01', 'A-02-02', 'B-01-01', 'B-02-01', 'B-02-02', 'B-03-01', 'C-01-01', 'C-01-02', 'D-01-01']
