import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export default function SettingsPage() {
  const { user } = useAuth()
  const [warehouseName, setWarehouseName] = useState('Mi Almacén')
  const [currency, setCurrency] = useState('USD')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">Preferencias del sistema</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* General */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px' }}>General</h3>
          <div className="form-group">
            <label className="form-label">Nombre del Almacén</label>
            <input className="input" value={warehouseName} onChange={e => setWarehouseName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Moneda</label>
            <select className="input" value={currency} onChange={e => setCurrency(e.target.value)}>
              <option value="USD">USD — Dólar Americano</option>
              <option value="MXN">MXN — Peso Mexicano</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? '✓ Guardado' : 'Guardar Cambios'}
          </button>
        </div>

        {/* User info */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px' }}>Mi Cuenta</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '700', color: 'white' }}>
              {user?.name?.[0]}
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '16px' }}>{user?.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{user?.email}</div>
              <div style={{ marginTop: '4px' }}><span className="badge badge-blue">{user?.role}</span></div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Nombre</label>
            <input className="input" defaultValue={user?.name} readOnly style={{ opacity: 0.7 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="input" defaultValue={user?.email} readOnly style={{ opacity: 0.7 }} />
          </div>
        </div>

        {/* About */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>Acerca del Sistema</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              ['Versión', '1.0.0'],
              ['Framework', 'React 18 + Vite'],
              ['Tecnología', 'JavaScript ES2023'],
              ['Licencia', 'MIT'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{k}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
