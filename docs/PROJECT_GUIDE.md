# FashionStore Frontend — guía del proyecto

## 1. Qué es

Aplicación web en Angular 22 con componentes independientes y señales. Cubre **las dos caras** del sistema:

- **Tienda pública y cuenta del cliente**: catálogo, ficha de prenda, probador virtual, carrito, compra, pedidos con seguimiento, devoluciones, reservas, perfil y direcciones.
- **Panel de administración**: catálogo, usuarios y roles, sucursales y cajas, proveedores, existencias, pedidos y pagos, caja, reservas, devoluciones, bitácora y el tablero de reportes.

El catálogo es la página de inicio: no hay pantalla de login como puerta de entrada. La sesión se pide recién cuando la operación es personal o administrativa, igual que en el backend.

## 2. Organización del código

Un `feature` por módulo del backend, con las mismas cuatro capas. Buscar algo lleva al mismo lugar en los tres proyectos.

```
src/
  app/core/            layout, rutas, interceptores y api.service
  environments/        local · qa · producción
  features/<módulo>/
    domain/            modelos y funciones puras, sin Angular
    infrastructure/    servicios HTTP
    application/       estado con señales
    presentation/      componentes
  shared/              iconos, formularios por esquema, pose y dibujo de prendas
  styles.scss          hoja global
```

Features con código: `auth`, `usuarios-catalogo`, `ventas-pagos`, `reservas-vestidor`, `inventario-sucursales`, `ia-reportes`. Las carpetas vacías que habían quedado de un andamiaje inicial (`pagos`, `pedidos`, `productos`, `usuarios`, `app/layout` y seis subcarpetas de `shared/`) se eliminaron.

**La lógica que se puede verificar sin navegador vive en `domain/`**: `order-progress.ts` decide las etapas del pedido, `catalog.models.ts` decide si una prenda tiene probador, `garment-renderer.ts` dibuja la prenda. Son funciones puras con sus propias pruebas; el componente solo las muestra.

## 3. A qué backend apunta

```ts
// src/environments/environment.ts        → local, vía proxy a 127.0.0.1:8000
// src/environments/environment.qa.ts     → QA
// src/environments/environment.prod.ts   → Railway
```

```powershell
npm start                    # local, proxy al backend en 127.0.0.1:8000
npm run start:qa             # QA, proxy al backend en 127.0.0.1:8011
npm run build                # producción (Railway)
```

En desarrollo, `apiUrl` es `/api/v1` y el proxy de Angular redirige al backend; así no hay CORS en local ni una URL absoluta quemada en el código.

## 4. Sesión y permisos

El **access token** vive en memoria y muere al cerrar la pestaña. El **refresh token** se guarda en `sessionStorage`, no en `localStorage`: no sobrevive al cierre del navegador.

`auth.interceptor.ts` agrega el bearer y, ante un `401`, renueva **una sola vez** y reintenta. Si el reintento vuelve a fallar, limpia la sesión y manda a iniciar sesión conservando a dónde iba.

`session.can('permiso')` oculta lo que el servidor va a rechazar igual. Es comodidad de interfaz, nunca seguridad: la autorización real está en el backend.

## 5. Rutas

| Ruta | Quién entra |
|---|---|
| `/` · `/prendas/:slug` · `/sucursales` | Público |
| `/iniciar-sesion` · `/registrarse` · `/recuperar-contrasena` · `/verificar-correo` | Público |
| `/carrito` · `/reservar` · `/prendas/:slug/vestidor` | Cliente con sesión |
| `/mi-cuenta` · `/mi-cuenta/direcciones` · `/mi-cuenta/pedidos` · `/mi-cuenta/reservas` · `/mi-cuenta/seguridad` | Cliente con sesión |
| `/admin/...` | Según el permiso de cada sección |

Cada ruta administrativa declara su permiso en `data.permission` y el guardia lo verifica antes de cargar el componente.

## 6. Decisiones que conviene conocer

**Formularios por esquema.** Las pantallas de administración (usuarios, roles, catálogo, sucursales, proveedores, cajas) no tienen un componente cada una: se describen como datos en `resources.ts` —campos, validaciones, secciones, búsquedas— y `resource-page.component.ts` las construye. Agregar un campo es agregar una línea, no una pantalla.

