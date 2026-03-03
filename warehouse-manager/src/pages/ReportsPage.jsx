import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { useApp } from '../context/AppContext.jsx'
import { formatCurrency } from '../utils/helpers.js'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  fontSize: '13px',
}

export default function ReportsPage() {
  const { products, orders } = useApp()

  // By category
  const byCategory = Object.values(
    products.reduce((acc, p) => {
      if (!acc[p.category]) acc[p.category] = { name: p.category, count: 0, value: 0 }
      acc[p.category].count += p.stock
      acc[p.category].value += p.stock * p.price
      return acc
    }, {})
  )

  // Orders by type and status
  const orderStats = {
    incoming: orders.filter(o => o.type === 'incoming').length,
    outgoing: orders.filter(o => o.type === 'outgoing').length,
    pending: orders.filter(o => o.status === 'pending').length,
    completed: orders.filter(o => o.status === 'completed').length,
  }

  // Top products by value
  const topByValue = [...products]
    .sort((a, b) => (b.stock * b.price) - (a.stock * a.price))
    .slice(0, 8)
    .map(p => ({ name: p.name.slice(0, 20), value: +(p.stock * p.price).toFixed(2) }))

  const totalValue = products.reduce((s, p) => s + p.stock * p.price, 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="page-subtitle">Análisis y estadísticas del almacén</p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '24px' }}>
        <div className="stat-card purple">
          <div className="stat-label">Valor Total Inventario</div>
          <div className="stat-value" style={{ fontSize: '20px' }}>{formatCurrency(totalValue)}</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Órdenes Entrada</div>
          <div className="stat-value">{orderStats.incoming}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Órdenes Salida</div>
          <div className="stat-value">{orderStats.outgoing}</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">Órdenes Completadas</div>
          <div className="stat-value">{orderStats.completed}</div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px' }}>Stock por Categoría</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byCategory}>
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, 'Unidades']} />
              <Bar dataKey="count" fill="var(--accent-blue)" radius={[4,4,0,0]} name="Stock" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px' }}>Distribución por Categoría (Valor)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [formatCurrency(v), 'Valor']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top products table */}
      <div className="card">
        <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px' }}>Top Productos por Valor de Inventario</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>#</th><th>Producto</th><th>Stock</th><th>Precio Unit.</th><th>Valor Total</th><th>% del Total</th></tr>
            </thead>
            <tbody>
              {[...products].sort((a, b) => (b.stock * b.price) - (a.stock * a.price)).slice(0, 10).map((p, i) => {
                const val = p.stock * p.price
                const pct = totalValue > 0 ? (val / totalValue * 100).toFixed(1) : 0
                return (
                  <tr key={p.id}>
                    <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{i + 1}</td>
                    <td style={{ fontWeight: '500' }}>{p.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{p.stock}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(p.price)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}>{formatCurrency(val)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)', minWidth: '40px' }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
