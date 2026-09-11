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

// --- 3. Validación gerencial sin cambio directo -----------------------------
//
// El porcentaje deja de ser una entrada del browser. Gerencia valida el único
// escalón calculado; la operación central y la verificación ocurren después.

// Se recorta al bloque JSX de la sugerencia y nada más.
//
// Hay que anclar en la ETIQUETA renderizada, no en el texto suelto: el archivo
// menciona "Sugerencia por urgencia" antes, en un comentario, y anclar ahí
// abarcaba todos los handlers del modal y hacía fallar la aserción por lo que
// hay fuera del bloque en vez de por lo que hay dentro.
const inicioBloque = modal.indexOf('>Sugerencia por urgencia<')
assert.ok(inicioBloque !== -1, 'la tarjeta debe renderizar la etiqueta "Sugerencia por urgencia"')
const bloqueSugerencia = modal.slice(inicioBloque, modal.indexOf('Finalizar RAG vigente', inicioBloque))
assert.ok(bloqueSugerencia.length > 0 && bloqueSugerencia.length < 6000,
  'el bloque de la sugerencia se recortó mal: revisá los anclajes')

assert.match(bloqueSugerencia, /Informar \$\{sugerencia\.hasta\}%/,
  'gerencia valida con la acción Informar NN%')
assert.match(bloqueSugerencia, /handleSolicitarCambioRag/,
  'la acción debe crear una solicitud, no modificar la intervención')
assert.match(bloqueSugerencia, /Requiere gerente o supervisor/,
  'la operadora ve la sugerencia pero no puede validarla')
assert.doesNotMatch(modal, /setRagPorcentaje|type="number"[^>]+rag/i,
  'el porcentaje RAG no puede ser editable')
assert.doesNotMatch(modal, /\bUsar \{sugerencia\.hasta\}%|elegir otro porcentaje/,
  'la UI no debe conservar lenguaje del flujo directo anterior')

// Ignorar es no hacer nada: no puede haber un temporizador ni un auto-apply.
for (const automatismo of [/setTimeout\([^)]*handleSolicitarCambioRag/, /useEffect\([^)]*handleSolicitarCambioRag/]) {
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

// El aviso de que UN escalón puede no alcanzar es distinto del tope de escala:
// el tope dice "no hay más"; éste dice "hay más, pero este paso probablemente
// no cierre el déficit". Con la regla de un escalón por vez es lo que reemplaza
// al salto doble, y sin él el operador no vería la diferencia entre un déficit
// leve y uno severo.
assert.match(bloqueSugerencia, /saltoPuedeNoAlcanzar/,
  'la tarjeta tiene que avisar cuando un escalón probablemente no alcance')
assert.match(bloqueSugerencia, /probablemente no alcance/,
  'el aviso va en palabras, y en potencial: Noven no predice cuánto acelera un descuento')
assert.match(badge, /saltoPuedeNoAlcanzar/,
  'la línea del Dashboard también lo avisa')

// Y sigue siendo el operador el que decide: el aviso NO puede venir con un
// botón que aplique un salto mayor por su cuenta.
assert.doesNotMatch(bloqueSugerencia, /escalones\s*\+\s*1|escalones:\s*2|subirEscalones\(/,
  'la tarjeta no puede proponer un salto propio: el motor decide cuántos escalones')

// --- 6. El detalle aparece cuando corresponde -------------------------------
//
// Velocidad necesaria, cobertura y días comerciales sólo cuando el estado es
// insuficiente o sin movimiento. En los demás la tarjeta queda como estaba.

assert.match(modal, /estado_seguimiento_rag === 'insuficiente'\s*\n?\s*\|\|\s*seguimientoRag\.estado_seguimiento_rag === 'sin_movimiento'/,
  'el detalle del déficit se muestra en insuficiente y sin movimiento')
for (const campo of ['Vel. necesaria', 'Cobertura', 'Días comerciales']) {
  assert.ok(modal.includes(campo), `la tarjeta debe mostrar "${campo}" cuando hay déficit`)
}

// --- 7. La evidencia nace con la solicitud ----------------------------------

assert.match(modal, /supabase\.rpc\('solicitar_cambio_rag'/,
  'la validación llama una RPC acotada')
assert.match(modal, /p_vencimiento_id: vencimiento\.id/,
  'el browser sólo aporta la identidad del vencimiento')
assert.doesNotMatch(modal, /instrumentar_sugerencia_rag/,
  'la evidencia no se instrumenta en una segunda llamada falible del browser')
assert.match(modal, /p_porcentaje_rag: null/,
  'registrar un control no puede abrir ni cambiar el RAG')

// --- 8. La escala se lee acotada por RLS, no filtrada a mano ----------------

assert.match(hook, /from\('rag_escala_descuento'\)/)
assert.doesNotMatch(hook, /\.eq\('organizacion_id'/,
  'la RLS acota la escala; filtrar además da la impresión de que la seguridad depende del select')
assert.match(hook, /setEscala\(\[\]\)/,
  'sin escala la lista queda vacía y el motor no sugiere: no hay default')

console.log('✓ La sugerencia vive en la tarjeta existente, con un solo motor para los dos lugares')
console.log('✓ Human-in-the-loop: gerencia informa el escalón y nunca cambia el precio desde el browser')

// --- Tope de escala: el motor evaluó y no tiene nada que ofrecer ------------
//
// Sin esta frase la tarjeta queda muda justo donde iría la sugerencia, y el
// operador no puede distinguir «el motor evaluó y no hay margen» de «el motor
// se olvidó de responder». El motivo existía en el motor desde siempre; lo que
// faltaba era mostrarlo.

const modalTope = fs.readFileSync(
  path.join(process.cwd(), 'src/components/dashboard/EditarVencimientoModalSeguro.tsx'),
  'utf8',
)

assert.match(
  modalTope,
  /sugerencia\?\.motivo === 'tope_de_escala'/,
  'la tarjeta tiene que reconocer el tope de escala, no sólo la ausencia de sugerencia',
)
assert.match(modalTope, /Sin escalón superior/)
assert.match(
  modalTope,
  /el máximo de la escala[\s\S]{0,120}No hay más margen de descuento para sugerir/,
  'la frase tiene que decir por qué no hay sugerencia, no sólo que no la hay',
)
// Mismo contenedor y mismas clases que el aviso de «el salto puede no alcanzar»:
// el operador debe leerlo con el mismo peso, no como una nota al pie.
assert.match(
  modalTope,
  /tope_de_escala'[\s\S]{0,200}rounded-lg border border-amber-300 bg-amber-100\/70 p-2\.5/,
  'el aviso de tope va con el mismo peso visual que el resto de los avisos del bloque',
)

console.log('✓ Tope de escala: la tarjeta explica por qué no hay sugerencia')
