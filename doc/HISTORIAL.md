# Historial de avance

## 2026-09-15 — Estabilización del probador manual web

- Corregido ciclo de vida de cámara/video, permisos, cancelación tardía, cierre, desconexión y cambio de producto/cámara.
- Recursos ausentes/rotos, controles de teclado y estilos propios adaptables. Se identifica explícitamente como superposición manual.
- 98 pruebas frontend (15 nuevas del probador) y build aprobados; 4 pruebas HTTP backend aprobadas.
- Detalle en PROBADOR_VIRTUAL.md. Cámara física, revisión visual móvil, seguimiento corporal y despliegue pendientes.

## 2026-09-12 — Incidente publicado y diseño

- Verificadas rutas públicas y preflight del backend publicado; petición autenticada pendiente de logs.
- Iconos de carrito, colores de botones, cabecera adaptable y formulario de prenda en dos columnas de escritorio.
- 60 pruebas frontend y compilación aprobadas; acceso inspeccionado en móvil y medido a 320/768/1440 px.
- Se documentó DIAGNOSTICO_RAILWAY_Y_DISENO.md. Cambios aún no desplegados; no se declara solucionado el incidente de producción.

## 2026-09-12 — Integración comercial

- Conectadas rutas /carrito, /mi-cuenta/pedidos, /admin/pedidos y /admin/stock con permisos.
- Agregar al carrito desde talla/color de prenda; enlaces de cabecera y menú administrativo.
- Corregida compra con disponibilidad antigua tras error de red y carrito con prenda desactivada.
- 60 pruebas frontend, compilación y 2 contratos comerciales backend aprobados.
- Documentado COMERCIO.md con uso, pruebas y límites. Pendientes ya no son crear estas rutas, sino verificación visual y pruebas externas/PostgreSQL.

## 2026-09-11 — Correo, iconos y contraste

- Bitácora prioriza correo autenticado, con nombre/ID en detalle.
- Iconos accesibles y contraste de Excel; botón de contraseña centrado.
- Menú administrativo colapsable en móvil.
- 56 pruebas frontend y compilación aprobadas. Revisión individual autenticada pendiente.
- Se documentó AJUSTES_VISUALES_Y_PENDIENTES.md con el orden de reanudación y las limitaciones de auditoría/comercio.

## 2026-09-11 — Carrusel en el formulario principal

- Integrado ProductImagesComponent en Nuevo/Editar prenda: archivos múltiples, enlaces, carrusel, descripción, principal y quitar antes de guardar.
- Edición carga detalle completo para conservar la galería actual.
- Backend ampliado para guardar datos y galería en la misma transacción.
- 56 pruebas frontend y 118 comprobaciones del ciclo 1 aprobadas; prueba HTTP adicional de galería aprobada.
- Documentado FORMULARIO_PRENDA_IMAGENES.md con instrucciones, límites y pruebas pendientes.
- Se detiene la sesión con trabajo comercial parcial guardado; los agentes se interrumpieron por límite de créditos. No se presenta carrito/pagos como entrega completa.

## 2026-09-10 — Formularios, galerías y revisión adaptable

- Formularios largos divididos en pasos de hasta seis campos; prueba de conservación/validación aprobada.
- Ajustes compartidos de móvil, foco, ventanas, tablas, horarios y navegación; detalle en RESPONSIVIDAD.md.
- Galerías administrativas con tarjetas horizontales y detalle público con controles anterior/siguiente.
- Filtros del catálogo desplegables en móvil, comprobados en navegador.
- Corregido start:qa con lanzador Node y environment.qa para usar exclusivamente el backend temporal local. No se cambiaron las direcciones de desarrollo o producción.
- 49 pruebas frontend aprobadas; compilación de producción aprobada. Pruebas de Excel/imágenes ampliadas y aprobadas.
- Catálogo, prenda y sucursales comprobados a 320/768/1440 px; registro inspeccionado en móvil. Vistas autenticadas todavía requieren revisión individual.

## 2026-09-10 — Recuperación y documentación

- Se verificó el estado de archivos locales y la ausencia de agentes activos.
- Se guardó `ESTADO_ACTUAL.md` con alcance, avances parciales, pendientes y orden de reanudación.
- Se identificaron componentes de Excel/imágenes y ayudantes del dashboard todavía pendientes de integración y validación conjunta.
- No se declara completado el flujo comercial ni se reutilizan resultados antiguos de pruebas como evidencia actual.

## 2026-09-10 — Integración de Excel e imágenes

- Editor de prendas: al agregar una imagen se puede elegir URL o archivo con vista previa mediante `ImageFormComponent`. La edición de imágenes existentes conserva su formulario actual.
- Compilación de producción: aprobada (313,29 kB iniciales).
- `npm run test:contract`: 118 comprobaciones HTTP del ciclo 1 aprobadas en base temporal.
- Nuevo `scripts/test_excel_media.py`: comprobó plantillas y exportaciones de todos los recursos permitidos, permisos, previsualización sin persistencia, importación, duplicados, carga/lectura de imagen y rechazo de contenido inválido.
- La prueba de Excel/imágenes se ejecuta desde frontend con `..\backend_marketplace_moda\.venv\Scripts\python.exe scripts/test_excel_media.py`. Usa base descartable y almacenamiento temporal.
- Pendiente: comprobar importaciones de negocio complejas, formularios en navegador, dashboard, flujo comercial y responsividad completa.
