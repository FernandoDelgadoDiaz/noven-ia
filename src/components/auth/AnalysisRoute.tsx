import { Navigate, Outlet } from 'react-router-dom'
import { usePuedeVerAnalisis } from '@/hooks/usePuedeVerAnalisis'

export default function AnalysisRoute() {
  const { puedeVerAnalisis, loading } = usePuedeVerAnalisis()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-brand" />
          <p className="text-sm text-muted-foreground">Verificando alcance gerencial...</p>
        </div>
      </div>
    )
  }

  if (!puedeVerAnalisis) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
