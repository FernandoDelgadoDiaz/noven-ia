import { Package } from 'lucide-react'

export default function Maestro() {
  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-none">Maestro de productos</h1>
        <p className="text-sm text-muted-foreground mt-1 leading-none">Catálogo completo del surtido</p>
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
