# Reglas de codigo

- TypeScript strict: no `any`, no type assertions sin justificacion
- Mobile-first: disenar para 375px, luego escalar
- RLS siempre activo en Supabase: nunca bypassear Row Level Security
- Componentes: functional components con hooks
- Naming: camelCase para variables/funciones, PascalCase para componentes/types
- Imports: absolutos desde `src/`, no relativos con `../../../`
- No hardcodear keys, URLs ni secrets: usar variables de entorno
- Manejo de errores: siempre manejar estados loading, error y empty