**Formularios largos por secciones.** Un formulario de prenda tiene demasiados campos para una sola columna, así que se divide en secciones con nombre y se recorre por pasos. El error de validación lleva a la sección donde está.

**Estilos de componentes hijos.** Angular encapsula los estilos por componente: la hoja de un componente **no** alcanza el DOM interno de sus hijos. Por eso el seguimiento y las devoluciones tienen su propia hoja (`order-tracking.scss`), compartida por `fs-order-tracker` y `fs-order-returns`, en vez de depender de la hoja de la página que los contiene.

**Listas como parámetros repetidos.** `api.service.ts` manda los arreglos como `?id=a&id=b`, que es lo que espera FastAPI. Unirlos por coma llegaba como un valor único e inválido.

**Fechas locales.** Un `datetime-local` trabaja en hora local; `toISOString()` devuelve UTC. Mezclarlos corría el horario mínimo de una reserva cuatro horas en Bolivia. Las fechas de formulario se ajustan con el desfase del navegador.

**Asistente por voz.** Lo dictado se transcribe en el servidor y se enruta con el mismo detector de
intención que lo escrito (`assistant-intent.ts`): «exportame un reporte en PDF» dispara la
exportación, y «cómo exporto un reporte» sigue siendo una pregunta. El detector ya toleraba las
variantes del dictado; lo que fallaba era la transcripción, que ante silencio devolvía una frase
inventada por el modelo y el asistente la respondía como si fuera un mensaje. Ese filtro vive en el
backend, y acá se muestra el aviso.

**Probador virtual: la prenda se deforma, no se pega.** La foto preparada del catálogo no se
superpone como imagen: se usa como **relleno del polígono** que ya seguía hombros, codos, muñecas y
caderas. La foto se reparte en una malla de 4×6 celdas y cada celda se estira, triángulo a
triángulo, hasta la parte del cuerpo que le toca (`garment-texture.ts`). Antes la foto se colocaba
con mover, rotar y escalar: con cuatro parámetros no existe deformación posible, y por eso se veía
como una calcomanía.

Dos detalles que costaron: recortar no es deformar —clipar la foto contra la silueta la deja
intacta y en un cuerpo angosto le corta las mangas—, y cada triángulo recortado contra su propio
borde deja un hilo transparente que agrieta la prenda como un mosaico; se resuelve solapando cada
pieza 0,6 px. Toda la matemática está en funciones puras con pruebas: afín entre triángulos, malla,
solape y encuadre.

Sin foto preparada se dibuja la silueta con el color de la variante, y la vista lo dice.

**Probador virtual.** No superpone la fotografía del catálogo: dibuja la prenda a partir de los puntos del cuerpo que detecta MediaPipe. Eso evita el problema del fondo blanco de raíz —no hay foto que recortar— y permite que la prenda siga al cuerpo. Cuando el producto sí tiene un recurso preparado por el backend, se usa esa imagen con sus anclajes.

**Ubicación en el mapa.** El formulario de sucursal tiene un campo `type: 'map'` que escribe sobre `latitude` y `longitude`: el mapa es una forma más cómoda de llenarlos, no un dato nuevo, y quien prefiera tipear los números sigue pudiendo. Usa Leaflet con mapas de OpenStreetMap, cargado **bajo demanda** para que solo lo pague quien abre ese formulario. El marcador se dibuja con CSS porque los PNG de Leaflet se referencian por ruta relativa y se rompen al empaquetar. La lógica que puede fallar —coordenadas fuera de rango, longitudes que dieron la vuelta al mundo, respuestas del buscador de direcciones— vive en `geo.ts`, en funciones puras con sus pruebas.

**Campanita de avisos.** En la barra superior, solo con sesión iniciada. Muestra compras, reservas y devoluciones con los mismos textos que los correos. Lo leído se recuerda con la fecha del último aviso visto, en el navegador: evita una tabla, a cambio de que el punto rojo sea por dispositivo.

