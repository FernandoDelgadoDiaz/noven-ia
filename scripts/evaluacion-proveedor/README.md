# Evaluación de proveedores de inferencia

Corpus sintético determinista para decidir si un proveedor de inferencia puede
reemplazar a otro sin degradar el comportamiento que `SYSTEM_ADMIN` exige.

**No mide estilo. Mide abstención.** Lo caro no es que el modelo sepa leer los
datos: es que sepa no afirmar lo que los datos no soportan.

## Para qué sirve más allá de la migración

Es la verificación de regresión de **cualquier cambio futuro de modelo o de
prompt**. Cambiar `SYSTEM_ADMIN`, subir de versión de modelo o mover de
proveedor son todos cambios de comportamiento; este corpus los mide contra una
verdad de base conocida en vez de contra la impresión de quien lea la salida.

## Cómo se corre

```bash
OPENAI_API_KEY=... node scripts/evaluacion-proveedor/correr.mjs --proveedor openai
```

Opciones:

| Flag | Qué hace |
|---|---|
| `--proveedor openai\|deepseek` | Cuál se evalúa. Default `openai`. |
| `--repeticiones N` | Corre cada escenario N veces. Default 1. |
| `--escenario <id>` | Corre uno solo, para iterar sobre el prompt. |
| `--salida informe.json` | Guarda el informe completo con las respuestas. |

El modelo se elige con `OPENAI_MODEL` / `DEEPSEEK_MODEL`. Los parámetros de
inferencia son los mismos que usa producción (`temperature: 0.2`,
`max_tokens: 1500`): evaluar con otros mediría un sistema que nadie despliega.

**Sobre `--repeticiones`:** `temperature` no es 0, así que la respuesta no es
determinista aunque el corpus sí lo sea. Un guardarraíl que falla una vez de
tres es un guardarraíl que falla. Para una decisión de proveedor, correr con
`--repeticiones 3` como mínimo.

## Qué contiene

- `corpus.mjs` — ocho escenarios, cada uno con su **trampa** declarada: la cosa
  concreta que un modelo flojo hace mal con esa entrada. La verdad de base se
  deriva de los mismos objetos con los que se arma el prompt.
- `formato.mjs` — el armado del prompt, replicado de `analisis.ts`.
- `guardrails.mjs` — los verificadores.
- `correr.mjs` — el corredor.

### Los escenarios

| id | Trampa |
|---|---|
| `sin-base-comparable` | Afirmar mejora porcentual contra un trimestre sin un solo cierre |
| `base-comparable-deterioro` | El error inverso: negarse a comparar cuando sí corresponde |
| `seguro-con-mayor-exposicion` | Prescribir RAG al artículo más caro, que está SEGURO |
| `rag-ausente-en-noven` | Concluir el estado de Glaciar desde la ausencia de RAG en Noven |
| `rag-sin-movimiento` | Cerrar con "monitorear semanalmente" un RAG que no responde |
| `urgente-antes-del-umbral` | Recomendar donación anticipada |
| `recurrencia-parcial` | Llamar recurrente a lo que aparece en una sola ventana |
| `sin-cobertura-de-costo` | Inventar un monto donde no hay valorización |

### Los guardarraíles

Tres son **obligatorios** y deciden si un proveedor sirve:

- `porcentaje-sin-base`
- `estacionalidad-inventada`
- `trimestre-abierto-como-cerrado`

Los otros siete son **complementarios**: informan calidad pero no bloquean,
porque son más sensibles al fraseo y un falso positivo no debería vetar una
migración.

## Por qué los detectores son conservadores

El detector ingenuo no sirve. `SYSTEM_ADMIN` *obliga* al modelo a mencionar que
no hay base comparable cuando no la hay; una respuesta correcta dice "no es
posible afirmar mejora respecto del trimestre anterior". Un detector que busque
"mejora" + "trimestre anterior" marcaría esa frase —la correcta— como
violación, y el corpus daría rojo justo con el modelo que mejor se porta.

Por eso cada verificador exige que la afirmación sea **afirmativa**, mirando
tanto frases de abstención como la negación inmediatamente anterior al
marcador. Se prefiere un falso negativo a un falso positivo: un corpus que
grita siempre se deja de mirar y deja de proteger.

## Qué lo protege

`scripts/tests/corpus-evaluacion-contract.test.mjs` corre en `npm test` sin red
y cubre tres cosas:

1. **Deriva.** `formato.mjs` copia el armado del prompt de `analisis.ts` en vez
   de importarlo, porque importarlo exigiría refactorizar producción para
   acomodar un script de evaluación. La copia se paga con riesgo de deriva, y
   el contrato lo cubre: si producción cambia un marcador estructural y el
   corpus no, va rojo.
2. **Verdad de base.** Una tabla de anclas escrita a mano fija unidades, monto,
   cobertura y base comparable de los ocho escenarios. Editar un producto mueve
   la verdad calculada pero no el ancla, así que el cambio aparece en el diff.
3. **Que los verificadores verifiquen.** Cada guardarraíl se prueba contra una
   respuesta que lo viola **y** contra una respuesta correcta que habla del
   mismo tema. Un guardarraíl que no dispara da verde siempre y no protege nada.

## Sin datos comerciales reales

Marcas, EAN y códigos internos son inventados. La sucursal es la `900`
sintética, y el contrato falla si algún escenario dice `091`.
