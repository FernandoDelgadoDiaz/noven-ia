CREATE INDEX acciones_operativas_sucursal_idx ON acciones_operativas USING btree (sucursal_id);

CREATE INDEX acciones_operativas_sucursal_periodo_idx ON acciones_operativas USING btree (sucursal_id, anio, trimestre);

CREATE INDEX acciones_operativas_vencimiento_idx ON acciones_operativas USING btree (vencimiento_id);

CREATE INDEX idx_acciones_fecha ON acciones_operativas USING btree (fecha);

CREATE INDEX idx_acciones_producto ON acciones_operativas USING btree (producto_id);

CREATE INDEX idx_acciones_tipo ON acciones_operativas USING btree (tipo);

CREATE INDEX idx_acciones_trimestre ON acciones_operativas USING btree (trimestre, anio);

CREATE INDEX idx_acciones_usuario ON acciones_operativas USING btree (usuario_id);

CREATE INDEX alertas_zonales_familia_org_idx ON alertas_zonales USING btree (familia_id, organizacion_id);

CREATE INDEX alertas_zonales_organizacion_idx ON alertas_zonales USING btree (organizacion_id);

CREATE INDEX alertas_zonales_origen_idx ON alertas_zonales USING btree (sucursal_origen_id, created_at DESC);

CREATE INDEX alertas_zonales_producto_idx ON alertas_zonales USING btree (producto_id, fecha_vencimiento DESC);

CREATE INDEX alertas_zonales_producto_org_idx ON alertas_zonales USING btree (producto_id, organizacion_id);

CREATE INDEX alertas_zonales_sucursal_org_idx ON alertas_zonales USING btree (sucursal_origen_id, organizacion_id);

CREATE INDEX alertas_zonales_vencimiento_origen_idx ON alertas_zonales USING btree (vencimiento_origen_id);

CREATE INDEX alertas_zonales_zona_estado_idx ON alertas_zonales USING btree (zona_id, estado, last_detected_at DESC);

CREATE INDEX alertas_zonales_zona_org_idx ON alertas_zonales USING btree (zona_id, organizacion_id);

CREATE INDEX alertas_zonales_destinos_alerta_estado_idx ON alertas_zonales_destinos USING btree (alerta_id, estado);

CREATE INDEX alertas_zonales_destinos_organizacion_idx ON alertas_zonales_destinos USING btree (organizacion_id);

CREATE INDEX alertas_zonales_destinos_sucursal_estado_idx ON alertas_zonales_destinos USING btree (sucursal_id, estado, created_at DESC);

CREATE INDEX alertas_zonales_destinos_sucursal_org_idx ON alertas_zonales_destinos USING btree (sucursal_id, organizacion_id);

CREATE INDEX alertas_zonales_destinos_usuario_estado_idx ON alertas_zonales_destinos USING btree (usuario_id, estado, created_at DESC) WHERE usuario_id IS NOT NULL;

CREATE INDEX alertas_zonales_destinos_vencimiento_idx ON alertas_zonales_destinos USING btree (vencimiento_destino_id) WHERE vencimiento_destino_id IS NOT NULL;

CREATE INDEX alertas_zonales_destinos_zona_org_idx ON alertas_zonales_destinos USING btree (zona_id, organizacion_id);

CREATE INDEX familias_organizacion_idx ON familias USING btree (organizacion_id);

CREATE INDEX familias_sector_org_idx ON familias USING btree (sector_id, organizacion_id);

CREATE INDEX importacion_0258_detalle_org_cod_idx ON importacion_0258_detalle USING btree (organizacion_id, cod_art, captured_at DESC);

CREATE INDEX importacion_0258_detalle_producto_idx ON importacion_0258_detalle USING btree (producto_id, captured_at DESC);

CREATE INDEX importaciones_org_fecha_idx ON importaciones USING btree (organizacion_id, created_at DESC);

CREATE INDEX importaciones_sucursal_fecha_idx ON importaciones USING btree (sucursal_id, created_at DESC);

CREATE INDEX importaciones_sucursal_org_idx ON importaciones USING btree (sucursal_id, organizacion_id);

CREATE INDEX importaciones_usuario_idx ON importaciones USING btree (usuario_id) WHERE usuario_id IS NOT NULL;

CREATE UNIQUE INDEX intervenciones_rag_un_vigente_por_vencimiento_uidx ON intervenciones_rag USING btree (vencimiento_id) WHERE finalizado_at IS NULL;

