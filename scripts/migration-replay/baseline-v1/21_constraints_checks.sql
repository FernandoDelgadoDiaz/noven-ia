ALTER TABLE ONLY public.acciones_operativas ADD CONSTRAINT acciones_operativas_cantidad_check CHECK (cantidad > 0);

ALTER TABLE ONLY public.acciones_operativas ADD CONSTRAINT acciones_operativas_costo_unitario_sin_iva_check CHECK (costo_unitario_sin_iva IS NULL OR costo_unitario_sin_iva >= 0::numeric);

ALTER TABLE ONLY public.acciones_operativas ADD CONSTRAINT acciones_operativas_tipo_v2_check CHECK (tipo = ANY (ARRAY['vendido'::text, 'donacion'::text, 'decomiso'::text]));

ALTER TABLE ONLY public.acciones_operativas ADD CONSTRAINT acciones_operativas_trimestre_check CHECK (trimestre = ANY (ARRAY[1, 2, 3, 4]));

ALTER TABLE ONLY public.acciones_operativas ADD CONSTRAINT acciones_operativas_valorizacion_metodo_check CHECK (valorizacion_metodo IS NULL OR (valorizacion_metodo = ANY (ARRAY['congelado_al_cierre'::text, 'retrospectiva_0258'::text])));

ALTER TABLE ONLY public.alertas_zonales ADD CONSTRAINT alertas_zonales_estado_check CHECK (estado = ANY (ARRAY['activa'::text, 'cerrada'::text]));

ALTER TABLE ONLY public.alertas_zonales ADD CONSTRAINT alertas_zonales_nivel_origen_check CHECK (nivel_origen = ANY (ARRAY['radar'::text, 'urgente'::text, 'donacion'::text, 'decomiso'::text]));

ALTER TABLE ONLY public.alertas_zonales_destinos ADD CONSTRAINT alertas_zonales_destinos_cantidad_confirmada_check CHECK (cantidad_confirmada IS NULL OR cantidad_confirmada > 0);

ALTER TABLE ONLY public.alertas_zonales_destinos ADD CONSTRAINT alertas_zonales_destinos_estado_check CHECK (estado = ANY (ARRAY['pendiente'::text, 'revisar_despues'::text, 'ya_controlado'::text, 'misma_fecha'::text, 'otra_fecha'::text, 'no_lo_tengo'::text, 'sin_responsable'::text, 'sin_stock'::text, 'cerrada'::text]));

ALTER TABLE ONLY public.alertas_zonales_destinos ADD CONSTRAINT alertas_zonales_destinos_stock_snapshot_check CHECK (stock_snapshot > 0);

ALTER TABLE ONLY public.importaciones ADD CONSTRAINT importaciones_archivo_sha256_check CHECK (archivo_sha256 ~ '^[0-9a-f]{64}$'::text);

ALTER TABLE ONLY public.importaciones ADD CONSTRAINT importaciones_conteos_masivos_check CHECK (filas_aplicadas >= 0 AND filas_sin_mapear >= 0 AND filas_sin_familia >= 0);

ALTER TABLE ONLY public.importaciones ADD CONSTRAINT importaciones_estado_aplicada_check CHECK (estado <> 'aplicada'::text OR aplicada_at IS NOT NULL);

ALTER TABLE ONLY public.importaciones ADD CONSTRAINT importaciones_estado_check CHECK (estado = ANY (ARRAY['recibida'::text, 'validada'::text, 'aplicada'::text, 'fallida'::text, 'cancelada'::text]));

ALTER TABLE ONLY public.importaciones ADD CONSTRAINT importaciones_filas_descartadas_check CHECK (filas_descartadas >= 0);

ALTER TABLE ONLY public.importaciones ADD CONSTRAINT importaciones_filas_total_check CHECK (filas_total >= 0);

ALTER TABLE ONLY public.importaciones ADD CONSTRAINT importaciones_filas_validas_check CHECK (filas_validas >= 0);

ALTER TABLE ONLY public.importaciones ADD CONSTRAINT importaciones_modo_check CHECK (modo = ANY (ARRAY['familia'::text, 'masiva'::text]));

ALTER TABLE ONLY public.importaciones ADD CONSTRAINT importaciones_tipo_reporte_check CHECK (tipo_reporte = ANY (ARRAY['reposicion_asistida'::text, 'glaciar_0258'::text]));

ALTER TABLE ONLY public.intervenciones_rag ADD CONSTRAINT intervenciones_rag_cantidad_comprometida_al_aplicar_check CHECK (cantidad_comprometida_al_aplicar >= 0::numeric);

ALTER TABLE ONLY public.intervenciones_rag ADD CONSTRAINT intervenciones_rag_motivo_finalizacion_check CHECK (motivo_finalizacion IS NULL OR (motivo_finalizacion = ANY (ARRAY['reemplazado'::text, 'oferta_centralizada'::text, 'decision_comercial'::text, 'otro'::text])));

ALTER TABLE ONLY public.intervenciones_rag ADD CONSTRAINT intervenciones_rag_porcentaje_descuento_check CHECK (porcentaje_descuento > 0::numeric AND porcentaje_descuento <= 100::numeric);

