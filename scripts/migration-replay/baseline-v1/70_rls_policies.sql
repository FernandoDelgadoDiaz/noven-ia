ALTER TABLE public.acciones_operativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acciones_operativas NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.alertas_zonales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_zonales NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.alertas_zonales_destinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_zonales_destinos NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.familias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.familias NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.importacion_0258_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacion_0258_detalle NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.importaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importaciones NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.intervenciones_rag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervenciones_rag NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.invitaciones_acceso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitaciones_acceso NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.organizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizaciones NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.problemas_economicos_ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problemas_economicos_ciclos NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.producto_codigos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_codigos NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.producto_costo_observaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_costo_observaciones NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.producto_costo_ultima_observacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_costo_ultima_observacion NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.producto_imagen_cambios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_imagen_cambios NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.producto_pendiente_detecciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_pendiente_detecciones NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.producto_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_snapshots NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.producto_sucursal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_sucursal NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.productos_pendientes_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos_pendientes_catalogo NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.rag_escalamientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_escalamientos NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.regiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regiones NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sectores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectores NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sucursales NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.usuario_accesos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_accesos NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.usuario_familias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_familias NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.usuario_familias_sucursal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_familias_sucursal NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.vencimiento_observaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vencimiento_observaciones NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.vencimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vencimientos NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zonas NO FORCE ROW LEVEL SECURITY;

CREATE POLICY acciones_operativas_select_scope_v1 ON public.acciones_operativas AS PERMISSIVE FOR SELECT TO PUBLIC USING (noven_private.puede_leer_producto_sucursal(sucursal_id, producto_id));

CREATE POLICY familias_select_scope_v1 ON public.familias AS PERMISSIVE FOR SELECT TO authenticated USING (noven_private.tiene_acceso_organizacion(organizacion_id));

CREATE POLICY rag_select_scope ON public.intervenciones_rag AS PERMISSIVE FOR SELECT TO PUBLIC USING (noven_private.puede_leer_producto_sucursal(sucursal_id, producto_id));

CREATE POLICY organizaciones_select_scope ON public.organizaciones AS PERMISSIVE FOR SELECT TO authenticated USING (noven_private.tiene_acceso_organizacion(id));

CREATE POLICY producto_codigos_select_scope ON public.producto_codigos AS PERMISSIVE FOR SELECT TO authenticated USING (noven_private.tiene_acceso_organizacion(organizacion_id));

CREATE POLICY producto_sucursal_select_scope ON public.producto_sucursal AS PERMISSIVE FOR SELECT TO PUBLIC USING (noven_private.puede_leer_producto_sucursal(sucursal_id, producto_id));

CREATE POLICY productos_select_scope_v1 ON public.productos AS PERMISSIVE FOR SELECT TO authenticated USING (noven_private.tiene_acceso_organizacion(organizacion_id));

CREATE POLICY push_own ON public.push_subscriptions AS PERMISSIVE FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid)) = usuario_id) WITH CHECK ((( SELECT auth.uid() AS uid)) = usuario_id);

CREATE POLICY regiones_select_scope ON public.regiones AS PERMISSIVE FOR SELECT TO authenticated USING (noven_private.tiene_acceso_organizacion(organizacion_id));

CREATE POLICY sectores_select_scope_v1 ON public.sectores AS PERMISSIVE FOR SELECT TO authenticated USING (noven_private.tiene_acceso_organizacion(organizacion_id));

CREATE POLICY sucursales_select_scope_v1 ON public.sucursales AS PERMISSIVE FOR SELECT TO authenticated USING (noven_private.tiene_acceso_sucursal(id));

CREATE POLICY usuario_accesos_select_propios ON public.usuario_accesos AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid)) = usuario_id);

CREATE POLICY usuario_familias_sucursal_select_propias ON public.usuario_familias_sucursal AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid)) = usuario_id);

CREATE POLICY usuarios_select_own ON public.usuarios AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid)) = id);

CREATE POLICY venc_obs_select_scope ON public.vencimiento_observaciones AS PERMISSIVE FOR SELECT TO PUBLIC USING (noven_private.puede_leer_producto_sucursal(sucursal_id, producto_id));

CREATE POLICY vencimientos_select_scope_v1 ON public.vencimientos AS PERMISSIVE FOR SELECT TO PUBLIC USING (noven_private.puede_leer_producto_sucursal(sucursal_id, producto_id));

CREATE POLICY zonas_select_scope ON public.zonas AS PERMISSIVE FOR SELECT TO authenticated USING (noven_private.tiene_acceso_zona(id));
