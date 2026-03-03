import React, { useState } from 'react'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { formatCurrency, getStockStatus, filterItems } from '../utils/helpers.js'
import ProductModal from '../components/products/ProductModal.jsx'

export default function ProductsPage() {
  const { products, deleteProduct } = useApp()
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editProduct, setEditProduct] = useState(null)

  const categories = ['all', ...new Set(products.map(p => p.category))]

  const filtered = filterItems(products, query, ['name', 'sku', 'category', 'supplier'])
    .filter(p => categoryFilter === 'all' || p.category === categoryFilter)

  const openAdd = () => { setEditProduct(null); setModalOpen(true) }
  const openEdit = (p) => { setEditProduct(p); setModalOpen(true) }

  const handleDelete = (id) => {
    if (confirm('¿Eliminar este producto?')) deleteProduct(id)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Productos</h1>
          <p className="page-subtitle">{products.length} productos registrados</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Nuevo Producto
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ maxWidth: '300px' }}>
            <Search size={16} className="search-icon" />
            <input className="input" placeholder="Buscar por nombre, SKU..." value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <select className="input" style={{ maxWidth: '180px' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'Todas las categorías' : c}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>SKU</th><th>Nombre</th><th>Categoría</th>
                <th>Stock</th><th>Stock Mín.</th><th>Precio</th>
                <th>Ubicación</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No se encontraron productos</td></tr>
              ) : filtered.map(p => {
                const status = getStockStatus(p.stock, p.minStock)
                return (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>{p.sku}</td>
                    <td style={{ fontWeight: '500' }}>{p.name}</td>
                    <td><span className="badge badge-blue">{p.category}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}>{p.stock}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{p.minStock}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(p.price)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>{p.location}</td>
                    <td><span className={`badge ${status.class}`}>{status.label}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => openEdit(p)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDelete(p.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <ProductModal
          product={editProduct}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
