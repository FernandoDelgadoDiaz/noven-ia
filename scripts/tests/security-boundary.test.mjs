import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')

// Sólo archivos que forman parte de los flujos activos del browser. Los archivos
// legacy conservados temporalmente como referencia no cuentan como contrato vivo.
const ACTIVE_BROWSER_FILES = [
  'src/pages/Scanner.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/Vencimientos.tsx',
  'src/pages/ImportarFamiliaSeguro.tsx',
  'src/pages/ImportarMasivoSeguro.tsx',
  'src/pages/AdminSeguro.tsx',
  'src/pages/HistorialSeguro.tsx',
  'src/components/dashboard/EditarVencimientoModalSeguro.tsx',
  'src/components/dashboard/AccionOperativaModal.tsx',
  'src/hooks/useProductos.ts',
  'src/hooks/useVencimientos.ts',
  'src/hooks/useVencimientosLista.ts',
  'src/hooks/useAccionesOperativas.ts',
]

const PROTECTED_TABLES = [
  'productos',
  'producto_sucursal',
  'producto_codigos',
  'vencimientos',
  'acciones_operativas',
  'vencimiento_observaciones',
  'intervenciones_rag',
  'usuarios',
  'usuario_familias',
  'usuario_familias_sucursal',
  'usuario_accesos',
  'sucursales',
  'familias',
  'sectores',
]

const violations = []

for (const rel of ACTIVE_BROWSER_FILES) {
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) {
    violations.push(`${rel}: archivo activo esperado inexistente`)
    continue
  }

  const source = fs.readFileSync(abs, 'utf8')
  for (const table of PROTECTED_TABLES) {
    // Captura tanto `.from('tabla').update(...)` como el formato multilínea:
    // `.from('tabla')\n  .update(...)`.
    const re = new RegExp(
      String.raw`\.from\(\s*['\"]${table}['\"]\s*\)\s*\.(?:insert|update|delete|upsert)\s*\(`,
      'g',
    )
    if (re.test(source)) {
      violations.push(`${rel}: DML browser directo sobre public.${table}`)
    }
  }
}

if (violations.length > 0) {
  console.error('Frontera de seguridad multitenant violada:')
  for (const v of violations) console.error(`  - ${v}`)
  console.error('\nUsar un RPC acotado o endpoint server-side con validación de scope.')
  process.exit(1)
}

console.log(
  `OK · ${ACTIVE_BROWSER_FILES.length} archivos activos sin DML directo sobre tablas protegidas`,
)
