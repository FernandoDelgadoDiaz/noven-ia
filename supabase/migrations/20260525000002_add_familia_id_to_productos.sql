-- Add familia_id FK to productos for Glaciar CSV family linking
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS familia_id uuid references public.familias(id);
