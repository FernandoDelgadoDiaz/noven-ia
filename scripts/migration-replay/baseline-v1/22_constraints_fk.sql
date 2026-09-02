ALTER TABLE ONLY public.acciones_operativas ADD CONSTRAINT acciones_operativas_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES productos(id);

ALTER TABLE ONLY public.acciones_operativas ADD CONSTRAINT acciones_operativas_sucursal_id_fkey FOREIGN KEY (sucursal_id) REFERENCES sucursales(id);

ALTER TABLE ONLY public.acciones_operativas ADD CONSTRAINT acciones_operativas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.acciones_operativas ADD CONSTRAINT acciones_operativas_vencimiento_id_fkey FOREIGN KEY (vencimiento_id) REFERENCES vencimientos(id);

ALTER TABLE ONLY public.alertas_zonales ADD CONSTRAINT alertas_zonales_familia_org_fk FOREIGN KEY (familia_id, organizacion_id) REFERENCES familias(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.alertas_zonales ADD CONSTRAINT alertas_zonales_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alertas_zonales ADD CONSTRAINT alertas_zonales_producto_org_fk FOREIGN KEY (producto_id, organizacion_id) REFERENCES productos(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.alertas_zonales ADD CONSTRAINT alertas_zonales_sucursal_org_fk FOREIGN KEY (sucursal_origen_id, organizacion_id) REFERENCES sucursales(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.alertas_zonales ADD CONSTRAINT alertas_zonales_vencimiento_origen_id_fkey FOREIGN KEY (vencimiento_origen_id) REFERENCES vencimientos(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.alertas_zonales ADD CONSTRAINT alertas_zonales_zona_org_fk FOREIGN KEY (zona_id, organizacion_id) REFERENCES zonas(id, organizacion_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alertas_zonales_destinos ADD CONSTRAINT alertas_zonales_destinos_alerta_id_fkey FOREIGN KEY (alerta_id) REFERENCES alertas_zonales(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alertas_zonales_destinos ADD CONSTRAINT alertas_zonales_destinos_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alertas_zonales_destinos ADD CONSTRAINT alertas_zonales_destinos_sucursal_org_fk FOREIGN KEY (sucursal_id, organizacion_id) REFERENCES sucursales(id, organizacion_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alertas_zonales_destinos ADD CONSTRAINT alertas_zonales_destinos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alertas_zonales_destinos ADD CONSTRAINT alertas_zonales_destinos_vencimiento_destino_id_fkey FOREIGN KEY (vencimiento_destino_id) REFERENCES vencimientos(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alertas_zonales_destinos ADD CONSTRAINT alertas_zonales_destinos_zona_org_fk FOREIGN KEY (zona_id, organizacion_id) REFERENCES zonas(id, organizacion_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.familias ADD CONSTRAINT familias_organizacion_fk FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.familias ADD CONSTRAINT familias_sector_organizacion_fk FOREIGN KEY (sector_id, organizacion_id) REFERENCES sectores(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.importacion_0258_detalle ADD CONSTRAINT importacion_0258_detalle_importacion_id_fkey FOREIGN KEY (importacion_id) REFERENCES importaciones(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.importacion_0258_detalle ADD CONSTRAINT importacion_0258_detalle_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.importacion_0258_detalle ADD CONSTRAINT importacion_0258_detalle_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.importacion_0258_detalle ADD CONSTRAINT importacion_0258_detalle_sucursal_id_fkey FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.importaciones ADD CONSTRAINT importaciones_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.importaciones ADD CONSTRAINT importaciones_sucursal_org_fk FOREIGN KEY (sucursal_id, organizacion_id) REFERENCES sucursales(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.importaciones ADD CONSTRAINT importaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.intervenciones_rag ADD CONSTRAINT intervenciones_rag_finalizado_por_fkey FOREIGN KEY (finalizado_por) REFERENCES usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.intervenciones_rag ADD CONSTRAINT intervenciones_rag_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.intervenciones_rag ADD CONSTRAINT intervenciones_rag_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.intervenciones_rag ADD CONSTRAINT rag_producto_org_fk FOREIGN KEY (producto_id, organizacion_id) REFERENCES productos(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.intervenciones_rag ADD CONSTRAINT rag_sucursal_org_fk FOREIGN KEY (sucursal_id, organizacion_id) REFERENCES sucursales(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.intervenciones_rag ADD CONSTRAINT rag_vencimiento_scope_fk FOREIGN KEY (vencimiento_id, producto_id, sucursal_id) REFERENCES vencimientos(id, producto_id, sucursal_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.invitaciones_acceso ADD CONSTRAINT invitaciones_acceso_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.invitaciones_acceso ADD CONSTRAINT invitaciones_acceso_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.invitaciones_acceso ADD CONSTRAINT invitaciones_acceso_sucursal_org_fk FOREIGN KEY (sucursal_id, organizacion_id) REFERENCES sucursales(id, organizacion_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.invitaciones_acceso ADD CONSTRAINT invitaciones_acceso_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.invitaciones_acceso ADD CONSTRAINT invitaciones_acceso_zona_org_fk FOREIGN KEY (zona_id, organizacion_id) REFERENCES zonas(id, organizacion_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.problemas_economicos_ciclos ADD CONSTRAINT problemas_economicos_ciclos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.problemas_economicos_ciclos ADD CONSTRAINT problemas_economicos_ciclos_vencimiento_id_fkey FOREIGN KEY (vencimiento_id) REFERENCES vencimientos(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.producto_codigos ADD CONSTRAINT producto_codigos_producto_org_fk FOREIGN KEY (producto_id, organizacion_id) REFERENCES productos(id, organizacion_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.producto_costo_observaciones ADD CONSTRAINT producto_costo_observaciones_importacion_id_fkey FOREIGN KEY (importacion_id) REFERENCES importaciones(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.producto_costo_observaciones ADD CONSTRAINT producto_costo_observaciones_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.producto_costo_observaciones ADD CONSTRAINT producto_costo_observaciones_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.producto_costo_observaciones ADD CONSTRAINT producto_costo_observaciones_sucursal_fuente_id_fkey FOREIGN KEY (sucursal_fuente_id) REFERENCES sucursales(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.producto_costo_ultima_observacion ADD CONSTRAINT producto_costo_ultima_observacion_importacion_id_fkey FOREIGN KEY (importacion_id) REFERENCES importaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.producto_costo_ultima_observacion ADD CONSTRAINT producto_costo_ultima_observacion_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.producto_costo_ultima_observacion ADD CONSTRAINT producto_costo_ultima_observacion_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.producto_costo_ultima_observacion ADD CONSTRAINT producto_costo_ultima_observacion_sucursal_fuente_id_fkey FOREIGN KEY (sucursal_fuente_id) REFERENCES sucursales(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.producto_imagen_cambios ADD CONSTRAINT producto_imagen_cambios_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.producto_imagen_cambios ADD CONSTRAINT producto_imagen_cambios_producto_org_fk FOREIGN KEY (producto_id, organizacion_id) REFERENCES productos(id, organizacion_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.producto_imagen_cambios ADD CONSTRAINT producto_imagen_cambios_sucursal_org_fk FOREIGN KEY (sucursal_id, organizacion_id) REFERENCES sucursales(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.producto_imagen_cambios ADD CONSTRAINT producto_imagen_cambios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.producto_pendiente_detecciones ADD CONSTRAINT producto_pendiente_detecciones_import_scope_fk FOREIGN KEY (importacion_id, organizacion_id, sucursal_id) REFERENCES importaciones(id, organizacion_id, sucursal_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.producto_pendiente_detecciones ADD CONSTRAINT producto_pendiente_detecciones_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.producto_pendiente_detecciones ADD CONSTRAINT producto_pendiente_detecciones_pendiente_id_fkey FOREIGN KEY (pendiente_id) REFERENCES productos_pendientes_catalogo(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.producto_pendiente_detecciones ADD CONSTRAINT producto_pendiente_detecciones_sucursal_org_fk FOREIGN KEY (sucursal_id, organizacion_id) REFERENCES sucursales(id, organizacion_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.producto_snapshots ADD CONSTRAINT producto_snapshots_import_scope_fk FOREIGN KEY (importacion_id, organizacion_id, sucursal_id) REFERENCES importaciones(id, organizacion_id, sucursal_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.producto_snapshots ADD CONSTRAINT producto_snapshots_importacion_id_fkey FOREIGN KEY (importacion_id) REFERENCES importaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.producto_snapshots ADD CONSTRAINT producto_snapshots_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.producto_snapshots ADD CONSTRAINT producto_snapshots_producto_org_fk FOREIGN KEY (producto_id, organizacion_id) REFERENCES productos(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.producto_snapshots ADD CONSTRAINT producto_snapshots_sucursal_org_fk FOREIGN KEY (sucursal_id, organizacion_id) REFERENCES sucursales(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.producto_sucursal ADD CONSTRAINT producto_sucursal_producto_org_fk FOREIGN KEY (producto_id, organizacion_id) REFERENCES productos(id, organizacion_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.producto_sucursal ADD CONSTRAINT producto_sucursal_sucursal_org_fk FOREIGN KEY (sucursal_id, organizacion_id) REFERENCES sucursales(id, organizacion_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.productos ADD CONSTRAINT productos_familia_organizacion_fk FOREIGN KEY (familia_id, organizacion_id) REFERENCES familias(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.productos ADD CONSTRAINT productos_organizacion_fk FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.productos_pendientes_catalogo ADD CONSTRAINT productos_pendientes_catalogo_clasificado_por_fkey FOREIGN KEY (clasificado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.productos_pendientes_catalogo ADD CONSTRAINT productos_pendientes_catalogo_familia_org_fk FOREIGN KEY (familia_id_resuelta, organizacion_id) REFERENCES familias(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.productos_pendientes_catalogo ADD CONSTRAINT productos_pendientes_catalogo_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.productos_pendientes_catalogo ADD CONSTRAINT productos_pendientes_catalogo_producto_org_fk FOREIGN KEY (producto_id, organizacion_id) REFERENCES productos(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.push_subscriptions ADD CONSTRAINT push_subscriptions_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.rag_escalamientos ADD CONSTRAINT rag_escalamientos_observacion_id_fkey FOREIGN KEY (observacion_id) REFERENCES vencimiento_observaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.rag_escalamientos ADD CONSTRAINT rag_escalamientos_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.rag_escalamientos ADD CONSTRAINT rag_escalamientos_producto_org_fk FOREIGN KEY (producto_id, organizacion_id) REFERENCES productos(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.rag_escalamientos ADD CONSTRAINT rag_escalamientos_rag_id_fkey FOREIGN KEY (rag_id) REFERENCES intervenciones_rag(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.rag_escalamientos ADD CONSTRAINT rag_escalamientos_sucursal_org_fk FOREIGN KEY (sucursal_id, organizacion_id) REFERENCES sucursales(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.rag_escalamientos ADD CONSTRAINT rag_escalamientos_vencimiento_scope_fk FOREIGN KEY (vencimiento_id, producto_id, sucursal_id) REFERENCES vencimientos(id, producto_id, sucursal_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.regiones ADD CONSTRAINT regiones_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.sectores ADD CONSTRAINT sectores_organizacion_fk FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.sucursales ADD CONSTRAINT sucursales_organizacion_fk FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.sucursales ADD CONSTRAINT sucursales_zona_organizacion_fk FOREIGN KEY (zona_id, organizacion_id) REFERENCES zonas(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.usuario_accesos ADD CONSTRAINT usuario_accesos_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.usuario_accesos ADD CONSTRAINT usuario_accesos_sucursal_org_fk FOREIGN KEY (sucursal_id, organizacion_id) REFERENCES sucursales(id, organizacion_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.usuario_accesos ADD CONSTRAINT usuario_accesos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.usuario_accesos ADD CONSTRAINT usuario_accesos_zona_org_fk FOREIGN KEY (zona_id, organizacion_id) REFERENCES zonas(id, organizacion_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.usuario_familias ADD CONSTRAINT usuario_familias_familia_id_fkey FOREIGN KEY (familia_id) REFERENCES familias(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.usuario_familias ADD CONSTRAINT usuario_familias_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.usuario_familias_sucursal ADD CONSTRAINT usuario_familias_sucursal_familia_id_fkey FOREIGN KEY (familia_id) REFERENCES familias(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.usuario_familias_sucursal ADD CONSTRAINT usuario_familias_sucursal_familia_org_fk FOREIGN KEY (familia_id, organizacion_id) REFERENCES familias(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.usuario_familias_sucursal ADD CONSTRAINT usuario_familias_sucursal_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.usuario_familias_sucursal ADD CONSTRAINT usuario_familias_sucursal_sucursal_org_fk FOREIGN KEY (sucursal_id, organizacion_id) REFERENCES sucursales(id, organizacion_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.usuario_familias_sucursal ADD CONSTRAINT usuario_familias_sucursal_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.usuarios ADD CONSTRAINT usuarios_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.usuarios ADD CONSTRAINT usuarios_sucursal_id_fkey FOREIGN KEY (sucursal_id) REFERENCES sucursales(id);

ALTER TABLE ONLY public.vencimiento_observaciones ADD CONSTRAINT venc_obs_producto_org_fk FOREIGN KEY (producto_id, organizacion_id) REFERENCES productos(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.vencimiento_observaciones ADD CONSTRAINT venc_obs_sucursal_org_fk FOREIGN KEY (sucursal_id, organizacion_id) REFERENCES sucursales(id, organizacion_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.vencimiento_observaciones ADD CONSTRAINT venc_obs_vencimiento_scope_fk FOREIGN KEY (vencimiento_id, producto_id, sucursal_id) REFERENCES vencimientos(id, producto_id, sucursal_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.vencimiento_observaciones ADD CONSTRAINT vencimiento_observaciones_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.vencimiento_observaciones ADD CONSTRAINT vencimiento_observaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.vencimientos ADD CONSTRAINT vencimientos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES productos(id);

ALTER TABLE ONLY public.vencimientos ADD CONSTRAINT vencimientos_sucursal_id_fkey FOREIGN KEY (sucursal_id) REFERENCES sucursales(id);

ALTER TABLE ONLY public.vencimientos ADD CONSTRAINT vencimientos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.zonas ADD CONSTRAINT zonas_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.zonas ADD CONSTRAINT zonas_region_organizacion_fk FOREIGN KEY (region_id, organizacion_id) REFERENCES regiones(id, organizacion_id) ON DELETE RESTRICT;
