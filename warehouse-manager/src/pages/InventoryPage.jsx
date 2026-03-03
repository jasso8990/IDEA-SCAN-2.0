import React, { useState } from 'react'
import { ArrowUpCircle, ArrowDownCircle, RotateCcw, Search } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { getStockStatus, filterItems, formatCurrency } from '../utils/helpers.js'
import StockAdjustModal from '../components/inventory/StockAdjustModal.jsx'

export default function InventoryPage() {
  const { products } = useApp()
  const [query, setQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [adjustProduct, setAdjustProduct] = useState(null)

  const filtered = filterItems(products, query, ['name', 'sku', 'location', 'category'])
    .filter(p => {
      if (filterStatus === 'ok') return p.stock > p.minStock
      if (filterStatus === 'low') return p.stock > 0 && p.stock <= p.minStock
      if (filterStatus === 'out') return p.stock === 0
      return true
    })

  const totalValue = filtered.reduce((s, p) => s + p.stock * p.price, 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventario</h1>
          <p className="page-subtitle">Control de stock y movimientos</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card blue">
          <div className="stat-label">Total Productos</div>
          <div className="stat-value">{products.length}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">En Stock Normal</div>
          <div className="stat-value">{products.filter(p => p.stock > p.minStock).length}</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">Stock Bajo</div>
          <div className="stat-value">{products.filter(p => p.stock > 0 && p.stock <= p.minStock).length}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Sin Stock</div>
          <div className="stat-value">{products.filter(p => p.stock === 0).length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-bar">
            <Search size={16} className="search-icon" />
            <input className="input" placeholder="Buscar producto..." value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['all', 'ok', 'low', 'out'].map(s => (
              <button
                key={s}
                className={`btn ${filterStatus === s ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterStatus(s)}
                style={{ padding: '8px 14px' }}
              >
                {{ all: 'Todos', ok: 'Normal', low: 'Bajo', out: 'Sin Stock' }[s]}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Valor total: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(totalValue)}</strong>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Producto</th><th>SKU</th><th>Ubicación</th>
                <th>Stock</th><th>Mínimo</th><th>Valor</th><th>Estado</th><th>Ajustar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const status = getStockStatus(p.stock, p.minStock)
                const pct = p.minStock > 0 ? Math.min(100, Math.round((p.stock / (p.minStock * 3)) * 100)) : 100
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: '500' }}>{p.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>{p.sku}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{p.location}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>{p.stock}</span>
                        <div style={{ width: '60px', height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: p.stock === 0 ? 'var(--accent-red)' : p.stock <= p.minStock ? 'var(--accent-yellow)' : 'var(--accent-green)', borderRadius: '2px' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{p.minStock}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{formatCurrency(p.stock * p.price)}</td>
                    <td><span className={`badge ${status.class}`}>{status.label}</span></td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => setAdjustProduct(p)}>
                        <RotateCcw size={14} /> Ajustar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {adjustProduct && (
        <StockAdjustModal product={adjustProduct} onClose={() => setAdjustProduct(null)} />
      )}
    </div>
  )
}
