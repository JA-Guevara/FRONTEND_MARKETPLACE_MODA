# Dashboard en tres vistas y definición del probador

Fecha: 17/09/2026. Alcance: mejorar el dashboard existente y aclarar alternativas del probador. No se implementó generación 3D ni se enviaron fotografías a proveedores externos.

## Dashboard implementado

1. **Gráficos:** seis indicadores y un carrusel manual de tres grupos. Ventas/evolución: ingresos diarios con proyección, acumulado de la serie visible y prendas más vendidas; distribución: sucursales, horarios, días de la semana y meses; operación: categorías, medios de pago, estados de pedidos y reservas. Once gráficos en total. Las alertas de existencias llevan directamente a su tabla.
2. **Tablas:** selector de once conjuntos agregados recibidos del backend. Tabla semántica con búsqueda sin distinguir tildes, orden numérico/textual, paginación de 10/25/50 filas y desplazamiento horizontal dentro de la tabla en pantallas pequeñas. No es una lista exhaustiva de transacciones: para detalle completo se mantiene exportación de reportes, y pedidos individuales se gestionan en su módulo.
3. **Análisis IA:** interpretación de consultas, aplicación de filtros, explicación por secciones y recomendaciones. Conserva endpoints y permisos existentes; no solicita IA al abrir. Muestra contexto y método de proyección. No presenta botones ficticios de entrenamiento.

### Interacción y presentación

- Solo se monta el panel activo. El carrusel anterior conservaba la altura de todos los paneles, dejando una vista extensa incluso al cambiar de sección.
- Flechas y pestañas principales; teclado izquierda/derecha/inicio/fin con foco y semántica de pestañas. Los grupos de gráficos tienen botones de selección y anterior/siguiente, sin avance automático.
- Color vino para la marca, verde azulado para proyección, tarjetas claras y tipografía jerárquica. Exportación plegada inicialmente para priorizar datos; conserva selección múltiple y Excel/PDF/CSV.
- Rango de fechas personalizado desplegable con validación y límites completos del día de Bolivia (-04:00). Filtros generales y comparación existentes conservados.
- Líneas con escala, fechas, títulos con valores, área tenue y proyección discontinua. La posición horizontal respeta la distancia entre fechas; días ausentes no se dibujan como intervalos idénticos.
- La serie acumulada suma únicamente los días incluidos en la serie visible. No se presenta como el total completo de un período si el backend devuelve una serie limitada.
- Corregidas etiquetas: comparación de pedidos pagados y reservas del período (incluye todos sus estados). Los filtros de pedidos no mezclan estados exclusivos de reservas.
- Plantilla y estilos separados del controlador para facilitar mantenimiento por futuros agentes.

### Alcance de filtros y datos

La búsqueda de tabla es local y no altera filtros globales ni exportación. Los filtros aplicados del servidor siguen siendo la fuente del asistente y las exportaciones. Se conserva el contrato del backend; no se añadieron métricas de visitantes, conversión de embudo ni probabilidades inventadas para llenar gráficos. La proyección existente es estadística, no un modelo entrenado en esta revisión.

### Validación

- 170 pruebas frontend aprobadas en 26 archivos; nueve nuevas cubren navegación, panel único, fechas, búsqueda/orden/paginación y escala temporal.
- Build de producción aprobado. Aviso de presupuesto de estilos: dashboard 6.28 kB frente a 4 kB de advertencia; por debajo del máximo de error de 8 kB y menor que la versión anterior (6.92 kB).
- Revisión visual local con el componente real y datos ficticios identificados como prueba; no certifica conectividad del servidor ni calidad de respuestas del proveedor IA. Tamaños revisados: 320, 768 y 1366 px, sin desbordamiento horizontal de página. A 320 px la tabla de stock desplaza sus columnas dentro del contenedor. Verificados cambio de pestañas/grupos, búsqueda que reduce resultados y paginación. Corregidos posición fija heredada de filtros, recorte de anillos SVG y disposición de las cuatro composiciones. Vista final inspeccionada después de recompilar.
- No se cambiaron endpoints ni modelos del backend en esta tanda. Pruebas backend de la tanda anterior: 84; no se presentan como una nueva ejecución.

## Probador: qué existe hoy

