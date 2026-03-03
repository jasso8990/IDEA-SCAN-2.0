import React, { useState } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'

export default function StockAdjustModal({ product, onClose }) {
  const { adjustStock } = useApp()
  const [type, setType] = useState('add')
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')

  const preview = type === 'add' ? product.stock + qty : Math.max(0, product.stock - qty)

  const handleSubmit = (e) => {
    e.preventDefault()
    const delta = type === 'add' ? qty : -qty
    adjustStock(product.id, delta, type, note)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Ajustar Stock</h2>
          <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{product.sku}</div>
          <div style={{ fontWeight: '600', marginBottom: '8px' }}>{product.name}</div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Stock actual</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: '700' }}>{product.stock}</div>
            </div>
            <div style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>→</div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Resultado</div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: '700',
                color: preview > product.stock ? 'var(--accent-green)' : preview < product.stock ? 'var(--accent-red)' : 'var(--text-primary)'
              }}>{preview}</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Tipo de Ajuste</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`btn ${type === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setType('add')}
                style={{ justifyContent: 'center' }}
              >
                <Plus size={16} /> Entrada
              </button>
              <button
                type="button"
                className={`btn ${type === 'remove' ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => setType('remove')}
                style={{ justifyContent: 'center' }}
              >
                <Minus size={16} /> Salida
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Cantidad</label>
            <input
              className="input"
              type="number"
              min="1"
              max={type === 'remove' ? product.stock : undefined}
              value={qty}
              onChange={e => setQty(Math.max(1, +e.target.value))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Nota (opcional)</label>
            <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Motivo del ajuste..." />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className={`btn ${type === 'add' ? 'btn-primary' : 'btn-danger'}`}>
              Confirmar Ajuste
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
