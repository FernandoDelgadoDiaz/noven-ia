# 09 — Plan de ejecución (22/10 → 30/10/2026)

Horario: Argentina (UTC−3). Cierre oficial: **31/10 00:45 ART** (30/10 23:45 EDT). **Cierre interno: 30/10 18:00 ART** (casi 7 h de margen).

## Camino crítico

`Formulario de clave (hoy)` → `recepción de la clave` → `T1–T5 (2 h)` → `go/no-go` → `integración Qloo + agente` → `backtest` → `deploy` → `entrega en Devpost`.

Todo lo que no depende de la clave se hace **antes** de que llegue, con datos **ficticios** (no respuestas de Qloo, que no pueden publicarse).

## Bloqueantes de inscripción

| Bloqueante | Quién | Cuándo |
|---|---|---|
| Registro en Devpost ("Join hackathon") | **Usuario** | Hoy 22/10 |
| Formulario de clave Qloo (sin idea definida, permitido) | **Usuario** | **Hoy 22/10** — cada día hábil cuenta |
| Revisar spam a diario; si a las 72 h hábiles no llegó, reenviar el formulario y consultar en Discord #api-help | Usuario | 27/10 |
| Confirmar disponibilidad para la final en vivo del 05/11 (inglés) | Usuario | Hoy |
| Clave de LLM nueva y separada de producción, con tope de gasto | Usuario | 23/10 |
| Cuenta de GitHub para el repo público nuevo (no dentro de `noven-ia`) | Usuario | 23/10 |

## Cronograma

| Día | Fecha | Tareas | Entregable / criterio de salida |
|---|---|---|---|
| D0 | Jue 22/10 | Registro en Devpost, formulario de clave, Discord. Leer esta investigación y decidir | Clave solicitada |
| D1 | Vie 23/10 | Repo nuevo público + MIT + README esqueleto. Frontend con 3 estados. Ingesta de RSS + extracción de invitados (sin Qloo). Adaptador Qloo con interfaz y *fixtures* ficticios. Script de pruebas T1–T10 listo para correr | Demo local con datos ficticios; script de tests |
| D2 | Sáb 24/10 | Loop de agente con *tool calling*, log de pasos, scoring, borrador de pitch. Deploy en Netlify (modo ficticio, rotulado) | URL pública funcionando en modo ficticio |
| D3 | Dom 25/10 | Backtest (framework de medición con datos ficticios) y baseline LLM sin Qloo. Pulido de UI | Pantalla de backtest |
| **Gate** | **Lun 26/10 – Mar 27/10 12:00** | **Al recibir la clave: correr T1–T10 (≤2 h)** → decidir Green Room / Shelf Signal / no presentar (ver 08) | Decisión registrada |
| D4 | Lun 26 o Mar 27/10 | Integración real con Qloo, caché privada, validación de parámetros (errores silenciosos), reintentos | Flujo real de punta a punta |
| D5 | Mié 28/10 | Backtest real con 3 shows; ajuste de scoring **sin sobreajustar** (separar shows de ajuste y de evaluación) | Métrica real Qloo vs. sin Qloo |
| D6 | Jue 29/10 | Pruebas de funcionamiento (10 shows, errores, latencia, mobile). README final en inglés mapeado a los 4 criterios. Capturas. Video de 2 min | App estable; README; video |
| D7 | Vie 30/10 | Descripción de Devpost, testing instructions, revisión final. **Entrega antes de las 18:00 ART**. Congelar el deploy | Entrega confirmada |
| — | 31/10 → 05/11 | No tocar producción del demo. Monitorear que siga activo. Si es finalista: preparar un pitch de 3 min + demo en vivo | App disponible hasta el 05/11 23:45 ET |

## Pruebas de funcionamiento (D6)

- 10 RSS distintos: feeds largos, con títulos sin invitados, en idioma no inglés y con nombres ambiguos.
- Simular que Qloo devuelve vacío, 401, 403 o *timeout*: la UI debe explicar el error, nunca romperse.
- Tiempo de punta a punta < 60 s; si se excede, mostrar progreso parcial.
- Prueba en el celular.
- Prueba en una ventana anónima, como un juez sin contexto.

## Margen y contingencias

| Riesgo | Señal | Respuesta |
|---|---|---|
| Clave no llega el 27/10 12:00 | Sin email | **Abortar** (no se puede cumplir la regla de integrar Qloo) |
| T2/T4 fallan | Cobertura < 70% o resultados vacíos | Plan B Shelf Signal si T6/T7 aprueban; si no, abortar |
| T5 sin mejora sobre el baseline | Qloo ≤ sin Qloo | No afirmar superioridad; presentar solo si el producto se sostiene igual. Si no, abortar |
| Cuota agotada | 429 | Caché privada + pedir ampliación en Discord |
| Deploy roto el último día | — | Congelar el deploy el 29/10 a la noche; el 30/10 solo cambios de texto |

## Fuera de alcance (explícito)

- No tocar `noven-ia` ni ningún sistema en producción.
- No reutilizar código ni datos privados.
- No publicar respuestas de Qloo en el repo.
- No hacer múltiples entregas.
