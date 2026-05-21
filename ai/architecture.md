# Arquitectura del sistema

## Capas
1. **UI** - React + shadcn/ui, mobile-first
2. **Router** - React Router v6, rutas: /, /login, /scanner, /vencimientos, /maestro
3. **Hooks** - logica de negocio encapsulada en custom hooks
4. **Supabase** - base de datos PostgreSQL + Auth + RLS

## Motor predictivo
- `cobertura_dias = stock_actual / venta_media_diaria`
- `dias_restantes = diferencia en dias entre fecha_vencimiento y hoy`
- Si `cobertura_dias > dias_restantes` hay mas stock del que se puede vender antes de vencer
- Niveles: seguro (>30d), moderado (15-30d), alto (7-15d), critico (<7d)

## Flujo de datos
Scanner -> carga vencimiento -> Supabase -> Dashboard consume con RLS