CREATE INDEX rag_organizacion_idx ON intervenciones_rag USING btree (organizacion_id);

CREATE INDEX rag_producto_org_idx ON intervenciones_rag USING btree (producto_id, organizacion_id);

CREATE INDEX rag_sucursal_fecha_idx ON intervenciones_rag USING btree (sucursal_id, aplicado_at DESC);

CREATE INDEX rag_sucursal_org_idx ON intervenciones_rag USING btree (sucursal_id, organizacion_id);

CREATE INDEX rag_usuario_idx ON intervenciones_rag USING btree (usuario_id);

CREATE INDEX rag_vencimiento_fecha_idx ON intervenciones_rag USING btree (vencimiento_id, aplicado_at DESC);

CREATE INDEX rag_vencimiento_fecha_orden_idx ON intervenciones_rag USING btree (vencimiento_id, aplicado_at, created_at, id);

CREATE INDEX rag_vencimiento_scope_idx ON intervenciones_rag USING btree (vencimiento_id, producto_id, sucursal_id);

CREATE INDEX invitaciones_acceso_creador_idx ON invitaciones_acceso USING btree (creado_por, created_at DESC);

CREATE INDEX invitaciones_acceso_email_idx ON invitaciones_acceso USING btree (lower(email));

CREATE INDEX invitaciones_acceso_org_idx ON invitaciones_acceso USING btree (organizacion_id);

CREATE INDEX invitaciones_acceso_pendiente_expira_idx ON invitaciones_acceso USING btree (usuario_id, expires_at) WHERE estado = 'pendiente'::text;

CREATE INDEX invitaciones_acceso_sucursal_org_idx ON invitaciones_acceso USING btree (sucursal_id, organizacion_id) WHERE sucursal_id IS NOT NULL;

CREATE INDEX invitaciones_acceso_usuario_idx ON invitaciones_acceso USING btree (usuario_id, estado);

CREATE INDEX invitaciones_acceso_zona_org_idx ON invitaciones_acceso USING btree (zona_id, organizacion_id) WHERE zona_id IS NOT NULL;

CREATE INDEX problemas_economicos_ciclos_producto_v1 ON problemas_economicos_ciclos USING btree (producto_id, abierto_at DESC);

CREATE INDEX problemas_economicos_ciclos_sucursal_estado_v1 ON problemas_economicos_ciclos USING btree (sucursal_id, resuelto_at, abierto_at DESC);

CREATE UNIQUE INDEX problemas_economicos_ciclos_un_abierto_v1 ON problemas_economicos_ciclos USING btree (vencimiento_id) WHERE resuelto_at IS NULL;

CREATE INDEX producto_codigos_org_idx ON producto_codigos USING btree (organizacion_id);

CREATE INDEX producto_codigos_producto_idx ON producto_codigos USING btree (producto_id);

CREATE INDEX producto_codigos_producto_org_idx ON producto_codigos USING btree (producto_id, organizacion_id);

CREATE INDEX producto_costo_observaciones_producto_idx ON producto_costo_observaciones USING btree (organizacion_id, producto_id, observado_at DESC);

CREATE INDEX producto_imagen_cambios_org_idx ON producto_imagen_cambios USING btree (organizacion_id);

CREATE INDEX producto_imagen_cambios_producto_fecha_idx ON producto_imagen_cambios USING btree (producto_id, created_at DESC);

CREATE INDEX producto_imagen_cambios_producto_org_idx ON producto_imagen_cambios USING btree (producto_id, organizacion_id);

CREATE INDEX producto_imagen_cambios_sucursal_fecha_idx ON producto_imagen_cambios USING btree (sucursal_id, created_at DESC);

CREATE INDEX producto_imagen_cambios_sucursal_org_idx ON producto_imagen_cambios USING btree (sucursal_id, organizacion_id);

CREATE INDEX producto_imagen_cambios_usuario_idx ON producto_imagen_cambios USING btree (usuario_id);

CREATE INDEX pendiente_detecciones_import_scope_idx ON producto_pendiente_detecciones USING btree (importacion_id, organizacion_id, sucursal_id);

CREATE INDEX pendiente_detecciones_org_idx ON producto_pendiente_detecciones USING btree (organizacion_id);

CREATE INDEX pendiente_detecciones_sucursal_org_idx ON producto_pendiente_detecciones USING btree (sucursal_id, organizacion_id);

CREATE INDEX producto_pendiente_detecciones_pendiente_fecha_idx ON producto_pendiente_detecciones USING btree (pendiente_id, detected_at DESC);

