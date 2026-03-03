import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { CATEGORIES, UNITS, LOCATIONS } from '../../utils/initialData.js'
import { generateSKU } from '../../utils/helpers.js'

const EMPTY = { sku: '', name: '', category: 'Electronics', stock: 0, minStock: 5, price: 0, supplier: '', location: 'A-01-01', unit: 'pcs' }

export default function ProductModal({ product, onClose }) {
  const { addProduct, updateProduct, suppliers } = useApp()
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    if (product) {
      setForm(product)
    } else {
      setForm({ ...EMPTY, sku: generateSKU() })
    }
  }, [product])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (product) {
      updateProduct(product.id, form)
    } else {
      addProduct(form)
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{product ? 'Editar Producto' : 'Nuevo Producto'}</h2>
          <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">SKU</label>
              <input className="input" value={form.sku} onChange={e => set('sku', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nombre del Producto</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Nombre descriptivo del producto" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Stock Actual</label>
              <input className="input" type="number" min="0" value={form.stock} onChange={e => set('stock', +e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Stock Mínimo</label>
              <input className="input" type="number" min="0" value={form.minStock} onChange={e => set('minStock', +e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Precio Unitario ($)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', +e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Unidad</label>
              <select className="input" value={form.unit} onChange={e => set('unit', e.target.value)}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Proveedor</label>
              <input className="input" value={form.supplier} onChange={e => set('supplier', e.target.value)} placeholder="Nombre del proveedor" list="supplier-list" />
              <datalist id="supplier-list">
                {suppliers.map(s => <option key={s.id} value={s.name} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Ubicación</label>
              <select className="input" value={form.location} onChange={e => set('location', e.target.value)}>
                {LOCATIONS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{product ? 'Guardar Cambios' : 'Crear Producto'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
