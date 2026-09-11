# Imágenes dentro de crear y editar prendas

Fecha: 11 de septiembre de 2026.

## Solicitud aplicada

El carrusel forma parte del formulario principal de la prenda. Ya no es necesario crear primero la prenda y abrir «Variantes y recursos» para añadir imágenes.

1. Abrir Nuevo o Editar en el listado de prendas.
2. Seleccionar uno o varios archivos JPEG/PNG/WebP (hasta 5 MB cada uno), o pegar una URL HTTP/HTTPS y pulsar Añadir enlace.
3. Recorrer las imágenes con anterior/siguiente o miniaturas, describirlas y elegir la principal.
4. Quitar del carrusel las imágenes que no se desean conservar.
5. Completar los datos y guardar. Cancelar descarta los cambios locales.

La vista previa de archivos es local; la subida empieza al guardar. La URL se carga en el navegador para previsualizarla. Un enlace pendiente sin añadir al carrusel impide guardar para evitar que se pierda sin aviso.

## Comportamiento de guardado

- Crear: se envían datos e imágenes en la creación del producto.
- Editar: PATCH envía la galería completa, conservando IDs existentes. Datos e imágenes se confirman en la misma transacción del backend.
- Una imagen de otra prenda o un ID repetido se rechazan.
- Quitar imágenes no manda DELETE desde la vista previa. La eliminación ocurre al guardar la galería final.
- Los archivos físicos se suben antes de guardar los datos; si falla después la validación, pueden quedar archivos sin asociación. Sigue pendiente la limpieza automática de estos archivos.

## Verificación

- 56 pruebas frontend aprobadas; 3 nuevas sobre carrusel, selección de principal, eliminación diferida y enlace pendiente.
- 118 comprobaciones HTTP del ciclo 1 aprobadas.
- Prueba HTTP adicional: crear con imagen, editar conservando ID/agregando otra, rechazar ID ajeno sin cambiar el nombre y guardar galería vacía.
- Pendiente: prueba visual autenticada del diálogo, subida real desde navegador y tamaño móvil con varias imágenes. Los estilos contemplan una columna y visor de altura acotada en móvil; esto no sustituye esa inspección.

## Requisito para probar

Ejecutar las versiones actualizadas de backend y frontend juntas. Reiniciar el backend si estaba abierto antes del cambio: el nuevo PATCH debe reconocer el campo images. No requiere migración de base para esta mejora.
