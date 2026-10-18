import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './Context/AuthContext'
import { ChatProvider } from './Context/ChatContext'
import Chat from './Pages/Chat'
import AuthCallback from './Pages/AuthCallback'
import Home from './Pages/Home'
import Login from './Pages/Login'
import Register from './Pages/Register'
import ResetPassword from './Pages/ResetPassword'
import Profile from './Pages/Profile'

function ProtectedChat() {
  const { loading, isAuthenticated } = useAuth()

  if (loading) return <main>Checking your session...</main>
  return isAuthenticated ? <Chat /> : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { loading, isAuthenticated } = useAuth()

  if (loading) return <main>Checking your session...</main>
  return isAuthenticated ? <Navigate to="/chat" replace /> : children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/chat" element={<ProtectedChat />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ChatProvider>
    </AuthProvider>
  )
}

export default App
