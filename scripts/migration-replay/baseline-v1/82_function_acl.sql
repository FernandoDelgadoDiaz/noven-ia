REVOKE ALL PRIVILEGES ON FUNCTION noven_private.actualizar_imagen_producto_operador_impl(p_sucursal_id uuid, p_producto_id uuid, p_imagen_url text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.actualizar_imagen_producto_operador_v2_impl(p_sucursal_id uuid, p_producto_id uuid, p_imagen_url text, p_imagen_thumb_url text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.actualizar_vencimiento_operador_impl(p_vencimiento_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.anular_vencimiento_carga_incorrecta_impl(p_vencimiento_id uuid, p_motivo text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.cerrar_vencimiento_operativo_impl(p_vencimiento_id uuid, p_resultado text, p_observaciones text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.completar_cod_art_producto_scanner_impl(p_sucursal_id uuid, p_producto_id uuid, p_cod_art text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.crear_producto_scanner_impl(p_sucursal_id uuid, p_cod_art text, p_ean text, p_descripcion text, p_marca text, p_categoria text, p_stock_actual integer, p_venta_media_diaria numeric, p_familia_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.crear_vencimiento_operador_impl(p_producto_id uuid, p_sucursal_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.es_administrador_jerarquia_v1(p_actor_id uuid, p_organizacion_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.evaluar_escalamiento_rag_observacion_v1() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.freeze_legacy_producto_estado_v1() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.generar_radar_zonal_v1(p_vencimiento_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.listar_mis_alertas_zonales_v1_impl(p_sucursal_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.listar_resumen_radar_zonal_v1_impl(p_zona_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.marcar_escalamientos_respondidos_v1(p_vencimiento_id uuid, p_respondido_at timestamp with time zone, p_respondido_por uuid, p_tipo text, p_referencia text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.nivel_riesgo_vencimiento_zonal_v1(p_vencimiento_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.nombre_actor_accion_visible(p_usuario_id uuid, p_sucursal_id uuid, p_producto_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.notificar_escalamiento_rag_async_v1(p_escalamiento_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.notificar_radar_zonal_async_v1(p_alerta_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.persistir_detalle_0258_v1(p_importacion_id uuid, p_sucursal_id uuid, p_items jsonb) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.puede_actualizar_imagen_catalogo_storage(p_name text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.puede_gestionar_invitacion_v1(p_actor_id uuid, p_invitacion_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.puede_insertar_imagen_catalogo_storage(p_name text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.puede_leer_familia_sucursal(p_sucursal_id uuid, p_familia_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.puede_leer_producto_sucursal(p_sucursal_id uuid, p_producto_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.puede_reemplazar_imagen_producto(p_sucursal_id uuid, p_producto_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.puede_ver_familia_sucursal(p_sucursal_id uuid, p_familia_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.puede_ver_producto_sucursal(p_sucursal_id uuid, p_producto_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.registrar_control_vencimiento_dashboard_impl(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_fecha_vencimiento date, p_stock_actual integer, p_porcentaje_rag numeric, p_nota text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.registrar_control_vencimiento_impl(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_nota text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.registrar_escalamiento_rag_si_corresponde_v1(p_vencimiento_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.registrar_intervencion_rag_impl(p_vencimiento_id uuid, p_porcentaje_descuento numeric, p_nota text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.responder_alerta_zonal_v1_impl(p_destino_id uuid, p_respuesta text, p_cantidad integer, p_fecha_otra date) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.responder_escalamiento_por_cierre_v1() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.responder_escalamiento_por_observacion_v1() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.responder_escalamiento_por_rag_v1() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.scanner_org(p_sucursal_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.scanner_producto_json(p_producto_id uuid, p_sucursal_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.sincronizar_problema_economico_v1(p_vencimiento_id uuid, p_evento_at timestamp with time zone, p_fuente text, p_apertura_metodo text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.tiene_acceso_organizacion(p_organizacion_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.tiene_acceso_sucursal(p_sucursal_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.tiene_acceso_zona(p_zona_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.trg_problema_economico_costo_v1() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.trg_problema_economico_producto_sucursal_v1() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.trg_problema_economico_vencimiento_v1() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.trigger_control_local_radar_zonal_v1() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.trigger_estado_producto_radar_zonal_v1() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.trigger_generar_radar_zonal_v1() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.upsert_stock_producto_sucursal_scanner(p_sucursal_id uuid, p_producto_id uuid, p_stock_actual integer) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION noven_private.vincular_ean_producto_scanner_impl(p_sucursal_id uuid, p_producto_id uuid, p_ean text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.aceptar_invitacion_acceso_v1() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.actualizar_imagen_producto_operador(p_sucursal_id uuid, p_producto_id uuid, p_imagen_url text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.actualizar_imagen_producto_operador_v2(p_sucursal_id uuid, p_producto_id uuid, p_imagen_url text, p_imagen_thumb_url text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.actualizar_stock_producto_sucursal_scanner(p_sucursal_id uuid, p_producto_id uuid, p_stock_actual integer) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.actualizar_vencimiento_operador(p_vencimiento_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.actualizar_vencimiento_operador_invoker_v1(p_vencimiento_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.anular_invitacion_gestion_v1(p_actor_id uuid, p_invitacion_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.anular_vencimiento_carga_incorrecta(p_vencimiento_id uuid, p_motivo text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.anular_vencimiento_carga_incorrecta_invoker_v1(p_vencimiento_id uuid, p_motivo text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.aplicar_importacion_0258_familia_v1(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_codigo_familia text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_operaciones jsonb, p_detalle_items jsonb, p_fecha_reporte date) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.aplicar_importacion_0258_masiva_v1(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_items jsonb, p_detalle_items jsonb, p_fecha_reporte date) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.aplicar_importacion_glaciar_familia_legacy_v1(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_codigo_familia text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_operaciones jsonb, p_fecha_reporte date) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.aplicar_importacion_glaciar_familia_v1(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_codigo_familia text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_operaciones jsonb, p_fecha_reporte date) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.aplicar_importacion_glaciar_masiva(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_items jsonb, p_fecha_reporte date) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.aplicar_importacion_glaciar_masiva_legacy_v2(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_items jsonb, p_fecha_reporte date) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.aplicar_importacion_glaciar_masiva_v2(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_items jsonb, p_fecha_reporte date) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.buscar_conflicto_codigos_scanner(p_sucursal_id uuid, p_cod_art text, p_ean text, p_excluir_producto_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.buscar_producto_scanner(p_sucursal_id uuid, p_codigo text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.cerrar_vencimiento_operativo(p_vencimiento_id uuid, p_resultado text, p_observaciones text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.cerrar_vencimiento_operativo_invoker_v1(p_vencimiento_id uuid, p_resultado text, p_observaciones text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.completar_cod_art_producto_scanner(p_sucursal_id uuid, p_producto_id uuid, p_cod_art text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.completar_cod_art_producto_scanner_invoker_v1(p_sucursal_id uuid, p_producto_id uuid, p_cod_art text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.crear_producto_scanner(p_sucursal_id uuid, p_cod_art text, p_ean text, p_descripcion text, p_marca text, p_categoria text, p_stock_actual integer, p_venta_media_diaria numeric, p_familia_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.crear_producto_scanner_invoker_v1(p_sucursal_id uuid, p_cod_art text, p_ean text, p_descripcion text, p_marca text, p_categoria text, p_stock_actual integer, p_venta_media_diaria numeric, p_familia_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.crear_vencimiento_operador(p_producto_id uuid, p_sucursal_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.crear_vencimiento_operador_invoker_v1(p_producto_id uuid, p_sucursal_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.fn_familia_exclusiva_operador() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.fn_rol_operador_sin_colision() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.guardar_usuario_sucursal_admin_v1(p_actor_id uuid, p_sucursal_id uuid, p_usuario_id uuid, p_nombre text, p_rol_legacy text, p_activo boolean, p_familias uuid[]) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.guardar_vencimiento_y_stock_scanner_v1(p_producto_id uuid, p_sucursal_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text, p_stock_actual integer, p_vencimiento_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.listar_admin_sucursal_v1(p_actor_id uuid, p_sucursal_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.listar_contexto_altas_v1(p_actor_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.listar_familias_scanner(p_sucursal_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.listar_invitaciones_gestion_v1(p_actor_id uuid, p_tipo text, p_sucursal_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.listar_mis_alertas_zonales_v1(p_sucursal_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.listar_productos_pendientes_catalogo(p_usuario_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.listar_productos_pendientes_catalogo_v2(p_usuario_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.listar_resumen_radar_zonal_v1(p_zona_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.modo_imagen_producto_operador(p_sucursal_id uuid, p_producto_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.notify_push_urgente() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.obtener_invitacion_gestion_v1(p_actor_id uuid, p_invitacion_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.recalcular_niveles_vencimientos() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.registrar_control_vencimiento(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_nota text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.registrar_control_vencimiento_dashboard(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_fecha_vencimiento date, p_stock_actual integer, p_porcentaje_rag numeric, p_nota text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.registrar_control_vencimiento_dashboard_invoker_v1(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_fecha_vencimiento date, p_stock_actual integer, p_porcentaje_rag numeric, p_nota text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.registrar_control_vencimiento_invoker_v1(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_nota text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.registrar_intervencion_rag(p_vencimiento_id uuid, p_porcentaje_descuento numeric, p_nota text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.registrar_intervencion_rag_invoker_v1(p_vencimiento_id uuid, p_porcentaje_descuento numeric, p_nota text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.registrar_invitacion_acceso_v1(p_actor_id uuid, p_usuario_id uuid, p_email text, p_nombre text, p_rol text, p_zona_id uuid, p_sucursal_id uuid, p_canal text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.registrar_invitacion_local_v1(p_actor_id uuid, p_usuario_id uuid, p_email text, p_nombre text, p_rol text, p_sucursal_id uuid, p_familias uuid[], p_canal text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.resolver_pendientes_catalogo_por_familia_csv(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_codigo_familia text, p_cod_arts jsonb) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.resolver_pendientes_catalogo_por_familia_csv_legacy_v1(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_codigo_familia text, p_cod_arts jsonb) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.resolver_producto_pendiente_catalogo(p_pendiente_id uuid, p_familia_id uuid, p_usuario_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.resolver_producto_pendiente_catalogo_legacy_v1(p_pendiente_id uuid, p_familia_id uuid, p_usuario_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.responder_alerta_zonal_v1(p_destino_id uuid, p_respuesta text, p_cantidad integer, p_fecha_otra date) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.rol_actual() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.sync_legacy_producto_estado_091() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.validar_operacion_local_server_v1(p_actor_id uuid, p_sucursal_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.validar_resolucion_pendiente_server_v1(p_actor_id uuid, p_pendiente_id uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.vincular_ean_producto_scanner(p_sucursal_id uuid, p_producto_id uuid, p_ean text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.vincular_ean_producto_scanner_invoker_v1(p_sucursal_id uuid, p_producto_id uuid, p_ean text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION noven_private.actualizar_imagen_producto_operador_v2_impl(p_sucursal_id uuid, p_producto_id uuid, p_imagen_url text, p_imagen_thumb_url text) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.actualizar_vencimiento_operador_impl(p_vencimiento_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.anular_vencimiento_carga_incorrecta_impl(p_vencimiento_id uuid, p_motivo text) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.cerrar_vencimiento_operativo_impl(p_vencimiento_id uuid, p_resultado text, p_observaciones text) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.completar_cod_art_producto_scanner_impl(p_sucursal_id uuid, p_producto_id uuid, p_cod_art text) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.crear_producto_scanner_impl(p_sucursal_id uuid, p_cod_art text, p_ean text, p_descripcion text, p_marca text, p_categoria text, p_stock_actual integer, p_venta_media_diaria numeric, p_familia_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.crear_vencimiento_operador_impl(p_producto_id uuid, p_sucursal_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.listar_mis_alertas_zonales_v1_impl(p_sucursal_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.nombre_actor_accion_visible(p_usuario_id uuid, p_sucursal_id uuid, p_producto_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.puede_actualizar_imagen_catalogo_storage(p_name text) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.puede_gestionar_invitacion_v1(p_actor_id uuid, p_invitacion_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION noven_private.puede_insertar_imagen_catalogo_storage(p_name text) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.puede_leer_producto_sucursal(p_sucursal_id uuid, p_producto_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.puede_reemplazar_imagen_producto(p_sucursal_id uuid, p_producto_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.puede_ver_familia_sucursal(p_sucursal_id uuid, p_familia_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.puede_ver_producto_sucursal(p_sucursal_id uuid, p_producto_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.registrar_control_vencimiento_dashboard_impl(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_fecha_vencimiento date, p_stock_actual integer, p_porcentaje_rag numeric, p_nota text) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.registrar_control_vencimiento_impl(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_nota text) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.registrar_intervencion_rag_impl(p_vencimiento_id uuid, p_porcentaje_descuento numeric, p_nota text) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.responder_alerta_zonal_v1_impl(p_destino_id uuid, p_respuesta text, p_cantidad integer, p_fecha_otra date) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.scanner_org(p_sucursal_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.scanner_producto_json(p_producto_id uuid, p_sucursal_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.tiene_acceso_organizacion(p_organizacion_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.tiene_acceso_sucursal(p_sucursal_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.tiene_acceso_zona(p_zona_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.upsert_stock_producto_sucursal_scanner(p_sucursal_id uuid, p_producto_id uuid, p_stock_actual integer) TO authenticated;

GRANT EXECUTE ON FUNCTION noven_private.vincular_ean_producto_scanner_impl(p_sucursal_id uuid, p_producto_id uuid, p_ean text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.aceptar_invitacion_acceso_v1() TO authenticated;

GRANT EXECUTE ON FUNCTION public.aceptar_invitacion_acceso_v1() TO service_role;

GRANT EXECUTE ON FUNCTION public.actualizar_imagen_producto_operador(p_sucursal_id uuid, p_producto_id uuid, p_imagen_url text) TO service_role;

GRANT EXECUTE ON FUNCTION public.actualizar_imagen_producto_operador_v2(p_sucursal_id uuid, p_producto_id uuid, p_imagen_url text, p_imagen_thumb_url text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.actualizar_imagen_producto_operador_v2(p_sucursal_id uuid, p_producto_id uuid, p_imagen_url text, p_imagen_thumb_url text) TO service_role;

GRANT EXECUTE ON FUNCTION public.actualizar_stock_producto_sucursal_scanner(p_sucursal_id uuid, p_producto_id uuid, p_stock_actual integer) TO service_role;

GRANT EXECUTE ON FUNCTION public.actualizar_vencimiento_operador(p_vencimiento_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text) TO service_role;

GRANT EXECUTE ON FUNCTION public.actualizar_vencimiento_operador_invoker_v1(p_vencimiento_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text) TO service_role;

GRANT EXECUTE ON FUNCTION public.anular_invitacion_gestion_v1(p_actor_id uuid, p_invitacion_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.anular_vencimiento_carga_incorrecta(p_vencimiento_id uuid, p_motivo text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.anular_vencimiento_carga_incorrecta(p_vencimiento_id uuid, p_motivo text) TO service_role;

GRANT EXECUTE ON FUNCTION public.anular_vencimiento_carga_incorrecta_invoker_v1(p_vencimiento_id uuid, p_motivo text) TO service_role;

GRANT EXECUTE ON FUNCTION public.aplicar_importacion_0258_familia_v1(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_codigo_familia text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_operaciones jsonb, p_detalle_items jsonb, p_fecha_reporte date) TO service_role;

GRANT EXECUTE ON FUNCTION public.aplicar_importacion_0258_masiva_v1(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_items jsonb, p_detalle_items jsonb, p_fecha_reporte date) TO service_role;

GRANT EXECUTE ON FUNCTION public.aplicar_importacion_glaciar_familia_v1(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_codigo_familia text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_operaciones jsonb, p_fecha_reporte date) TO service_role;

GRANT EXECUTE ON FUNCTION public.aplicar_importacion_glaciar_masiva_v2(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_nombre_archivo text, p_archivo_sha256 text, p_filas_total integer, p_filas_validas integer, p_filas_descartadas integer, p_items jsonb, p_fecha_reporte date) TO service_role;

GRANT EXECUTE ON FUNCTION public.buscar_conflicto_codigos_scanner(p_sucursal_id uuid, p_cod_art text, p_ean text, p_excluir_producto_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.buscar_conflicto_codigos_scanner(p_sucursal_id uuid, p_cod_art text, p_ean text, p_excluir_producto_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.buscar_producto_scanner(p_sucursal_id uuid, p_codigo text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.buscar_producto_scanner(p_sucursal_id uuid, p_codigo text) TO service_role;

GRANT EXECUTE ON FUNCTION public.cerrar_vencimiento_operativo(p_vencimiento_id uuid, p_resultado text, p_observaciones text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.cerrar_vencimiento_operativo(p_vencimiento_id uuid, p_resultado text, p_observaciones text) TO service_role;

GRANT EXECUTE ON FUNCTION public.cerrar_vencimiento_operativo_invoker_v1(p_vencimiento_id uuid, p_resultado text, p_observaciones text) TO service_role;

GRANT EXECUTE ON FUNCTION public.completar_cod_art_producto_scanner(p_sucursal_id uuid, p_producto_id uuid, p_cod_art text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.completar_cod_art_producto_scanner(p_sucursal_id uuid, p_producto_id uuid, p_cod_art text) TO service_role;

GRANT EXECUTE ON FUNCTION public.completar_cod_art_producto_scanner_invoker_v1(p_sucursal_id uuid, p_producto_id uuid, p_cod_art text) TO service_role;

GRANT EXECUTE ON FUNCTION public.crear_producto_scanner(p_sucursal_id uuid, p_cod_art text, p_ean text, p_descripcion text, p_marca text, p_categoria text, p_stock_actual integer, p_venta_media_diaria numeric, p_familia_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.crear_producto_scanner(p_sucursal_id uuid, p_cod_art text, p_ean text, p_descripcion text, p_marca text, p_categoria text, p_stock_actual integer, p_venta_media_diaria numeric, p_familia_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.crear_producto_scanner_invoker_v1(p_sucursal_id uuid, p_cod_art text, p_ean text, p_descripcion text, p_marca text, p_categoria text, p_stock_actual integer, p_venta_media_diaria numeric, p_familia_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.crear_vencimiento_operador(p_producto_id uuid, p_sucursal_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text) TO service_role;

GRANT EXECUTE ON FUNCTION public.crear_vencimiento_operador_invoker_v1(p_producto_id uuid, p_sucursal_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text) TO service_role;

GRANT EXECUTE ON FUNCTION public.fn_familia_exclusiva_operador() TO service_role;

GRANT EXECUTE ON FUNCTION public.fn_rol_operador_sin_colision() TO service_role;

GRANT EXECUTE ON FUNCTION public.guardar_usuario_sucursal_admin_v1(p_actor_id uuid, p_sucursal_id uuid, p_usuario_id uuid, p_nombre text, p_rol_legacy text, p_activo boolean, p_familias uuid[]) TO service_role;

GRANT EXECUTE ON FUNCTION public.guardar_vencimiento_y_stock_scanner_v1(p_producto_id uuid, p_sucursal_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text, p_stock_actual integer, p_vencimiento_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.guardar_vencimiento_y_stock_scanner_v1(p_producto_id uuid, p_sucursal_id uuid, p_cantidad numeric, p_fecha_vencimiento date, p_lote text, p_stock_actual integer, p_vencimiento_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.listar_admin_sucursal_v1(p_actor_id uuid, p_sucursal_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.listar_contexto_altas_v1(p_actor_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.listar_familias_scanner(p_sucursal_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.listar_familias_scanner(p_sucursal_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.listar_invitaciones_gestion_v1(p_actor_id uuid, p_tipo text, p_sucursal_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.listar_mis_alertas_zonales_v1(p_sucursal_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.listar_mis_alertas_zonales_v1(p_sucursal_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.listar_productos_pendientes_catalogo_v2(p_usuario_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.modo_imagen_producto_operador(p_sucursal_id uuid, p_producto_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.modo_imagen_producto_operador(p_sucursal_id uuid, p_producto_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.notify_push_urgente() TO service_role;

GRANT EXECUTE ON FUNCTION public.obtener_invitacion_gestion_v1(p_actor_id uuid, p_invitacion_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.recalcular_niveles_vencimientos() TO service_role;

GRANT EXECUTE ON FUNCTION public.registrar_control_vencimiento(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_nota text) TO service_role;

GRANT EXECUTE ON FUNCTION public.registrar_control_vencimiento_dashboard(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_fecha_vencimiento date, p_stock_actual integer, p_porcentaje_rag numeric, p_nota text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.registrar_control_vencimiento_dashboard(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_fecha_vencimiento date, p_stock_actual integer, p_porcentaje_rag numeric, p_nota text) TO service_role;

GRANT EXECUTE ON FUNCTION public.registrar_control_vencimiento_dashboard_invoker_v1(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_fecha_vencimiento date, p_stock_actual integer, p_porcentaje_rag numeric, p_nota text) TO service_role;

GRANT EXECUTE ON FUNCTION public.registrar_control_vencimiento_invoker_v1(p_vencimiento_id uuid, p_cantidad_comprometida numeric, p_nota text) TO service_role;

GRANT EXECUTE ON FUNCTION public.registrar_intervencion_rag(p_vencimiento_id uuid, p_porcentaje_descuento numeric, p_nota text) TO service_role;

GRANT EXECUTE ON FUNCTION public.registrar_intervencion_rag_invoker_v1(p_vencimiento_id uuid, p_porcentaje_descuento numeric, p_nota text) TO service_role;

GRANT EXECUTE ON FUNCTION public.registrar_invitacion_acceso_v1(p_actor_id uuid, p_usuario_id uuid, p_email text, p_nombre text, p_rol text, p_zona_id uuid, p_sucursal_id uuid, p_canal text) TO service_role;

GRANT EXECUTE ON FUNCTION public.registrar_invitacion_local_v1(p_actor_id uuid, p_usuario_id uuid, p_email text, p_nombre text, p_rol text, p_sucursal_id uuid, p_familias uuid[], p_canal text) TO service_role;

GRANT EXECUTE ON FUNCTION public.resolver_pendientes_catalogo_por_familia_csv(p_sucursal_id uuid, p_usuario_id uuid, p_codigo_sucursal_fuente text, p_codigo_familia text, p_cod_arts jsonb) TO service_role;

GRANT EXECUTE ON FUNCTION public.resolver_producto_pendiente_catalogo(p_pendiente_id uuid, p_familia_id uuid, p_usuario_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.responder_alerta_zonal_v1(p_destino_id uuid, p_respuesta text, p_cantidad integer, p_fecha_otra date) TO authenticated;

GRANT EXECUTE ON FUNCTION public.responder_alerta_zonal_v1(p_destino_id uuid, p_respuesta text, p_cantidad integer, p_fecha_otra date) TO service_role;

GRANT EXECUTE ON FUNCTION public.rol_actual() TO service_role;

GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;

GRANT EXECUTE ON FUNCTION public.validar_operacion_local_server_v1(p_actor_id uuid, p_sucursal_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.validar_resolucion_pendiente_server_v1(p_actor_id uuid, p_pendiente_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.vincular_ean_producto_scanner(p_sucursal_id uuid, p_producto_id uuid, p_ean text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.vincular_ean_producto_scanner(p_sucursal_id uuid, p_producto_id uuid, p_ean text) TO service_role;

GRANT EXECUTE ON FUNCTION public.vincular_ean_producto_scanner_invoker_v1(p_sucursal_id uuid, p_producto_id uuid, p_ean text) TO service_role;
