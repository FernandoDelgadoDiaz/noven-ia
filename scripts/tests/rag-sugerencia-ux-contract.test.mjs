// Contrato de la presentación de la sugerencia por urgencia.
//
// La lógica ya está probada en `rag-cobertura-motor-contract`. Lo que se
// protege acá es distinto y no menos importante: CÓMO se le presenta al
// operador.
//
// Una sugerencia por urgencia presentada como "porcentaje óptimo" o como algo
// que el sistema aprendió cambia lo que la persona hace con ella: deja de
// decidir y empieza a obedecer. Y un botón que aplique solo convierte una
// herramienta de apoyo en una que fija precios sin que nadie lo haya decidido.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const modal = read('src/components/dashboard/EditarVencimientoModalSeguro.tsx')
const badge = read('src/components/dashboard/RagSeguimientoBadge.tsx')
const hook = read('src/hooks/useEscalaRag.ts')

// --- 1. No hay pantallas nuevas ---------------------------------------------
//
// La tarjeta de RAG y la línea del Dashboard ya existían. La sugerencia vive
// dentro de ellas.

assert.ok(fs.existsSync(path.join(ROOT, 'src/components/dashboard/RagSeguimientoBadge.tsx')))
assert.ok(fs.existsSync(path.join(ROOT, 'src/components/dashboard/EditarVencimientoModalSeguro.tsx')))
for (const inventada of ['SugerenciaRagPage', 'PanelSugerencias', 'RagSugerenciaModal']) {
  assert.ok(!fs.existsSync(path.join(ROOT, `src/pages/${inventada}.tsx`)),
    `no corresponde una pantalla nueva (${inventada}): la sugerencia va en la tarjeta que ya existe`)
}

const router = read('src/router/index.tsx')
assert.doesNotMatch(router, /sugerencia/i, 'no se agrega una ruta para esto')

// --- 2. Un solo motor para los dos lugares ----------------------------------
//
// Si la tarjeta y el Dashboard calcularan por su cuenta, el operador podría ver
// dos números distintos para lo mismo, y no habría forma de saber cuál creer.

