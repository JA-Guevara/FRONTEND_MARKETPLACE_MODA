# FashionStore — Frontend del ciclo I

Aplicación Angular con catálogo público, acceso de clientes y administración por permisos. Implementa el ciclo I (CU01–CU08) definido en `../backend_marketplace_moda/docs/PROJECT_GUIDE.md` y utiliza el contrato de `API_CONTRACT.md` y las rutas FastAPI actuales.

## Probar con el backend configurado

Desde esta carpeta:

```powershell
npm install
npm start
```

Si las dependencias ya están instaladas, basta `npm start`.
Abrir http://localhost:4200. El proxy envía `/api/v1` a `http://127.0.0.1:8000`.

El backend debe estar iniciado con su base migrada:

```powershell
# En otra terminal, desde backend_marketplace_moda
.venv\Scripts\python.exe -m uvicorn src.main:app --reload --port 8000
```

Las instrucciones de migraciones y creación del primer administrador están en `../backend_marketplace_moda/docs/PROJECT_GUIDE.md`. Este frontend no crea administradores ni aplica migraciones sobre tu base automáticamente.

## Probar todo sin modificar la base real

```powershell
npm run start:qa
```

Abrir http://127.0.0.1:4201. El encabezado indica **ENTORNO DE PRUEBA · DATOS TEMPORALES**.

| Cuenta de prueba | Correo | Contraseña de prueba |
|---|---|---|
| Administrador | qa-admin@example.com | PruebaCicloUno!2026 |
| Cliente | qa-client@example.com | PruebaCicloUno!2026 |

Estas credenciales existen únicamente en la base de datos temporal del servidor QA. No sirven para tu backend normal. El entorno incluye una prenda, talla, color, categoría y sucursal de ejemplo. Los cambios se descartan al detener QA. Escucha solo en la computadora local, en los puertos 8011 y 4201. Los correos se capturan en memoria y no se envían.

Requiere el entorno Python ya instalado en el backend vecino y `npm install` en esta carpeta. Si PowerShell impide ejecutar scripts por una política local, iniciá manualmente dos terminales:

```powershell
# Terminal 1, desde frontend_marketplace_moda
..\backend_marketplace_moda\.venv\Scripts\python.exe scripts\qa_backend.py

# Terminal 2, desde frontend_marketplace_moda
npm start -- --configuration qa --host 127.0.0.1 --port 4201 --proxy-config proxy.qa.conf.json
```

## Cobertura

- CU01: registro, política de contraseña, confirmación y verificación de correo.
- CU02: login, logout, renovación de tokens, recuperación, reenvío de verificación y cambio de contraseña.
- CU03: consulta y administración de usuarios, asignación de roles, estados, desbloqueo, eliminación lógica y restauración; roles y permisos completos.
- CU04: prendas, categorías, tallas, colores, precios, marca, variantes, SKU, códigos de barras, imágenes y recursos AR.
- CU05: temporadas, fechas, colecciones y asociaciones a prendas.
- CU06: proveedores, NIT, contacto, estados, restauración y asociación con costo/SKU/proveedor principal.
- CU07: portada pública, detalle por slug, imágenes, selección de variantes, precios, filtros combinables y paginación. Los filtros quedan en la URL.
- CU08: ciudades, sucursales, ubicación, horarios por día y cajas; listado público de sucursales.
- Complementos disponibles en el backend: direcciones del cliente y bitácora inmutable con filtros y detalle.

La guía de recorrido está en `docs/PRUEBAS_CICLO_1.md`. Los ciclos posteriores tienen carpetas reservadas; no se ofrecen operaciones de inventario, reserva, pago o IA sin API implementada.

## Estructura

```text
src/
  app/core/
    shared/                  # Cliente HTTP y composición de recursos
    layout/                  # Cabecera, administración y estados
    app.ts, app.html, app.scss
    app.config.ts, app.routes.ts, app.spec.ts
  features/
    auth/
      domain/                # Política de contraseña
      application/           # Estado y operaciones de sesión
      infrastructure/        # Interceptor HTTP
      presentation/          # Login, cuenta y guardas
    usuarios-catalogo/
      domain/                # Contratos de catálogo
      application/           # Configuración de recursos y formularios
      infrastructure/        # Acceso al catálogo público
      presentation/          # Catálogo, detalle, recursos y bitácora
    inventario-sucursales/
      domain/
      application/
      infrastructure/
      presentation/
    reservas-vestidor/        # Las cuatro capas preparadas
    ventas-pagos/            # Las cuatro capas preparadas
    ia-reportes/             # Las cuatro capas preparadas
  shared/                    # Formularios, tablas, diálogos, errores y contratos
  environments/              # Desarrollo, producción y QA
  assets/
  main.ts, index.html, styles.scss
scripts/                     # Entorno aislado y prueba HTTP reproducible
```

