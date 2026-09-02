REVOKE ALL PRIVILEGES ON TABLE public.acciones_operativas FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.alertas_zonales FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.alertas_zonales_destinos FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.familias FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.importacion_0258_detalle FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON SEQUENCE public.importacion_0258_detalle_id_seq FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.importaciones FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.intervenciones_rag FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.invitaciones_acceso FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.organizaciones FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.problemas_economicos_ciclos FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.producto_codigos FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.producto_costo_observaciones FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON SEQUENCE public.producto_costo_observaciones_id_seq FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.producto_costo_ultima_observacion FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.producto_imagen_cambios FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON SEQUENCE public.producto_imagen_cambios_id_seq FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.producto_pendiente_detecciones FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON SEQUENCE public.producto_pendiente_detecciones_id_seq FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.producto_snapshots FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON SEQUENCE public.producto_snapshots_id_seq FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.producto_sucursal FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.productos FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.productos_pendientes_catalogo FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.push_subscriptions FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.rag_escalamientos FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.regiones FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.sectores FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.sucursales FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.usuario_accesos FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.usuario_familias FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.usuario_familias_sucursal FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.usuarios FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.v_acciones_operativas_historial FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.v_efectividad_intervencion_rag FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.v_efectividad_rag_operador FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.v_efectividad_rag_resumen FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.v_problemas_economicos_historial FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.v_producto_sucursal_operativo FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.v_productos_catalogo FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.v_resultado_operador_rag FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.v_resultado_vencimiento_tramos FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.v_seguimiento_rag_actual FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.v_vencimientos_operativos FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vencimiento_observaciones FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON SEQUENCE public.vencimiento_observaciones_id_seq FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vencimientos FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vw_usuarios_completos FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.zonas FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.acciones_operativas TO authenticated;

GRANT DELETE ON TABLE public.acciones_operativas TO service_role;

GRANT INSERT ON TABLE public.acciones_operativas TO service_role;

GRANT MAINTAIN ON TABLE public.acciones_operativas TO service_role;

GRANT REFERENCES ON TABLE public.acciones_operativas TO service_role;

GRANT SELECT ON TABLE public.acciones_operativas TO service_role;

GRANT TRIGGER ON TABLE public.acciones_operativas TO service_role;

GRANT TRUNCATE ON TABLE public.acciones_operativas TO service_role;

GRANT UPDATE ON TABLE public.acciones_operativas TO service_role;

GRANT DELETE ON TABLE public.alertas_zonales TO service_role;

GRANT INSERT ON TABLE public.alertas_zonales TO service_role;

GRANT MAINTAIN ON TABLE public.alertas_zonales TO service_role;

GRANT REFERENCES ON TABLE public.alertas_zonales TO service_role;

GRANT SELECT ON TABLE public.alertas_zonales TO service_role;

GRANT TRIGGER ON TABLE public.alertas_zonales TO service_role;

GRANT TRUNCATE ON TABLE public.alertas_zonales TO service_role;

GRANT UPDATE ON TABLE public.alertas_zonales TO service_role;

GRANT DELETE ON TABLE public.alertas_zonales_destinos TO service_role;

GRANT INSERT ON TABLE public.alertas_zonales_destinos TO service_role;

GRANT MAINTAIN ON TABLE public.alertas_zonales_destinos TO service_role;

GRANT REFERENCES ON TABLE public.alertas_zonales_destinos TO service_role;

GRANT SELECT ON TABLE public.alertas_zonales_destinos TO service_role;

GRANT TRIGGER ON TABLE public.alertas_zonales_destinos TO service_role;

GRANT TRUNCATE ON TABLE public.alertas_zonales_destinos TO service_role;

GRANT UPDATE ON TABLE public.alertas_zonales_destinos TO service_role;

GRANT SELECT ON TABLE public.familias TO authenticated;

GRANT DELETE ON TABLE public.familias TO service_role;

GRANT INSERT ON TABLE public.familias TO service_role;

GRANT MAINTAIN ON TABLE public.familias TO service_role;

GRANT REFERENCES ON TABLE public.familias TO service_role;

GRANT SELECT ON TABLE public.familias TO service_role;

GRANT TRIGGER ON TABLE public.familias TO service_role;

GRANT TRUNCATE ON TABLE public.familias TO service_role;

GRANT UPDATE ON TABLE public.familias TO service_role;

GRANT DELETE ON TABLE public.importacion_0258_detalle TO service_role;

GRANT INSERT ON TABLE public.importacion_0258_detalle TO service_role;

GRANT MAINTAIN ON TABLE public.importacion_0258_detalle TO service_role;

GRANT REFERENCES ON TABLE public.importacion_0258_detalle TO service_role;

GRANT SELECT ON TABLE public.importacion_0258_detalle TO service_role;

GRANT TRIGGER ON TABLE public.importacion_0258_detalle TO service_role;

GRANT TRUNCATE ON TABLE public.importacion_0258_detalle TO service_role;

GRANT UPDATE ON TABLE public.importacion_0258_detalle TO service_role;

GRANT SELECT ON SEQUENCE public.importacion_0258_detalle_id_seq TO anon;

GRANT UPDATE ON SEQUENCE public.importacion_0258_detalle_id_seq TO anon;

GRANT USAGE ON SEQUENCE public.importacion_0258_detalle_id_seq TO anon;

GRANT SELECT ON SEQUENCE public.importacion_0258_detalle_id_seq TO authenticated;

GRANT UPDATE ON SEQUENCE public.importacion_0258_detalle_id_seq TO authenticated;

GRANT USAGE ON SEQUENCE public.importacion_0258_detalle_id_seq TO authenticated;

