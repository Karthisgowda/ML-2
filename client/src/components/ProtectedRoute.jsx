import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('agentToken')
  return token ? children : <Navigate to="/agent/login" replace />
}
