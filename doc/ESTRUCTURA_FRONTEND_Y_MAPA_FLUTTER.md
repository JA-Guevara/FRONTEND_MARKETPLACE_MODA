# Estructura real del frontend y mapa para Flutter

Revisión local: 16 de septiembre de 2026. Inventario de archivos, rutas y servicios; no constituye una prueba funcional ni una validación del despliegue. No se modificó código de Angular ni Flutter en esta revisión.

## 1. Proyectos existentes

Los tres proyectos son carpetas hermanas:

```text
Primer Examen Parcial/
├── backend_marketplace_moda/     # Backend existente
├── frontend_marketplace_moda/    # Angular 22
└── mobile_marketplace_moda/      # Flutter inicial
```

El móvil ya tiene `pubspec.yaml`, carpetas de plataforma y `lib/main.dart`. Su pantalla actual es la demostración del contador de Flutter; todavía no implementa los módulos de FashionStore. No confundir una carpeta de plataforma generada con una integración probada.

## 2. Árbol real del frontend

Se omiten dependencias, compilados, pruebas `*.spec.ts`, archivos `.gitkeep` y configuración de herramientas. Las carpetas sin lógica se identifican expresamente.

```text
frontend_marketplace_moda/
├── doc/                         # Documentación funcional y continuidad
├── docs/                        # Otra carpeta de documentación existente
├── public/
├── angular.json
├── package.json
├── proxy.conf.json
├── proxy.qa.conf.json
└── src/
    ├── app/
    │   └── core/
    │       ├── app.ts
    │       ├── app.html
    │       ├── app.scss
    │       ├── app.config.ts
    │       ├── app.routes.ts
    │       ├── shared/
    │       │   ├── api.service.ts
    │       │   └── resources.ts
    │       └── layout/
    │           ├── site-layout.component.ts
    │           ├── admin-layout.component.ts
    │           ├── admin-home.component.ts
    │           └── status-page.component.ts
    ├── features/
    │   ├── auth/
    │   │   ├── domain/password.ts
    │   │   ├── application/session.service.ts
    │   │   ├── infrastructure/auth.interceptor.ts
    │   │   └── presentation/
    │   │       ├── auth.guard.ts
    │   │       ├── auth-page.component.ts
    │   │       ├── account-layout.component.ts
    │   │       └── account-page.component.ts
    │   ├── usuarios-catalogo/
    │   │   ├── domain/catalog.models.ts
    │   │   ├── application/resources.ts
    │   │   ├── infrastructure/catalog.service.ts
    │   │   └── presentation/
    │   │       ├── catalog-page.component.ts
    │   │       ├── product-page.component.ts
    │   │       ├── product-editor.component.ts
    │   │       └── audit-page.component.ts
    │   ├── inventario-sucursales/
    │   │   ├── domain/branch.ts
    │   │   ├── application/resources.ts
    │   │   ├── infrastructure/branches.service.ts
    │   │   └── presentation/branches-page.component.ts
    │   ├── reservas-vestidor/
    │   │   ├── domain/reservas.models.ts
    │   │   ├── application/try-on-list.service.ts
    │   │   ├── infrastructure/reservas.service.ts
    │   │   └── presentation/
    │   │       ├── nueva-reserva.component.ts
    │   │       ├── mis-reservas.component.ts
    │   │       ├── admin-reservas.component.ts
    │   │       ├── vestidor.component.ts
    │   │       ├── reservas.scss
    │   │       └── vestidor.scss
    │   ├── ventas-pagos/
    │   │   ├── domain/commerce.models.ts
    │   │   ├── application/cart-state.service.ts
    │   │   ├── infrastructure/commerce.service.ts
    │   │   └── presentation/
    │   │       ├── cart-page.component.ts
    │   │       ├── orders-page.component.ts
    │   │       ├── stock-page.component.ts
    │   │       ├── assistant-widget.component.ts
    │   │       └── commerce.scss
    │   ├── ia-reportes/
    │   │   ├── domain/
    │   │   │   ├── dashboard.ts
    │   │   │   └── dashboard.helpers.ts
    │   │   ├── application/     # Solo .gitkeep
    │   │   ├── infrastructure/dashboard.service.ts
    │   │   └── presentation/
    │   │       ├── dashboard.component.ts
    │   │       ├── trend-chart.component.ts
    │   │       ├── bar-chart.component.ts
    │   │       ├── pie-chart.component.ts
    │   │       └── data-table.component.ts
    │   ├── productos/          # Cuatro capas con .gitkeep; sin lógica
    │   ├── pedidos/            # Cuatro capas vacías
    │   ├── pagos/              # Cuatro capas vacías
    │   └── usuarios/           # Cuatro capas vacías
    ├── shared/
    │   ├── models.ts
    │   ├── errors.ts
    │   ├── form-schema.ts
    │   ├── resource-page.component.ts
    │   ├── entity-form.component.ts
    │   ├── image-form.component.ts
    │   ├── product-images.component.ts
    │   ├── bulk-excel.component.ts
    │   ├── dialog-focus.directive.ts
    │   ├── icon.component.ts
    │   ├── bot-avatar.component.ts
    │   └── assistant-context.service.ts
    ├── environments/
    │   ├── environment.ts
    │   ├── environment.qa.ts
    │   └── environment.prod.ts
    ├── assets/
    │   ├── favicon.svg
    │   └── prenda-demo.svg
    ├── main.ts
    ├── index.html
    └── styles.scss
```