GRANT SELECT ON SEQUENCE public.importacion_0258_detalle_id_seq TO service_role;

GRANT UPDATE ON SEQUENCE public.importacion_0258_detalle_id_seq TO service_role;

GRANT USAGE ON SEQUENCE public.importacion_0258_detalle_id_seq TO service_role;

GRANT DELETE ON TABLE public.importaciones TO service_role;

GRANT INSERT ON TABLE public.importaciones TO service_role;

GRANT MAINTAIN ON TABLE public.importaciones TO service_role;

GRANT REFERENCES ON TABLE public.importaciones TO service_role;

GRANT SELECT ON TABLE public.importaciones TO service_role;

GRANT TRIGGER ON TABLE public.importaciones TO service_role;

GRANT TRUNCATE ON TABLE public.importaciones TO service_role;

GRANT UPDATE ON TABLE public.importaciones TO service_role;

GRANT SELECT ON TABLE public.intervenciones_rag TO authenticated;

GRANT DELETE ON TABLE public.intervenciones_rag TO service_role;

GRANT INSERT ON TABLE public.intervenciones_rag TO service_role;

GRANT MAINTAIN ON TABLE public.intervenciones_rag TO service_role;

GRANT REFERENCES ON TABLE public.intervenciones_rag TO service_role;

GRANT SELECT ON TABLE public.intervenciones_rag TO service_role;

GRANT TRIGGER ON TABLE public.intervenciones_rag TO service_role;

GRANT TRUNCATE ON TABLE public.intervenciones_rag TO service_role;

GRANT UPDATE ON TABLE public.intervenciones_rag TO service_role;

GRANT DELETE ON TABLE public.invitaciones_acceso TO service_role;

GRANT INSERT ON TABLE public.invitaciones_acceso TO service_role;

GRANT MAINTAIN ON TABLE public.invitaciones_acceso TO service_role;

GRANT REFERENCES ON TABLE public.invitaciones_acceso TO service_role;

GRANT SELECT ON TABLE public.invitaciones_acceso TO service_role;

GRANT TRIGGER ON TABLE public.invitaciones_acceso TO service_role;

GRANT TRUNCATE ON TABLE public.invitaciones_acceso TO service_role;

GRANT UPDATE ON TABLE public.invitaciones_acceso TO service_role;

GRANT SELECT ON TABLE public.organizaciones TO authenticated;

GRANT DELETE ON TABLE public.organizaciones TO service_role;

GRANT INSERT ON TABLE public.organizaciones TO service_role;

GRANT MAINTAIN ON TABLE public.organizaciones TO service_role;

GRANT REFERENCES ON TABLE public.organizaciones TO service_role;

GRANT SELECT ON TABLE public.organizaciones TO service_role;

GRANT TRIGGER ON TABLE public.organizaciones TO service_role;

GRANT TRUNCATE ON TABLE public.organizaciones TO service_role;

GRANT UPDATE ON TABLE public.organizaciones TO service_role;

GRANT DELETE ON TABLE public.problemas_economicos_ciclos TO service_role;

GRANT INSERT ON TABLE public.problemas_economicos_ciclos TO service_role;

GRANT MAINTAIN ON TABLE public.problemas_economicos_ciclos TO service_role;

GRANT REFERENCES ON TABLE public.problemas_economicos_ciclos TO service_role;

GRANT SELECT ON TABLE public.problemas_economicos_ciclos TO service_role;

GRANT TRIGGER ON TABLE public.problemas_economicos_ciclos TO service_role;

GRANT TRUNCATE ON TABLE public.problemas_economicos_ciclos TO service_role;

GRANT UPDATE ON TABLE public.problemas_economicos_ciclos TO service_role;

GRANT SELECT ON TABLE public.producto_codigos TO authenticated;

GRANT DELETE ON TABLE public.producto_codigos TO service_role;

GRANT INSERT ON TABLE public.producto_codigos TO service_role;

GRANT MAINTAIN ON TABLE public.producto_codigos TO service_role;

GRANT REFERENCES ON TABLE public.producto_codigos TO service_role;

GRANT SELECT ON TABLE public.producto_codigos TO service_role;

GRANT TRIGGER ON TABLE public.producto_codigos TO service_role;

GRANT TRUNCATE ON TABLE public.producto_codigos TO service_role;

GRANT UPDATE ON TABLE public.producto_codigos TO service_role;

GRANT DELETE ON TABLE public.producto_costo_observaciones TO service_role;

GRANT INSERT ON TABLE public.producto_costo_observaciones TO service_role;

GRANT MAINTAIN ON TABLE public.producto_costo_observaciones TO service_role;

GRANT REFERENCES ON TABLE public.producto_costo_observaciones TO service_role;

GRANT SELECT ON TABLE public.producto_costo_observaciones TO service_role;

GRANT TRIGGER ON TABLE public.producto_costo_observaciones TO service_role;

GRANT TRUNCATE ON TABLE public.producto_costo_observaciones TO service_role;

GRANT UPDATE ON TABLE public.producto_costo_observaciones TO service_role;

GRANT SELECT ON SEQUENCE public.producto_costo_observaciones_id_seq TO anon;

GRANT UPDATE ON SEQUENCE public.producto_costo_observaciones_id_seq TO anon;

GRANT USAGE ON SEQUENCE public.producto_costo_observaciones_id_seq TO anon;

GRANT SELECT ON SEQUENCE public.producto_costo_observaciones_id_seq TO authenticated;

GRANT UPDATE ON SEQUENCE public.producto_costo_observaciones_id_seq TO authenticated;

GRANT USAGE ON SEQUENCE public.producto_costo_observaciones_id_seq TO authenticated;

GRANT SELECT ON SEQUENCE public.producto_costo_observaciones_id_seq TO service_role;

