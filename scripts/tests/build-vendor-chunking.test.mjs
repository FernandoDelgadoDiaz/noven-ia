import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const config = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8')

assert.match(config, /manualChunks\s*\(id\)/, 'Vite debe separar vendors estables mediante manualChunks')
assert.match(config, /return 'vendor-react'/, 'React debe quedar en un chunk estable propio')
assert.match(config, /return 'vendor-router'/, 'React Router debe quedar en un chunk estable propio')
assert.match(config, /return 'vendor-supabase'/, 'Supabase debe quedar en un chunk estable propio')
assert.doesNotMatch(
  config,
  /chunkSizeWarningLimit\s*:/,
  'no se debe ocultar la deuda de bundle aumentando el limite de warning',
)

console.log('✓ Build separa React, Router y Supabase sin ocultar warnings de tamaño')
