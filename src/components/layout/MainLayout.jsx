import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Header from './Header.jsx'
import styles from './MainLayout.module.css'

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className={styles.layout}>
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />
      <div className={`${styles.main} ${!sidebarOpen ? styles.mainExpanded : ''}`}>
        <Header onMenuClick={() => setSidebarOpen(o => !o)} />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
