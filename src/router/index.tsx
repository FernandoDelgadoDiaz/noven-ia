import { createBrowserRouter } from 'react-router-dom'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import Scanner from '../pages/Scanner'
import Vencimientos from '../pages/Vencimientos'
import Maestro from '../pages/Maestro'
import AppLayout from '../components/layout/AppLayout'

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'scanner', element: <Scanner /> },
      { path: 'vencimientos', element: <Vencimientos /> },
      { path: 'maestro', element: <Maestro /> },
    ],
  },
])
