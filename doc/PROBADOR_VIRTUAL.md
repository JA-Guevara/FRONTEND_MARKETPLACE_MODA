# Probador virtual web: estado y verificación

Fecha: 15/09/2026. Alcance de esta sesión: revisar y estabilizar la implementación existente de cámara con superposición manual. Flutter aplazado por instrucción del usuario. No se desplegaron cambios.

## Resultado actual

La ruta `/prendas/:slug/vestidor` permite cargar el recurso `image_overlay` activo del producto, activar la cámara mediante una acción explícita y mover o escalar su imagen. Es una vista manual 2D. No hay detección corporal, ajuste automático, simulación de tela, selección del recurso por variante ni recomendación de talla.

No equivale al probador con seguimiento corporal planificado. La validación de cámara física, presentación visual en teléfonos y funcionamiento desplegado sigue pendiente.

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
- `vestidor.component.spec.ts`: 15 pruebas del componente con cámara simulada y plantilla Angular renderizada en jsdom.
- Catálogo: `CatalogService.product(slug)` resuelve la prenda y su primer `image_overlay` activo.
- Bitácora: `POST /api/v1/vestidor/sessions`, cuerpo `{product_id}`, requiere autenticación. Responde `{success,message,data:{product_id,asset_type,asset_url}}`. Un visitante puede abrir la vista pública sin registrar traza autenticada.
- La ficha de prenda ya enlaza al probador cuando tiene un recurso compatible. El recurso corresponde al producto, no a un color o talla: se explica en pantalla.

## Evidencia de esta sesión

| Comprobación | Resultado | Límite |
| --- | --- | --- |
| `npm.cmd run test:ci` | 98 pruebas aprobadas, 16 archivos | Incluye 15 nuevas del probador; cámara simulada |
| `npm.cmd run build` | Compilación aprobada | Advertencia previa de estilos del dashboard, ajena al probador |
| Contrato backend del probador | 4 pruebas HTTP aprobadas | SQLite descartable y usuario de prueba; sin PostgreSQL real |
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
9. Volver a la ficha para elegir la variante y comprar/reservar. El probador aún no incorpora acciones directas de carrito o visita.
10. Registrar dispositivo, navegador, URL/versión, escenario, resultado y captura cuando corresponda, sin almacenar imágenes personales automáticamente.

## Pendientes y siguiente etapa

- Seguimiento de hombros/caderas y suavizado; primer prototipo con una sola polera.
- Recursos transparentes reales y calibración por prenda/color; el editor actual permite registrar una URL pero no verifica transparencia ni anclajes.
- Conservar/resolver variante y añadir acciones de compra/reserva desde el probador.
- Alternativa sobre foto con elección expresa; actualmente no existe y no se presenta el fondo vacío como prueba sobre una persona.
- Pruebas táctiles y de cámara física en móviles, orientación, zoom y pantallas de poca altura.
- Flutter queda pendiente del examen aunque esta etapa se concentre en Angular.

## Reanudación y trabajo compartido

No restaurar ni modificar automáticamente scripts eliminados por otras sesiones: el inicio de esta revisión ya tenía eliminados `scripts/qa_backend.py`, lanzadores y contratos antiguos. Los nuevos tests del probador son independientes de esos scripts. Para continuar, partir de este documento y revisar el estado de Git antes de editar.