GRANT UPDATE ON SEQUENCE public.producto_costo_observaciones_id_seq TO service_role;

GRANT USAGE ON SEQUENCE public.producto_costo_observaciones_id_seq TO service_role;

GRANT DELETE ON TABLE public.producto_costo_ultima_observacion TO service_role;

GRANT INSERT ON TABLE public.producto_costo_ultima_observacion TO service_role;

GRANT MAINTAIN ON TABLE public.producto_costo_ultima_observacion TO service_role;

GRANT REFERENCES ON TABLE public.producto_costo_ultima_observacion TO service_role;

GRANT SELECT ON TABLE public.producto_costo_ultima_observacion TO service_role;

GRANT TRIGGER ON TABLE public.producto_costo_ultima_observacion TO service_role;

GRANT TRUNCATE ON TABLE public.producto_costo_ultima_observacion TO service_role;

GRANT UPDATE ON TABLE public.producto_costo_ultima_observacion TO service_role;

GRANT DELETE ON TABLE public.producto_imagen_cambios TO service_role;

GRANT INSERT ON TABLE public.producto_imagen_cambios TO service_role;

GRANT MAINTAIN ON TABLE public.producto_imagen_cambios TO service_role;

GRANT REFERENCES ON TABLE public.producto_imagen_cambios TO service_role;

GRANT SELECT ON TABLE public.producto_imagen_cambios TO service_role;

GRANT TRIGGER ON TABLE public.producto_imagen_cambios TO service_role;

GRANT TRUNCATE ON TABLE public.producto_imagen_cambios TO service_role;

GRANT UPDATE ON TABLE public.producto_imagen_cambios TO service_role;

GRANT SELECT ON SEQUENCE public.producto_imagen_cambios_id_seq TO anon;

GRANT UPDATE ON SEQUENCE public.producto_imagen_cambios_id_seq TO anon;

GRANT USAGE ON SEQUENCE public.producto_imagen_cambios_id_seq TO anon;

GRANT SELECT ON SEQUENCE public.producto_imagen_cambios_id_seq TO authenticated;

GRANT UPDATE ON SEQUENCE public.producto_imagen_cambios_id_seq TO authenticated;

GRANT USAGE ON SEQUENCE public.producto_imagen_cambios_id_seq TO authenticated;

GRANT SELECT ON SEQUENCE public.producto_imagen_cambios_id_seq TO service_role;

GRANT UPDATE ON SEQUENCE public.producto_imagen_cambios_id_seq TO service_role;

GRANT USAGE ON SEQUENCE public.producto_imagen_cambios_id_seq TO service_role;

GRANT DELETE ON TABLE public.producto_pendiente_detecciones TO service_role;

GRANT INSERT ON TABLE public.producto_pendiente_detecciones TO service_role;

GRANT MAINTAIN ON TABLE public.producto_pendiente_detecciones TO service_role;

GRANT REFERENCES ON TABLE public.producto_pendiente_detecciones TO service_role;

GRANT SELECT ON TABLE public.producto_pendiente_detecciones TO service_role;

GRANT TRIGGER ON TABLE public.producto_pendiente_detecciones TO service_role;

GRANT TRUNCATE ON TABLE public.producto_pendiente_detecciones TO service_role;

GRANT UPDATE ON TABLE public.producto_pendiente_detecciones TO service_role;

GRANT SELECT ON SEQUENCE public.producto_pendiente_detecciones_id_seq TO anon;

GRANT UPDATE ON SEQUENCE public.producto_pendiente_detecciones_id_seq TO anon;

GRANT USAGE ON SEQUENCE public.producto_pendiente_detecciones_id_seq TO anon;

GRANT SELECT ON SEQUENCE public.producto_pendiente_detecciones_id_seq TO authenticated;

GRANT UPDATE ON SEQUENCE public.producto_pendiente_detecciones_id_seq TO authenticated;

GRANT USAGE ON SEQUENCE public.producto_pendiente_detecciones_id_seq TO authenticated;

GRANT SELECT ON SEQUENCE public.producto_pendiente_detecciones_id_seq TO service_role;

GRANT UPDATE ON SEQUENCE public.producto_pendiente_detecciones_id_seq TO service_role;

GRANT USAGE ON SEQUENCE public.producto_pendiente_detecciones_id_seq TO service_role;

GRANT DELETE ON TABLE public.producto_snapshots TO service_role;

GRANT INSERT ON TABLE public.producto_snapshots TO service_role;

GRANT MAINTAIN ON TABLE public.producto_snapshots TO service_role;

GRANT REFERENCES ON TABLE public.producto_snapshots TO service_role;

GRANT SELECT ON TABLE public.producto_snapshots TO service_role;

GRANT TRIGGER ON TABLE public.producto_snapshots TO service_role;

GRANT TRUNCATE ON TABLE public.producto_snapshots TO service_role;

GRANT UPDATE ON TABLE public.producto_snapshots TO service_role;

GRANT SELECT ON SEQUENCE public.producto_snapshots_id_seq TO anon;

GRANT UPDATE ON SEQUENCE public.producto_snapshots_id_seq TO anon;

GRANT USAGE ON SEQUENCE public.producto_snapshots_id_seq TO anon;

GRANT SELECT ON SEQUENCE public.producto_snapshots_id_seq TO authenticated;

GRANT UPDATE ON SEQUENCE public.producto_snapshots_id_seq TO authenticated;

GRANT USAGE ON SEQUENCE public.producto_snapshots_id_seq TO authenticated;

GRANT SELECT ON SEQUENCE public.producto_snapshots_id_seq TO service_role;

GRANT UPDATE ON SEQUENCE public.producto_snapshots_id_seq TO service_role;

