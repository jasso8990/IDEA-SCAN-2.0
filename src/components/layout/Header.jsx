import React from 'react'
import { Menu, Bell, Search } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './Header.module.css'

export default function Header({ onMenuClick }) {
  const { stats } = useApp()

  return (
    <header className={styles.header}>
      <button className={styles.menuBtn} onClick={onMenuClick}>
        <Menu size={20} />
      </button>

      <div className={styles.searchBar}>
        <Search size={16} className={styles.searchIcon} />
        <input className={styles.searchInput} placeholder="Buscar productos, órdenes..." />
      </div>

      <div className={styles.right}>
        {stats.lowStock > 0 && (
          <div className={styles.alertBadge}>
            <span>{stats.lowStock}</span> stock bajo
          </div>
        )}
        <button className={styles.iconBtn}>
          <Bell size={20} />
          {stats.pendingOrders > 0 && (
            <span className={styles.notifDot}>{stats.pendingOrders}</span>
          )}
        </button>
      </div>
    </header>
  )
}
