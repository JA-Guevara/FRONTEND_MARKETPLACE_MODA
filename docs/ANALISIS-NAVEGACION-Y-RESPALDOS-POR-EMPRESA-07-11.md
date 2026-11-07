# Consola útil y respaldo por empresa · análisis del 07/11/2026

Estado: navegación corregida; respaldo por empresa analizado, todavía no implementado. No se ejecutó ninguna copia, programación, restauración ni migración sobre producción.

## 1. Qué existía y para qué sirve realmente

| Elemento | Comprobación en código | Decisión aplicada |
| --- | --- | --- |
| Empresas y Suscripciones | La ruta de Suscripciones ya redirigía a Empresas con `filtro=por_vencer`. La ficha 360° contiene Suscripción y la gestión de pagos. Dos entradas en la barra conducían al mismo módulo. | Una sola entrada: **Empresas y suscripciones**. Se conserva el enlace anterior para no romper accesos guardados. Planes permanece separado: define la oferta comercial, mientras la ficha gestiona la contratación de una empresa. |
| Despliegues y migraciones | Consulta `/platform/ops/status`: configuración, versión, revisión de base, mantenimiento. No despliega ni aplica migraciones. Además mostraba una puerta obligatoria de respaldo y excepción fechada que `scripts/railway_entrypoint.py` ya no ejecuta. | Se convierte en **Diagnóstico técnico**, dentro de Estado del sistema, con textos que describen el arranque actual y las diferencias de versión. Se elimina el bloqueo ficticio por respaldo. |
| Continuidad y respaldos | Historial de `platform_backups` y solicitud de un workflow global de GitHub. La restauración es una guía técnica; no hay restauración individual de empresas desde la UI. | Se denomina **Copias globales**, dentro de Estado del sistema. Explica que incluye todas las empresas y que solicitar un workflow no equivale a tener una copia verificada. |
| Salud y seguridad | Comprueba disponibilidad de API/base, errores, límites de peticiones, problemas de sincronización y controles de cuenta. | Se conserva como **Estado y seguridad**, primera vista del único acceso **Estado del sistema**. Su utilidad es detectar indisponibilidad y fallos concretos. |

No se eliminaron servicios de respaldo existentes ni controles de aislamiento. Se simplificó su presentación. No se muestra un nuevo módulo de respaldo por empresa antes de que exista su servicio real.

Archivos contrastados: `frontend_marketplace_moda/src/app/core/layout/admin-nav.ts`, `plataforma.routes.ts`, `empresa-360.component.ts`, `continuidad-page.component.ts`, `despliegues-page.component.ts`; backend `ops_service.py`, `ops_router.py`, `scripts/railway_entrypoint.py` y `.github/workflows/respaldo-bd.yml`.

El workflow diario existe, pero su ejecución programada depende de `BACKUP_SCHEDULE_ENABLED` y de secretos externos. No se inspeccionaron los valores privados ni se certifica que esté activado. El permiso `tenant.data_export` aparece reservado en pruebas/documentación, pero no se encontró un endpoint de copia integral por empresa. Las exportaciones de reportes existentes no permiten restaurar una empresa completa.

## 2. Cómo funciona la base actual

Las empresas comparten la misma base PostgreSQL. `tenant_id` identifica al propietario lógico; no crea una base física diferente por empresa.

Hay pertenencia directa (`products`, `branches`, `users`, `commerce_orders`, `reservations`) e indirecta (`product_variants` y `product_images` por producto; `stock` por sucursal y variante; relaciones de roles/usuarios por sus propietarios). También existen catálogos globales, roles compartidos, referencias financieras externas y archivos que no están en PostgreSQL.

Por eso no alcanza con ejecutar un dump de tablas filtradas por nombre ni exportar todas las tablas con columna `tenant_id`. Una copia individual necesita seleccionar también las relaciones y validar que no incluya registros de otra empresa. `pg_dump` sigue teniendo utilidad para la copia global de la plataforma; no representa por sí solo el contrato de restauración de una empresa.

## 3. Propuesta de producto

Ubicación de la función para el administrador de empresa: **Mi empresa → Datos y respaldos**. Acciones concretas:

