# Probador virtual: preparación de imágenes

La foto de referencia se prepara desde la edición de cada prenda, en la sección **Probador virtual**. Seleccioná el color, usá **Preparar desde foto** y verificá que la vista previa quede transparente con estado **Listo**. El cliente verá esa imagen al abrir la cámara y seleccionar el mismo color.

No requiere vectorización: una imagen frontal PNG/WebP con transparencia es ideal. Si se carga JPG, el sistema intenta quitar un fondo liso. Una imagen de una persona, con varios objetos o un fondo complejo puede quedar marcada como fallida para evitar que se superponga una foto completa sobre la cámara.

La corrección completa y los pasos de validación están en `backend_marketplace_moda/doc/PROBADOR_CORRECCION_2026-09-19.md`.

## Actualización: acceso desde el catálogo público

El cliente puede abrir el espejo sin iniciar sesión. La cuenta solo se pide para pedir una **foto realista con IA**, porque esa imagen pertenece al usuario y debe poder eliminarse y consultarse desde su perfil.

Si el color tiene estado **Listo**, la pantalla indica que usa la imagen preparada. Si no existe un recurso preparado para ese color, muestra una explicación y el maniquí de orientación; no representa una prenda real. Las prendas históricas se preparan desde **Administración → Recursos del probador → Preparar pendientes en lote**. Repetí el lote hasta agotar pendientes (cada ejecución procesa hasta 60 recursos) y revisá los elementos que queden en revisión antes de aprobarlos.
