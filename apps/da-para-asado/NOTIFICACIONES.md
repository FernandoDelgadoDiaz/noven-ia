# Alertas futuras de «¿Da para asado?» (diseño, no implementado)

Hoy la app **no envía alertas**. Detecta cambios solo cuando el usuario la abre o toca «Actualizar»:
compara el pronóstico nuevo con la consulta anterior guardada en el dispositivo (`dpa:prev:v1`)
usando `Asado.diffForecast(prevModel, curModel, prefs, now)`, que devuelve:

- `added`: ventanas recomendadas que antes no existían (con su categoría anterior).
- `upgraded`: ventanas que cambiaron de categoría.
- `removed`: ventanas que dejaron de recomendarse.

## Qué falta para notificaciones push reales

Un Artifact de Claude no puede ejecutarse periódicamente, registrar un service worker ni pedir
permiso de notificaciones. Hace falta infraestructura propia:

1. **Hosting propio** de `index.html` (Netlify, por ejemplo) con un service worker y Web Push
   (claves VAPID; la clave privada solo en el servidor).
2. **Suscripciones**: guardar por usuario la suscripción push y sus preferencias (duración,
   franja, umbrales, ubicación de la parrilla) en una base de datos.
3. **Tarea programada** (por ejemplo una Netlify Scheduled Function cada 1–3 h) que:
   - descargue Open-Meteo y el METAR de SAWG;
   - ejecute el mismo motor (`analyze` + `diffForecast`) contra la última corrida guardada;
   - envíe un push solo si hay `added` o `upgraded` dentro de las próximas 48 h.
4. **Antirruido**: una alerta por ventana (clave `fecha|inicio|fin|categoría`), silencio nocturno
   configurable y un tope diario de avisos.
5. **Texto de la alerta**: igual al de la app, con la advertencia de que la recomendación es
   orientativa y que rigen las alertas oficiales de incendio.

Ninguna de estas piezas existe todavía; la app no debe sugerir lo contrario.

## Eventos guardados del planificador (versión 3)

Cada evento (`dpa:events:v1`: nombre, rango, duración y firma) guarda una **firma de estado**
calculada con `Asado.eventSignature(plan, duración)`:

- `pronto`: fuera del horizonte de tendencia (más de 16 días).
- `tendencia`: dentro de los 16 días de tendencia diaria, sin horarios.
- `horario|sin-ventanas`: con pronóstico horario, pero sin ventanas que cumplan los límites configurados.
- `horario|fecha|inicio|fin|categoría`: mejor ventana recomendada.

`Asado.eventChange(firmaGuardada, firmaActual)` devuelve el aviso, por ejemplo «Ya hay pronóstico
horario para este evento» o «Apareció una ventana recomendable». Hoy el aviso se muestra **solo
dentro de la app** al abrirla. Un servicio de alertas real reutilizaría estas mismas funciones en la
tarea programada descrita arriba, con los eventos guardados en el servidor en lugar del dispositivo.