GRANT USAGE ON SEQUENCE public.producto_snapshots_id_seq TO service_role;

GRANT SELECT ON TABLE public.producto_sucursal TO authenticated;

GRANT DELETE ON TABLE public.producto_sucursal TO service_role;

GRANT INSERT ON TABLE public.producto_sucursal TO service_role;

GRANT MAINTAIN ON TABLE public.producto_sucursal TO service_role;

GRANT REFERENCES ON TABLE public.producto_sucursal TO service_role;

GRANT SELECT ON TABLE public.producto_sucursal TO service_role;

GRANT TRIGGER ON TABLE public.producto_sucursal TO service_role;

GRANT TRUNCATE ON TABLE public.producto_sucursal TO service_role;

GRANT UPDATE ON TABLE public.producto_sucursal TO service_role;

GRANT SELECT ON TABLE public.productos TO authenticated;

GRANT DELETE ON TABLE public.productos TO service_role;

GRANT INSERT ON TABLE public.productos TO service_role;

GRANT MAINTAIN ON TABLE public.productos TO service_role;

GRANT REFERENCES ON TABLE public.productos TO service_role;

GRANT SELECT ON TABLE public.productos TO service_role;

GRANT TRIGGER ON TABLE public.productos TO service_role;

GRANT TRUNCATE ON TABLE public.productos TO service_role;

GRANT UPDATE ON TABLE public.productos TO service_role;

GRANT DELETE ON TABLE public.productos_pendientes_catalogo TO service_role;

GRANT INSERT ON TABLE public.productos_pendientes_catalogo TO service_role;

GRANT MAINTAIN ON TABLE public.productos_pendientes_catalogo TO service_role;

GRANT REFERENCES ON TABLE public.productos_pendientes_catalogo TO service_role;

GRANT SELECT ON TABLE public.productos_pendientes_catalogo TO service_role;

GRANT TRIGGER ON TABLE public.productos_pendientes_catalogo TO service_role;

GRANT TRUNCATE ON TABLE public.productos_pendientes_catalogo TO service_role;

GRANT UPDATE ON TABLE public.productos_pendientes_catalogo TO service_role;

GRANT DELETE ON TABLE public.push_subscriptions TO authenticated;

GRANT INSERT ON TABLE public.push_subscriptions TO authenticated;

GRANT MAINTAIN ON TABLE public.push_subscriptions TO authenticated;

GRANT REFERENCES ON TABLE public.push_subscriptions TO authenticated;

GRANT SELECT ON TABLE public.push_subscriptions TO authenticated;

GRANT TRIGGER ON TABLE public.push_subscriptions TO authenticated;

GRANT TRUNCATE ON TABLE public.push_subscriptions TO authenticated;

GRANT UPDATE ON TABLE public.push_subscriptions TO authenticated;

GRANT DELETE ON TABLE public.push_subscriptions TO service_role;

GRANT INSERT ON TABLE public.push_subscriptions TO service_role;

GRANT MAINTAIN ON TABLE public.push_subscriptions TO service_role;

GRANT REFERENCES ON TABLE public.push_subscriptions TO service_role;

GRANT SELECT ON TABLE public.push_subscriptions TO service_role;

GRANT TRIGGER ON TABLE public.push_subscriptions TO service_role;

GRANT TRUNCATE ON TABLE public.push_subscriptions TO service_role;

GRANT UPDATE ON TABLE public.push_subscriptions TO service_role;

GRANT DELETE ON TABLE public.rag_escalamientos TO service_role;

GRANT INSERT ON TABLE public.rag_escalamientos TO service_role;

GRANT MAINTAIN ON TABLE public.rag_escalamientos TO service_role;

GRANT REFERENCES ON TABLE public.rag_escalamientos TO service_role;

GRANT SELECT ON TABLE public.rag_escalamientos TO service_role;

GRANT TRIGGER ON TABLE public.rag_escalamientos TO service_role;

GRANT TRUNCATE ON TABLE public.rag_escalamientos TO service_role;

GRANT UPDATE ON TABLE public.rag_escalamientos TO service_role;

GRANT DELETE ON TABLE public.regiones TO authenticated;

GRANT INSERT ON TABLE public.regiones TO authenticated;

GRANT MAINTAIN ON TABLE public.regiones TO authenticated;

GRANT REFERENCES ON TABLE public.regiones TO authenticated;

GRANT SELECT ON TABLE public.regiones TO authenticated;

GRANT TRIGGER ON TABLE public.regiones TO authenticated;

GRANT TRUNCATE ON TABLE public.regiones TO authenticated;

GRANT UPDATE ON TABLE public.regiones TO authenticated;

GRANT DELETE ON TABLE public.regiones TO service_role;

GRANT INSERT ON TABLE public.regiones TO service_role;

GRANT MAINTAIN ON TABLE public.regiones TO service_role;

GRANT REFERENCES ON TABLE public.regiones TO service_role;

GRANT SELECT ON TABLE public.regiones TO service_role;

GRANT TRIGGER ON TABLE public.regiones TO service_role;

GRANT TRUNCATE ON TABLE public.regiones TO service_role;

GRANT UPDATE ON TABLE public.regiones TO service_role;

GRANT SELECT ON TABLE public.sectores TO authenticated;

GRANT DELETE ON TABLE public.sectores TO service_role;

GRANT INSERT ON TABLE public.sectores TO service_role;

GRANT MAINTAIN ON TABLE public.sectores TO service_role;

GRANT REFERENCES ON TABLE public.sectores TO service_role;

GRANT SELECT ON TABLE public.sectores TO service_role;

GRANT TRIGGER ON TABLE public.sectores TO service_role;

GRANT TRUNCATE ON TABLE public.sectores TO service_role;

