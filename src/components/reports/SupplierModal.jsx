import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { CATEGORIES } from '../../utils/initialData.js'

const EMPTY = { name: '', contact: '', email: '', phone: '', category: 'Electronics', status: 'active' }

export default function SupplierModal({ supplier, onClose }) {
  const { addSupplier, updateSupplier } = useApp()
  const [form, setForm] = useState(EMPTY)

  useEffect(() => { setForm(supplier ?? EMPTY) }, [supplier])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    supplier ? updateSupplier(supplier.id, form) : addSupplier(form)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2 className="modal-title">{supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
          <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nombre de la Empresa</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Nombre del proveedor" />
          </div>
          <div className="form-group">
            <label className="form-label">Contacto</label>
            <input className="input" value={form.contact} onChange={e => set('contact', e.target.value)} placeholder="Nombre del contacto" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@ejemplo.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1-555-0000" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{supplier ? 'Guardar Cambios' : 'Crear Proveedor'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
