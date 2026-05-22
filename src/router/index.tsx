import { createBrowserRouter, Navigate } from 'react-router-dom'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import Scanner from '../pages/Scanner'
import Vencimientos from '../pages/Vencimientos'
import Maestro from '../pages/Maestro'
import Importar from '../pages/Importar'
import AppLayout from '../components/layout/AppLayout'
import PrivateRoute from '../components/auth/PrivateRoute'
import ErrorBoundary from '../components/ErrorBoundary'

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
          { path: 'dashboard', element: <ErrorBoundary><Dashboard /></ErrorBoundary> },
          { path: 'scanner', element: <ErrorBoundary><Scanner /></ErrorBoundary> },
          { path: 'vencimientos', element: <ErrorBoundary><Vencimientos /></ErrorBoundary> },
          { path: 'maestro', element: <ErrorBoundary><Maestro /></ErrorBoundary> },
          { path: 'importar', element: <ErrorBoundary><Importar /></ErrorBoundary> },
        ],
      },
    ],
  },
])
