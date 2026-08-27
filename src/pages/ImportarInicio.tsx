import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileCheck2, FileSearch, Layers3, ShieldCheck, Tags } from 'lucide-react'

export default function ImportarInicio() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-none">Importar desde Glaciar</h1>
        <p className="text-sm text-muted-foreground mt-1">Elegí el tipo de carga según el objetivo.</p>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-5xl space-y-5 pb-28">
        <div className="bg-brand-light border border-brand/20 rounded-card px-4 py-3.5 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-brand shrink-0 mt-0.5" />
          <div>
            <p className="text-foreground font-semibold text-sm">Aprendizaje compartido por toda la organización</p>
            <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
              El asistido completo actualiza lo conocido. Los códigos nuevos quedan en una bandeja global y pueden resolverse manualmente
              o usando un CSV filtrado de Glaciar. Una vez clasificados, todas las sucursales reutilizan esa decisión.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => navigate('/importar/familia')}
            className="text-left bg-white rounded-[24px] shadow-card hover:shadow-elevated border border-border/60 hover:border-brand/30 p-5 transition-all active:scale-[0.99]"
          >
            <div className="h-11 w-11 rounded-2xl bg-brand-light flex items-center justify-center mb-4">
              <FileSearch className="h-5 w-5 text-brand" />
            </div>
            <p className="text-xs uppercase tracking-wide text-brand font-bold">Aprendizaje detallado</p>
            <h2 className="text-foreground font-bold text-lg mt-1">Importar por familia</h2>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
              Para un CSV filtrado, por ejemplo Almacén → Golosinas. Permite reconciliar, corregir códigos y confirmar la familia.
            </p>
            <div className="mt-5 flex items-center gap-2 text-brand text-sm font-semibold">
              Abrir por familia <ArrowRight className="h-4 w-4" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/importar/masivo')}
            className="text-left bg-white rounded-[24px] shadow-card hover:shadow-elevated border border-border/60 hover:border-brand/30 p-5 transition-all active:scale-[0.99]"
          >
            <div className="h-11 w-11 rounded-2xl bg-brand-light flex items-center justify-center mb-4">
              <Layers3 className="h-5 w-5 text-brand" />
            </div>
            <p className="text-xs uppercase tracking-wide text-brand font-bold">Mantenimiento</p>
            <h2 className="text-foreground font-bold text-lg mt-1">Asistido completo</h2>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
              Para toda la Reposición Asistida. Actualiza stock/VMD por sucursal y registra automáticamente los códigos desconocidos.
            </p>
            <div className="mt-5 flex items-center gap-2 text-brand text-sm font-semibold">
              Abrir actualización masiva <ArrowRight className="h-4 w-4" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/importar/pendientes')}
            className="text-left bg-white rounded-[24px] shadow-card hover:shadow-elevated border border-border/60 hover:border-brand/30 p-5 transition-all active:scale-[0.99]"
          >
            <div className="h-11 w-11 rounded-2xl bg-brand-light flex items-center justify-center mb-4">
              <Tags className="h-5 w-5 text-brand" />
            </div>
            <p className="text-xs uppercase tracking-wide text-brand font-bold">Resolución manual</p>
            <h2 className="text-foreground font-bold text-lg mt-1">Pendientes de clasificación</h2>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
              Clasificá uno o varios códigos nuevos. La decisión se propaga a todas las sucursales que ya los detectaron.
            </p>
            <div className="mt-5 flex items-center gap-2 text-brand text-sm font-semibold">
              Ver pendientes <ArrowRight className="h-4 w-4" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/importar/pendientes/aprender')}
            className="text-left bg-white rounded-[24px] shadow-card hover:shadow-elevated border border-border/60 hover:border-brand/30 p-5 transition-all active:scale-[0.99]"
          >
            <div className="h-11 w-11 rounded-2xl bg-brand-light flex items-center justify-center mb-4">
              <FileCheck2 className="h-5 w-5 text-brand" />
            </div>
            <p className="text-xs uppercase tracking-wide text-brand font-bold">Resolución automática</p>
            <h2 className="text-foreground font-bold text-lg mt-1">Aprender desde CSV filtrado</h2>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
              Subí, por ejemplo, el CSV de Golosinas. Noven usa su Cód.Familia para resolver juntos todos los pendientes presentes en ese archivo.
            </p>
            <div className="mt-5 flex items-center gap-2 text-brand text-sm font-semibold">
              Aprender desde archivo <ArrowRight className="h-4 w-4" />
            </div>
          </button>
        </div>
      </main>
    </div>
  )
}
