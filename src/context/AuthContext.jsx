import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

// Default users (in production, replace with real API auth)
const USERS = [
  { id: 1, username: 'admin', password: 'admin123', name: 'Admin User', role: 'admin', email: 'admin@warehouse.com' },
  { id: 2, username: 'operator', password: 'op123', name: 'Operator', role: 'operator', email: 'op@warehouse.com' },
]

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('wms_user')
    if (saved) {
      setUser(JSON.parse(saved))
    }
    setLoading(false)
  }, [])

  const login = (username, password) => {
    const found = USERS.find(u => u.username === username && u.password === password)
    if (found) {
      const { password: _, ...safeUser } = found
      setUser(safeUser)
      localStorage.setItem('wms_user', JSON.stringify(safeUser))
      return { success: true }
    }
    return { success: false, error: 'Credenciales incorrectas' }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('wms_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
