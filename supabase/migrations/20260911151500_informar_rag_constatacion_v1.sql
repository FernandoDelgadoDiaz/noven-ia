-- =============================================================================
-- NOVEN · INFORMAR RAG · LA CONSTATACIÓN QUE FALTABA
--
-- EL HUECO. El bloque de validación en sucursal cerró la puerta lateral por la
-- que el browser abría un RAG: `registrar_control_vencimiento_dashboard` ya no
-- acepta `p_porcentaje_rag`. Cerrarla estuvo bien —era una puerta por la que se
-- modificaba un precio sin circuito— pero sólo se reconstruyó el camino de
-- AUTORIZAR un cambio (`solicitar_cambio_rag`), que exige un RAG vigente:
--
--     AND sg.rag_porcentaje IS NOT NULL
--
-- Un producto que nunca tuvo RAG no puede recibir el primero. No es que le
-- falte permiso: no hay camino. El motor de cobertura tampoco arranca, porque
-- mide desde el inicio de un tramo y sin intervención no hay tramo. Nueve
-- vencimientos quedaron fuera del motor por esta omisión.
--
-- LA DISTINCIÓN QUE LA CAUSÓ. Informar el primer RAG no es proponer un cambio:
-- es declarar un hecho que ya ocurrió en la góndola —la cadena puso el
-- descuento y está a la vista. CONSTATAR UN HECHO Y AUTORIZAR UN CAMBIO SON
-- PERMISOS DISTINTOS. Constatar lo puede hacer quien está frente al producto;
-- autorizar, quien tiene la jerarquía. Al reconstruir sólo el camino de
-- autorización se le pidió jerarquía a una constatación, y el resultado fue que
-- nadie podía hacerla.
--
-- La frontera ya existía en el código, sin nombre:
--
--   constatar  → noven_private.puede_ver_producto_sucursal(sucursal, producto)
--                (informar_oferta_central, finalizar_intervencion_por_tipo)
--   autorizar  → ua.rol IN ('gerente_sucursal','supervisor')
--                (solicitar_cambio_rag)
--
-- Esta migración agrega el hermano que faltaba del lado de constatar, con el
-- mismo guard y sin lista de roles. Queda nombrada en `ai/rules.md` y con
-- contrato propio en `scripts/tests/frontera-constatar-autorizar-contract.test.mjs`.
--
-- LO QUE NO HACE. No reabre la puerta lateral: `informar_rag` sólo puede
-- ESTRENAR el RAG de un vencimiento. Con un RAG vigente distinto, el cambio
-- sigue siendo del circuito centralizado y la RPC lo rechaza. Tampoco cuelga
-- del control: es una RPC propia, como `informar_oferta_central`, para que
-- registrar stock y declarar un precio no vuelvan a ser la misma llamada.
-- =============================================================================

-- --- 1. Informar el RAG que ya está en góndola ------------------------------

