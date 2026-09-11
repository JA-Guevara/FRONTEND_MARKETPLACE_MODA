# Excel: uso y alcance

Implementado para prendas, variantes, categorías, tallas, colores, temporadas, colecciones, proveedores, ciudades, sucursales y cajas. Se accede desde las herramientas del listado correspondiente. En prendas se puede elegir importar variantes por SKU.

## Procedimiento

1. Descargar la plantilla del recurso. Conservar columnas y hoja Datos.
2. Completar valores; las hojas auxiliares ayudan a identificar referencias.
3. Elegir Crear o Actualizar y revisar el archivo.
4. Corregir los errores indicados por fila. Confirmar únicamente el archivo revisado.

Límites: .xlsx, 5 MB, 1000 filas por importación. No admite fórmulas, macros ni enlaces externos de libros. Una fila inválida impide guardar el lote completo. Actualizar conserva campos vacíos; no cambia estados ni existencias.

## Recomendación de uso

Priorizar prendas y variantes para catálogos extensos; proveedores para migraciones iniciales; maestros antes de cargar prendas. Ciudades, sucursales y cajas son útiles para apertura o migración, aunque su uso habitual será menor.

No se recomienda un importador genérico en todos los formularios: usuarios, roles, credenciales y pagos necesitan controles específicos. Las existencias requieren movimientos trazables, y las asociaciones de imágenes/proveedores se gestionan desde la prenda.

## Evidencia y pendientes

Pruebas HTTP aprobadas: plantillas/exportaciones de los recursos permitidos, permisos, preview sin persistencia, alta, duplicados, lote mixto sin escritura parcial, archivo cambiado después de preview, fórmulas rechazadas e imágenes válidas/inválidas.

Pendiente ampliar casos de referencias compuestas de colecciones y ciudades, actualizaciones con campos vacíos y volumen máximo. La prueba actual no certifica individualmente todas las combinaciones de negocio.
