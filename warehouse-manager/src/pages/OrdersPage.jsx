import React, { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { formatCurrency, formatDate, getOrderStatusBadge, filterItems } from '../utils/helpers.js'
import OrderModal from '../components/orders/OrderModal.jsx'

export default function OrdersPage() {
  const { orders, updateOrderStatus } = useApp()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = filterItems(orders, query, ['id', 'supplier', 'customer'])
    .filter(o => typeFilter === 'all' || o.type === typeFilter)
    .filter(o => statusFilter === 'all' || o.status === statusFilter)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Órdenes</h1>
          <p className="page-subtitle">{orders.length} órdenes en total</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Nueva Orden
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-bar">
            <Search size={16} className="search-icon" />
            <input className="input" placeholder="Buscar por ID, proveedor..." value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <select className="input" style={{ maxWidth: '160px' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">Todos los tipos</option>
            <option value="incoming">Entradas</option>
            <option value="outgoing">Salidas</option>
          </select>
          <select className="input" style={{ maxWidth: '160px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="processing">Procesando</option>
            <option value="completed">Completado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Tipo</th><th>Contraparte</th>
                <th>Items</th><th>Total</th><th>Estado</th><th>Fecha</th><th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No se encontraron órdenes</td></tr>
              ) : filtered.map(o => {
                const badge = getOrderStatusBadge(o.status)
                return (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>{o.id}</td>
                    <td><span className={`badge ${o.type === 'incoming' ? 'badge-blue' : 'badge-purple'}`}>{o.type === 'incoming' ? '↓ Entrada' : '↑ Salida'}</span></td>
                    <td style={{ fontWeight: '500' }}>{o.supplier || o.customer || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{o.items?.length ?? 0} artículo(s)</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(o.total)}</td>
                    <td><span className={`badge ${badge.class}`}>{badge.label}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{formatDate(o.createdAt)}</td>
                    <td>
                      {o.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => updateOrderStatus(o.id, 'processing')}>Procesar</button>
                          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => updateOrderStatus(o.id, 'completed')}>✓</button>
                        </div>
                      )}
                      {o.status === 'processing' && (
                        <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => updateOrderStatus(o.id, 'completed')}>Completar</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && <OrderModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}
