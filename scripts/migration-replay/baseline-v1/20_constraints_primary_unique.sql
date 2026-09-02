ALTER TABLE ONLY public.acciones_operativas ADD CONSTRAINT acciones_operativas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.alertas_zonales ADD CONSTRAINT alertas_zonales_evento_uk UNIQUE (zona_id, producto_id, fecha_vencimiento);

ALTER TABLE ONLY public.alertas_zonales ADD CONSTRAINT alertas_zonales_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.alertas_zonales_destinos ADD CONSTRAINT alertas_zonales_destinos_alerta_sucursal_uk UNIQUE (alerta_id, sucursal_id);

ALTER TABLE ONLY public.alertas_zonales_destinos ADD CONSTRAINT alertas_zonales_destinos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.familias ADD CONSTRAINT familias_id_organizacion_uk UNIQUE (id, organizacion_id);

ALTER TABLE ONLY public.familias ADD CONSTRAINT familias_organizacion_codigo_uk UNIQUE (organizacion_id, codigo);

ALTER TABLE ONLY public.familias ADD CONSTRAINT familias_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.importacion_0258_detalle ADD CONSTRAINT importacion_0258_detalle_import_cod_uk UNIQUE (importacion_id, cod_art);

ALTER TABLE ONLY public.importacion_0258_detalle ADD CONSTRAINT importacion_0258_detalle_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.importaciones ADD CONSTRAINT importaciones_archivo_unico UNIQUE (sucursal_id, tipo_reporte, archivo_sha256);

ALTER TABLE ONLY public.importaciones ADD CONSTRAINT importaciones_id_org_sucursal_uk UNIQUE (id, organizacion_id, sucursal_id);

ALTER TABLE ONLY public.importaciones ADD CONSTRAINT importaciones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.intervenciones_rag ADD CONSTRAINT intervenciones_rag_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.invitaciones_acceso ADD CONSTRAINT invitaciones_acceso_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.organizaciones ADD CONSTRAINT organizaciones_codigo_key UNIQUE (codigo);

ALTER TABLE ONLY public.organizaciones ADD CONSTRAINT organizaciones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.problemas_economicos_ciclos ADD CONSTRAINT problemas_economicos_ciclos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.producto_codigos ADD CONSTRAINT producto_codigos_org_codigo_uk UNIQUE (organizacion_id, codigo);

ALTER TABLE ONLY public.producto_codigos ADD CONSTRAINT producto_codigos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.producto_costo_observaciones ADD CONSTRAINT producto_costo_observaciones_import_producto_uk UNIQUE (importacion_id, producto_id);

ALTER TABLE ONLY public.producto_costo_observaciones ADD CONSTRAINT producto_costo_observaciones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.producto_costo_ultima_observacion ADD CONSTRAINT producto_costo_ultima_observacion_pkey PRIMARY KEY (producto_id);

ALTER TABLE ONLY public.producto_imagen_cambios ADD CONSTRAINT producto_imagen_cambios_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.producto_pendiente_detecciones ADD CONSTRAINT producto_pendiente_detecciones_pendiente_import_uk UNIQUE (pendiente_id, importacion_id);

ALTER TABLE ONLY public.producto_pendiente_detecciones ADD CONSTRAINT producto_pendiente_detecciones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.producto_snapshots ADD CONSTRAINT producto_snapshots_import_producto_uk UNIQUE (importacion_id, producto_id);

ALTER TABLE ONLY public.producto_snapshots ADD CONSTRAINT producto_snapshots_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.producto_sucursal ADD CONSTRAINT producto_sucursal_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.producto_sucursal ADD CONSTRAINT producto_sucursal_producto_sucursal_uk UNIQUE (producto_id, sucursal_id);

ALTER TABLE ONLY public.productos ADD CONSTRAINT productos_id_organizacion_uk UNIQUE (id, organizacion_id);

ALTER TABLE ONLY public.productos ADD CONSTRAINT productos_organizacion_cod_art_uk UNIQUE (organizacion_id, cod_art);

ALTER TABLE ONLY public.productos ADD CONSTRAINT productos_organizacion_codigo_barras_uk UNIQUE (organizacion_id, codigo_barras);

ALTER TABLE ONLY public.productos ADD CONSTRAINT productos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.productos_pendientes_catalogo ADD CONSTRAINT productos_pendientes_catalogo_org_cod_uk UNIQUE (organizacion_id, cod_art);

ALTER TABLE ONLY public.productos_pendientes_catalogo ADD CONSTRAINT productos_pendientes_catalogo_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.push_subscriptions ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rag_escalamientos ADD CONSTRAINT rag_escalamientos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rag_escalamientos ADD CONSTRAINT rag_escalamientos_unico_por_control UNIQUE (rag_id, observacion_id);

ALTER TABLE ONLY public.regiones ADD CONSTRAINT regiones_id_organizacion_uk UNIQUE (id, organizacion_id);

ALTER TABLE ONLY public.regiones ADD CONSTRAINT regiones_organizacion_codigo_uk UNIQUE (organizacion_id, codigo);

ALTER TABLE ONLY public.regiones ADD CONSTRAINT regiones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sectores ADD CONSTRAINT sectores_id_organizacion_uk UNIQUE (id, organizacion_id);

ALTER TABLE ONLY public.sectores ADD CONSTRAINT sectores_organizacion_codigo_uk UNIQUE (organizacion_id, codigo);

ALTER TABLE ONLY public.sectores ADD CONSTRAINT sectores_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sucursales ADD CONSTRAINT sucursales_id_organizacion_uk UNIQUE (id, organizacion_id);

ALTER TABLE ONLY public.sucursales ADD CONSTRAINT sucursales_organizacion_codigo_uk UNIQUE (organizacion_id, codigo);

ALTER TABLE ONLY public.sucursales ADD CONSTRAINT sucursales_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.usuario_accesos ADD CONSTRAINT usuario_accesos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.usuario_familias ADD CONSTRAINT usuario_familias_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.usuario_familias ADD CONSTRAINT usuario_familias_usuario_id_familia_id_key UNIQUE (usuario_id, familia_id);

ALTER TABLE ONLY public.usuario_familias_sucursal ADD CONSTRAINT usuario_familias_sucursal_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.usuario_familias_sucursal ADD CONSTRAINT usuario_familias_sucursal_usuario_familia_uk UNIQUE (usuario_id, sucursal_id, familia_id);

ALTER TABLE ONLY public.usuarios ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vencimiento_observaciones ADD CONSTRAINT vencimiento_observaciones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vencimientos ADD CONSTRAINT vencimientos_id_producto_sucursal_uk UNIQUE (id, producto_id, sucursal_id);

ALTER TABLE ONLY public.vencimientos ADD CONSTRAINT vencimientos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.zonas ADD CONSTRAINT zonas_id_organizacion_uk UNIQUE (id, organizacion_id);

ALTER TABLE ONLY public.zonas ADD CONSTRAINT zonas_organizacion_codigo_uk UNIQUE (organizacion_id, codigo);

ALTER TABLE ONLY public.zonas ADD CONSTRAINT zonas_pkey PRIMARY KEY (id);
