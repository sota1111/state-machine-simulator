import React, { createContext, useContext, useState } from 'react'
import axios from 'axios'

interface AuthContextType {
  token: string | null
  isAuthenticated: boolean
  login: (password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'))

  const login = async (password: string) => {
    try {
      const response = await axios.post('/api/auth/login', { password })
      const { access_token } = response.data
      localStorage.setItem('auth_token', access_token)
      setToken(access_token)
    } catch (error) {
      throw new Error('パスワードが正しくありません')
    }
  }

  const logout = () => {
    localStorage.removeItem('auth_token')
    setToken(null)
  }

  const isAuthenticated = !!token

  return (
    <AuthContext.Provider value={{ token, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
