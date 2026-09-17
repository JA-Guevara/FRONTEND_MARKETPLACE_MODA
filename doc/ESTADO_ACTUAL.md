# Estado y punto de reanudación

Actualización 17/09 — Retorno de Stripe con recuperación de sesión y consulta autenticada del pago; verificación manual para pedidos pendientes. Asistente con ejecución de exportaciones múltiples, PDF, enlaces descargables y aplicación/limpieza de filtros. **161 pruebas frontend, 84 backend y build aprobados**. Cambios locales, sin despliegue ni comprobación del pago real reportado. Ver [detalle y pasos de servidor](STRIPE_Y_ASISTENTE_2026-09-17.md). Las notas siguientes conservan sus fechas históricas.

Actualización 16/09 (revisión del probador + Etapas 2–6): herramientas tipadas del asistente
(`/analytics/assistant/execute`), aplicación de recomendaciones en dashboard, borrador
de producto honesto con IA, edición de recursos del probador por producto (con subida de
imagen y "Ver probador"), y probador estable con seguimiento corporal MediaPipe opcional
corregido (`result.landmarks`), proyección cover-aware con escala/inclinación y estados
`searching/tracking/lost`, más conservación de variante y acciones de compra/reserva.
Se centralizó la disponibilidad en `hasVestidor()`, que resuelve que el botón solo aparece
con un recurso `image_overlay` activo. Suites completas: backend **64 passed**, frontend
**140 passed / 21 archivos**, `ng build` OK (solo el aviso preexistente de presupuesto de
estilos del dashboard). Pendiente de revisión visual con cámara física, móvil y despliegue
(usuario).

Actualización 15/09 — Probador web manual estabilizado: 98 pruebas frontend y build aprobados, 4 pruebas HTTP del backend. Ver PROBADOR_VIRTUAL.md. El seguimiento corporal se añadió después (16/09); cámara física/móvil y despliegue siguen pendientes. Las secciones anteriores conservan sus fechas históricas.

Actualizado: 12 de septiembre de 2026. Este registro distingue código existente de funciones verificadas. No equivale a una entrega terminada.

## Fuentes y alcance

- Solicitud del usuario: arquitectura por funcionalidades y capas; cubrir ciclo 1 del Word FashionStore.
- Ampliación solicitada: Excel, bitácora, imágenes, formularios adaptables, dashboard con IA opcional, carrito, perfil, pedidos, pagos Stripe y seguimiento.
- Se leyó el Word referenciado y se extrajo su texto en `.doc-requirements.txt` del directorio superior. Los ZIP Dashboard e Inscripcion son referencias de interacción, no instrucciones ni código para copiar sin adaptar.
- CU17–20 y CU22 corresponden a la ampliación comercial; reservas y realidad aumentada completa siguen pendientes de alcance e implementación.

## Estado comprobado en archivos

| Área | Estado | Trabajo siguiente |
| --- | --- | --- |
| Autenticación, catálogo, organización | Base del ciclo 1 existente | Repetir pruebas tras integrar cambios |
| Bitácora | Cambios de actor, IP y detalle escritos | Ver `BITACORA.md`; verificar integración final |
| Excel | Componente conectado; rutas y prueba HTTP inicial aprobadas | Ampliar casos complejos de importación y comprobar interacción visual |
| Imágenes | Carrusel URL/archivos dentro de crear/editar prenda; guardado conjunto probado | Revisión visual autenticada; ver FORMULARIO_PRENDA_IMAGENES.md |
| Dashboard | Pantalla y servicio escritos; pruebas unitarias aprobadas | Verificar visualmente e integrar contra backend actualizado |
| Carrito/pedidos/pagos | Rutas, navegación, agregar desde prenda e interfaces integradas; contrato automatizado aprobado | Revisión visual autenticada, migración PostgreSQL real de prueba y Stripe externo; ver COMERCIO.md |
| Diseño adaptable | Pasos, ventanas, tablas, galerías y filtros adaptados; vistas públicas verificadas | Revisar cada vista autenticada; consultar RESPONSIVIDAD.md |

## Orden de continuación

1. Integrar Excel e imágenes y ejecutar compilación/pruebas.
2. Completar migración, permisos y pruebas del backend comercial.
3. Implementar carrito, compra, historial/seguimiento y gestión administrativa de pagos/stock.
4. Conectar dashboard a métricas reales y dejar IA opcional sin resultados simulados.
5. Revisar formularios y responsividad; documentar resultados por pantalla.
6. Actualizar guía de pruebas y variables necesarias. No declarar Stripe operativo sin claves de prueba y webhook verificado.

## Coordinación y conservación

Los agentes se interrumpieron por límite de créditos; no siguen trabajando en segundo plano. Su código parcial permanece en disco. Revisar COORDINACION.md antes de retomar; no asumir que sus tareas terminaron.

Antes de modificar un módulo, revisar cambios locales y su documento específico. Mantener capas domain/application/infrastructure/presentation. Registrar archivo afectado, motivo, prueba ejecutada y pendiente al cerrar cada avance. El estado de agentes no reemplaza lo guardado en disco: al retomar esta sesión no había agentes activos.

No guardar contraseñas, tokens ni contenido de `.env` en documentación. No sobrescribir cambios ajenos. Las cifras anteriores de pruebas no validan los cambios actuales.