CREATE INDEX producto_pendiente_detecciones_sucursal_fecha_idx ON producto_pendiente_detecciones USING btree (sucursal_id, detected_at DESC);

CREATE INDEX producto_snapshots_import_scope_idx ON producto_snapshots USING btree (importacion_id, organizacion_id, sucursal_id);

CREATE INDEX producto_snapshots_importacion_idx ON producto_snapshots USING btree (importacion_id);

CREATE INDEX producto_snapshots_org_fecha_idx ON producto_snapshots USING btree (organizacion_id, captured_at DESC);

CREATE INDEX producto_snapshots_producto_org_idx ON producto_snapshots USING btree (producto_id, organizacion_id);

CREATE INDEX producto_snapshots_sucursal_org_idx ON producto_snapshots USING btree (sucursal_id, organizacion_id);

CREATE INDEX producto_snapshots_sucursal_producto_fecha_idx ON producto_snapshots USING btree (sucursal_id, producto_id, captured_at DESC);

CREATE INDEX producto_sucursal_org_sucursal_idx ON producto_sucursal USING btree (organizacion_id, sucursal_id);

CREATE INDEX producto_sucursal_producto_org_idx ON producto_sucursal USING btree (producto_id, organizacion_id);

CREATE INDEX producto_sucursal_sucursal_idx ON producto_sucursal USING btree (sucursal_id);

CREATE INDEX producto_sucursal_sucursal_org_idx ON producto_sucursal USING btree (sucursal_id, organizacion_id);

CREATE INDEX idx_productos_cod_art ON productos USING btree (cod_art);

CREATE INDEX idx_productos_codigo_barras ON productos USING btree (codigo_barras);

CREATE INDEX productos_familia_org_idx ON productos USING btree (familia_id, organizacion_id) WHERE familia_id IS NOT NULL;

CREATE INDEX productos_organizacion_idx ON productos USING btree (organizacion_id);

CREATE INDEX productos_pendientes_catalogo_estado_idx ON productos_pendientes_catalogo USING btree (organizacion_id, estado, last_detected_at DESC);

CREATE INDEX productos_pendientes_catalogo_producto_idx ON productos_pendientes_catalogo USING btree (producto_id) WHERE producto_id IS NOT NULL;

CREATE INDEX productos_pendientes_clasificado_por_idx ON productos_pendientes_catalogo USING btree (clasificado_por) WHERE clasificado_por IS NOT NULL;

CREATE INDEX productos_pendientes_familia_org_idx ON productos_pendientes_catalogo USING btree (familia_id_resuelta, organizacion_id) WHERE familia_id_resuelta IS NOT NULL;

CREATE INDEX productos_pendientes_producto_org_idx ON productos_pendientes_catalogo USING btree (producto_id, organizacion_id) WHERE producto_id IS NOT NULL;

CREATE INDEX idx_push_usuario ON push_subscriptions USING btree (usuario_id);

CREATE UNIQUE INDEX uq_push_usuario_endpoint ON push_subscriptions USING btree (usuario_id, (subscription ->> 'endpoint'::text));

CREATE INDEX rag_escalamientos_abiertos_vencimiento_idx ON rag_escalamientos USING btree (vencimiento_id, detectado_at DESC) WHERE respondido_at IS NULL;

CREATE INDEX rag_escalamientos_sucursal_fecha_idx ON rag_escalamientos USING btree (sucursal_id, detectado_at DESC);

CREATE INDEX rag_escalamientos_vencimiento_fecha_idx ON rag_escalamientos USING btree (vencimiento_id, detectado_at DESC);

CREATE INDEX idx_regiones_organizacion ON regiones USING btree (organizacion_id);

CREATE INDEX sectores_organizacion_idx ON sectores USING btree (organizacion_id);

CREATE INDEX sucursales_organizacion_idx ON sucursales USING btree (organizacion_id);

CREATE INDEX sucursales_zona_idx ON sucursales USING btree (zona_id);

CREATE INDEX sucursales_zona_org_idx ON sucursales USING btree (zona_id, organizacion_id);

CREATE INDEX usuario_accesos_org_idx ON usuario_accesos USING btree (organizacion_id) WHERE activo = true;

CREATE UNIQUE INDEX usuario_accesos_org_uk ON usuario_accesos USING btree (usuario_id, organizacion_id, rol) WHERE zona_id IS NULL AND sucursal_id IS NULL;

