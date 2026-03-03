import React, { createContext, useContext, useState, useCallback } from 'react'
import { INITIAL_PRODUCTS, INITIAL_ORDERS, INITIAL_SUPPLIERS } from '../utils/initialData.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [products, setProducts] = useState(INITIAL_PRODUCTS)
  const [orders, setOrders] = useState(INITIAL_ORDERS)
  const [suppliers, setSuppliers] = useState(INITIAL_SUPPLIERS)

  // ── Products ──────────────────────────────────────────
  const addProduct = useCallback((product) => {
    const newProduct = { ...product, id: Date.now(), createdAt: new Date().toISOString() }
    setProducts(prev => [...prev, newProduct])
    return newProduct
  }, [])

  const updateProduct = useCallback((id, updates) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }, [])

  const deleteProduct = useCallback((id) => {
    setProducts(prev => prev.filter(p => p.id !== id))
  }, [])

  // ── Inventory (stock adjustments) ─────────────────────
  const adjustStock = useCallback((productId, qty, type = 'adjustment', note = '') => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p
      const newStock = Math.max(0, p.stock + qty)
      return { ...p, stock: newStock, lastMovement: new Date().toISOString() }
    }))
  }, [])

  // ── Orders ─────────────────────────────────────────────
  const addOrder = useCallback((order) => {
    const newOrder = {
      ...order,
      id: `ORD-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'pending'
    }
    setOrders(prev => [newOrder, ...prev])
    // Reduce stock for outgoing orders
    if (order.type === 'outgoing') {
      order.items.forEach(item => adjustStock(item.productId, -item.qty, 'sale'))
    }
    return newOrder
  }, [adjustStock])

  const updateOrderStatus = useCallback((orderId, status) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status, updatedAt: new Date().toISOString() } : o))
  }, [])

  // ── Suppliers ─────────────────────────────────────────
  const addSupplier = useCallback((supplier) => {
    const newSupplier = { ...supplier, id: Date.now(), createdAt: new Date().toISOString() }
    setSuppliers(prev => [...prev, newSupplier])
    return newSupplier
  }, [])

  const updateSupplier = useCallback((id, updates) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }, [])

  const deleteSupplier = useCallback((id) => {
    setSuppliers(prev => prev.filter(s => s.id !== id))
  }, [])

  // ── Computed stats ────────────────────────────────────
  const stats = {
    totalProducts: products.length,
    totalStock: products.reduce((sum, p) => sum + p.stock, 0),
    lowStock: products.filter(p => p.stock <= p.minStock).length,
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    totalValue: products.reduce((sum, p) => sum + (p.stock * p.price), 0),
  }

  return (
    <AppContext.Provider value={{
      products, addProduct, updateProduct, deleteProduct,
      adjustStock,
      orders, addOrder, updateOrderStatus,
      suppliers, addSupplier, updateSupplier, deleteSupplier,
      stats,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
