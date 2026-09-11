# Ajustes y pendientes — 11/09/2026

## Aplicado en esta sesión

- Bitácora: columna principal Usuario (correo), utilizando actor_email del servidor. Nombre e ID quedan en el detalle. Sin correo histórico disponible, se indica la ausencia; no se sustituye por un ID ni se inventa un correo.
- Corregida codificación de caracteres en la página de bitácora.
- Iconos SVG compartidos: ojo abierto/cerrado, carga, descarga y menú. Conservan etiquetas accesibles; los botones de importar/exportar mantienen texto.
- Mostrar contraseña: icono centrado, área de 44 px y estado aria-pressed.
- Excel: barra agrupada, contraste definido, importación destacada, exportación secundaria y botones adaptables. Errores de descargas Blob conservan el estado HTTP para mostrar el mensaje del servidor.
- Administración móvil: menú colapsable para que los grupos no alarguen siempre la página. En escritorio permanece visible.

## Verificación y límites

56 pruebas frontend aprobadas y compilación de producción aprobada durante esta sesión. Los cambios visuales necesitan inspección individual con sesión administrativa; las pruebas no certifican contraste medido WCAG ni todas las resoluciones.

El correo de bitácora proviene de la relación del evento con el usuario; no es una copia histórica inmutable. Si se elimina definitivamente el usuario, puede no estar disponible. Los eventos sin sesión no tienen un correo autenticado.

## Próxima sesión, en orden

1. Revisar rutas comerciales: aún no aparecen carrito/pedidos/stock en app.routes.ts. Integrar las vistas ya escritas y navegación, evitando rehacerlas.
2. Completar pruebas del backend comercial y migración 0003 en base descartable.
3. Verificar pedido, reserva/devolución de stock, pago manual y seguimiento por propietario.
4. Preparar/pruebas Stripe con gateway simulado; integración real de prueba pendiente de configuración y webhook. No declarar cobros listos.
5. Revisión visual autenticada: nuevo/editar prenda con carrusel, bitácora, Excel, dashboard y pantallas comerciales.
6. Ampliar importación: referencias compuestas, actualizaciones y volumen máximo; documentar los resultados.
7. Evaluar instantánea histórica de correo de auditoría si se requiere conservarlo tras cambios/eliminación de usuario.

Mantener el alcance del Word y los pendientes de ESTADO_ACTUAL.md. Esta sesión no completa todos los módulos planificados.
