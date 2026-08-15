import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import PrivateRoute from '../components/auth/PrivateRoute'
import AdminRoute from '../components/auth/AdminRoute'
import ErrorBoundary from '../components/ErrorBoundary'
import RouteSkeleton from '../components/ui/RouteSkeleton'
import Login from '../pages/Login'

const Dashboard = lazy(() => import('../pages/Dashboard'))
const Scanner = lazy(() => import('../pages/Scanner'))
const Vencimientos = lazy(() => import('../pages/Vencimientos'))
const Historial = lazy(() => import('../pages/Historial'))
const Analisis = lazy(() => import('../pages/Analisis'))
const Importar = lazy(() => import('../pages/Importar'))
const Admin = lazy(() => import('../pages/Admin'))
const Desafio5S = lazy(() => import('../features/desafio5s/Desafio5SPage'))

const suspenseProps = { fallback: <RouteSkeleton /> }
const lazyPage = (Page: typeof Dashboard) => <ErrorBoundary><Suspense {...suspenseProps}><Page /></Suspense></ErrorBoundary>

export const router = createBrowserRouter([
  { path: '/login', element: <ErrorBoundary><Login /></ErrorBoundary> },
  // Módulo público e independiente. No utiliza AppLayout ni guards de Noven.
  { path: '/desafio-5s', element: lazyPage(Desafio5S) },
  {
    path: '/',
    element: <PrivateRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: lazyPage(Dashboard) },
          { path: 'scanner', element: lazyPage(Scanner) },
          { path: 'vencimientos', element: lazyPage(Vencimientos) },
          { path: 'historial', element: lazyPage(Historial) },
          { path: 'analisis', element: lazyPage(Analisis) },
          {
            element: <AdminRoute />,
            children: [
              { path: 'importar', element: lazyPage(Importar) },
              { path: 'admin', element: lazyPage(Admin) },
            ],
          },
        ],
      },
    ],
  },
])
