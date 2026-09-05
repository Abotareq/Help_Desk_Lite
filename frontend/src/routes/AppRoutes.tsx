import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { SignInPage } from '../features/auth/SignInPage'
import { UserRole } from '../types/domain'
import { PlaceholderPage } from './PlaceholderPage'

const HANDLER_ROLES = [UserRole.AGENT, UserRole.MANAGER]
const MANAGER_ONLY = [UserRole.MANAGER]

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<PlaceholderPage title="My requests" />} />

        {/*
          Every restricted route is gated here as well as hidden from the
          sidebar. Filtering the nav only removes the link — someone typing the
          path, or following an old bookmark after a role change, would still
          land on the screen.
        */}
        <Route
          path="queue"
          element={
            <ProtectedRoute roles={HANDLER_ROLES}>
              <PlaceholderPage title="Queue" />
            </ProtectedRoute>
          }
        />
        <Route
          path="all"
          element={
            <ProtectedRoute roles={MANAGER_ONLY}>
              <PlaceholderPage title="All requests" />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute roles={MANAGER_ONLY}>
              <PlaceholderPage title="Dashboard" />
            </ProtectedRoute>
          }
        />
        <Route
          path="people"
          element={
            <ProtectedRoute roles={MANAGER_ONLY}>
              <PlaceholderPage title="People" />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