La administración comparte un motor de formularios y listados: cada módulo define campos, relaciones, permisos y rutas. Se evitan pantallas duplicadas por cada catálogo maestro. Los componentes se cargan por rutas para reducir el peso inicial.

## Comprobaciones

```powershell
npm run build
npm run test:ci
npm run test:contract
```

`test:contract` ejecuta las rutas y servicios reales del backend contra SQLite en memoria. Adapta únicamente las fechas de SQLite a UTC, para conservar el contrato de PostgreSQL, y captura correos. No prueba migraciones ni configuración SMTP/PostgreSQL del entorno real.

## Decisiones de integración

- Los tokens se conservan en memoria; no se escriben en localStorage. Recargar la página o abrir otra pestaña requiere ingresar nuevamente. La navegación dentro de la aplicación conserva la sesión y los 401 disparan una sola renovación compartida.
- El backend actual entrega tokens en JSON y no ofrece cookies HttpOnly. La persistencia segura entre recargas requiere ampliar ese contrato; no se simula desde el frontend.
- Las rutas y los botones usan permisos (`catalog.read`, `catalog.write`, etc.). El backend conserva la autoridad final de autorización y validación; un 403 se muestra al usuario.
- Los enlaces enviados por correo coinciden con `/verificar-correo?token=...` y `/recuperar-contrasena?token=...`. Para correos reales, configurar SMTP y `FRONTEND_URL` en el backend.
- Los recursos de prendas reciben URLs HTTP(S), como exige la API. No hay un endpoint de carga binaria de imágenes.
- Tras modificar variantes, imágenes, recursos AR o proveedores se consulta nuevamente el producto: algunas respuestas de mutación del backend conservan relaciones anteriores en la sesión ORM.
- Los errores conservan el formulario abierto y el borrador. Las acciones destructivas requieren confirmación dentro de la interfaz. Los diálogos permiten usar Tab y Escape.
- El borrado y los estados respetan las reglas del backend: no eliminar maestros en uso, no activar cajas de sucursales inactivas, no duplicar SKU ni talla/color.

## Perfil del cliente y direcciones

El cliente carga sus datos una vez y el checkout los reutiliza; antes había que reescribir la
dirección en cada pedido.

- **`/mi-cuenta`** concentra el perfil: datos personales editables y la lista de direcciones, cada
  una con su etiqueta, destinatario, dirección, ciudad y código postal. La predeterminada se
  distingue con una insignia y el resto ofrece «Usar como predeterminada» (un `PATCH` con
  `is_default: true`; el backend deja una sola activa).
- **`/mi-cuenta/direcciones`** mantiene el alta, edición y baja completas.
- **Checkout.** Al continuar con la compra se listan las direcciones guardadas con la
  predeterminada ya seleccionada y el formulario completo (destinatario, teléfono, dirección,
  ciudad, código postal y país). «Usar otra dirección» limpia el formulario y ofrece guardarla en el
  perfil para la próxima compra.
- **Código postal y país** se agregaron a la dirección guardada (migración `20260912_0004`), porque
  el pedido ya los pedía y la dirección del perfil no los tenía: esa era la razón de fondo por la
  que no se podían reutilizar.

## Formularios e interfaz

Los formularios de administración se generan desde `src/shared/form-schema.ts` y se dibujan con
`EntityFormComponent`. Un formulario largo se divide en pasos con nombre en lugar de mostrarse en
una sola columna interminable.

- **Secciones.** Cada campo puede declarar `section`. El asistente arma un paso por sección, en el
  orden en que aparecen. Los campos sin `section` heredan la del campo anterior. Si ningún campo
  declara sección, se agrupan de a seis por paso (comportamiento anterior).
- **Cómo declararlas.** El helper `section(nombre, campos)` de
  `src/features/usuarios-catalogo/application/resources.ts` marca un grupo completo:

  ```ts
  fields: [
    ...section('Identificación', [nameField, description]),
    ...section('Clasificación', [lookup('category_id', 'Categoría', ruta, true)]),
  ]
  ```

- **Cuándo dividir.** Solo los formularios largos usan secciones: prendas, usuarios, roles,
  proveedores, sucursales y direcciones. Los de pocos campos (tallas, colores, ciudades, cajas,
  temporadas, colecciones) se muestran en una sola pantalla, sin barra de pasos.
- **Validación por paso.** «Continuar» valida únicamente los campos del paso actual. Se puede
  volver a cualquier paso anterior con un clic; avanzar salteando pasos exige que los intermedios
  sean válidos. Al guardar, si algo quedó incompleto, el formulario salta al paso del primer campo
  con error en lugar de mostrar un mensaje sobre una sección oculta.