CREATE OR REPLACE FUNCTION noven_private.informar_rag_impl(
  p_vencimiento_id uuid,
  p_porcentaje numeric,
  p_nota text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid        uuid := (SELECT auth.uid());
  v_org        uuid;
  v_sucursal   uuid;
  v_producto   uuid;
  v_cantidad   numeric;
  v_vmd        numeric;
  v_vigente_id uuid;
  v_vigente_pc numeric;
  v_rag_id     uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  -- El porcentaje no se valida contra la escala. Si la cadena puso algo fuera
  -- de escala, eso PASÓ: negarse a registrarlo no lo deshace, sólo deja a NoVen
  -- ciego sobre un producto intervenido. La escala gobierna lo que se SUGIERE;
  -- la constatación registra lo que hay. El único límite es aritmético.
  IF p_porcentaje IS NULL OR p_porcentaje <= 0 OR p_porcentaje > 100 THEN
    RAISE EXCEPTION 'El porcentaje RAG debe ser mayor a 0 y menor o igual a 100'
      USING ERRCODE = '22023';
  END IF;

  -- Serializa el doble click y dos pantallas abiertas sobre el mismo
  -- vencimiento: sin este bloqueo, dos informes simultáneos chocarían recién
  -- contra el índice único y uno moriría con un error de integridad.
  SELECT p.organizacion_id, v.sucursal_id, v.producto_id, v.cantidad,
         ps.venta_media_diaria
    INTO v_org, v_sucursal, v_producto, v_cantidad, v_vmd
  FROM public.vencimientos v
  JOIN public.productos p
    ON p.id = v.producto_id
   AND p.activo = true
  JOIN public.producto_sucursal ps
    ON ps.producto_id = v.producto_id
   AND ps.sucursal_id = v.sucursal_id
   AND ps.organizacion_id = p.organizacion_id
  WHERE v.id = p_vencimiento_id
    AND v.activo = true
  FOR UPDATE OF v;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento activo/estado de sucursal no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  -- EL GUARD DE LA CONSTATACIÓN. Alcance sobre el producto, no jerarquía: el
  -- operador con la familia asignada, el gerente y el supervisor pasan por igual
  -- porque los tres pueden estar parados frente a la góndola. Cualquier lista de
  -- roles acá volvería a convertir un hecho en una autorización.
  IF NOT noven_private.puede_ver_producto_sucursal(v_sucursal, v_producto) THEN
    RAISE EXCEPTION 'Sin permiso para informar un RAG sobre este producto'
      USING ERRCODE = '42501';
  END IF;

  SELECT r.id, r.porcentaje_descuento
    INTO v_vigente_id, v_vigente_pc
  FROM public.intervenciones_rag r
  WHERE r.vencimiento_id = p_vencimiento_id
    AND r.tipo = 'rag'
    AND r.finalizado_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    -- Mismo porcentaje: es el mismo hecho informado dos veces. Se devuelve la
    -- intervención existente sin mover `aplicado_at`, porque retrotraer o
    -- adelantar el inicio del tramo falsearía la medición.
    IF v_vigente_pc IS NOT DISTINCT FROM p_porcentaje THEN
      RETURN v_vigente_id;
    END IF;

    -- Porcentaje distinto sobre un RAG vivo ya no es constatar: es cambiar el
    -- precio. Ese camino es el circuito centralizado, y esta RPC no lo puentea.
    --
    -- El porcentaje va entre paréntesis y no con el signo pegado: en el formato
    -- de RAISE, `%%%` se lee como "porcentaje literal seguido del argumento" y
    -- el mensaje saldría al revés.
    RAISE EXCEPTION 'Ya hay un RAG vigente (%): el cambio se gestiona por el circuito centralizado',
      v_vigente_pc
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.intervenciones_rag(
    organizacion_id, sucursal_id, producto_id, vencimiento_id, usuario_id,
    tipo, porcentaje_descuento, cantidad_comprometida_al_aplicar,
    vmd_glaciar_al_aplicar, nota
  )
  VALUES(
    v_org, v_sucursal, v_producto, p_vencimiento_id, v_uid,
    'rag', p_porcentaje, v_cantidad, v_vmd, NULLIF(btrim(p_nota), '')
  )
  RETURNING id INTO v_rag_id;

  -- La instrumentación se delega en vez de recalcularse acá. `escalones_estado`
  -- NULL significa "no se instrumentó, es anterior a la reparación de D-7": una
  -- fila nacida hoy no puede afirmar eso. Reusar la función existente además
  -- evita dos cómputos del mismo escalón que puedan divergir: ella ya resuelve
  -- el escalón cero implícito, `sin_escala` y `fuera_de_escala` —que es
  -- justamente donde cae un porcentaje que la cadena puso fuera de la escala.
  --
  -- Origen `manual` = "no había sugerencia vigente", que es la verdad: nadie
  -- sugirió este RAG, se constató. Por eso cobertura y escalones sugeridos van
  -- NULL: no hubo sugerencia que medir.
  PERFORM noven_private.instrumentar_sugerencia_rag_impl(
    p_vencimiento_id, NULL::numeric, NULL::smallint, 'manual'
  );

  RETURN v_rag_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.informar_rag(
  p_vencimiento_id uuid,
  p_porcentaje numeric,
  p_nota text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.informar_rag_impl(p_vencimiento_id, p_porcentaje, p_nota);
$$;

-- --- 2. Superficie RPC mínima y explícita -----------------------------------
--
-- Los defaults de Supabase conceden a `authenticated` sobre toda función nueva.
-- El REVOKE previo al GRANT no es ceremonia: es lo que deja `anon` afuera.

REVOKE ALL ON FUNCTION noven_private.informar_rag_impl(uuid, numeric, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.informar_rag_impl(uuid, numeric, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.informar_rag(uuid, numeric, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.informar_rag(uuid, numeric, text)
  TO authenticated;

COMMENT ON FUNCTION public.informar_rag(uuid, numeric, text) IS
  'Constata el primer RAG de un vencimiento: declara un descuento que la cadena ya puso en góndola. Autoriza por alcance sobre el producto —operador con la familia, gerente y supervisor— y no por jerarquía, porque constatar un hecho y autorizar un cambio son permisos distintos. Acepta porcentajes fuera de la escala, que quedan marcados fuera_de_escala. No puede modificar un RAG vigente: ese camino es el circuito centralizado.';
