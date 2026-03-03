import React from 'react'
import { Package, Warehouse, ShoppingCart, DollarSign, TrendingDown, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { useApp } from '../context/AppContext.jsx'
import { formatCurrency } from '../utils/helpers.js'

const CHART_DATA = [
  { month: 'Ago', entradas: 42, salidas: 28 },
  { month: 'Sep', entradas: 38, salidas: 35 },
  { month: 'Oct', entradas: 55, salidas: 41 },
  { month: 'Nov', entradas: 47, salidas: 52 },
  { month: 'Dic', entradas: 60, salidas: 48 },
  { month: 'Ene', entradas: 72, salidas: 55 },
]

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  fontSize: '13px',
}

export default function DashboardPage() {
  const { stats, products, orders } = useApp()

  const lowStockProducts = products.filter(p => p.stock <= p.minStock).slice(0, 5)
  const recentOrders = orders.slice(0, 5)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Resumen general del almacén</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <StatCard label="Total Productos" value={stats.totalProducts} icon={<Package size={20} />} color="blue" />
        <StatCard label="Unidades en Stock" value={stats.totalStock.toLocaleString()} icon={<Warehouse size={20} />} color="green" />
        <StatCard label="Órdenes Pendientes" value={stats.pendingOrders} icon={<ShoppingCart size={20} />} color="yellow" />
        <StatCard label="Valor del Inventario" value={formatCurrency(stats.totalValue)} icon={<DollarSign size={20} />} color="purple" />
        <StatCard label="Stock Bajo / Sin Stock" value={stats.lowStock} icon={<TrendingDown size={20} />} color="red" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '20px', fontSize: '15px', fontWeight: '600' }}>Movimientos del Inventario</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={CHART_DATA} barGap={4}>
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="entradas" fill="var(--accent-blue)" radius={[4,4,0,0]} name="Entradas" />
              <Bar dataKey="salidas" fill="var(--accent-purple)" radius={[4,4,0,0]} name="Salidas" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '20px', fontSize: '15px', fontWeight: '600' }}>Tendencia de Valor</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={CHART_DATA}>
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="entradas" stroke="var(--accent-green)" strokeWidth={2} dot={false} name="Stock" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Low stock alert */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <AlertTriangle size={16} color="var(--accent-yellow)" />
            <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Alertas de Stock Bajo</h3>
          </div>
          {lowStockProducts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Todo el inventario está en niveles adecuados ✓</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Producto</th><th>Stock</th><th>Mínimo</th></tr></thead>
                <tbody>
                  {lowStockProducts.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontSize: '13px' }}>{p.name}</td>
                      <td><span className={`badge ${p.stock === 0 ? 'badge-red' : 'badge-yellow'}`}>{p.stock}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{p.minStock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>Órdenes Recientes</h3>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>ID</th><th>Tipo</th><th>Estado</th><th>Total</th></tr></thead>
              <tbody>
                {recentOrders.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>{o.id}</td>
                    <td><span className={`badge ${o.type === 'incoming' ? 'badge-blue' : 'badge-purple'}`}>{o.type === 'incoming' ? 'Entrada' : 'Salida'}</span></td>
                    <td><span className={`badge ${o.status === 'completed' ? 'badge-green' : o.status === 'pending' ? 'badge-yellow' : 'badge-blue'}`}>{o.status}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{formatCurrency(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className={`stat-card ${color}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div className="stat-label">{label}</div>
        <div style={{ color: `var(--accent-${color})`, opacity: 0.7 }}>{icon}</div>
      </div>
      <div className="stat-value">{value}</div>
    </div>
  )
}
