# P2 · Análisis IA multitenant

Corrección de auditoría:

- La sucursal analizada se recibe como `sucursal_id` seleccionada por el usuario.
- El servidor valida el alcance contra `usuario_accesos` activo.
- El cliente no envía ni decide rol ni familias.
- Operadores se limitan a `usuario_familias_sucursal` de la sucursal exacta.
- Se eliminó el fallback a la sucursal legacy 091.
- El cache queda aislado por `usuario_id + sucursal_id`.
- Los cálculos de fecha/trimestre usan `America/Argentina/Buenos_Aires`.
