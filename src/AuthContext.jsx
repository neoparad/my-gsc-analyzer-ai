import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

// JWTをデコードする関数（検証なし、ペイロードのみ取得）
function decodeJWT(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded)
  } catch (error) {
    console.error('Error decoding JWT:', error)
    return null
  }
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // トークンからユーザー情報を取得
  const getUserFromToken = (token) => {
    try {
      const decoded = decodeJWT(token)
      if (decoded && decoded.userId) {
        return {
          id: decoded.userId,
          username: decoded.username,
          role: decoded.role || 'user'
        }
      }
    } catch (error) {
      console.error('Error decoding token:', error)
    }
    return null
  }

  useEffect(() => {
    // ページ読み込み時にlocalStorageからトークンをチェック
    const token = localStorage.getItem('authToken')
    const userData = localStorage.getItem('userData')

    if (token) {
      // トークンからユーザー情報を取得
      const userFromToken = getUserFromToken(token)
      
      // localStorageに保存されたユーザーデータがある場合はそれを使用
      let userInfo = userFromToken
      if (userData) {
        try {
          const parsedUserData = JSON.parse(userData)
          userInfo = { ...userFromToken, ...parsedUserData }
        } catch (error) {
          console.error('Error parsing user data:', error)
        }
      }

      if (userInfo) {
        setIsAuthenticated(true)
        setUser(userInfo)
        
        // サーバーから最新のユーザー情報を取得（オプション）
        fetchUserInfo(token)
      } else {
        // トークンが無効な場合、クリア
        localStorage.removeItem('authToken')
        localStorage.removeItem('userData')
      }
    }
    setIsLoading(false)
  }, [])

  // サーバーから最新のユーザー情報を取得
  const fetchUserInfo = async (token) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const userData = await response.json()
        setUser({
          id: userData.id,
          username: userData.username,
          email: userData.email,
          role: userData.role,
          displayName: userData.displayName,
          isActive: userData.isActive
        })
        localStorage.setItem('userData', JSON.stringify(userData))
      }
    } catch (error) {
      console.error('Error fetching user info:', error)
    }
  }

  const login = async (token, userData) => {
    localStorage.setItem('authToken', token)
    if (userData) {
      localStorage.setItem('userData', JSON.stringify(userData))
    }
    
    const userFromToken = getUserFromToken(token)
    const userInfo = userData ? { ...userFromToken, ...userData } : userFromToken
    
    setIsAuthenticated(true)
    setUser(userInfo)
    
    // サーバーから最新情報を取得
    if (token) {
      await fetchUserInfo(token)
    }
  }

  const logout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('userData')
    setIsAuthenticated(false)
    setUser(null)
  }

  // 管理者かどうかを判定
  const isAdmin = user?.role === 'admin'

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      user, 
      login, 
      logout, 
      isLoading,
      isAdmin
    }}>
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
