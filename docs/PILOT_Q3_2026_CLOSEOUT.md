# NoVen · Cierre del piloto interno Q3 2026

Fecha de cierre: **2026-10-08**

## Propósito

Este documento congela el estado del piloto interno de NoVen para que cualquier
persona o agente pueda distinguir con claridad tres cosas:

1. qué capacidades fueron realmente usadas y validadas;
2. qué preguntas quedaron abiertas;
3. qué condiciones deben cumplirse antes de reanudar desarrollo significativo.

NoVen **no se abandona**. Se detiene el desarrollo específico para el empleador
actual y se conserva el producto como activo independiente y generalizable.

## Estado al cierre

El piloto operó durante varios meses en una sucursal real y completó ciclos
operativos de vencimientos durante Q3 2026.

A nivel de producto quedaron ejercitadas en contexto real:

- detección de riesgo usando cantidad comprometida, VMD y ventana comercial;
- clasificación `seguro / radar / urgente / donacion / decomiso`;
- circuito de intervención con oferta/RAG y medición posterior;
- confirmación en góndola como requisito para considerar aplicada una acción;
- historial y trazabilidad de eventos;
- Radar Zonal para propagar riesgo dentro de una zona evitando alertas
  redundantes cuando otra sucursal ya controla el mismo SKU/fecha;
- bandeja zonal de solicitudes RAG como circuito separado del Radar Zonal;
- arquitectura organización → zona/región → sucursal;
- roles, RLS y flujos multitenant;
- importaciones operativas y scanner.

Esto es evidencia suficiente para tratar a NoVen como **producto operativo en
evolución**, no como demo o prototipo visual.

## Resultado del piloto: qué prueba y qué no

El piloto produjo cierres operativos y evidencia económica observable.

Sin embargo, NoVen no debe presentar esa evidencia como ahorro causal íntegro
sin un contrafactual adecuado. El siguiente nivel de prueba deberá congelar el
estado previo a cada intervención, estimar la pérdida esperada sin acción,
registrar costo/margen sacrificado y comparar contra el resultado observado.

La formulación correcta mientras eso no exista es:

> NoVen completó ciclos operativos reales y registró mercadería
> recuperada/protegida dentro de su circuito.

No afirmar:

> NoVen causó por sí solo todo el valor recuperado.

Los conteos productivos exactos y cualquier dato interno del retailer se
mantienen fuera de este repositorio público.

## Decisión corporativa que cierra esta etapa

La empresa decidió continuar el control de vencimientos mediante una planilla
Excel.

Los bloqueantes comunicados para NoVen fueron principalmente:

- política de Sistemas respecto de información operativa alojada en servicios o
  bases de datos externas;
- dependencia de teléfonos personales de responsables de góndola para parte del
  flujo operativo.

La decisión demuestra una brecha de **enterprise readiness** y modelo de
despliegue. No constituye por sí sola una invalidación del motor de riesgo, del
Radar Zonal ni de los circuitos que sí fueron usados durante el piloto.

## Decisión del responsable del producto

Como responsable operativo de la sucursal se adopta el proceso corporativo
vigente.

Como creador del producto se decide:

- no seguir invirtiendo tiempo o dinero en desarrollos específicos para el
  empleador actual sin sponsorship formal;
- preservar estable lo ya construido;
- evitar adaptar Noven a una planilla sólo para prolongar el piloto;
- continuar Noven, cuando se retome, como producto independiente del retailer
  donde nació.

## Estado técnico congelado

El cierre es documental. No requiere migraciones, cambios de RLS, cambios de
datos ni modificaciones funcionales.

La rama principal al iniciar este cierre estaba en:

`ae7c36e76cbe471d466634d7fbd5481a9881882c`

correspondiente al PR #205 de identidad PWA y pantalla de verificación.

El commit de cierre que incorpore este documento será el nuevo checkpoint
canónico del final del piloto.

## Qué NO hacer durante la pausa

No abrir trabajo nuevo para:

- convencer a la organización actual agregando features;
- reproducir particularidades de Glaciar como reglas universales;
- sumar agentes sólo porque exista una novedad del mercado;
- convertir Excel en nueva fuente de verdad de producto;
- prometer ROI causal que la evidencia todavía no demuestra.

Durante la pausa sólo deberían aceptarse cambios de preservación:
seguridad, corrección crítica, continuidad documental o mantenimiento necesario
para no perder el producto.

## Siguiente etapa: Noven Enterprise Readiness

Cuando el desarrollo se retome, la primera pregunta no será
“¿qué feature agregamos?” sino:

> **¿Qué falta para que una cadena pueda comprar NoVen sin que Sistemas,
> Seguridad o la política de dispositivos lo bloquee?**

El frente deberá cubrir al menos:

### 1. Despliegue portable

Mantener el cerebro de NoVen independiente del hosting concreto.

Modos objetivo:

- SaaS/Cloud cuando el cliente lo permita;
- despliegue privado/VPC;
- infraestructura propia/on-premise o equivalente aprobado por el cliente.

Supabase puede seguir siendo una implementación válida, pero no una condición
obligatoria del producto.

### 2. Operación device-agnostic

Ningún proceso central debe depender estructuralmente de un teléfono personal.

El mismo circuito debería poder ejecutarse, según el cliente, desde:

- PC;
- tablet;
- handheld corporativo;
- dispositivo compartido;
- móvil corporativo;
- BYOD sólo cuando esté autorizado.

### 3. Gobierno y seguridad

Preparar respuestas concretas sobre:

- residencia y flujo de datos;
- identidad/SSO;
- permisos y segregación;
- logs y auditoría;
- backups y recuperación;
- retención/borrado;
- integraciones;
- observabilidad;
- incidentes y soporte.

### 4. Evidencia económica

Evolucionar de “resultado observado” a estimación defendible de impacto:

`pérdida esperada sin intervención → acción → costo de acción → resultado real
→ valor neto protegido`

Cuando sea posible, complementar con controles comparables o rollout escalonado.

### 5. Pilotos futuros

Un futuro piloto enterprise debe involucrar desde el día 0:

- sponsor de Operaciones;
- Sistemas/Infraestructura;
- Seguridad;
- criterios de éxito acordados;
- plan de despliegue compatible;
- métricas de decisión;
- definición previa de qué ocurre si el piloto funciona.

## Señales de mercado a conservar

Las novedades de retail que validan dirección estratégica se documentan en la
memoria ejecutiva/Notion. La regla para GitHub permanece:

- incorporar al producto sólo lo que cambie una decisión arquitectónica o un
  contrato;
- no copiar funcionalidades de competidores;
- mantener compatibilidad futura con captura automática (por ejemplo GS1 2D),
  pricing/markdown inteligente y agentes con guardrails sin abrir esos frentes
  durante la pausa.

## Fuentes de verdad al reanudar

Leer en este orden:

1. `AGENTS.md`
2. este documento
3. `docs/CURRENT_WORK.md`
4. `PRODUCT_VISION.md`
5. `docs/PRE_PRODUCTION_HARDENING_PLAN.md`
6. `ai/architecture.md`, `ai/contracts.md`, `ai/decisions.md`, `ai/rules.md`

GitHub sigue siendo la fuente de verdad técnica. La evidencia operativa sensible
y el contexto ejecutivo no deben reconstruirse desde este repositorio público.
