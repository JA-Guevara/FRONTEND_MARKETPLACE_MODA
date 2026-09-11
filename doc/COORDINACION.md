# Trabajo coordinado y pasos de reanudación

Sesión actual: implementación solicitada por el usuario, con autorización expresa de trabajo multiagente. Cada estado debe confirmarse con archivos y pruebas, no con intención.

## Reparto

| Responsable | Archivos propios | Resultado esperado |
| --- | --- | --- |
| commerce_finish | Backend ventas_pagos, migración, rutas, metadata, fixture QA | Comercio integrado y pruebas aisladas |
| commerce_ui | Frontend ventas-pagos, rutas, cabecera, integración desde prenda | Carrito, compra, pedidos propios, pagos/stock administrativos |
| dashboard_finish | Frontend ia-reportes y admin-home | Métricas reales, recomendaciones opcionales y estados vacíos |
| Principal | Perfil, estilos compartidos, revisión visual, documentación general | Formularios proporcionados e integración final |

## Secuencia de comprobación

1. Confirmar contratos de rutas y permisos entre backend y frontend.
2. Revisar migración y probar en base descartable; no aplicar a datos reales durante QA.
3. Probar carrito, reserva de stock, pedido, cancelación, pago manual, seguimiento y acceso por propietario.
4. Compilar frontend y ejecutar pruebas. Separar pruebas de gateways simulados de integración real con Stripe.
5. Revisar vistas públicas y autenticadas cuando el acceso del navegador esté autorizado, en móvil/tableta/escritorio.
6. Actualizar ESTADO_ACTUAL, HISTORIAL y documentos de cada módulo con resultados y pendientes concretos.

## Referencia de compra

Se consultó el [carrito público de AliExpress](https://www.aliexpress.us/p/shoppingcart/index.html). El contenido recuperable sin sesión es limitado. La adaptación propia de FashionStore organiza talla/color, cantidad, resumen, dirección, pago y pedidos con seguimiento; no se presenta como réplica completa ni como integración logística de AliExpress.

## Si se interrumpe la sesión

Leer primero ESTADO_ACTUAL.md y este archivo. Consultar estado de agentes; si no siguen activos, revisar sus archivos antes de reasignar. No sobrescribir trabajos sin integrar. Documentar por separado: código escrito, pruebas aprobadas y funcionalidad externa pendiente de credenciales.
