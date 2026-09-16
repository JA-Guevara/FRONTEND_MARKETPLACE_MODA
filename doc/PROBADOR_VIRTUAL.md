# Probador virtual web: estado y verificación

## Actualización 16/09 (revisión del probador web)
- **Causa de la no-visibilidad del botón (comprobada)**: solo se ofrece el probador cuando
  la prenda tiene un `ar_assets` **activo** con `asset_type === 'image_overlay'`. Un
  producto con fotos comerciales pero sin ese recurso no muestra el botón, y la mayoría
  de los productos de ejemplo no lo tienen. Se centralizó el criterio en `hasVestidor()`
  (`catalog.models.ts`), usado por la ficha, el catálogo y el vestidor.
- **Corrección de la integración MediaPipe**: el resultado documentado de `PoseLandmarker`
  expone `result.landmarks` (`NormalizedLandmark[][]`), **no** `poseLandmarks`. Se corrigió
  en `pose-tracking.service.ts`. Además: reintento eliminando el `<script>` fallido y
  fallback de delegado GPU→CPU al crear el landmarker.
- **Proyección con `object-fit: cover`**: `pose-projection.ts` mapea coordenadas
  normalizadas a píxeles de pantalla considerando recorte, centrado y espejo frontal. La
  postura ahora ajusta **posición, escala e inclinación** (antes solo posición), con
  suavizado; escala acotada 0.4–3.
- **Estados dentro del probador**: `off/busy/searching/tracking/lost`. Sin detección se
  muestra "Buscando…"; al perder a la persona por más de 1200 ms la prenda se atenúa y se
  reanuda sola al volver al encuadre.
- **Gestión admin del recurso**: nuevo `ar-asset-form.component.ts` en el editor (pestaña
  "Probador virtual") con URL o **subida de imagen** reutilizando `POST /media/images`
  (PNG/JPEG/WebP ≤ 5 MB), preview y `is_active`. La tabla muestra el estado y "Ver probador"
  para recursos activos. Los formatos 3D se registran pero no se renderizan (visor 2D).
- **Conservación de variante**: la ficha enlaza con `?variante=<id>`; el vestidor devuelve
  ese parámetro en "Volver a la prenda" y la ficha lo preselecciona.
- **Comprar/reservar desde el probador**: botones que llevan a la ficha de la prenda donde
  se resuelve variante (color/talla) y se agrega al carrito o se reserva.
- Suites: vestidor **22** (`vestidor.component.spec.ts`), proyección **14**
  (`pose-projection.spec.ts`), servicio de postura **4** (`pose-tracking.service.spec.ts`),
  ficha **3** (`product-page-fitting.spec.ts`), criterio compartido **2**
  (`catalog.models.spec.ts`). Total frontend **140 / 21 archivos**; backend **71 passed**;
  `ng build` OK (solo aviso preexistente del dashboard).
- **Pendiente (usuario)**: cámara física, móvil, HTTPS y despliegue.

Fecha 15/09 (histórico de la tanda anterior)

Fecha: 15/09/2026. Alcance de esta sesión: revisar y estabilizar la implementación existente de cámara con superposición manual. Flutter aplazado por instrucción del usuario. No se desplegaron cambios.

## Resultado actual

La ruta `/prendas/:slug/vestidor` permite cargar el recurso `image_overlay` activo del producto, activar la cámara mediante una acción explícita y mover o escalar su imagen. Es una vista 2D con un modo **opcional** de seguimiento corporal (MediaPipe Pose) que ajusta posición, escala e inclinación del torso; no simula tela ni determina la talla. El seguimiento puede fallar o no cargar y en ese caso queda el ajuste manual.

No equivale a un probador 3D real ni a una recomendación de talla. La validación de cámara física, presentación visual en teléfonos y funcionamiento desplegado sigue pendiente.

## Fallos corregidos

- Se solicitaba la cámara mientras `loading` ocultaba el elemento `<video>`; el stream podía quedar sin enlazar. Ahora el video existe antes de activar y permanece visible durante el inicio de reproducción.
- La cámara se activaba al entrar. Ahora hay Activar, Apagar, Cancelar activación, Reintentar y Cambiar cámara.
- Se liberan tracks al salir, ocultar la pestaña, cambiar de producto/cámara y al fallar la reproducción. Si el permiso llega después de cancelar o destruir la pantalla, el stream tardío se detiene.
- Se distinguen permiso denegado, ausencia de cámara, dispositivo ocupado, desconexión e incompatibilidad del navegador. Un fallo de imagen impide activar y detiene la cámara.
- Un producto sin recurso no presenta una falsa experiencia lista.
- Arrastre con captura de puntero, manejo de cancelación y límites de posición. Hay controles alternativos accesibles mediante teclado y un rango de escala de 0.4 a 3.
- Estilos propios del componente: dos columnas cuando hay espacio, una columna hasta 720 px, escenario limitado por altura disponible y botones de al menos 44 px. Eliminado el bloque global obsoleto del probador.
- La traza se solicita después de iniciar la cámara, únicamente si hay sesión. Su fallo se comunica sin bloquear la vista. No se envían video ni fotos; el POST contiene solo `product_id`.
- Los cambios de ruta invalidan cargas anteriores y restablecen los controles.

