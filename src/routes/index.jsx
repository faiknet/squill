import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useSupabaseAuth'
import Layout from './Layout'
import { LoadingSpinner } from '../components/ui'

// Core Session Workspace Pages (Lazy loaded to reduce initial bundle and improve non-session page loads)
const SessionEditor = lazy(() => import('../pages/SessionEditor'))
const Journal = lazy(() => import('../pages/Journal'))
const Activity = lazy(() => import('../pages/Activity'))
const SessionPreferences = lazy(() => import('../pages/SessionPreferences'))
const SessionTabsLayout = lazy(() => import('../components/sessions/SessionTabsLayout'))

// Lazy loaded pages
const CampaignList = lazy(() => import('../pages/CampaignList'))
const CampaignDetail = lazy(() => import('../pages/CampaignDetail'))
const Settings = lazy(() => import('../pages/Settings'))
const JoinCampaign = lazy(() => import('../pages/JoinCampaign'))
const Auth = lazy(() => import('../pages/Auth'))
const AuthCallback = lazy(() => import('../pages/AuthCallback'))
const AuthResetPassword = lazy(() => import('../pages/AuthResetPassword'))
const VerifyEmail = lazy(() => import('../pages/VerifyEmail'))
import NotFound from './NotFound'

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { authState } = useAuth()

  if (authState.isLoading) {
    return <LoadingSpinner />
  }

  if (!authState || !authState.user) {
    return <Navigate to="/" replace />
  }

  return children
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Auth />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
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

        {/* Session workspace — nested under persistent layout for smooth tab transitions */}
        <Route
          path="/campaigns/:campaignSlug/sessions/:sessionSlug"
          element={
            <ProtectedRoute>
              <SessionTabsLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<SessionEditor />} />
          <Route path="journal" element={<Journal />} />
          <Route path="activity" element={<Activity />} />
          <Route path="preferences" element={<SessionPreferences />} />
        </Route>
        <Route
          path="/dashboard"
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

