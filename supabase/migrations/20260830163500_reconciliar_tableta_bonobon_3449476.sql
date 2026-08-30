-- Corrección auditada de una vinculación scanner creada con código interno mal tipeado.
-- Evidencia cerrada:
--   EAN 7790580117979 = Bon o Bon tableta 48 g.
--   El 0258 del 29/08/2026 contiene SKU 3449476, TABLETA CHOCO RELLENO, BON O BON, 48 GR,
--   costo unitario s/IVA 1961.67.
--   El SKU 3443479 no existe en ese 0258 y fue creado el 30/08/2026 con el mismo EAN.
-- No se borra el producto erróneo: se preserva inactivo para auditoría.

DO $$
DECLARE
  v_org uuid;
  v_wrong uuid;
  v_right uuid;
  v_ean constant text := '7790580117979';
BEGIN
  SELECT p.organizacion_id, p.id
    INTO v_org, v_wrong
  FROM public.productos p
  JOIN public.producto_codigos pc
    ON pc.producto_id = p.id
   AND pc.organizacion_id = p.organizacion_id
   AND pc.codigo = v_ean
   AND pc.activo = true
  WHERE p.cod_art = '3443479'
    AND upper(trim(coalesce(p.marca, ''))) = 'BON O BON'
  LIMIT 1;

  IF v_wrong IS NULL THEN
    RAISE EXCEPTION 'No se encontró la vinculación errónea esperada 3443479 / %', v_ean;
  END IF;

  SELECT p.id
    INTO v_right
  FROM public.productos p
  WHERE p.organizacion_id = v_org
    AND p.cod_art = '3449476'
    AND upper(trim(coalesce(p.marca, ''))) = 'BON O BON'
    AND upper(trim(coalesce(p.descripcion, ''))) = 'TABLETA CHOCO RELLENO'
  LIMIT 1;

  IF v_right IS NULL THEN
    RAISE EXCEPTION 'No se encontró el SKU 3449476 validado por 0258';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.producto_costo_ultima_observacion c
    WHERE c.producto_id = v_right
      AND c.costo_unitario = 1961.67
  ) THEN
    RAISE EXCEPTION 'El SKU 3449476 no tiene el costo 0258 esperado 1961.67';
  END IF;

  -- Primero liberar el EAN del registro duplicado para mantener consistencia del catálogo.
  UPDATE public.productos
  SET codigo_barras = NULL,
      activo = false,
      updated_at = now()
  WHERE id = v_wrong;

  UPDATE public.productos
  SET codigo_barras = v_ean,
      updated_at = now()
  WHERE id = v_right
    AND (codigo_barras IS NULL OR codigo_barras = v_ean);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El SKU 3449476 ya tiene un código de barras distinto; revisión manual requerida';
  END IF;

  UPDATE public.producto_codigos
  SET producto_id = v_right,
      updated_at = now()
  WHERE organizacion_id = v_org
    AND codigo = v_ean
    AND producto_id = v_wrong;

  -- La observación referencia al vencimiento mediante FK compuesta
  -- (vencimiento_id, producto_id, sucursal_id). Como esa FK no es diferible,
  -- se retira sólo dentro de esta transacción, se mueven ambos lados y se
  -- recrea idéntica antes de confirmar la migración.
  ALTER TABLE public.vencimiento_observaciones
    DROP CONSTRAINT venc_obs_vencimiento_scope_fk;

  -- Mover únicamente la trazabilidad operativa del registro duplicado al SKU canónico.
  UPDATE public.vencimientos
  SET producto_id = v_right,
      updated_at = now()
  WHERE producto_id = v_wrong;

  UPDATE public.vencimiento_observaciones
  SET producto_id = v_right
  WHERE producto_id = v_wrong;

  ALTER TABLE public.vencimiento_observaciones
    ADD CONSTRAINT venc_obs_vencimiento_scope_fk
    FOREIGN KEY (vencimiento_id, producto_id, sucursal_id)
    REFERENCES public.vencimientos(id, producto_id, sucursal_id)
    ON DELETE RESTRICT;

  UPDATE public.intervenciones_rag
  SET producto_id = v_right
  WHERE producto_id = v_wrong;

  UPDATE public.acciones_operativas
  SET producto_id = v_right,
      updated_at = now()
  WHERE producto_id = v_wrong;

  UPDATE public.rag_escalamientos
  SET producto_id = v_right
  WHERE producto_id = v_wrong;

  UPDATE public.alertas_zonales
  SET producto_id = v_right
  WHERE producto_id = v_wrong;

  IF EXISTS (SELECT 1 FROM public.vencimientos WHERE producto_id = v_wrong) THEN
    RAISE EXCEPTION 'Persisten vencimientos vinculados al SKU erróneo 3443479';
  END IF;

  IF EXISTS (SELECT 1 FROM public.vencimiento_observaciones WHERE producto_id = v_wrong) THEN
    RAISE EXCEPTION 'Persisten observaciones vinculadas al SKU erróneo 3443479';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.producto_codigos pc
    WHERE pc.organizacion_id = v_org
      AND pc.codigo = v_ean
      AND pc.producto_id = v_right
      AND pc.activo = true
  ) THEN
    RAISE EXCEPTION 'El EAN no quedó vinculado al SKU canónico 3449476';
  END IF;
END
$$;