GRANT UPDATE ON TABLE public.sectores TO service_role;

GRANT SELECT ON TABLE public.sucursales TO authenticated;

GRANT DELETE ON TABLE public.sucursales TO service_role;

GRANT INSERT ON TABLE public.sucursales TO service_role;

GRANT MAINTAIN ON TABLE public.sucursales TO service_role;

GRANT REFERENCES ON TABLE public.sucursales TO service_role;

GRANT SELECT ON TABLE public.sucursales TO service_role;

GRANT TRIGGER ON TABLE public.sucursales TO service_role;

GRANT TRUNCATE ON TABLE public.sucursales TO service_role;

GRANT UPDATE ON TABLE public.sucursales TO service_role;

GRANT SELECT ON TABLE public.usuario_accesos TO authenticated;

GRANT DELETE ON TABLE public.usuario_accesos TO service_role;

GRANT INSERT ON TABLE public.usuario_accesos TO service_role;

GRANT MAINTAIN ON TABLE public.usuario_accesos TO service_role;

GRANT REFERENCES ON TABLE public.usuario_accesos TO service_role;

GRANT SELECT ON TABLE public.usuario_accesos TO service_role;

GRANT TRIGGER ON TABLE public.usuario_accesos TO service_role;

GRANT TRUNCATE ON TABLE public.usuario_accesos TO service_role;

GRANT UPDATE ON TABLE public.usuario_accesos TO service_role;

GRANT DELETE ON TABLE public.usuario_familias TO service_role;

GRANT INSERT ON TABLE public.usuario_familias TO service_role;

GRANT MAINTAIN ON TABLE public.usuario_familias TO service_role;

GRANT REFERENCES ON TABLE public.usuario_familias TO service_role;

GRANT SELECT ON TABLE public.usuario_familias TO service_role;

GRANT TRIGGER ON TABLE public.usuario_familias TO service_role;

GRANT TRUNCATE ON TABLE public.usuario_familias TO service_role;

GRANT UPDATE ON TABLE public.usuario_familias TO service_role;

GRANT SELECT ON TABLE public.usuario_familias_sucursal TO authenticated;

GRANT DELETE ON TABLE public.usuario_familias_sucursal TO service_role;

GRANT INSERT ON TABLE public.usuario_familias_sucursal TO service_role;

GRANT MAINTAIN ON TABLE public.usuario_familias_sucursal TO service_role;

GRANT REFERENCES ON TABLE public.usuario_familias_sucursal TO service_role;

GRANT SELECT ON TABLE public.usuario_familias_sucursal TO service_role;

GRANT TRIGGER ON TABLE public.usuario_familias_sucursal TO service_role;

GRANT TRUNCATE ON TABLE public.usuario_familias_sucursal TO service_role;

GRANT UPDATE ON TABLE public.usuario_familias_sucursal TO service_role;

GRANT SELECT ON TABLE public.usuarios TO authenticated;

GRANT DELETE ON TABLE public.usuarios TO service_role;

GRANT INSERT ON TABLE public.usuarios TO service_role;

GRANT MAINTAIN ON TABLE public.usuarios TO service_role;

GRANT REFERENCES ON TABLE public.usuarios TO service_role;

GRANT SELECT ON TABLE public.usuarios TO service_role;

GRANT TRIGGER ON TABLE public.usuarios TO service_role;

GRANT TRUNCATE ON TABLE public.usuarios TO service_role;

GRANT UPDATE ON TABLE public.usuarios TO service_role;

GRANT DELETE ON TABLE public.v_acciones_operativas_historial TO authenticated;

GRANT INSERT ON TABLE public.v_acciones_operativas_historial TO authenticated;

GRANT MAINTAIN ON TABLE public.v_acciones_operativas_historial TO authenticated;

GRANT REFERENCES ON TABLE public.v_acciones_operativas_historial TO authenticated;

GRANT SELECT ON TABLE public.v_acciones_operativas_historial TO authenticated;

GRANT TRIGGER ON TABLE public.v_acciones_operativas_historial TO authenticated;

GRANT TRUNCATE ON TABLE public.v_acciones_operativas_historial TO authenticated;

GRANT UPDATE ON TABLE public.v_acciones_operativas_historial TO authenticated;

GRANT DELETE ON TABLE public.v_acciones_operativas_historial TO service_role;

GRANT INSERT ON TABLE public.v_acciones_operativas_historial TO service_role;

GRANT MAINTAIN ON TABLE public.v_acciones_operativas_historial TO service_role;

GRANT REFERENCES ON TABLE public.v_acciones_operativas_historial TO service_role;

GRANT SELECT ON TABLE public.v_acciones_operativas_historial TO service_role;

GRANT TRIGGER ON TABLE public.v_acciones_operativas_historial TO service_role;

GRANT TRUNCATE ON TABLE public.v_acciones_operativas_historial TO service_role;

GRANT UPDATE ON TABLE public.v_acciones_operativas_historial TO service_role;

GRANT DELETE ON TABLE public.v_efectividad_intervencion_rag TO authenticated;

GRANT INSERT ON TABLE public.v_efectividad_intervencion_rag TO authenticated;

GRANT MAINTAIN ON TABLE public.v_efectividad_intervencion_rag TO authenticated;

GRANT REFERENCES ON TABLE public.v_efectividad_intervencion_rag TO authenticated;

GRANT SELECT ON TABLE public.v_efectividad_intervencion_rag TO authenticated;

GRANT TRIGGER ON TABLE public.v_efectividad_intervencion_rag TO authenticated;

GRANT TRUNCATE ON TABLE public.v_efectividad_intervencion_rag TO authenticated;

