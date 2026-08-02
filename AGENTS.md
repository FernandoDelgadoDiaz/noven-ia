# NoVen IA

App web mobile-first para control predictivo de vencimientos en retail alimenticio.

## Stack
- React 18 + TypeScript 5 + Vite 5
- TailwindCSS 3 + shadcn/ui
- React Router v6
- Supabase JS v2
- html5-qrcode, SheetJS (xlsx)

## Motor predictivo
Si `cobertura (stock/venta_diaria) > dias_restantes` entonces riesgo de merma.

## Comandos
- `npm run dev` - desarrollo local en localhost:5173
- `npm run build` - build de produccion
- `npm run lint` - linting

## Referencias
- `/ai/rules.md` - reglas de codigo
- `/ai/architecture.md` - arquitectura del sistema
- `/ai/decisions.md` - decisiones tecnicas
- `/ai/contracts.md` - contratos de interfaces

## Variables de entorno
Ver `.env.example`
