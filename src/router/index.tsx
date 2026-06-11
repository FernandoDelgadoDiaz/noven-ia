import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import PrivateRoute from '../components/auth/PrivateRoute'
import AdminRoute from '../components/auth/AdminRoute'
import ErrorBoundary from '../components/ErrorBoundary'
import RouteSkeleton from '../components/ui/RouteSkeleton'

// Login se importa estáticamente — es la primera ruta que carga, sin overhead
import Login from '../pages/Login'

// Lazy loading por ruta — cada página genera su propio chunk en build
const Dashboard = lazy(() => import('../pages/Dashboard'))
const Scanner = lazy(() => import('../pages/Scanner'))
const Vencimientos = lazy(() => import('../pages/Vencimientos'))
const Maestro = lazy(() => import('../pages/Maestro'))
const Importar = lazy(() => import('../pages/Importar'))
const Admin = lazy(() => import('../pages/Admin'))

const suspenseProps = { fallback: <RouteSkeleton /> }

export const router = createBrowserRouter([
  { path: '/login', element: <ErrorBoundary><Login /></ErrorBoundary> },
  {
    path: '/',
    element: <PrivateRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          {
            path: 'dashboard',
            element: (
              <ErrorBoundary>
                <Suspense {...suspenseProps}><Dashboard /></Suspense>
              </ErrorBoundary>
            ),
          },
          {
            path: 'scanner',
            element: (
              <ErrorBoundary>
                <Suspense {...suspenseProps}><Scanner /></Suspense>
              </ErrorBoundary>
            ),
          },
          {
            path: 'vencimientos',
            element: (
              <ErrorBoundary>
                <Suspense {...suspenseProps}><Vencimientos /></Suspense>
              </ErrorBoundary>
            ),
          },
          {
            path: 'maestro',
            element: (
              <ErrorBoundary>
                <Suspense {...suspenseProps}><Maestro /></Suspense>
              </ErrorBoundary>
            ),
          },
          {
            path: 'importar',
            element: (
              <ErrorBoundary>
                <Suspense {...suspenseProps}><Importar /></Suspense>
              </ErrorBoundary>
            ),
          },
          {
            element: <AdminRoute />,
            children: [
              {
                path: 'admin',
                element: (
                  <ErrorBoundary>
                    <Suspense {...suspenseProps}><Admin /></Suspense>
                  </ErrorBoundary>
                ),
              },
            ],
          },
        ],
      },
    ],
  },
])