El probador actual usa un recurso activo `image_overlay`. Muestra la cámara y superpone una imagen 2D de la prenda. MediaPipe opcional detecta puntos del cuerpo para posición, escala e inclinación; existe ajuste manual. El frontend no renderiza modelos 3D aunque se puedan registrar recursos de otros tipos. La imagen ideal para esta modalidad es frontal, sin fondo y con silueta limpia. Una foto comercial con fondo no se convierte por sí sola en una prenda recortada.

No hay simulación física de tela ni medición fiable de talla. Estado técnico anterior en `PROBADOR_VIRTUAL.md`; validación de cámara física/móvil sigue pendiente.

## Propuesta de evolución (pendiente de implementar)

| Modalidad | Entrada | Resultado | Trabajo necesario |
| --- | --- | --- | --- |
| Cámara en vivo 2D, existente | Imagen recortada de la prenda + cámara | Prenda superpuesta siguiendo el torso | Mejorar recortes, ajustes por categoría y comprobar cámara/móviles |
| Foto con IA, recomendada como siguiente etapa | Foto aportada por el cliente + imagen de la prenda/variante | Imagen generada de la persona usando la prenda | Adaptador de proveedor, trabajos asincrónicos, estado/reintento, límites de uso y almacenamiento temporal |
| Modelo 3D de catálogo | Imágenes frontal, lateral y posterior cuando existan | Recurso GLB para girar y observar | Generación por producto, revisión, optimización y visor 3D |
| Prenda 3D sobre el cuerpo en vivo | Modelo apto para deformarse + seguimiento corporal | Prenda orientada y deformada con el cuerpo | Rigging/deformación, oclusiones, medidas y rendimiento; generar una malla no resuelve todo esto |

### Recomendación

Mantener **«Cámara en vivo»** y preparar **«Verme con esta prenda · IA»** como dos experiencias claramente distintas. La segunda no necesita convertir antes la prenda a 3D. Permite un resultado visual más elaborado a partir de una foto; debe identificarse como simulación visual y no prometer talla exacta ni caída real.

Flujo propuesto: elegir prenda y variante → seleccionar modalidad → aportar foto o tomar una captura con acción explícita → informar procesamiento y confirmar generación → mostrar estado → comparar original/resultado → volver a talla/color, carrito o reserva. No enviar video continuo a IA. No usar fotos personales para entrenamiento; definir retención corta y eliminación. Los errores o un cambio de variante deben cancelar/invalidar resultados anteriores para no presentar otra prenda como la seleccionada.

Arquitectura propuesta: conservar `reservas-vestidor`, añadir caso de uso de generación y puerto de proveedor en backend; trabajos identificados y autorizados por propietario, estados `queued/processing/succeeded/failed`, imagen de prenda vinculada a variante, cuotas y auditoría sin imágenes ni secretos. Credenciales solo en servidor. La selección del proveedor y su contrato deben revisarse antes de integrar llamadas de pago.

### Si se decide generar 3D

La API de Tripo documenta generación desde una imagen y resultado GLB. El modelo debe generarse una vez por recurso/variante visual, revisarse y reutilizarse, no regenerarse por cada visita. Una imagen no describe zonas ocultas: el sistema debe estimarlas y puede alterar espalda, textura o volumen. Conviene aportar varias vistas reales cuando sea posible.

Para catálogo 360° esto puede ser útil. Para vestir el cuerpo se necesita además preparar geometría/deformación, escala, anclajes y tratamiento de manos/cuerpo delante de la tela. Es una fase mayor, que requiere una prueba técnica con prendas representativas antes de prometer funcionamiento para todo el catálogo.

Coste a estimar: número de prendas/variantes × generaciones y reintentos por recurso, más almacenamiento; para foto con IA, número de generaciones de clientes × coste unitario y reintentos. No asumir que la clave del chat actual incluye generación visual o 3D. No se verificaron ni contrataron tarifas en esta revisión.

Fuentes primarias consultadas:

- [Tripo: generación de modelo desde imagen](https://developers.tripo3d.ai/en/docs/generation-image-to-model).
- [Tripo: limitaciones de generación desde imágenes](https://www.tripo3d.ai/tutorials/tripo-ai-image-to-3d-problems).
- [Google: funcionamiento de generación visual de prendas sobre personas](https://blog.google/products-and-platforms/products/shopping/virtual-try-on-google-generative-ai/).
- [Investigación sobre limitaciones de ajuste de talla en probadores por imagen](https://arxiv.org/abs/2302.14197).

La recomendación de fases es una decisión de arquitectura para este proyecto, no una garantía de los proveedores.