Muchos componentes contienen su plantilla y estilos dentro del archivo TypeScript. La ausencia de un HTML separado no indica que falte la pantalla.

## 3. Distribución funcional real

| Funcionalidad | Ubicación activa |
|---|---|
| Acceso, registro, verificación, recuperación, perfil y seguridad | `auth` |
| Catálogo público, prendas, variantes y recursos | `usuarios-catalogo` |
| Usuarios, roles, permisos y referencias de catálogo | Configuraciones en `usuarios-catalogo/application/resources.ts` y componentes genéricos de `shared` |
| Bitácora | `usuarios-catalogo/presentation/audit-page.component.ts` |
| Sucursales públicas, proveedores, ciudades, sucursales y cajas administrativas | `inventario-sucursales` y componentes genéricos |
| Selección provisional, reservas y probador | `reservas-vestidor` |
| Carrito, pedidos de cliente y administrador, pagos y existencias | `ventas-pagos` |
| Asistente flotante | `ventas-pagos/presentation/assistant-widget.component.ts` |
| Contexto compartido del asistente | `shared/assistant-context.service.ts` |
| Dashboard, gráficos y reportes | `ia-reportes` |
| Excel, formularios e imágenes reutilizables | `shared` |

No trasladar las carpetas vacías como si fueran módulos terminados. Tampoco duplicar pedidos o stock: hoy su implementación está en `ventas-pagos`.

## 4. Pantallas y rutas actuales

| Ruta web | Pantalla |
|---|---|
| `/` | Catálogo |
| `/prendas/:slug` | Detalle de prenda |
| `/prendas/:slug/vestidor` | Probador |
| `/sucursales` | Sucursales públicas |
| `/iniciar-sesion` | Acceso |
| `/registrarse` | Registro |
| `/recuperar-contrasena` | Recuperación |
| `/verificar-correo` | Verificación |
| `/reenviar-verificacion` | Reenvío de verificación |
| `/carrito` | Carrito y flujo de compra |
| `/reservar` | Nueva reserva |
| `/mi-cuenta` | Perfil |
| `/mi-cuenta/direcciones` | Direcciones |
| `/mi-cuenta/pedidos` | Pedidos propios |
| `/mi-cuenta/reservas` | Reservas propias |
| `/mi-cuenta/seguridad` | Cambio de contraseña |
| `/admin` | Inicio administrativo |
| `/admin/dashboard` | Dashboard y reportes |
| `/admin/pedidos` | Pedidos y pagos administrativos |
| `/admin/stock` | Existencias |
| `/admin/products/:id` | Editor de recursos de prenda |
| `/admin/reservas` | Gestión de reservas |
| `/admin/bitacora` | Auditoría |
| `/sin-acceso` | Acceso denegado |

`/cambiar-contrasena` redirige a `/mi-cuenta/seguridad`. Existe una ruta comodín para páginas desconocidas.

Además, `app.routes.ts` genera rutas `/admin/{key}` mediante recursos configurables. Claves actuales: `users`, `roles`, `permissions`, `products`, `categories`, `sizes`, `colors`, `seasons`, `collections`, `suppliers`, `cities`, `branches`, `cash-points`.

Estas rutas usan `resource-page.component.ts` y esquemas de formularios; no hay un componente independiente por cada tabla. El detalle de los campos y permisos vive en los dos archivos `application/resources.ts`.

## 5. Contratos que debe conservar el móvil

La URL de producción configurada en Angular es `https://backendmarketplacemoda-production.up.railway.app/api/v1`. Su presencia en configuración no prueba conectividad actual. Configurar el móvil por ambiente y mantener las claves privadas de IA y pagos en el backend.

| Servicio web | Prefijo o recurso utilizado |
|---|---|
| Sesión | `/auth/*`, con tokens Bearer y renovación |
| Catálogo | `/catalog/products`, `/catalog/products/{slug}`, referencias y `/catalog/admin/*` |
| Sucursales públicas | `/public/branches` |
| Organización administrativa | `/organization/*` |
| Direcciones propias | `/users/me/addresses` |
| Comercio | `/commerce/*` |
| Reservas | `/reservations`, disponibilidad y administración bajo ese prefijo |
| Dashboard | `/analytics/*` |

Revisar el backend y su esquema OpenAPI para tipos, campos obligatorios y errores antes de implementar cada cliente Dart. La tabla es un mapa, no la especificación completa de la API.

Detalles comprobados en el cliente web:

