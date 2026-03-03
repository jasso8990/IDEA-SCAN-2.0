import React, { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { formatCurrency } from '../../utils/helpers.js'

export default function OrderModal({ onClose }) {
  const { addOrder, products, suppliers } = useApp()
  const [type, setType] = useState('incoming')
  const [counterpart, setCounterpart] = useState('')
  const [items, setItems] = useState([{ productId: '', qty: 1, price: 0, name: '' }])

  const addItem = () => setItems(prev => [...prev, { productId: '', qty: 1, price: 0, name: '' }])
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const setItem = (i, key, val) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item
      if (key === 'productId') {
        const p = products.find(p => String(p.id) === val)
        return { ...item, productId: +val, name: p?.name ?? '', price: p?.price ?? 0 }
      }
      return { ...item, [key]: val }
    }))
  }

  const total = items.reduce((s, it) => s + (it.qty * it.price), 0)

  const handleSubmit = (e) => {
    e.preventDefault()
    const validItems = items.filter(it => it.productId && it.qty > 0)
    if (!validItems.length) return
    addOrder({
      type,
      [type === 'incoming' ? 'supplier' : 'customer']: counterpart,
      items: validItems,
      total,
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Nueva Orden</h2>
          <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Type selector */}
          <div className="form-group">
            <label className="form-label">Tipo de Orden</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button type="button" className={`btn ${type === 'incoming' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setType('incoming')} style={{ justifyContent: 'center' }}>↓ Entrada de Mercancía</button>
              <button type="button" className={`btn ${type === 'outgoing' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setType('outgoing')} style={{ justifyContent: 'center' }}>↑ Salida de Mercancía</button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{type === 'incoming' ? 'Proveedor' : 'Cliente'}</label>
            <input className="input" value={counterpart} onChange={e => setCounterpart(e.target.value)} placeholder={type === 'incoming' ? 'Nombre del proveedor' : 'Nombre del cliente'} list="counterpart-list" required />
            <datalist id="counterpart-list">
              {suppliers.map(s => <option key={s.id} value={s.name} />)}
            </datalist>
          </div>

          {/* Items */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label className="form-label" style={{ margin: 0 }}>Productos</label>
              <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={addItem}><Plus size={14} /> Agregar</button>
            </div>

            {items.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 32px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <select className="input" value={item.productId || ''} onChange={e => setItem(i, 'productId', e.target.value)} required>
                  <option value="">Seleccionar producto...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>)}
                </select>
                <input className="input" type="number" min="1" value={item.qty} onChange={e => setItem(i, 'qty', +e.target.value)} placeholder="Qty" />
                <input className="input" type="number" min="0" step="0.01" value={item.price} onChange={e => setItem(i, 'price', +e.target.value)} placeholder="Precio" />
                <button type="button" className="btn btn-danger" style={{ padding: '6px' }} onClick={() => removeItem(i)} disabled={items.length === 1}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          {/* Total */}
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Total de la Orden</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '18px' }}>{formatCurrency(total)}</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Crear Orden</button>
          </div>
        </form>
      </div>
    </div>
  )
}
