import React from 'react'
import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
