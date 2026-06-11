/**
 * Fallback de carga para rutas lazy-loaded.
 * Se muestra mientras el chunk de la página se descarga.
 */
export default function RouteSkeleton() {
  return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      {/* Header skeleton */}
      <div className="bg-white border-b border-border/40 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-36 bg-muted rounded-lg animate-pulse" />
            <div className="h-3.5 w-24 bg-muted/60 rounded-lg animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-9 bg-muted rounded-xl animate-pulse" />
            <div className="h-9 w-9 bg-brand/20 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 px-4 py-5 space-y-4">
        {/* Cards row */}
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[136px] bg-white rounded-[24px] shadow-card animate-pulse" />
          ))}
        </div>

        {/* List items */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[88px] bg-white rounded-[24px] shadow-card animate-pulse" />
        ))}
      </div>
    </div>
  )
}
