from pathlib import Path

root = Path(__file__).resolve().parents[1]

dashboard = root / 'src/pages/Dashboard.tsx'
text = dashboard.read_text(encoding='utf-8')

old_import = "import { Package, ScanLine, RefreshCw, AlertTriangle, Bell, FolderX, HandHeart, Trash2, CircleCheckBig } from 'lucide-react'"
new_import = "import { Package, ScanLine, RefreshCw, AlertTriangle, FolderX, HandHeart, Trash2, CircleCheckBig } from 'lucide-react'"
assert old_import in text, 'Dashboard lucide import changed; aborting guarded patch'
text = text.replace(old_import, new_import, 1)

anchor = "import AccionOperativaModal from '@/components/dashboard/AccionOperativaModal'\n"
addition = anchor + "import RadarZonalBell from '@/components/dashboard/RadarZonalBell'\n"
assert anchor in text and "RadarZonalBell" not in text, 'Dashboard import anchor changed or already patched'
text = text.replace(anchor, addition, 1)

old_bell = '''            <button
              type="button"
              className="relative h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground transition-colors duration-150 active:scale-[0.94]"
              aria-label="Notificaciones"
            >
              <Bell className="h-4 w-4" />
              {hayCriticos && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white" />
              )}
            </button>'''
new_bell = '''            <RadarZonalBell sucursalId={sucursalId} hayCriticos={hayCriticos} />'''
assert old_bell in text, 'Dashboard Bell block changed; aborting guarded patch'
text = text.replace(old_bell, new_bell, 1)
dashboard.write_text(text, encoding='utf-8')

layout = root / 'src/components/layout/AppLayout.tsx'
layout_text = layout.read_text(encoding='utf-8')
old_copy = '🔔 Activá las notificaciones para recibir alertas de vencimientos urgentes'
new_copy = '🔔 Activá las notificaciones para recibir alertas urgentes y de Radar Zonal'
assert old_copy in layout_text, 'Push banner copy changed; aborting guarded patch'
layout.write_text(layout_text.replace(old_copy, new_copy, 1), encoding='utf-8')

print('Radar Zonal UI patch applied safely.')
