# Railway y revisión visual — 12/09/2026

## Evidencia del incidente de carrito

Se comprobó el backend publicado sin credenciales y sin modificar datos:

| Solicitud | Resultado |
| --- | --- |
| GET /health | 200 |
| GET /api/v1/commerce/branches | 200 |
| GET /api/v1/commerce/cart sin sesión | 401 esperado |
| OPTIONS /api/v1/commerce/cart, Origin frontend, header authorization | 200; origen y cabecera permitidos |

La API de producción del frontend coincide con el dominio backend probado. Estas comprobaciones descartan caída general y bloqueo general del preflight; NO prueban el carrito autenticado del usuario ni identifican su excepción.

Se solicitaron logs del backend inmediatamente después de Reintentar. Queda pendiente recibirlos para confirmar la causa. Un error de base de datos/migración es una posibilidad, no un diagnóstico confirmado. railway.json ya contiene preDeployCommand con alembic upgrade head.

## Correcciones locales

- Backend: error SQLAlchemy se devuelve como 503 JSON con referencia, conservando CORS. Registra tipo, SQLSTATE y tabla en logs, sin mostrar SQL, credenciales ni detalles internos al cliente.
- Frontend: mensaje de status 0 ya no afirma que el backend esté apagado; reconoce conexión o error del servicio.
- Carrito: icono SVG en cabecera, Agregar al carrito y Ver carrito.
- Botones: acento borgoña, hover, contraste y espaciado coherentes; cabecera se reorganiza en pantallas pequeñas.
- Formulario de prendas: galería y datos en dos columnas en escritorio; una columna hasta 800 px para no comprimir los controles.
- Administración: espaciados/títulos acotados; áreas de acciones más cómodas.

## Validación

60 pruebas frontend y compilación de producción aprobadas. 3 pruebas comerciales backend aprobadas, incluyendo error de base de datos simulado con respuesta 503 y cabeceras CORS verificadas.

Navegador local: acceso inspeccionado visualmente a 390 px; sin desbordamiento horizontal medido a 320/768/1440 px. Se probó el botón de mostrar contraseña y su estado accesible.

## Pendientes y publicación

Los cambios están en el workspace, NO desplegados en Railway durante esta sesión. La falla autenticada de producción sigue pendiente de logs y reproducción. No se publicaron cambios ni se modificó la base real.

La revisión visual total sigue abierta: formulario de prenda con sesión, bitácora, Excel, dashboard, carrito con artículos, pedidos, stock y restantes listados administrativos. No equiparar compilación con revisión visual de todas las pantallas.
