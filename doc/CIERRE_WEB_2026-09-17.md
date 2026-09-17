# Cierre del frontend web — 17 de septiembre de 2026

El frontend queda conectado a los módulos de autenticación, catálogo, importación/exportación, carrito, Stripe, reservas, probador, inventario, pedidos, dashboard, asistente y bitácora.

Se agregó **Administración → Caja** para ventas presenciales: selección de sucursal y caja, listado con stock real, resumen de prendas, confirmación explícita de cobro y descarga autenticada del comprobante. La pantalla de Existencias ahora pide un motivo para cada ajuste y presenta el historial con saldo, cambio y correo del actor.

La estructura responsive se mantiene en una columna en pantallas pequeñas, conserva desplazamiento horizontal sólo para tablas amplias y los botones conservan área táctil de 44 px.

Validación: `npm run build` y `npm run test:ci` finalizaron correctamente con 175 pruebas.

Para activar estas pantallas en el servidor hay que desplegar en conjunto las migraciones de inventario y caja documentadas en [el cierre del backend](../../backend_marketplace_moda/doc/CIERRE_WEB_2026-09-17.md).