for (const [nombre, fuente] of [['la tarjeta de Control', modal], ['la línea del Dashboard', badge]]) {
  // Tiene que ser el RESULTADO del motor, no una mención suelta: dejar el
  // identificador en el archivo y calcular por otro lado pasaría una aserción
  // de presencia sin que el motor decida nada.
  assert.match(fuente, /return evaluarSugerencia\(\{/,
    `${nombre} debe devolver lo que calcula el motor, no su propio cálculo`)
  assert.match(fuente, /useEscalaRag/,
    `${nombre} debe tomar la escala de la organización`)
  assert.doesNotMatch(fuente, /\[\s*10\s*,\s*20\s*,\s*30\s*,\s*40\s*,\s*50\s*,\s*60\s*,\s*70\s*\]/,
    `${nombre} no puede tener la escala hardcodeada: es política de la organización`)
}

// --- 3. Human-in-the-loop ---------------------------------------------------
//
// El usuario aplica, elige otro porcentaje autorizado, o ignora. Nada se
// aplica solo.

// Se recorta al bloque JSX de la sugerencia y nada más.
//
// Hay que anclar en la ETIQUETA renderizada, no en el texto suelto: el archivo
// menciona "Sugerencia por urgencia" antes, en un comentario, y anclar ahí
// abarcaba todos los handlers del modal y hacía fallar la aserción por lo que
// hay fuera del bloque en vez de por lo que hay dentro.
const inicioBloque = modal.indexOf('>Sugerencia por urgencia<')
assert.ok(inicioBloque !== -1, 'la tarjeta debe renderizar la etiqueta "Sugerencia por urgencia"')
const bloqueSugerencia = modal.slice(inicioBloque, modal.indexOf('Finalizar RAG vigente', inicioBloque))
assert.ok(bloqueSugerencia.length > 0 && bloqueSugerencia.length < 3000,
  'el bloque de la sugerencia se recortó mal: revisá los anclajes')

// El botón sólo carga el valor en el campo; no guarda ni registra nada.
assert.match(bloqueSugerencia, /setRagPorcentaje\(String\(sugerencia\.hasta\)\)/,
  'el botón de la sugerencia sólo propone el valor en el campo editable')
assert.doesNotMatch(bloqueSugerencia, /handleGuardar|supabase\.rpc|registrar_control/,
  'la sugerencia NUNCA aplica sola: el botón no guarda')

// El campo sigue siendo editable, que es "elegir otro porcentaje".
assert.match(modal, /onChange=\{\(e\) => setRagPorcentaje\(e\.target\.value\)\}/,
  'el operador tiene que poder escribir otro porcentaje')

// Ignorar es no hacer nada: no puede haber un temporizador ni un auto-apply.
for (const automatismo of [/setTimeout\([^)]*setRagPorcentaje/, /useEffect\([^)]*setRagPorcentaje\(String\(sugerencia/]) {
  assert.doesNotMatch(modal, automatismo,
    'la sugerencia no puede aplicarse sola por paso del tiempo ni por efecto')
}

// --- 4. Es urgencia, no evidencia -------------------------------------------
//
// El lenguaje importa: "óptimo" o "aprendido" convierten una heurística de
// urgencia en una afirmación que los datos no sostienen.

assert.match(modal, /Sugerencia por urgencia/,
  'la etiqueta tiene que decir de qué se trata')
assert.match(bloqueSugerencia, /no un porcentaje óptimo/,
  'hay que decir explícitamente que no es un óptimo')

for (const fuente of [modal, badge]) {
  for (const prohibido of [/porcentaje óptimo(?! )/i, /\boptimiza/i, /aprendi[óo]/i, /recomendación del modelo/i, /\bIA\b.{0,30}sugiere/i]) {
    const bloqueTexto = fuente.replace(/no un porcentaje óptimo/g, '')
    assert.doesNotMatch(bloqueTexto, prohibido,
      'la sugerencia no puede presentarse como óptimo ni como algo aprendido')
  }
}

// --- 5. El límite se muestra ------------------------------------------------

assert.match(bloqueSugerencia, /topeInsuficiente/,
  'cuando el tope de la escala puede no alcanzar, hay que decirlo')
assert.match(bloqueSugerencia, /puede no alcanzar/,
  'el aviso tiene que ser legible, no un flag interno')
assert.match(badge, /topeInsuficiente/,
  'la línea del Dashboard también avisa del tope')

// --- 6. El detalle aparece cuando corresponde -------------------------------
//
// Velocidad necesaria, cobertura y días comerciales sólo cuando el estado es
// insuficiente o sin movimiento. En los demás la tarjeta queda como estaba.

assert.match(modal, /estado_seguimiento_rag === 'insuficiente'\s*\n?\s*\|\|\s*seguimientoRag\.estado_seguimiento_rag === 'sin_movimiento'/,
  'el detalle del déficit se muestra en insuficiente y sin movimiento')
for (const campo of ['Vel. necesaria', 'Cobertura', 'Días comerciales']) {
  assert.ok(modal.includes(campo), `la tarjeta debe mostrar "${campo}" cuando hay déficit`)
}

// --- 7. La instrumentación se escribe ---------------------------------------
//
// Sin esto no se puede confrontar la regla contra la realidad en seis meses.

assert.match(modal, /instrumentar_sugerencia_rag/,
  'al guardar un RAG hay que registrar qué se sugirió y qué se hizo')
for (const origen of ['sugerida_aceptada', 'sugerida_rechazada', 'manual']) {
  assert.ok(modal.includes(`'${origen}'`), `falta distinguir el origen ${origen}`)
}

// Un fallo de instrumentación no puede voltear un control ya registrado: es
// evidencia, no parte de la operación.
// Se recorta hacia ADELANTE desde la llamada. Mirar hacia atrás alcanzaba el
// setError del fallo real del control —que sí corresponde— y hacía fallar la
// aserción por código que no es el que se está evaluando.
const inicioInstr = modal.indexOf("supabase.rpc('instrumentar_sugerencia_rag'")
assert.ok(inicioInstr !== -1, 'la instrumentación tiene que llamarse al guardar')
const bloqueInstr = modal.slice(inicioInstr, modal.indexOf('onGuardado()', inicioInstr))

assert.match(bloqueInstr, /console\.error/,
  'un fallo de instrumentación se loguea')
assert.doesNotMatch(bloqueInstr, /setError\(/,
  'un fallo de instrumentación no puede voltear un control ya registrado: es evidencia, no operación')
assert.doesNotMatch(bloqueInstr, /\breturn\b/,
  'un fallo de instrumentación no puede cortar el flujo: el control ya quedó registrado')

// --- 8. La escala se lee acotada por RLS, no filtrada a mano ----------------

assert.match(hook, /from\('rag_escala_descuento'\)/)
assert.doesNotMatch(hook, /\.eq\('organizacion_id'/,
  'la RLS acota la escala; filtrar además da la impresión de que la seguridad depende del select')
assert.match(hook, /setEscala\(\[\]\)/,
  'sin escala la lista queda vacía y el motor no sugiere: no hay default')

console.log('✓ La sugerencia vive en la tarjeta existente, con un solo motor para los dos lugares')
console.log('✓ Human-in-the-loop: propone en el campo, nunca aplica sola, y se declara como urgencia')