GRANT UPDATE ON TABLE public.v_efectividad_intervencion_rag TO authenticated;

GRANT DELETE ON TABLE public.v_efectividad_intervencion_rag TO service_role;

GRANT INSERT ON TABLE public.v_efectividad_intervencion_rag TO service_role;

GRANT MAINTAIN ON TABLE public.v_efectividad_intervencion_rag TO service_role;

GRANT REFERENCES ON TABLE public.v_efectividad_intervencion_rag TO service_role;

GRANT SELECT ON TABLE public.v_efectividad_intervencion_rag TO service_role;

GRANT TRIGGER ON TABLE public.v_efectividad_intervencion_rag TO service_role;

GRANT TRUNCATE ON TABLE public.v_efectividad_intervencion_rag TO service_role;

GRANT UPDATE ON TABLE public.v_efectividad_intervencion_rag TO service_role;

GRANT DELETE ON TABLE public.v_efectividad_rag_operador TO authenticated;

GRANT INSERT ON TABLE public.v_efectividad_rag_operador TO authenticated;

GRANT MAINTAIN ON TABLE public.v_efectividad_rag_operador TO authenticated;

GRANT REFERENCES ON TABLE public.v_efectividad_rag_operador TO authenticated;

GRANT SELECT ON TABLE public.v_efectividad_rag_operador TO authenticated;

GRANT TRIGGER ON TABLE public.v_efectividad_rag_operador TO authenticated;

GRANT TRUNCATE ON TABLE public.v_efectividad_rag_operador TO authenticated;

GRANT UPDATE ON TABLE public.v_efectividad_rag_operador TO authenticated;

GRANT DELETE ON TABLE public.v_efectividad_rag_operador TO service_role;

GRANT INSERT ON TABLE public.v_efectividad_rag_operador TO service_role;

GRANT MAINTAIN ON TABLE public.v_efectividad_rag_operador TO service_role;

GRANT REFERENCES ON TABLE public.v_efectividad_rag_operador TO service_role;

GRANT SELECT ON TABLE public.v_efectividad_rag_operador TO service_role;

GRANT TRIGGER ON TABLE public.v_efectividad_rag_operador TO service_role;

GRANT TRUNCATE ON TABLE public.v_efectividad_rag_operador TO service_role;

GRANT UPDATE ON TABLE public.v_efectividad_rag_operador TO service_role;

GRANT DELETE ON TABLE public.v_efectividad_rag_resumen TO authenticated;

GRANT INSERT ON TABLE public.v_efectividad_rag_resumen TO authenticated;

GRANT MAINTAIN ON TABLE public.v_efectividad_rag_resumen TO authenticated;

GRANT REFERENCES ON TABLE public.v_efectividad_rag_resumen TO authenticated;

GRANT SELECT ON TABLE public.v_efectividad_rag_resumen TO authenticated;

GRANT TRIGGER ON TABLE public.v_efectividad_rag_resumen TO authenticated;

GRANT TRUNCATE ON TABLE public.v_efectividad_rag_resumen TO authenticated;

GRANT UPDATE ON TABLE public.v_efectividad_rag_resumen TO authenticated;

GRANT DELETE ON TABLE public.v_efectividad_rag_resumen TO service_role;

GRANT INSERT ON TABLE public.v_efectividad_rag_resumen TO service_role;

GRANT MAINTAIN ON TABLE public.v_efectividad_rag_resumen TO service_role;

GRANT REFERENCES ON TABLE public.v_efectividad_rag_resumen TO service_role;

GRANT SELECT ON TABLE public.v_efectividad_rag_resumen TO service_role;

GRANT TRIGGER ON TABLE public.v_efectividad_rag_resumen TO service_role;

GRANT TRUNCATE ON TABLE public.v_efectividad_rag_resumen TO service_role;

GRANT UPDATE ON TABLE public.v_efectividad_rag_resumen TO service_role;

GRANT DELETE ON TABLE public.v_problemas_economicos_historial TO service_role;

GRANT INSERT ON TABLE public.v_problemas_economicos_historial TO service_role;

GRANT MAINTAIN ON TABLE public.v_problemas_economicos_historial TO service_role;

GRANT REFERENCES ON TABLE public.v_problemas_economicos_historial TO service_role;

GRANT SELECT ON TABLE public.v_problemas_economicos_historial TO service_role;

GRANT TRIGGER ON TABLE public.v_problemas_economicos_historial TO service_role;

GRANT TRUNCATE ON TABLE public.v_problemas_economicos_historial TO service_role;

GRANT UPDATE ON TABLE public.v_problemas_economicos_historial TO service_role;

GRANT DELETE ON TABLE public.v_producto_sucursal_operativo TO authenticated;

GRANT INSERT ON TABLE public.v_producto_sucursal_operativo TO authenticated;

GRANT MAINTAIN ON TABLE public.v_producto_sucursal_operativo TO authenticated;

GRANT REFERENCES ON TABLE public.v_producto_sucursal_operativo TO authenticated;

GRANT SELECT ON TABLE public.v_producto_sucursal_operativo TO authenticated;

GRANT TRIGGER ON TABLE public.v_producto_sucursal_operativo TO authenticated;

GRANT TRUNCATE ON TABLE public.v_producto_sucursal_operativo TO authenticated;

GRANT UPDATE ON TABLE public.v_producto_sucursal_operativo TO authenticated;

GRANT DELETE ON TABLE public.v_producto_sucursal_operativo TO service_role;

GRANT INSERT ON TABLE public.v_producto_sucursal_operativo TO service_role;

GRANT MAINTAIN ON TABLE public.v_producto_sucursal_operativo TO service_role;

GRANT REFERENCES ON TABLE public.v_producto_sucursal_operativo TO service_role;

