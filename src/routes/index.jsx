import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useSupabaseAuth'
import Layout from './Layout'
import { LoadingSpinner } from '../components/ui'

// Core Session Workspace Pages (Eagerly loaded to prevent spinner on transition)
import SessionEditor from '../pages/SessionEditor'
import Journal from '../pages/Journal'
import SessionPreferences from '../pages/SessionPreferences'

// Lazy loaded pages
const CampaignList = lazy(() => import('../pages/CampaignList'))
const CampaignDetail = lazy(() => import('../pages/CampaignDetail'))
const Settings = lazy(() => import('../pages/Settings'))
const JoinCampaign = lazy(() => import('../pages/JoinCampaign'))
const Auth = lazy(() => import('../pages/Auth'))
const AuthResetPassword = lazy(() => import('../pages/AuthResetPassword'))
const VerifyEmail = lazy(() => import('../pages/VerifyEmail'))
const NotFound = lazy(() => import('./NotFound'))

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { authState } = useAuth()

  if (authState.isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-300 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!authState || !authState.user) {
    return <Navigate to="/auth" replace />
  }

  return children
}

export default function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
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
          path="/campaigns/:campaignSlug/sessions/:sessionSlug"
          element={
            <ProtectedRoute>
              <SessionEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/:campaignSlug/sessions/:sessionSlug/journal"
          element={
            <ProtectedRoute>
              <Journal />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/:campaignSlug/sessions/:sessionSlug/preferences"
          element={
            <ProtectedRoute>
              <SessionPreferences />
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
          <Route path="/campaigns/:campaignSlug" element={<CampaignDetail />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