ALTER TABLE ONLY public.invitaciones_acceso ADD CONSTRAINT invitaciones_acceso_canal_check CHECK (canal = ANY (ARRAY['link'::text, 'email'::text]));

ALTER TABLE ONLY public.invitaciones_acceso ADD CONSTRAINT invitaciones_acceso_email_no_vacio CHECK (btrim(email) <> ''::text);

ALTER TABLE ONLY public.invitaciones_acceso ADD CONSTRAINT invitaciones_acceso_estado_check CHECK (estado = ANY (ARRAY['pendiente'::text, 'aceptada'::text, 'anulada'::text]));

ALTER TABLE ONLY public.invitaciones_acceso ADD CONSTRAINT invitaciones_acceso_expira_despues_creacion CHECK (expires_at > created_at);

ALTER TABLE ONLY public.invitaciones_acceso ADD CONSTRAINT invitaciones_acceso_nombre_no_vacio CHECK (btrim(nombre) <> ''::text);

ALTER TABLE ONLY public.invitaciones_acceso ADD CONSTRAINT invitaciones_acceso_rol_check CHECK (rol = ANY (ARRAY['gerente_zonal'::text, 'gerente_sucursal'::text, 'supervisor'::text, 'operador'::text]));

ALTER TABLE ONLY public.invitaciones_acceso ADD CONSTRAINT invitaciones_acceso_scope_valido CHECK (rol = 'gerente_zonal'::text AND zona_id IS NOT NULL AND sucursal_id IS NULL AND cardinality(familias_ids) = 0 OR (rol = ANY (ARRAY['gerente_sucursal'::text, 'supervisor'::text])) AND zona_id IS NULL AND sucursal_id IS NOT NULL AND cardinality(familias_ids) = 0 OR rol = 'operador'::text AND zona_id IS NULL AND sucursal_id IS NOT NULL AND cardinality(familias_ids) > 0);

ALTER TABLE ONLY public.organizaciones ADD CONSTRAINT organizaciones_codigo_no_vacio CHECK (btrim(codigo) <> ''::text);

ALTER TABLE ONLY public.organizaciones ADD CONSTRAINT organizaciones_nombre_no_vacio CHECK (btrim(nombre) <> ''::text);

ALTER TABLE ONLY public.problemas_economicos_ciclos ADD CONSTRAINT problemas_economicos_ciclos_apertura_metodo_check CHECK (apertura_metodo = ANY (ARRAY['evento'::text, 'backfill_actual'::text]));

ALTER TABLE ONLY public.problemas_economicos_ciclos ADD CONSTRAINT problemas_economicos_ciclos_cantidad_actual_check CHECK (cantidad_actual >= 0::numeric);

ALTER TABLE ONLY public.problemas_economicos_ciclos ADD CONSTRAINT problemas_economicos_ciclos_cantidad_apertura_check CHECK (cantidad_apertura >= 0::numeric);

ALTER TABLE ONLY public.problemas_economicos_ciclos ADD CONSTRAINT problemas_economicos_ciclos_nivel_apertura_check CHECK (nivel_apertura = ANY (ARRAY['decomiso'::text, 'donacion'::text, 'urgente'::text, 'radar'::text]));

ALTER TABLE ONLY public.problemas_economicos_ciclos ADD CONSTRAINT problemas_economicos_ciclos_resolucion_check CHECK (resolucion = ANY (ARRAY['vuelto_seguro'::text, 'vendido'::text, 'donacion'::text, 'decomiso'::text, 'anulado'::text, 'fuera_circuito'::text, 'inactivo_sin_resultado'::text]));

ALTER TABLE ONLY public.problemas_economicos_ciclos ADD CONSTRAINT problemas_economicos_ciclos_resolucion_ck CHECK (resuelto_at IS NULL AND resolucion IS NULL AND resolucion_fuente IS NULL OR resuelto_at IS NOT NULL AND resolucion IS NOT NULL AND resolucion_fuente IS NOT NULL);

ALTER TABLE ONLY public.problemas_economicos_ciclos ADD CONSTRAINT problemas_economicos_ciclos_unidades_expuestas_actual_check CHECK (unidades_expuestas_actual >= 0::numeric);

ALTER TABLE ONLY public.problemas_economicos_ciclos ADD CONSTRAINT problemas_economicos_ciclos_unidades_expuestas_apertura_check CHECK (unidades_expuestas_apertura >= 0::numeric);

ALTER TABLE ONLY public.producto_codigos ADD CONSTRAINT producto_codigos_codigo_no_vacio CHECK (btrim(codigo) <> ''::text);

ALTER TABLE ONLY public.producto_codigos ADD CONSTRAINT producto_codigos_tipo_check CHECK (tipo = ANY (ARRAY['ean8'::text, 'upca'::text, 'ean13'::text, 'gtin14'::text, 'otro'::text]));