1. **Crear copia ahora**: devuelve un trabajo en cola, sin bloquear la pantalla.
2. **Programar copias**: frecuencia, hora, zona horaria, conservación y activación. Propuesta inicial: diaria o semanal; intervalos más frecuentes solo si se justifican por volumen y costo.
3. **Consultar historial**: fecha, tamaño, contenido, revisión, estado real, última copia verificada, próxima ejecución y error comprensible.
4. **Descargar mis datos**: archivo de negocio de la empresa con permiso específico, autorización al descargar y enlace temporal.
5. **Solicitar recuperación**: primero validar y ensayar; mostrar alcance y efectos antes de confirmar una restauración real. Esta acción debe separarse del botón de descarga.

En la plataforma: dentro de la ficha de cada empresa se supervisan sus trabajos, programación, errores y solicitudes de recuperación. Un resumen global solo muestra las empresas sin protección o con fallos, con acceso a su ficha. No hace falta añadir otra entrada principal repetida en la barra.

La copia global sigue cubriendo una caída de toda la base. La copia individual cubre, por ejemplo, la recuperación de datos borrados por error en una sola empresa. Son alcances distintos y ambos deben estar identificados con claridad.

## 4. Contenido y coherencia de una copia individual

### Datos de negocio

- Perfil y configuración de la empresa, sucursales y cajas.
- Catálogo, variantes, imágenes, existencias y movimientos de inventario.
- Clientes y empleados mínimos necesarios, asignaciones de sucursal y roles propios.
- Ventas, detalles, reservas, cambios/devoluciones, descuentos y documentos relacionados.
- Identificadores de sincronización y comprobantes históricos para evitar duplicar ventas al recuperar.
- Archivos propios: manifiesto con sus versiones y hashes, más los objetos correspondientes.

El inventario de tablas debe ser explícito y versionado. Una tabla nueva sin clasificación impide certificar la copia como integral; no se incorpora a ciegas. Las referencias a ciudades, permisos y roles globales se incluyen como referencias validadas, sin sobreescribir los catálogos de otras empresas.

### Identidades, configuración y servicios externos

Una descarga del administrador no debe contener contraseñas, hashes de contraseñas, sesiones, tokens de recuperación, secretos MFA, claves API ni credenciales de Stripe. El contrato de recuperación debe reconocer esa exclusión: conservar identidades válidas que ya existan o recrear cuentas pendientes de activación cuando corresponda, con autorización y nueva verificación. Nunca asociar una cuenta a otra empresa solo porque coincide el correo.

Las restricciones actuales de `users.email`, `users.document_number`, `tenants.slug` y `tenants.tax_id` son globales. Copiar una empresa bajo otro ID dentro de la misma base no funciona simplemente cambiando `tenant_id`: colisionan usuarios y datos únicos. Para el primer ensayo se recomienda una base aislada. La clonación en la misma base sería una función diferente con remapeo y anonimización explícitos.

Los movimientos externos de dinero no se deshacen restaurando PostgreSQL. Stripe requiere reconciliar las referencias con el estado externo. Tampoco se deben reactivar entregas de webhooks, correos o cobros solo porque aparezcan como pendientes en una copia histórica.

### Consistencia y archivo

Crear el conjunto de filas con una transacción PostgreSQL de lectura consistente (`REPEATABLE READ`, de solo lectura), con contexto de empresa fijado y selección explícita de relaciones. Los archivos requieren versiones inmutables o copias de los objetos seleccionados; una URL por sí sola no conserva la imagen si luego se borra.

Propuesta de manifiesto: versión del formato, revisión Alembic, empresa de origen, fecha UTC, cantidades por entidad, hashes, referencias globales, archivos incluidos y exclusiones. Guardar el paquete en almacenamiento privado durable, cifrado y separado del disco efímero del contenedor. Limitar tamaño, tiempo y concurrencia; limpiar objetos temporales solo después de conocer el resultado del trabajo.

## 5. Programación y permisos

Persistir una política por empresa y un historial de ejecuciones, por ejemplo `tenant_backup_policies` y `tenant_backup_runs`. Son nombres propuestos, no tablas ya creadas. El trabajo debe recorrer políticas vencidas, reclamar cada ejecución con bloqueo y evitar duplicados con una clave única por política/instante programado. Reintentos conservan el mismo trabajo lógico.

Estados propuestos: en cola, copiando, verificando, verificado, fallido y vencido. Un archivo generado no se presenta como «restaurable» hasta aprobar el ensayo de restauración. Mostrar la próxima ejecución y la última copia verificada; no usar un horario fijo decorativo en la pantalla.

