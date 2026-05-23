import { Package } from 'lucide-react'

export default function Maestro() {
  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-border shadow-nav px-4 py-3.5">
        <h1 className="text-base font-bold text-foreground">Maestro de productos</h1>
        <p className="text-xs text-muted-foreground">Catálogo completo del surtido</p>
      </header>
      <main className="flex flex-col items-center justify-center px-4 py-20 gap-4 text-center">
        <div className="p-5 bg-muted rounded-full">
          <Package className="h-10 w-10 text-muted-foreground" />
        </div>
        <p className="text-foreground font-semibold text-base">Próximamente</p>
        <p className="text-muted-foreground text-sm max-w-xs">
          El catálogo completo de productos estará disponible en una próxima versión.
        </p>
      </main>
    </div>
  )
}
