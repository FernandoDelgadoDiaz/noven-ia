import { createBrowserRouter, Navigate } from 'react-router-dom'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import Scanner from '../pages/Scanner'
import Vencimientos from '../pages/Vencimientos'
import Maestro from '../pages/Maestro'
import AppLayout from '../components/layout/AppLayout'
import PrivateRoute from '../components/auth/PrivateRoute'

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <PrivateRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'scanner', element: <Scanner /> },
          { path: 'vencimientos', element: <Vencimientos /> },
          { path: 'maestro', element: <Maestro /> },
        ],
      },
    ],
  },
])
