import React, { useState } from 'react'
import { Plus, Search, Edit2, Trash2, Mail, Phone } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { filterItems } from '../utils/helpers.js'
import SupplierModal from '../components/reports/SupplierModal.jsx'

export default function SuppliersPage() {
  const { suppliers, deleteSupplier } = useApp()
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState(null)

  const filtered = filterItems(suppliers, query, ['name', 'contact', 'email', 'category'])

  const openEdit = (s) => { setEditSupplier(s); setModalOpen(true) }
  const openAdd = () => { setEditSupplier(null); setModalOpen(true) }
  const handleDelete = (id) => { if (confirm('¿Eliminar proveedor?')) deleteSupplier(id) }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Proveedores</h1>
          <p className="page-subtitle">{suppliers.length} proveedores registrados</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Nuevo Proveedor</button>
      </div>

      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div className="search-bar">
          <Search size={16} className="search-icon" />
          <input className="input" placeholder="Buscar por nombre, contacto..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Contacto</th><th>Email</th><th>Teléfono</th><th>Categoría</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: '600' }}>{s.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{s.contact}</td>
                  <td>
                    <a href={`mailto:${s.email}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Mail size={13} />{s.email}
                    </a>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)' }}>{s.phone}</td>
                  <td><span className="badge badge-blue">{s.category}</span></td>
                  <td><span className={`badge ${s.status === 'active' ? 'badge-green' : 'badge-red'}`}>{s.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => openEdit(s)}><Edit2 size={14} /></button>
                      <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDelete(s.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && <SupplierModal supplier={editSupplier} onClose={() => setModalOpen(false)} />}
    </div>
  )
}
