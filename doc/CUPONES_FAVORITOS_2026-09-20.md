# Vista de cupones y favoritos

Estado local: lista para consumir la API del backend con migración 0015.

- **Carrito:** muestra subtotal, campo de cupón, beneficios aplicados y total
  final. El total proviene del servidor en cada actualización.
- **Ficha de prenda:** botón de corazón que guarda o quita el favorito. Sin
  sesión redirige a iniciar sesión y vuelve a la ficha.
- **Mi cuenta > Mis favoritos:** lista adaptable a móvil, accesos a la prenda,
  controles separados para aviso de stock y rebaja, y eliminación del favorito.
- **Gestión > Cupones y promociones:** formulario para campañas automáticas o
  cupones, reglas de público, fechas, límites y alcance por categoría/prenda.

La interfaz mantiene un diseño de una sola columna en pantallas pequeñas; el
formulario de promociones deja de usar dos columnas bajo 800 px.