**Bandejas de gestión.** `/admin/pedidos` y `/admin/devoluciones` filtran por estado, sucursal,
canal y número o correo, y vuelven a la primera página con cada filtro nuevo. Un pedido muestra si
viene de caja y si tiene una devolución sin resolver; una devolución muestra de qué pedido y de
quién es, con un resumen de cuántas esperan decisión y cuánto dinero comprometen. Sin eso, ambas
listas dejan de servir apenas hay movimiento real.

**Punto de venta.** `/admin/caja` se diseñó con otro criterio que el resto del panel: el cajero
atiende con el cliente enfrente, así que prioriza velocidad sobre densidad. Enter en el buscador
agrega el SKU exacto —eso es todo lo que hace falta para un lector de código de barras—, el total se
lee de lejos y, al cobrar en efectivo, el vuelto se calcula y se muestra en grande. Tiene dos
pestañas: **Vender** y **Devolver**.

**Seguimiento del pedido.** `order-progress.ts` traduce `status`, `payment_status` y el historial a etapas con nombre y fecha. Un pedido cancelado o vencido no muestra etapas futuras como pendientes.

**Asistente por voz.** El botón del micrófono graba una nota de voz, como un chat: mientras graba se ve una burbuja con ondas, duración y, cuando el navegador lo ofrece, las palabras reconocidas en tiempo real. Tras detectar que la persona terminó de hablar, cierra y envía la nota automáticamente; también se puede tocar el micrófono para enviarla antes. El backend transcribe el audio y usa ese texto como una consulta normal; la detección local sólo mejora la vista y el audio enviado al servidor es el respaldo. Así puede responder, exportar, aplicar filtros o preparar un borrador con los mismos permisos que el chat escrito. El audio no queda guardado. Si el navegador bloquea el micrófono, no hay dispositivo o falla la transcripción, el chat explica la causa. Requiere permiso de micrófono y `AI_API_KEY`; `AI_TRANSCRIPTION_MODEL` permite configurar el modelo de transcripción, con `whisper-1` como respaldo.

**Gestión mediante el asistente.** Las órdenes administrativas no pasan directamente del lenguaje natural a la base de datos. `assistant-actions.ts` mantiene el registro cerrado de acciones, cada una con módulo, permiso, riesgo y parser comprobable. Cubre reportes, usuarios, catálogo, inventario, proveedores, sucursales, reservas, pedidos, pagos, devoluciones, promociones y recursos del vestidor. Las lecturas se consultan con los endpoints reales; las altas abren borradores editables; los cambios de estado, inventario, transportista, roles, activaciones y desactivaciones muestran una tarjeta de confirmación. Las eliminaciones y devoluciones piden además el identificador exacto. Para usuarios, la contraseña inicial se ingresa manualmente y se seleccionan los roles antes de crear la cuenta. Las acciones quedan sujetas a los mismos permisos y bitácora que sus formularios de administración.

## 7. Adaptación a la pantalla

Se revisó vista por vista, no con reglas generales:

- Debajo de 620px la línea de tiempo del pedido pasa de horizontal a vertical: cinco etapas no entran de lado en un teléfono.
- Las acciones de fila en las tablas de administración se vuelven solo icono cuando la columna se comprime.
- La barra de filtros del catálogo se colapsa en teléfono y queda al alcance, no al final de la página.
- El texto usa `overflow-wrap: break-word`: con `anywhere` las palabras se partían por la mitad.

## 8. Pruebas

```powershell
npm run test:ci      # 351 pruebas
npm run build        # compilación de producción
```

Se prueba lo que puede romperse en silencio: la lógica de `domain/`, el retorno del pago de Stripe, el panel de devoluciones, los formularios por esquema y el dibujo de la prenda. `npx vitest` no sirve: las globales las provee el constructor de pruebas de Angular, así que hay que usar `npm run test:ci`.

`docs/PRUEBAS_CICLO_1.md` conserva el detalle de las pruebas del ciclo I.

## 9. Qué falta

1. Prueba punta a punta contra la base real, con una cuenta de cliente y una de administración.
2. El probador nunca se probó con una persona frente a la cámara; la lógica sí está cubierta por pruebas.
3. Las vistas de devolución dependen de las migraciones `0011` y `0012` del backend: hasta aplicarlas responden error.
