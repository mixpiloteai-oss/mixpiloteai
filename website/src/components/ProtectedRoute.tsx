import { Navigate, useLocation } from 'react-router-dom'
import { authTokens, isTokenExpired } from '../lib/api'

interface ProtectedRouteProps {
  children: React.ReactNode
  redirectTo?: string
}

export default function ProtectedRoute({ children, redirectTo = '/login' }: ProtectedRouteProps) {
  const location = useLocation()
  const token = authTokens.get()
  const isAuthenticated = token !== null && !isTokenExpired()

  if (!isAuthenticated) {
    // Preserve the intended destination so login can redirect back
    return <Navigate to={`${redirectTo}?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }

  return <>{children}</>
}
