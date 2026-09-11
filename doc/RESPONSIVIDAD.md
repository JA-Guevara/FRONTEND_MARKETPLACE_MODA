# Formularios y adaptación de pantallas

Actualizado: 10 de septiembre de 2026.

## Cambios implementados

- Formularios compartidos de más de seis campos: pasos con progreso, validación antes de avanzar y conservación de valores. Al guardar, un campo inválido lleva al paso correspondiente.
- Móvil: una columna, ventanas limitadas a la altura disponible, desplazamiento interno, horarios en dos columnas con etiqueta propia y acciones con altura mínima de 44 px.
- Tablas: desplazamiento horizontal dentro de su contenedor. Navegación administrativa horizontal en pantallas pequeñas.
- Filtros del catálogo desplegables en móvil, visibles en escritorio.
- Galería administrativa horizontal con tarjetas e imágenes proporcionales. Detalle público con anterior/siguiente y miniaturas desplazables.
- Foco por teclado: los campos de pasos ocultos se excluyen de la navegación del diálogo.

## Verificación realizada

| Vista | Tamaños solicitados al navegador | Resultado |
| --- | --- | --- |
| Catálogo con datos temporales | 320, 768, 1440 px | Sin desbordamiento horizontal del documento |
| Detalle de prenda | 320, 768, 1440 px | Sin desbordamiento horizontal del documento |
| Sucursales | 320, 768, 1440 px | Sin desbordamiento horizontal del documento |
| Registro | 375 px y medida adicional a 320 px | Inspección visual del formulario completo y sin desbordamiento |
| Filtros móviles | 375 px | Abrir muestra campos; cerrar los oculta |

La barra vertical del navegador resta 15 px al área útil en algunas páginas. Las mediciones compararon scrollWidth con clientWidth, no solo el ancho solicitado.

Pruebas frontend: 49 aprobadas, incluyendo navegación de pasos y conservación de valores. Compilación de producción aprobada: 315,99 kB iniciales.

## Pendiente de revisión visual

Vistas autenticadas: usuarios, roles, permisos, prendas/editor, proveedores, sucursales/cajas, direcciones y bitácora. Los cambios compartidos les aplican, pero no se declara comprobación visual individual. También falta comprobar galería con múltiples imágenes y archivos desde el formulario del navegador.

Carrito, pedidos, pagos y dashboard siguen pendientes de completar; deberán incluirse en esta matriz al implementarlos.
