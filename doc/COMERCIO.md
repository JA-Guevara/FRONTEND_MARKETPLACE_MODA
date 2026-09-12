# Carrito, pedidos, pagos y existencias

Estado: integrado en rutas el 12/09/2026; pruebas automatizadas aprobadas. Pendiente revisión visual autenticada y pago externo en modo prueba.

## Flujo disponible

1. Abrir una prenda, elegir talla/color y pulsar Agregar al carrito. Si falta sesión, se dirige a iniciar sesión con retorno a la prenda; después se debe elegir y añadir nuevamente.
2. En `/carrito`, modificar cantidades, quitar artículos y elegir sucursal para consultar disponibilidad.
3. Completar destinatario, teléfono y dirección. Confirmar genera el pedido y reserva stock. El total se calcula en el servidor.
4. `/mi-cuenta/pedidos` muestra prendas, pago, dirección, transportista, número de seguimiento e historial. Permite cancelar pedidos pendientes y abrir Stripe cuando esté configurado.
5. `/admin/pedidos` permite consultar compras, registrar pagos manuales recibidos y pasar por preparación, envío y entrega, según permisos.
6. `/admin/stock` permite consultar y ajustar disponibilidad por sucursal, según permisos.

La cabecera incluye Carrito, Mi cuenta enlaza Mis pedidos y el menú administrativo incluye pedidos/stock. Los ajustes de disponibilidad son cantidades absolutas, no sustituyen un módulo completo de movimientos de inventario.

## Verificación de esta sesión

- Compilación de producción aprobada: aproximadamente 323 kB iniciales; vistas comerciales cargadas bajo demanda.
- 60 pruebas frontend aprobadas. Nuevas pruebas de sucursal/stock requerido, invalidez de disponibilidad tras fallo, contenido del pedido y permisos de rutas.
- 2 pruebas backend de contrato comercial aprobadas: compra, reserva, propiedad, pago manual, transiciones, cancelación, stock insuficiente, Stripe simulado, duplicados y firma inválida.
- Una prenda desactivada permanece en el carrito con disponibilidad cero y se puede quitar; el servidor rechaza comprarla.

## Límites y próximos pasos

- Reiniciar backend y frontend actualizados para probar. Base persistente requiere migración 0003; no se aplicó a la base del usuario.
- Revisar visualmente carrito, pedidos, stock y dashboard en 320/768/1440 px con sesión autorizada. Se implementaron estilos adaptables, pero no se certifica esa inspección.
- Stripe requiere claves de prueba y webhook. No se realizaron cobros externos; las pruebas usan gateway simulado.
- La sesión se conserva en memoria. Después de volver de Stripe o recargar puede ser necesario iniciar sesión nuevamente; los pedidos permanecen en servidor.
- Seguimiento actualizado por la tienda, sin consulta automática a transportistas.
- No hay tarifa automática de envío, cálculo tributario, devoluciones/reembolsos ni expiración automática de pedidos manuales.
- Añadir filtros de pedidos por estado/fecha, pruebas de concurrencia PostgreSQL, conciliación y módulo de movimientos de stock.
