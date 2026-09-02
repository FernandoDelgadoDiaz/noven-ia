CREATE TRIGGER acciones_operativas_respuesta_escalamiento_trg AFTER INSERT ON acciones_operativas FOR EACH ROW EXECUTE FUNCTION noven_private.responder_escalamiento_por_cierre_v1();

CREATE TRIGGER acciones_operativas_set_updated_at BEFORE UPDATE ON acciones_operativas FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER alertas_zonales_set_updated_at BEFORE UPDATE ON alertas_zonales FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER alertas_zonales_destinos_set_updated_at BEFORE UPDATE ON alertas_zonales_destinos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER intervenciones_rag_respuesta_escalamiento_trg AFTER INSERT OR UPDATE OF finalizado_at ON intervenciones_rag FOR EACH ROW EXECUTE FUNCTION noven_private.responder_escalamiento_por_rag_v1();

CREATE TRIGGER organizaciones_set_updated_at BEFORE UPDATE ON organizaciones FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER problemas_economicos_ciclos_set_updated_at BEFORE UPDATE ON problemas_economicos_ciclos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER producto_codigos_set_updated_at BEFORE UPDATE ON producto_codigos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER producto_costo_problema_economico_v1 AFTER INSERT OR UPDATE OF costo_unitario, observado_at ON producto_costo_ultima_observacion FOR EACH ROW EXECUTE FUNCTION noven_private.trg_problema_economico_costo_v1();

CREATE TRIGGER producto_sucursal_problema_economico_v1 AFTER INSERT OR UPDATE OF venta_media_diaria ON producto_sucursal FOR EACH ROW EXECUTE FUNCTION noven_private.trg_problema_economico_producto_sucursal_v1();

CREATE TRIGGER producto_sucursal_radar_zonal_v1 AFTER INSERT OR UPDATE OF stock_actual ON producto_sucursal FOR EACH ROW EXECUTE FUNCTION noven_private.trigger_estado_producto_radar_zonal_v1();

CREATE TRIGGER producto_sucursal_set_updated_at BEFORE UPDATE ON producto_sucursal FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER productos_freeze_legacy_state_insert_v1 BEFORE INSERT ON productos FOR EACH ROW EXECUTE FUNCTION noven_private.freeze_legacy_producto_estado_v1();

CREATE TRIGGER productos_set_updated_at BEFORE UPDATE ON productos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER zzz_productos_freeze_legacy_state_update_v1 BEFORE UPDATE OF stock_actual, venta_media_diaria ON productos FOR EACH ROW EXECUTE FUNCTION noven_private.freeze_legacy_producto_estado_v1();

CREATE TRIGGER productos_pendientes_catalogo_updated_at BEFORE UPDATE ON productos_pendientes_catalogo FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER push_subscriptions_set_updated_at BEFORE UPDATE ON push_subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER usuario_accesos_set_updated_at BEFORE UPDATE ON usuario_accesos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_familia_exclusiva_operador BEFORE INSERT OR UPDATE ON usuario_familias FOR EACH ROW EXECUTE FUNCTION fn_familia_exclusiva_operador();

CREATE TRIGGER usuario_familias_sucursal_set_updated_at BEFORE UPDATE ON usuario_familias_sucursal FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_rol_operador_sin_colision BEFORE UPDATE OF rol ON usuarios FOR EACH ROW EXECUTE FUNCTION fn_rol_operador_sin_colision();

CREATE CONSTRAINT TRIGGER vencimiento_observaciones_escalamiento_rag_ct AFTER INSERT ON vencimiento_observaciones DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION noven_private.evaluar_escalamiento_rag_observacion_v1();

CREATE TRIGGER vencimiento_observaciones_respuesta_escalamiento_trg AFTER INSERT ON vencimiento_observaciones FOR EACH ROW EXECUTE FUNCTION noven_private.responder_escalamiento_por_observacion_v1();

CREATE TRIGGER trg_notify_push_urgente AFTER UPDATE OF nivel_actual ON vencimientos FOR EACH ROW EXECUTE FUNCTION notify_push_urgente();

CREATE TRIGGER vencimientos_control_local_radar_zonal_v1 AFTER INSERT OR UPDATE OF activo ON vencimientos FOR EACH ROW EXECUTE FUNCTION noven_private.trigger_control_local_radar_zonal_v1();

CREATE TRIGGER vencimientos_problema_economico_v1 AFTER INSERT OR UPDATE OF cantidad, fecha_vencimiento, nivel_actual, producto_id, activo ON vencimientos FOR EACH ROW EXECUTE FUNCTION noven_private.trg_problema_economico_vencimiento_v1();

CREATE TRIGGER vencimientos_radar_zonal_v1 AFTER INSERT OR UPDATE OF nivel_actual, fecha_vencimiento, cantidad, activo ON vencimientos FOR EACH ROW EXECUTE FUNCTION noven_private.trigger_generar_radar_zonal_v1();

CREATE TRIGGER vencimientos_set_updated_at BEFORE UPDATE ON vencimientos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER zonas_set_updated_at BEFORE UPDATE ON zonas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
