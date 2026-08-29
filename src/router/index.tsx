import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import PrivateRoute from '../components/auth/PrivateRoute'
import OperationalRoute from '../components/auth/OperationalRoute'
import CatalogWriteRoute from '../components/auth/CatalogWriteRoute'
import AdminRoute from '../components/auth/AdminRoute'
import AccessAdminRoute from '../components/auth/AccessAdminRoute'
import ErrorBoundary from '../components/ErrorBoundary'
import RouteSkeleton from '../components/ui/RouteSkeleton'

// Login y activación deben poder abrirse antes de una sesión normal.
import Login from '../pages/Login'
import ActivarCuenta from '../pages/ActivarCuenta'

// Lazy loading por ruta — cada página genera su propio chunk en build
const Dashboard = lazy(() => import('../pages/Dashboard'))
const Scanner = lazy(() => import('../pages/Scanner'))
const Vencimientos = lazy(() => import('../pages/Vencimientos'))
const Historial = lazy(() => import('../pages/Historial'))
const Analisis = lazy(() => import('../pages/Analisis'))
const ImportarInicio = lazy(() => import('../pages/ImportarInicio'))
const ImportarFamilia = lazy(() => import('../pages/ImportarFamiliaSeguro'))
const ImportarMasivo = lazy(() => import('../pages/ImportarMasivoSeguro'))
const PendientesCatalogo = lazy(() => import('../pages/PendientesCatalogo'))
const AprenderPendientesCsv = lazy(() => import('../pages/AprenderPendientesCsv'))
const Admin = lazy(() => import('../pages/Admin'))
const AdminAccesos = lazy(() => import('../pages/AdminAccesos'))

const suspenseProps = { fallback: <RouteSkeleton /> }

export const router = createBrowserRouter([
  { path: '/login', element: <ErrorBoundary><Login /></ErrorBoundary> },
  { path: '/activar', element: <ErrorBoundary><ActivarCuenta /></ErrorBoundary> },
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
            element: <ErrorBoundary><Suspense {...suspenseProps}><Dashboard /></Suspense></ErrorBoundary>,
          },
          {
            // Scanner es una herramienta de escritura local: zonal queda fuera.
            element: <OperationalRoute />,
            children: [
              {
                path: 'scanner',
                element: <ErrorBoundary><Suspense {...suspenseProps}><Scanner /></Suspense></ErrorBoundary>,
              },
            ],
          },
          {
            path: 'vencimientos',
            element: <ErrorBoundary><Suspense {...suspenseProps}><Vencimientos /></Suspense></ErrorBoundary>,
          },
          {
            path: 'historial',
            element: <ErrorBoundary><Suspense {...suspenseProps}><Historial /></Suspense></ErrorBoundary>,
          },
          {
            path: 'analisis',
            element: <ErrorBoundary><Suspense {...suspenseProps}><Analisis /></Suspense></ErrorBoundary>,
          },
          {
            // La bandeja mantiene lectura zonal; la propia página oculta acciones
            // cuando el ítem no cae en una sucursal gestionable por el actor.
            path: 'importar/pendientes',
            element: <ErrorBoundary><Suspense {...suspenseProps}><PendientesCatalogo /></Suspense></ErrorBoundary>,
          },
          {
            // Escrituras de importación/catálogo: gerente o supervisor local exacto.
            element: <CatalogWriteRoute />,
            children: [
              {
                path: 'importar',
                element: <ErrorBoundary><Suspense {...suspenseProps}><ImportarInicio /></Suspense></ErrorBoundary>,
              },
              {
                path: 'importar/familia',
                element: <ErrorBoundary><Suspense {...suspenseProps}><ImportarFamilia /></Suspense></ErrorBoundary>,
              },
              {
                path: 'importar/masivo',
                element: <ErrorBoundary><Suspense {...suspenseProps}><ImportarMasivo /></Suspense></ErrorBoundary>,
              },
              {
                path: 'importar/pendientes/aprender',
                element: <ErrorBoundary><Suspense {...suspenseProps}><AprenderPendientesCsv /></Suspense></ErrorBoundary>,
              },
            ],
          },
          {
            // Administración de personas: exclusivamente gerente de la sucursal exacta.
            element: <AdminRoute />,
            children: [
              {
                path: 'admin',
                element: <ErrorBoundary><Suspense {...suspenseProps}><Admin /></Suspense></ErrorBoundary>,
              },
            ],
          },
          {
            // Administración superior: exclusiva de la cuenta gerente 091 + admin_organizacion.
            element: <AccessAdminRoute />,
            children: [
              {
                path: 'admin/accesos',
                element: <ErrorBoundary><Suspense {...suspenseProps}><AdminAccesos /></Suspense></ErrorBoundary>,
              },
            ],
          },
        ],
      },
    ],
  },
])