- **Secciones vacías.** Los campos `createOnly` desaparecen al editar; si una sección queda sin
  campos visibles, su paso no se dibuja.
- **Género del sustantivo.** `Resource.feminine` decide entre «Nuevo usuario» y «Nueva prenda».
- **Iconos.** `IconComponent` (`<fs-icon name="…" />`) dibuja los iconos de línea. Heredan el color
  y el tamaño del botón (`1.15em`), y el nombre puede ser dinámico: en la tabla, el botón de estado
  muestra un tilde, una cruz o una flecha según el registro esté inactivo, activo o eliminado.

### Reglas de adaptación a la pantalla

- La grilla de campos usa `repeat(auto-fit, minmax(230px, 1fr))`: acomoda dos columnas cuando hay
  espacio y una sola cuando no, sin depender de un punto de quiebre fijo.
- El panel admin se limita a `1400px` de ancho de contenido para que no se desparrame en monitores
  grandes.
- En el alta de prendas, por debajo de `800px` el formulario se ordena antes que el panel de
  imágenes: apilado al revés dejaba los campos fuera de la primera pantalla.
- Por debajo de `700px` las acciones de cada fila se reducen a iconos en una sola línea. El texto
  sigue en el DOM (`font-size: 0`), así que los lectores de pantalla lo siguen anunciando; sin esto
  cada fila medía unos 250px de alto.
- Las tablas angostas reservan `620px` de ancho mínimo y desplazan en horizontal dentro de su
  contenedor. Las celdas usan `overflow-wrap: break-word`, no `anywhere`, para que no se parta
  «Esenciale / s» a mitad de palabra.
- Los checkbox quedan excluidos de la regla que estira los controles de la barra de herramientas al
  100%: al estirarse empujaban su propia etiqueta fuera del recuadro.

### Catálogo público: filtros al alcance

Los filtros vivían en una columna lateral que aparecía después del hero y de la sección de
recomendados: había que bajar dos pantallas antes de poder filtrar.

- Son una **barra horizontal fija** (`form.filter-bar`, `position: sticky`) justo encima de la
  grilla, así siguen a la vista mientras se recorren las prendas. En móvil arrancan plegadas detrás
  del botón «Buscar y filtrar prendas».
- La grilla ocupa el ancho completo (`repeat(auto-fill, minmax(215px, 1fr))`): cinco prendas por
  fila en escritorio y dos en teléfono, con menos alto total de página.
- Los recomendados pasaron después de la grilla; el hero bajó de 450px a 320px de alto mínimo.
- Resultado medido: la portada pasó de 2847px a 2292px, y los filtros aparecen a los 615px.

Cuidado con la especificidad si se tocan estos estilos: `.filters form` (0,1,1) le gana a
`.filter-bar` (0,1,0), por eso las reglas se escriben como `.filters form.filter-bar`, y el plegado
móvil como `.filters.filters-collapsed form.filter-bar`.

### Densidad: una vista, una pantalla

Una pantalla de gestión no debería ocupar tres pantallas de alto. Las medidas tomadas, en orden de
impacto:

- **El menú lateral ya no define el alto de la página.** Con dieciséis accesos medía más de 1100px y
  estiraba toda la vista aunque la tabla midiera 200px. Por encima de 760px queda fijo
  (`position: sticky`), acotado a `100vh` y con desplazamiento propio. En móvil sigue siendo el menú
  horizontal desplegable, sin cambios.
- **Las tablas se desplazan dentro de su recuadro**, acotadas a `min(68vh, 680px)`, con el
  encabezado fijo. Treinta filas ya no estiran la página: el recuadro mantiene su alto.
- **Filas compactas.** El relleno de celda pasó de 16px a 9px 14px y los botones dentro de celdas
  (incluido «Ver detalle» de bitácora, que no está en `.row-actions`) bajaron a 30px de alto
  mínimo. Cada fila pasó de 94px a 49px.
- Encabezado de página y barra de filtros con menos aire (`margin-bottom` 28px → 18px; barra con
  12px de relleno).

Medido en bitácora: la página bajó de 1363px a 988px de alto, y la proyección con treinta filas pasó
de unos 2800px de tabla a 522px con desplazamiento interno.

## Producción

`npm run build` genera `dist/browser`. El servidor web debe servir `index.html` para rutas del frontend y reenviar `/api/v1` al backend. La compilación reemplaza el archivo de ambiente por `environment.prod.ts`. El proxy de Angular solo funciona durante desarrollo; no forma parte de la compilación publicada.

## Fuente documental

Se revisaron la guía, el contrato, los esquemas y las rutas del backend actualizado. El documento Word externo indicado por el usuario permanecía bloqueado por otra aplicación durante la implementación; falta contrastar directamente esa copia cuando esté disponible. No se modificó el documento.
# FRONTEND_MARKETPLACE_MODA
