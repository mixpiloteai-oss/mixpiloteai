import { useState, useCallback } from 'react'
import { login, logout, register, authTokens, type LoginResponse } from '../lib/api'

export interface AuthState {
  token: string | null
  isLoggedIn: boolean
  login:    (email: string, password: string) => Promise<LoginResponse>
  register: (name: string, email: string, password: string) => Promise<LoginResponse>
  logout:   () => void
}

/**
 * Provides auth state and actions.
 * Reads initial token from localStorage.
 */
export function useAuth(): AuthState {
  const [token, setToken] = useState<string | null>(authTokens.get)

  const handleLogin = useCallback(async (email: string, password: string) => {
    const result = await login(email, password)
    setToken(result.accessToken)
    return result
  }, [])

  const handleRegister = useCallback(async (name: string, email: string, password: string) => {
    const result = await register(name, email, password)
    setToken(result.accessToken)
    return result
  }, [])

  const handleLogout = useCallback(() => {
    logout()
    setToken(null)
  }, [])

  return {
    token,
    isLoggedIn: !!token,
    login:    handleLogin,
    register: handleRegister,
    logout:   handleLogout,
  }
}