Separar permisos para leer historial, crear, programar, descargar y solicitar restauración. La empresa se obtiene del contexto autenticado; no se confía en un `tenant_id` enviado por el navegador. El trabajador también fija el contexto de la empresa en cada transacción. El superadministrador puede supervisar con permiso de plataforma y auditoría; nunca se entrega un paquete global como descarga individual.

Retención inicial propuesta: últimas siete copias verificadas y conservación configurable dentro de una cuota. Eliminar solo copias vencidas, sin destruir la última copia válida al fallar una nueva. Las claves de acceso no van en políticas, archivos descargados ni logs.

## 6. Recuperación y prueba de aceptación

Primero recuperar el paquete en una base de ensayo con servicios externos desactivados. Validar firma/hashes, formato, esquema compatible, integridad de claves y pertenencia completa a una sola empresa. Un archivo cargado no puede ejecutar SQL arbitrario. La restauración usa un importador controlado del formato admitido.

Después emitir una vista previa con cantidades, referencias ausentes, identidades afectadas y efectos sobre inventario. Para recuperar sobre la empresa existente, requiere una ventana que detenga sus escrituras y trabajos, una confirmación concreta, un punto de retorno y una ejecución transaccional. Las demás empresas continúan intactas. La generación y el ensayo son pasos independientes de autorizar la recuperación real.

Considerar los dispositivos offline: una recuperación vuelve la base a otro instante, mientras los navegadores y teléfonos pueden conservar ventas posteriores. Se necesita una versión de datos por empresa o mecanismo equivalente para forzar descarga y revisión de la cola antigua. No se permite reenviar silenciosamente operaciones antiguas ni duplicar documentos o stock.

Pruebas mínimas antes de liberar:

1. Crear datos diferentes en empresas A y B; la copia de A solo contiene A y referencias globales permitidas.
2. Copiar mientras se registra una venta: existencias y documento deben corresponder al mismo instante.
3. Ensayar restauración de A y comparar filas, relaciones, totales e imágenes. Los datos de B quedan idénticos.
4. Solicitudes concurrentes y reintentos no duplican copias ni ejecuciones.
5. El administrador B no puede consultar, descargar ni restaurar copias de A, incluso conociendo su ID.
6. Paquete alterado, incompatible o incompleto se rechaza sin cambios parciales.
7. Tras restaurar, sesiones/credenciales externas no reviven y la sincronización offline requiere la revisión correspondiente.
8. Medir recuperación y pérdida de información efectiva; no declarar RTO/RPO alcanzados solo porque figuren como objetivos en la pantalla.

## 7. Orden recomendado

Primero cerrar el inventario de datos y el formato, construir una copia manual con aislamiento A/B y ensayarla en local. Después añadir historial/descarga, programación y conservación. Finalmente, implementar recuperación controlada y probarla con dispositivos offline. Mostrar el módulo de empresa cuando esos pasos tengan un servicio real detrás.

La petición actual autoriza la revisión y la corrección de navegación. Este documento no registra como ejecutado el nuevo sistema de respaldos por empresa ni activa tareas sobre la base real.

## Fuentes contrastadas

- PostgreSQL 18, [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html): alcance de una exportación de base y selección de objetos.
- PostgreSQL 18, [aislamiento de transacciones](https://www.postgresql.org/docs/18/transaction-iso.html): instantánea consistente en `REPEATABLE READ`.
- Supabase, [Database Backups](https://supabase.com/docs/guides/platform/backups): las copias de la base no incluyen los archivos guardados mediante Storage.

## Verificación de la corrección aplicada

Web: 662 pruebas aprobadas y build de producción correcto. Ensayo de navegador con API local sintética: acceso único de empresas/suscripciones, redirección del enlace antiguo con filtro de vencimiento, pestañas del sistema, indicador activo en la barra y alcance global de las copias comprobados. El ensayo encontró que la redirección anterior perdía el filtro; se corrigió con un UrlTree explícito.

Se mantiene el control `platform.ops.read` para Estado del sistema y sus tres vistas. La entrada duplicada de Suscripciones desaparece y las funciones de la ficha de empresa se conservan. Backend y móvil no requieren cambios ni migraciones para esta reorganización.
