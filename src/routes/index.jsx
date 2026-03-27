import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useSupabaseAuth'
import Layout from './Layout'

// Pages
import CampaignList from '../pages/CampaignList'
import CampaignDetail from '../pages/CampaignDetail'
import SessionEditor from '../pages/SessionEditor'
import Journal from '../pages/Journal'
import Settings from '../pages/Settings'
import JoinCampaign from '../pages/JoinCampaign'
import Auth from '../pages/Auth'
import AuthResetPassword from '../pages/AuthResetPassword'
import VerifyEmail from '../pages/VerifyEmail'
import NotFound from './NotFound'

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { authState } = useAuth()

  if (authState.isLoading) {
    return <div className="min-h-screen bg-gray-950 text-gray-300 flex items-center justify-center">Loading...</div>
  }

  if (!authState || !authState.user) {
    return <Navigate to="/auth" replace />
  }

  return children
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/reset-password" element={<AuthResetPassword />} />
      <Route path="/auth/verify-email" element={<VerifyEmail />} />
      <Route path="/join/:code" element={<JoinCampaign />} />

      {/* Campaigns - standalone layout (no Layout wrapper) */}
      <Route
        path="/campaigns"
        element={
          <ProtectedRoute>
            <CampaignList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/:id/sessions/:sessionId"
        element={
          <ProtectedRoute>
            <SessionEditor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/:id/sessions/:sessionId/journal"
        element={
          <ProtectedRoute>
            <Journal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={<Navigate to="/campaigns" replace />}
      />
      <Route
        path="/"
        element={<Navigate to="/campaigns" replace />}
      />

      {/* Protected routes with Layout */}
      <Route
        element={(
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        )}
      >
        <Route path="/settings" element={<Settings />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