GRANT SELECT ON TABLE public.v_producto_sucursal_operativo TO service_role;

GRANT TRIGGER ON TABLE public.v_producto_sucursal_operativo TO service_role;

GRANT TRUNCATE ON TABLE public.v_producto_sucursal_operativo TO service_role;

GRANT UPDATE ON TABLE public.v_producto_sucursal_operativo TO service_role;

GRANT DELETE ON TABLE public.v_productos_catalogo TO authenticated;

GRANT INSERT ON TABLE public.v_productos_catalogo TO authenticated;

GRANT MAINTAIN ON TABLE public.v_productos_catalogo TO authenticated;

GRANT REFERENCES ON TABLE public.v_productos_catalogo TO authenticated;

GRANT SELECT ON TABLE public.v_productos_catalogo TO authenticated;

GRANT TRIGGER ON TABLE public.v_productos_catalogo TO authenticated;

GRANT TRUNCATE ON TABLE public.v_productos_catalogo TO authenticated;

GRANT UPDATE ON TABLE public.v_productos_catalogo TO authenticated;

GRANT DELETE ON TABLE public.v_productos_catalogo TO service_role;

GRANT INSERT ON TABLE public.v_productos_catalogo TO service_role;

GRANT MAINTAIN ON TABLE public.v_productos_catalogo TO service_role;

GRANT REFERENCES ON TABLE public.v_productos_catalogo TO service_role;

GRANT SELECT ON TABLE public.v_productos_catalogo TO service_role;

GRANT TRIGGER ON TABLE public.v_productos_catalogo TO service_role;

GRANT TRUNCATE ON TABLE public.v_productos_catalogo TO service_role;

GRANT UPDATE ON TABLE public.v_productos_catalogo TO service_role;

GRANT DELETE ON TABLE public.v_resultado_operador_rag TO authenticated;

GRANT INSERT ON TABLE public.v_resultado_operador_rag TO authenticated;

GRANT MAINTAIN ON TABLE public.v_resultado_operador_rag TO authenticated;

GRANT REFERENCES ON TABLE public.v_resultado_operador_rag TO authenticated;

GRANT SELECT ON TABLE public.v_resultado_operador_rag TO authenticated;

GRANT TRIGGER ON TABLE public.v_resultado_operador_rag TO authenticated;

GRANT TRUNCATE ON TABLE public.v_resultado_operador_rag TO authenticated;

GRANT UPDATE ON TABLE public.v_resultado_operador_rag TO authenticated;

GRANT DELETE ON TABLE public.v_resultado_operador_rag TO service_role;

GRANT INSERT ON TABLE public.v_resultado_operador_rag TO service_role;

GRANT MAINTAIN ON TABLE public.v_resultado_operador_rag TO service_role;

GRANT REFERENCES ON TABLE public.v_resultado_operador_rag TO service_role;

GRANT SELECT ON TABLE public.v_resultado_operador_rag TO service_role;

GRANT TRIGGER ON TABLE public.v_resultado_operador_rag TO service_role;

GRANT TRUNCATE ON TABLE public.v_resultado_operador_rag TO service_role;

GRANT UPDATE ON TABLE public.v_resultado_operador_rag TO service_role;

GRANT DELETE ON TABLE public.v_resultado_vencimiento_tramos TO authenticated;

GRANT INSERT ON TABLE public.v_resultado_vencimiento_tramos TO authenticated;

GRANT MAINTAIN ON TABLE public.v_resultado_vencimiento_tramos TO authenticated;

GRANT REFERENCES ON TABLE public.v_resultado_vencimiento_tramos TO authenticated;

GRANT SELECT ON TABLE public.v_resultado_vencimiento_tramos TO authenticated;

GRANT TRIGGER ON TABLE public.v_resultado_vencimiento_tramos TO authenticated;

GRANT TRUNCATE ON TABLE public.v_resultado_vencimiento_tramos TO authenticated;

GRANT UPDATE ON TABLE public.v_resultado_vencimiento_tramos TO authenticated;

GRANT DELETE ON TABLE public.v_resultado_vencimiento_tramos TO service_role;

GRANT INSERT ON TABLE public.v_resultado_vencimiento_tramos TO service_role;

GRANT MAINTAIN ON TABLE public.v_resultado_vencimiento_tramos TO service_role;

GRANT REFERENCES ON TABLE public.v_resultado_vencimiento_tramos TO service_role;

GRANT SELECT ON TABLE public.v_resultado_vencimiento_tramos TO service_role;

GRANT TRIGGER ON TABLE public.v_resultado_vencimiento_tramos TO service_role;

GRANT TRUNCATE ON TABLE public.v_resultado_vencimiento_tramos TO service_role;

GRANT UPDATE ON TABLE public.v_resultado_vencimiento_tramos TO service_role;

GRANT DELETE ON TABLE public.v_seguimiento_rag_actual TO authenticated;

GRANT INSERT ON TABLE public.v_seguimiento_rag_actual TO authenticated;

GRANT MAINTAIN ON TABLE public.v_seguimiento_rag_actual TO authenticated;

GRANT REFERENCES ON TABLE public.v_seguimiento_rag_actual TO authenticated;

GRANT SELECT ON TABLE public.v_seguimiento_rag_actual TO authenticated;

GRANT TRIGGER ON TABLE public.v_seguimiento_rag_actual TO authenticated;

GRANT TRUNCATE ON TABLE public.v_seguimiento_rag_actual TO authenticated;

GRANT UPDATE ON TABLE public.v_seguimiento_rag_actual TO authenticated;

GRANT DELETE ON TABLE public.v_seguimiento_rag_actual TO service_role;

GRANT INSERT ON TABLE public.v_seguimiento_rag_actual TO service_role;

