-- =============================================================================
-- MULTITENANT V1 · FASE 2C — consistencia y policies de catálogo por tenant
--
-- Se ejecuta después de access_scopes porque usa helpers de `noven_private`.
-- Las policies legacy permisivas todavía coexisten hasta el cutover final; estas
-- policies dejan preparado el contrato seguro que sobrevivirá a ese cutover.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. La responsabilidad familia × sucursal debe pertenecer al mismo tenant.
-- La FK simple creada en 00300 puede coexistir; esta compuesta agrega la prueba
-- que faltaba: familia y sucursal deben compartir organizacion_id.
-- -----------------------------------------------------------------------------
ALTER TABLE public.usuario_familias_sucursal
  ADD CONSTRAINT usuario_familias_sucursal_familia_org_fk
  FOREIGN KEY (familia_id, organizacion_id)
  REFERENCES public.familias(id, organizacion_id)
  ON DELETE RESTRICT;

-- -----------------------------------------------------------------------------
-- 2. Policies target de catálogo
--
-- Por ahora no se eliminan `*_select_authenticated USING(true)` legacy: hacerlo
-- antes de migrar Scanner/Vencimientos rompería 091. El cutover final borrará
-- esas policies y quedarán únicamente las de scope.
-- -----------------------------------------------------------------------------
CREATE POLICY sectores_select_scope_v1
  ON public.sectores
  FOR SELECT
  TO authenticated
  USING (noven_private.tiene_acceso_organizacion(organizacion_id));

CREATE POLICY familias_select_scope_v1
  ON public.familias
  FOR SELECT
  TO authenticated
  USING (noven_private.tiene_acceso_organizacion(organizacion_id));

CREATE POLICY productos_select_scope_v1
  ON public.productos
  FOR SELECT
  TO authenticated
  USING (noven_private.tiene_acceso_organizacion(organizacion_id));

-- La tabla de códigos ya nació sin policies legacy abiertas. Su policy segura fue
-- creada en 00300. Acá solo documentamos la invariancia esperada.
COMMENT ON CONSTRAINT usuario_familias_sucursal_familia_org_fk
  ON public.usuario_familias_sucursal IS
  'Impide asignar a una sucursal una familia perteneciente a otra organización.';

COMMIT;