## Contrato y archivos

- `src/features/reservas-vestidor/presentation/vestidor.component.ts`: experiencia y ciclo de vida de cámara.
- `vestidor.scss`: distribución y controles.
- `vestidor.component.spec.ts`: 22 pruebas del componente con cámara simulada y plantilla Angular renderizada en jsdom.
- `src/shared/pose-projection.ts` y `pose-tracking.service.ts`: proyección pura (cover, escala, inclinación) y carga del modelo MediaPipe (`result.landmarks`).
- Catálogo: `CatalogService.product(slug)` resuelve la prenda y su primer `image_overlay` activo.
- Bitácora: `POST /api/v1/vestidor/sessions`, cuerpo `{product_id}`, requiere autenticación. Responde `{success,message,data:{product_id,asset_type,asset_url}}`. Un visitante puede abrir la vista pública sin registrar traza autenticada.
- La ficha de prenda ya enlaza al probador cuando tiene un recurso compatible. El recurso corresponde al producto, no a un color o talla: se explica en pantalla.

## Evidencia de esta sesión

| Comprobación | Resultado | Límite |
| --- | --- | --- |
| `npm.cmd run test:ci` | 140 pruebas aprobadas, 21 archivos | Incluye 45 del probador/postura/criterio; cámara simulada |
| `npm.cmd run build` | Compilación aprobada | Advertencia previa de estilos del dashboard, ajena al probador |
| Backend `pytest tests/unit` | 64 passed | Sin PostgreSQL real |
| Contrato backend del probador | 4 pruebas HTTP aprobadas | SQLite descartable y usuario de prueba |
| Navegador/cámara física | Pendiente | No se abrió la cámara del usuario |
| Responsividad visual en 320/390/768/1024/1440 px | Pendiente | Estilos implementados; requiere inspección en navegador |
| Despliegue | Pendiente | Sin publicación ni cambio de datos del servidor |

La prueba inicial detectó que un `DOMException` no siempre se identifica mediante `instanceof Error`; se corrigió la lectura del nombre del error y se volvió a ejecutar la suite.

## Guía de prueba real antes de marcar funcionalidad aprobada

1. Seleccionar una prenda real con imagen frontal transparente, pública y accesible desde HTTPS. No basta una URL guardada; confirmar que la imagen carga y corresponde al producto.
2. Abrir el probador desde su ficha. Confirmar que todavía no se solicita cámara.
3. Activar y aceptar el permiso. Comprobar video, orientación de espejo frontal y superposición.
4. Mover con dedo y con controles, cambiar escala, centrar y verificar que los controles caben en cada tamaño objetivo.
5. Apagar, reactivar y cambiar cámara; verificar el comportamiento si el teléfono solo ofrece una cámara. `facingMode` es una preferencia y el navegador puede conservar la misma.
6. Rechazar el permiso y reintentar después de habilitarlo. Probar imagen rota, falta de dispositivo y cámara ocupada.
7. Cancelar mientras espera permiso, abandonar la ruta y ocultar la pestaña. Confirmar que se apaga el indicador de cámara y no se reactiva sola.
8. Con usuario autenticado, verificar el evento de bitácora. Sin sesión, no afirmar que existe un evento asociado al usuario.
9. Activar "Seguir mi postura": verificar "Buscando…", seguimiento del torso (posición/escala/inclinación), atenuado al salir del encuadre y reanudación al volver. Comprobar que sin red o si el modelo no carga queda el ajuste manual con aviso.
10. Volver a la ficha por "Volver a la prenda": confirmar que se conserva la variante elegida (`?variante=`) y que se puede comprar/reservar.
11. Registrar dispositivo, navegador, URL/versión, escenario, resultado y captura cuando corresponda, sin almacenar imágenes personales automáticamente.

## Pendientes y siguiente etapa

- Recursos transparentes reales y calibración por prenda/color; el editor actual permite
  registrar/subir una imagen pero no verifica transparencia ni anclajes finos.
- Seguimiento corporal: calibrar umbrales (pérdida, escala, inclinación) con cámaras y
  prendas reales; hoy son valores razonables sin validar en dispositivo físico.
- Alternativa sobre foto con elección expresa; actualmente no existe y no se presenta el fondo vacío como prueba sobre una persona.
- Pruebas táctiles y de cámara física en móviles, orientación, zoom y pantallas de poca altura.
- Flutter queda pendiente del examen aunque esta etapa se concentre en Angular.

## Reanudación y trabajo compartido

No restaurar ni modificar automáticamente scripts eliminados por otras sesiones: el inicio de esta revisión ya tenía eliminados `scripts/qa_backend.py`, lanzadores y contratos antiguos. Los nuevos tests del probador son independientes de esos scripts. Para continuar, partir de este documento y revisar el estado de Git antes de editar.
