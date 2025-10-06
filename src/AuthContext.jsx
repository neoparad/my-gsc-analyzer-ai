import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // ページ読み込み時にlocalStorageからトークンをチェック
    const token = localStorage.getItem('authToken')
    const username = localStorage.getItem('username')

    if (token && username) {
      setIsAuthenticated(true)
      setUser({ username, token })
    }
    setIsLoading(false)
  }, [])

  const login = (token, username) => {
    localStorage.setItem('authToken', token)
    localStorage.setItem('username', username)
    setIsAuthenticated(true)
    setUser({ username, token })
  }

  const logout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('username')
    setIsAuthenticated(false)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