- Respuesta habitual: `{ success, message, data }`. Archivos de exportación no usan necesariamente ese formato.
- Paginación compartida: `{ items, total, page, page_size, pages }`. Pedidos de comercio usan listas con `limit/offset`; no imponer una única forma a todos los endpoints.
- Login devuelve `access_token`, `refresh_token`, `expires_in` y `user`.
- La web conserva tokens en memoria y comparte una renovación en curso. Diseñar explícitamente la persistencia móvil y el almacenamiento protegido si se conserva sesión.
- Los permisos se extraen de roles y permisos activos. Ocultar botones no sustituye autorización del servidor.
- Parámetros de lista se envían repetidos, no unidos por comas. Reservas utiliza listas alineadas de variantes y cantidades para disponibilidad.
- La creación de reservas envía `client_key` para idempotencia. Conservar la misma clave al reintentar el mismo intento.
- La lista provisional de visita usa `sessionStorage` en la web; todavía no es una reserva guardada.
- El checkout obtiene una URL del servidor, valida HTTPS y el host `checkout.stripe.com`, y luego navega. En móvil se necesita resolver apertura y retorno, y consultar el estado real del pedido.

## 6. Estructura propuesta para Flutter — todavía no creada

Mantener inicialmente los seis módulos activos facilita comparar la aplicación móvil con la web. Los nombres de carpetas y archivos Dart se expresan con guiones bajos.

```text
mobile_marketplace_moda/
├── lib/
│   ├── main.dart
│   ├── app/
│   │   ├── app.dart
│   │   ├── router/app_router.dart
│   │   ├── theme/app_theme.dart
│   │   └── layout/
│   │       ├── customer_shell.dart
│   │       └── admin_shell.dart
│   ├── core/
│   │   ├── config/app_config.dart
│   │   ├── network/
│   │   │   ├── api_client.dart
│   │   │   └── auth_interceptor.dart
│   │   ├── storage/token_store.dart
│   │   ├── errors/app_exception.dart
│   │   └── permissions/permission_service.dart
│   ├── shared/
│   │   ├── models/
│   │   │   ├── api_response.dart
│   │   │   └── paginated_response.dart
│   │   └── widgets/
│   │       ├── loading_indicator.dart
│   │       ├── empty_state.dart
│   │       ├── error_state.dart
│   │       ├── product_image_carousel.dart
│   │       └── confirmation_dialog.dart
│   └── features/
│       ├── auth/
│       ├── usuarios_catalogo/
│       ├── inventario_sucursales/
│       ├── reservas_vestidor/
│       ├── ventas_pagos/
│       └── ia_reportes/
├── assets/
├── test/
├── integration_test/
├── doc/
└── pubspec.yaml
```

Patrón propuesto para cada módulo:

```text
feature/
├── domain/             # Entidades y contratos de repositorio
├── application/        # Casos de uso y estado de la funcionalidad
├── infrastructure/     # Adaptadores HTTP, DTO y repositorios concretos
└── presentation/
    ├── pages/          # Pantallas
    └── widgets/        # Componentes específicos
```

No se seleccionaron ni instalaron paquetes Flutter en esta revisión. La elección de navegación, estado, HTTP, cámara, voz y almacenamiento deberá comprobar compatibilidad con el proyecto antes de implementarse.

## 7. Traducción conceptual Angular → Flutter

| Fuente web | Equivalente por desarrollar |
|---|---|
| Componentes de página y plantillas | Pantallas y widgets Dart |
| SCSS y variables visuales | Tema, espaciados y composición adaptable |
| `app.routes.ts` | Navegación móvil y protección de rutas |
| `ApiService` | Cliente HTTP compartido |
| Servicios de cada módulo | Repositorios y adaptadores del mismo backend |
| Interfaces TypeScript | Modelos Dart y serialización |
| Signals y servicios de estado | Estado móvil observable, según la solución elegida |
| Guards y `session.can()` | Protección de navegación y capacidades visibles |
| Esquemas `Resource` y `Field` | Definiciones y formularios móviles equivalentes |
| `sessionStorage`, DOM y APIs del navegador | Adaptadores específicos de la plataforma |

Se reutilizan el backend, los contratos y las reglas de negocio; las interfaces Angular, sus plantillas y SCSS deben reimplementarse en Dart. El probador con cámara, voz, manejo de archivos, enlaces de verificación y retorno de pagos requieren adaptación propia y pruebas en dispositivo.

## 8. Orden propuesto de construcción

1. Configuración, tema, navegación, cliente HTTP, errores y sesión.
2. Catálogo, búsqueda, detalle, imágenes y selección de variantes.
3. Carrito, dirección, pedido, checkout y seguimiento.
4. Sucursales y reservas con disponibilidad e idempotencia.
5. Probador móvil: definir y comprobar cámara y visualización, sin prometer seguimiento corporal por copiar la web.
6. Asistente con los contratos que efectivamente tenga el backend en ese momento.
7. Administración, reportes y Excel según el alcance móvil acordado; no considerarlos portados por existir en la web.

En cada etapa verificar carga, error, datos vacíos, permisos, sesión vencida, navegación de retorno y adaptación de pantalla. Mantener un mapa web → móvil con estado por pantalla. No marcar una funcionalidad como terminada sin probar su operación real.