GRANT MAINTAIN ON TABLE public.v_seguimiento_rag_actual TO service_role;

GRANT REFERENCES ON TABLE public.v_seguimiento_rag_actual TO service_role;

GRANT SELECT ON TABLE public.v_seguimiento_rag_actual TO service_role;

GRANT TRIGGER ON TABLE public.v_seguimiento_rag_actual TO service_role;

GRANT TRUNCATE ON TABLE public.v_seguimiento_rag_actual TO service_role;

GRANT UPDATE ON TABLE public.v_seguimiento_rag_actual TO service_role;

GRANT DELETE ON TABLE public.v_vencimientos_operativos TO authenticated;

GRANT INSERT ON TABLE public.v_vencimientos_operativos TO authenticated;

GRANT MAINTAIN ON TABLE public.v_vencimientos_operativos TO authenticated;

GRANT REFERENCES ON TABLE public.v_vencimientos_operativos TO authenticated;

GRANT SELECT ON TABLE public.v_vencimientos_operativos TO authenticated;

GRANT TRIGGER ON TABLE public.v_vencimientos_operativos TO authenticated;

GRANT TRUNCATE ON TABLE public.v_vencimientos_operativos TO authenticated;

GRANT UPDATE ON TABLE public.v_vencimientos_operativos TO authenticated;

GRANT DELETE ON TABLE public.v_vencimientos_operativos TO service_role;

GRANT INSERT ON TABLE public.v_vencimientos_operativos TO service_role;

GRANT MAINTAIN ON TABLE public.v_vencimientos_operativos TO service_role;

GRANT REFERENCES ON TABLE public.v_vencimientos_operativos TO service_role;

GRANT SELECT ON TABLE public.v_vencimientos_operativos TO service_role;

GRANT TRIGGER ON TABLE public.v_vencimientos_operativos TO service_role;

GRANT TRUNCATE ON TABLE public.v_vencimientos_operativos TO service_role;

GRANT UPDATE ON TABLE public.v_vencimientos_operativos TO service_role;

GRANT SELECT ON TABLE public.vencimiento_observaciones TO authenticated;

GRANT DELETE ON TABLE public.vencimiento_observaciones TO service_role;

GRANT INSERT ON TABLE public.vencimiento_observaciones TO service_role;

GRANT MAINTAIN ON TABLE public.vencimiento_observaciones TO service_role;

GRANT REFERENCES ON TABLE public.vencimiento_observaciones TO service_role;

GRANT SELECT ON TABLE public.vencimiento_observaciones TO service_role;

GRANT TRIGGER ON TABLE public.vencimiento_observaciones TO service_role;

GRANT TRUNCATE ON TABLE public.vencimiento_observaciones TO service_role;

GRANT UPDATE ON TABLE public.vencimiento_observaciones TO service_role;

GRANT SELECT ON SEQUENCE public.vencimiento_observaciones_id_seq TO anon;

GRANT UPDATE ON SEQUENCE public.vencimiento_observaciones_id_seq TO anon;

GRANT USAGE ON SEQUENCE public.vencimiento_observaciones_id_seq TO anon;

GRANT SELECT ON SEQUENCE public.vencimiento_observaciones_id_seq TO authenticated;

GRANT UPDATE ON SEQUENCE public.vencimiento_observaciones_id_seq TO authenticated;

GRANT USAGE ON SEQUENCE public.vencimiento_observaciones_id_seq TO authenticated;

GRANT SELECT ON SEQUENCE public.vencimiento_observaciones_id_seq TO service_role;

GRANT UPDATE ON SEQUENCE public.vencimiento_observaciones_id_seq TO service_role;

GRANT USAGE ON SEQUENCE public.vencimiento_observaciones_id_seq TO service_role;

GRANT SELECT ON TABLE public.vencimientos TO authenticated;

GRANT DELETE ON TABLE public.vencimientos TO service_role;

GRANT INSERT ON TABLE public.vencimientos TO service_role;

GRANT MAINTAIN ON TABLE public.vencimientos TO service_role;

GRANT REFERENCES ON TABLE public.vencimientos TO service_role;

GRANT SELECT ON TABLE public.vencimientos TO service_role;

GRANT TRIGGER ON TABLE public.vencimientos TO service_role;

GRANT TRUNCATE ON TABLE public.vencimientos TO service_role;

GRANT UPDATE ON TABLE public.vencimientos TO service_role;

GRANT DELETE ON TABLE public.vw_usuarios_completos TO service_role;

GRANT INSERT ON TABLE public.vw_usuarios_completos TO service_role;

GRANT MAINTAIN ON TABLE public.vw_usuarios_completos TO service_role;

GRANT REFERENCES ON TABLE public.vw_usuarios_completos TO service_role;

GRANT SELECT ON TABLE public.vw_usuarios_completos TO service_role;

GRANT TRIGGER ON TABLE public.vw_usuarios_completos TO service_role;

GRANT TRUNCATE ON TABLE public.vw_usuarios_completos TO service_role;

GRANT UPDATE ON TABLE public.vw_usuarios_completos TO service_role;

GRANT SELECT ON TABLE public.zonas TO authenticated;

GRANT DELETE ON TABLE public.zonas TO service_role;

GRANT INSERT ON TABLE public.zonas TO service_role;

GRANT MAINTAIN ON TABLE public.zonas TO service_role;

GRANT REFERENCES ON TABLE public.zonas TO service_role;

GRANT SELECT ON TABLE public.zonas TO service_role;

GRANT TRIGGER ON TABLE public.zonas TO service_role;

GRANT TRUNCATE ON TABLE public.zonas TO service_role;

GRANT UPDATE ON TABLE public.zonas TO service_role;