ALTER TABLE ONLY public.producto_costo_observaciones ADD CONSTRAINT producto_costo_observaciones_alguno_check CHECK (costo_unitario IS NOT NULL OR costo_final IS NOT NULL);

ALTER TABLE ONLY public.producto_costo_ultima_observacion ADD CONSTRAINT producto_costo_ultima_alguno_check CHECK (costo_unitario IS NOT NULL OR costo_final IS NOT NULL);

ALTER TABLE ONLY public.producto_imagen_cambios ADD CONSTRAINT producto_imagen_cambios_accion_check CHECK (accion = ANY (ARRAY['agregar'::text, 'reemplazar'::text]));

ALTER TABLE ONLY public.producto_pendiente_detecciones ADD CONSTRAINT producto_pendiente_detecciones_fila_check CHECK (fila_origen IS NULL OR fila_origen > 0);

ALTER TABLE ONLY public.producto_snapshots ADD CONSTRAINT producto_snapshots_fila_check CHECK (fila_origen IS NULL OR fila_origen > 0);

ALTER TABLE ONLY public.productos_pendientes_catalogo ADD CONSTRAINT productos_pendientes_catalogo_estado_check CHECK (estado = ANY (ARRAY['pendiente'::text, 'resuelto'::text, 'descartado'::text]));

ALTER TABLE ONLY public.productos_pendientes_catalogo ADD CONSTRAINT productos_pendientes_catalogo_resolucion_check CHECK (estado = 'resuelto'::text AND familia_id_resuelta IS NOT NULL AND clasificado_at IS NOT NULL OR estado <> 'resuelto'::text);

ALTER TABLE ONLY public.rag_escalamientos ADD CONSTRAINT rag_escalamientos_cantidad_actual_check CHECK (cantidad_actual >= 0::numeric);

ALTER TABLE ONLY public.rag_escalamientos ADD CONSTRAINT rag_escalamientos_estado_seguimiento_check CHECK (estado_seguimiento = ANY (ARRAY['insuficiente'::text, 'sin_movimiento'::text]));

ALTER TABLE ONLY public.rag_escalamientos ADD CONSTRAINT rag_escalamientos_respuesta_tipo_check CHECK (respuesta_tipo IS NULL OR (respuesta_tipo = ANY (ARRAY['control'::text, 'nueva_intervencion'::text, 'finalizacion_rag'::text, 'cierre_terminal'::text])));

ALTER TABLE ONLY public.rag_escalamientos ADD CONSTRAINT rag_escalamientos_unidades_expuestas_check CHECK (unidades_expuestas >= 0::numeric);

ALTER TABLE ONLY public.regiones ADD CONSTRAINT regiones_codigo_no_vacio CHECK (btrim(codigo) <> ''::text);

ALTER TABLE ONLY public.regiones ADD CONSTRAINT regiones_nombre_no_vacio CHECK (btrim(nombre) <> ''::text);

ALTER TABLE ONLY public.sectores ADD CONSTRAINT sectores_dias_donacion_rango CHECK (dias_donacion IS NULL OR dias_donacion >= 1 AND dias_donacion <= 90);

ALTER TABLE ONLY public.sucursales ADD CONSTRAINT sucursales_codigo_no_vacio CHECK (btrim(codigo) <> ''::text);

ALTER TABLE ONLY public.usuario_accesos ADD CONSTRAINT usuario_accesos_rol_check CHECK (rol = ANY (ARRAY['admin_organizacion'::text, 'gerente_zonal'::text, 'gerente_sucursal'::text, 'supervisor'::text, 'operador'::text]));

ALTER TABLE ONLY public.usuario_accesos ADD CONSTRAINT usuario_accesos_scope_valido CHECK (rol = 'admin_organizacion'::text AND zona_id IS NULL AND sucursal_id IS NULL OR rol = 'gerente_zonal'::text AND zona_id IS NOT NULL AND sucursal_id IS NULL OR (rol = ANY (ARRAY['gerente_sucursal'::text, 'supervisor'::text, 'operador'::text])) AND zona_id IS NULL AND sucursal_id IS NOT NULL);

ALTER TABLE ONLY public.usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol = ANY (ARRAY['admin'::text, 'operador'::text, 'supervisor'::text]));

ALTER TABLE ONLY public.vencimiento_observaciones ADD CONSTRAINT vencimiento_observaciones_cantidad_comprometida_check CHECK (cantidad_comprometida >= 0::numeric);

ALTER TABLE ONLY public.vencimientos ADD CONSTRAINT vencimientos_cantidad_check CHECK (cantidad > 0);

ALTER TABLE ONLY public.vencimientos ADD CONSTRAINT vencimientos_nivel_actual_check CHECK (nivel_actual = ANY (ARRAY['seguro'::text, 'radar'::text, 'urgente'::text, 'donacion'::text, 'decomiso'::text]));

ALTER TABLE ONLY public.zonas ADD CONSTRAINT zonas_codigo_no_vacio CHECK (btrim(codigo) <> ''::text);

ALTER TABLE ONLY public.zonas ADD CONSTRAINT zonas_nombre_no_vacio CHECK (btrim(nombre) <> ''::text);
