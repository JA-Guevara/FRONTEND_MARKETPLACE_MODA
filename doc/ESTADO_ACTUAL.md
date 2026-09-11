# Estado y punto de reanudación

Actualizado: 10 de septiembre de 2026. Este registro distingue código existente de funciones verificadas. No equivale a una entrega terminada.

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
| Imágenes | Editor URL/archivo, galería horizontal y controles públicos implementados; carga/permisos probados por HTTP | Comprobar carga desde navegador y galería con múltiples imágenes |
| Dashboard | Ayudantes de dominio y pruebas escritos | Completar pantalla y servicio de métricas |
| Carrito/pedidos/pagos | Backend en desarrollo | Faltan pantallas, migración y pruebas completas |
| Diseño adaptable | Pasos, ventanas, tablas, galerías y filtros adaptados; vistas públicas verificadas | Revisar cada vista autenticada; consultar RESPONSIVIDAD.md |

## Orden de continuación

1. Integrar Excel e imágenes y ejecutar compilación/pruebas.
2. Completar migración, permisos y pruebas del backend comercial.
3. Implementar carrito, compra, historial/seguimiento y gestión administrativa de pagos/stock.
4. Conectar dashboard a métricas reales y dejar IA opcional sin resultados simulados.
5. Revisar formularios y responsividad; documentar resultados por pantalla.
6. Actualizar guía de pruebas y variables necesarias. No declarar Stripe operativo sin claves de prueba y webhook verificado.

## Coordinación y conservación

Antes de modificar un módulo, revisar cambios locales y su documento específico. Mantener capas domain/application/infrastructure/presentation. Registrar archivo afectado, motivo, prueba ejecutada y pendiente al cerrar cada avance. El estado de agentes no reemplaza lo guardado en disco: al retomar esta sesión no había agentes activos.

No guardar contraseñas, tokens ni contenido de `.env` en documentación. No sobrescribir cambios ajenos. Las cifras anteriores de pruebas no validan los cambios actuales.
