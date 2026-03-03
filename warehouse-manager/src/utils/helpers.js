export const formatCurrency = (value, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)

export const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
}

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const getStockStatus = (stock, minStock) => {
  if (stock === 0) return { label: 'Sin Stock', class: 'badge-red' }
  if (stock <= minStock) return { label: 'Stock Bajo', class: 'badge-yellow' }
  return { label: 'En Stock', class: 'badge-green' }
}

export const getOrderStatusBadge = (status) => {
  const map = {
    pending: { label: 'Pendiente', class: 'badge-yellow' },
    processing: { label: 'Procesando', class: 'badge-blue' },
    completed: { label: 'Completado', class: 'badge-green' },
    cancelled: { label: 'Cancelado', class: 'badge-red' },
  }
  return map[status] || { label: status, class: 'badge-blue' }
}

export const generateSKU = (prefix = 'PRD') => {
  const num = Math.floor(Math.random() * 9000) + 1000
  return `${prefix}-${num}`
}

export const filterItems = (items, query, fields) => {
  if (!query.trim()) return items
  const q = query.toLowerCase()
  return items.filter(item =>
    fields.some(field => String(item[field] ?? '').toLowerCase().includes(q))
  )
}
