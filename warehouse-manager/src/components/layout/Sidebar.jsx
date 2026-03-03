import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart,
  BarChart3, Users, Settings, LogOut, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/products', icon: Package, label: 'Productos' },
  { path: '/inventory', icon: Warehouse, label: 'Inventario' },
  { path: '/orders', icon: ShoppingCart, label: 'Órdenes' },
  { path: '/reports', icon: BarChart3, label: 'Reportes' },
  { path: '/suppliers', icon: Users, label: 'Proveedores' },
]

export default function Sidebar({ isOpen, onToggle }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className={`${styles.sidebar} ${!isOpen ? styles.collapsed : ''}`}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>W</div>
        {isOpen && <span className={styles.logoText}>WMS</span>}
        <button className={styles.toggleBtn} onClick={onToggle}>
          {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
            title={!isOpen ? label : ''}
          >
            <Icon size={20} />
            {isOpen && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className={styles.bottom}>
        <NavLink
          to="/settings"
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
          title={!isOpen ? 'Configuración' : ''}
        >
          <Settings size={20} />
          {isOpen && <span>Configuración</span>}
        </NavLink>

        {isOpen && (
          <div className={styles.userCard}>
            <div className={styles.avatar}>{user?.name?.[0] ?? 'U'}</div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user?.name}</div>
              <div className={styles.userRole}>{user?.role}</div>
            </div>
          </div>
        )}

        <button className={`${styles.navItem} ${styles.logoutBtn}`} onClick={handleLogout} title={!isOpen ? 'Salir' : ''}>
          <LogOut size={20} />
          {isOpen && <span>Salir</span>}
        </button>
      </div>
    </aside>
  )
}
