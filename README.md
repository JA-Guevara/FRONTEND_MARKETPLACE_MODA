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

## Producción

`npm run build` genera `dist/browser`. El servidor web debe servir `index.html` para rutas del frontend y reenviar `/api/v1` al backend. La compilación reemplaza el archivo de ambiente por `environment.prod.ts`. El proxy de Angular solo funciona durante desarrollo; no forma parte de la compilación publicada.

## Fuente documental

Se revisaron la guía, el contrato, los esquemas y las rutas del backend actualizado. El documento Word externo indicado por el usuario permanecía bloqueado por otra aplicación durante la implementación; falta contrastar directamente esa copia cuando esté disponible. No se modificó el documento.
# FRONTEND_MARKETPLACE_MODA
