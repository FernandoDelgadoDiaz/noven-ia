import { Package } from 'lucide-react'

export default function Maestro() {
  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b border-border/60 shadow-nav px-4 py-3">
        <h1 className="text-sm font-bold text-foreground leading-none tracking-tight">Maestro de productos</h1>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">Catálogo completo del surtido</p>
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