CREATE INDEX usuario_accesos_sucursal_idx ON usuario_accesos USING btree (sucursal_id) WHERE activo = true AND sucursal_id IS NOT NULL;

CREATE INDEX usuario_accesos_sucursal_org_idx ON usuario_accesos USING btree (sucursal_id, organizacion_id) WHERE sucursal_id IS NOT NULL AND activo = true;

CREATE UNIQUE INDEX usuario_accesos_sucursal_uk ON usuario_accesos USING btree (usuario_id, organizacion_id, rol, sucursal_id) WHERE sucursal_id IS NOT NULL;

CREATE INDEX usuario_accesos_usuario_idx ON usuario_accesos USING btree (usuario_id) WHERE activo = true;

CREATE INDEX usuario_accesos_zona_idx ON usuario_accesos USING btree (zona_id) WHERE activo = true AND zona_id IS NOT NULL;

CREATE INDEX usuario_accesos_zona_org_idx ON usuario_accesos USING btree (zona_id, organizacion_id) WHERE zona_id IS NOT NULL AND activo = true;

CREATE UNIQUE INDEX usuario_accesos_zona_uk ON usuario_accesos USING btree (usuario_id, organizacion_id, rol, zona_id) WHERE zona_id IS NOT NULL AND sucursal_id IS NULL;

CREATE INDEX usuario_familias_familia_idx ON usuario_familias USING btree (familia_id);

CREATE INDEX usuario_familias_sucursal_familia_idx ON usuario_familias_sucursal USING btree (familia_id);

CREATE INDEX usuario_familias_sucursal_familia_org_idx ON usuario_familias_sucursal USING btree (familia_id, organizacion_id);

CREATE INDEX usuario_familias_sucursal_org_idx ON usuario_familias_sucursal USING btree (organizacion_id, sucursal_id) WHERE activo = true;

CREATE UNIQUE INDEX usuario_familias_sucursal_responsable_uk ON usuario_familias_sucursal USING btree (sucursal_id, familia_id) WHERE activo = true;

CREATE INDEX usuario_familias_sucursal_sucursal_org_idx ON usuario_familias_sucursal USING btree (sucursal_id, organizacion_id) WHERE activo = true;

CREATE INDEX usuario_familias_sucursal_usuario_idx ON usuario_familias_sucursal USING btree (usuario_id, sucursal_id) WHERE activo = true;

CREATE INDEX usuarios_sucursal_idx ON usuarios USING btree (sucursal_id) WHERE sucursal_id IS NOT NULL;

CREATE INDEX venc_obs_organizacion_idx ON vencimiento_observaciones USING btree (organizacion_id);

CREATE INDEX venc_obs_producto_org_idx ON vencimiento_observaciones USING btree (producto_id, organizacion_id);

CREATE INDEX venc_obs_sucursal_fecha_idx ON vencimiento_observaciones USING btree (sucursal_id, observada_at DESC);

CREATE INDEX venc_obs_sucursal_org_idx ON vencimiento_observaciones USING btree (sucursal_id, organizacion_id);

CREATE INDEX venc_obs_usuario_idx ON vencimiento_observaciones USING btree (usuario_id);

CREATE INDEX venc_obs_vencimiento_fecha_id_idx ON vencimiento_observaciones USING btree (vencimiento_id, observada_at, id);

CREATE INDEX venc_obs_vencimiento_fecha_idx ON vencimiento_observaciones USING btree (vencimiento_id, observada_at DESC);

CREATE INDEX venc_obs_vencimiento_scope_idx ON vencimiento_observaciones USING btree (vencimiento_id, producto_id, sucursal_id);

CREATE INDEX idx_vencimientos_fecha ON vencimientos USING btree (fecha_vencimiento);

CREATE INDEX idx_vencimientos_producto ON vencimientos USING btree (producto_id);

CREATE INDEX idx_vencimientos_sucursal ON vencimientos USING btree (sucursal_id);

CREATE UNIQUE INDEX uq_vencimiento_activo_por_producto_sucursal ON vencimientos USING btree (producto_id, sucursal_id) WHERE activo = true;

CREATE INDEX vencimientos_usuario_idx ON vencimientos USING btree (usuario_id);

CREATE INDEX idx_zonas_region ON zonas USING btree (region_id);

CREATE INDEX zonas_organizacion_idx ON zonas USING btree (organizacion_id);

CREATE INDEX zonas_region_org_idx ON zonas USING btree (region_id, organizacion_id);
