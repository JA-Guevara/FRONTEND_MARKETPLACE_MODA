# Recorrido de prueba — ciclo I

Usar preferentemente `npm run start:qa`; todos los registros son desechables. El recorrido normal usa la misma interfaz contra la base configurada, con un administrador creado según la guía del backend.

## Preparación

1. Abrir la portada sin iniciar sesión. Debe aparecer el catálogo y permitir abrir prendas y sucursales.
2. Ingresar con la cuenta administradora de QA indicada en README.
3. Abrir **Administración**. Deben aparecer Acceso y seguridad, Catálogo, Organización y Bitácora.

## CU03 — Acceso y seguridad

1. En Permisos, crear un permiso `prueba.read`, nombre `Consultar prueba`, módulo `prueba`.
2. En Roles, crear `gestor_prueba` y elegir permisos. Guardar, editar el nombre y abrir Permisos para cambiar la asignación.
3. En Usuarios, crear una cuenta con un correo distinto y al menos un rol; usar una contraseña de 12 caracteres con mayúscula, minúscula, número y símbolo que no contenga el nombre del correo.
4. Buscar la cuenta, ver sus datos, editarla y asignarle otro rol.
5. Desactivar, activar y desbloquear. Eliminar y marcar Mostrar eliminados para restaurar.
6. Intentar eliminar un rol del sistema debe mostrar el conflicto del backend sin perder datos.

## CU04–CU05 — Prendas y clasificación

1. Crear una categoría, una talla y un color hexadecimal válido.
2. Crear una temporada con fecha inicial y final. Una fecha final anterior debe impedir guardar.
3. Crear una colección vinculada a esa temporada.
4. Crear una prenda con descripción, categoría y precio; elegir temporada y colección coherentes.
5. Abrir **Variantes y recursos**: agregar talla/color, SKU único y un precio alternativo opcional.
6. Editar la variante, cambiar precio, desactivar y reactivar con el campo Variante activa.
7. Agregar dos imágenes por URL HTTP(S), con descripción y orden; marcar una como principal. Quitar una imagen y comprobar que desaparece inmediatamente.
8. Agregar un recurso GLB, GLTF, USDZ o imagen superpuesta mediante su URL. Comprobar que aparece y se puede quitar. La ejecución del probador virtual corresponde a otro ciclo.
9. Editar la prenda, desactivarla y verificar que ya no se muestra públicamente; activarla, eliminarla y restaurarla desde Mostrar eliminados.

## CU06 — Proveedores

1. Crear un proveedor con razón social, NIT y datos de contacto.
2. Buscarlo y editar sus datos. Desactivar, activar, eliminar y restaurar.
3. En una prenda, pestaña Proveedores, agregar proveedor, SKU, costo y marca Principal.
4. Editar esa asociación y agregar otro proveedor alternativo. No deben poder guardarse dos principales ni duplicar un proveedor.
5. Quitar una asociación y comprobar que las otras permanecen.

## CU08 — Organización

1. Crear una ciudad y luego una sucursal asociada.
2. Completar dirección, teléfono, coordenadas opcionales y horarios usando controles por día.
3. Crear una caja asociada a la sucursal. Filtrar cajas por sucursal.
4. Desactivar la sucursal: sus cajas quedan inactivas. Intentar activar una caja debe mostrar un conflicto.
5. Activar la sucursal y después su caja. Probar eliminación lógica y restauración.
6. En la página pública Sucursales, comprobar nombre, dirección, horarios y enlace de ubicación cuando haya coordenadas.

## CU07 — Consulta pública

1. Volver al catálogo. Buscar una prenda por texto y combinar categoría, temporada, colección, talla, color, marca y precios.
2. Marcar Solo destacadas. Los filtros deben reflejarse en la URL.
3. Limpiar filtros. Si hay suficientes registros, recorrer la paginación.
4. Abrir una prenda: seleccionar otra imagen y una variante. El precio alternativo debe respetarse, incluso si vale cero.
5. No deben mostrarse costos ni proveedores en la vista pública.

## CU01–CU02 — Cuenta de cliente

1. Salir y registrarse con datos nuevos. El registro solicita confirmar la contraseña y muestra los errores de validación.
2. Iniciar sesión con una cuenta de cliente y abrir Mi cuenta. No deben aparecer módulos de administración sin permisos.
3. Crear, editar y eliminar una dirección; elegir una como principal.
4. Cambiar la contraseña. La sesión local termina y se solicita un nuevo ingreso.
5. Solicitar recuperación y reenvío de verificación. En QA no salen correos: el test HTTP cubre la lectura y el uso de los tokens capturados. Para probar estos enlaces manualmente con correo real, configurar SMTP en el backend.
6. Abrir una ruta administrativa sin sesión: debe pedir login conservando el destino. Con un cliente sin permiso debe mostrar Acceso restringido.

## Bitácora y errores

1. Con el administrador, consultar la bitácora y abrir un evento. Filtrar acción, entidad, actor y fechas.
2. No debe haber botones para editar ni eliminar eventos.
3. Intentar un SKU, correo o NIT duplicado; mostrar el mensaje del servidor y conservar el formulario.
4. Navegar en celular y con teclado. Los diálogos deben retener el foco y cerrarse con Escape cuando no se está guardando.
5. Detener el backend para comprobar el mensaje de conexión y Reintentar.

## Verificación realizada

- Compilación de producción y pruebas automatizadas del frontend.
- 118 comprobaciones HTTP de CU01–CU08, direcciones, bitácora y autenticación contra una base temporal.
- Conexión real de lectura desde el proxy del frontend al backend local: catálogo disponible y vacío durante la revisión.
- Inspección visual de la portada y del formulario de login, en escritorio y portada móvil de 390 px.
- La prueba de ingreso administrativo en navegador quedó pendiente: la revisión automática rechazó el uso de las credenciales temporales sin autorización explícita. Los flujos HTTP se verificaron de forma aislada antes de ese rechazo.
