# Reservas de visitas: hallazgos, correcciones, pruebas y limitaciones

Revisión del flujo completo «elegir prendas para probar → agendar visita →
persistencia → seguimiento del cliente y del administrador» (CU-12, CU-13, CU-14).

## Cómo se prueba

```bash
# Backend (rutas reales, SQLite desechable creada por scripts/qa_backend.py)
cd backend_marketplace_moda
.venv\Scripts\python.exe -m pytest tests\ -q        # 31 pruebas verdes

# Frontend
cd frontend_marketplace_moda
ng test --watch=false                                # 83 pruebas verdes
npm run test:contract                                # 118 comprobaciones HTTP
ng build
```

## Hallazgos y su corrección

### A. Agregar a la visita sin visitar el backend (CONFIRMADO)
`addToTryOn()` solo tocaba `sessionStorage` (`fs-try-on-list`). Corrección:
- La cantidad por talla se elige en el detalle (1 a 10, recortada al rango) y se
  persiste con la entrada.
- Mensaje exacto al agregar: «Prenda añadida a tu selección. Elegí sucursal y
  horario para registrar la visita.» con las acciones «Revisar selección y
  agendar» y «Seguir explorando». Al cambiar de variante se limpia el mensaje.
- Límites compartidos con el backend (`MAX_TRYON_ITEMS=20`, `MIN/MAX_ITEM_QUANTITY`),
  verificados en el servicio (`wouldExceed`, `add` devuelve
  `added|quantity_updated|limit_items|limit_quantity`).

### B. Selección local sin registrar (CONFIRMADO)
La selección sigue siendo del lado del navegador, pero ahora:
- Se valida al cargar (`validEntry`) y se persiste con cantidades.
- Si `sessionStorage` falla, la lista vive en memoria con un aviso solo cuando
  afecta la experiencia (`memoryOnly`), y se recupera al poder persistir de nuevo.
- Contador en la cabecera: enlace persistente «Mi visita» distinto del carrito,
  que cuenta variantes distintas (no unidades), y el borrador se limpia al
  cerrar sesión o cambiar de cuenta (no se mezclan borradores en la pestaña).

### C. POST /reservations desde AgendarVisita (CONFIRMADO, correcto)
Sigue siendo el único punto de registro. `ReservasService.create()` ahora envía
`client_key` (idempotencia), y extrae `data` del envoltorio consistente con el
resto de la app. La confirmación exitosa navega a `/mi-cuenta/reservas?nueva=<id>`.

### D. Sin acceso persistente con contador (CONFIRMADO)
`/agendar-visita` solo era visible como enlace dentro del asistente (logged-in).
Corrección: enlace «Mi visita» fijo en la barra de navegación con contador de
variantes seleccionadas (hallazgo A). El contador es distinto del carrito.

### E. Éxito falso vía agendada=1 (CONFIRMADO)
`MisReservas` detectaba haber registrado la visita con `agendada=1`, y
`AgendarVisita` pasaba ese parámetro falso por la URL. Corrección:
- `agendada` quedó **eliminado** del flujo.
- La confirmación se muestra solo cuando `GET /reservations/{id}` (filtrado por
  dueño) devuelve la reserva recién creada; un parámetro `nueva` inventado da 404
  y no fabrica confirmación.
- `MisReservas` conserva los datos ante errores de recarga y distingue estado
  vacío de error, con paginación completa (página X de N).

### F. create() con commit y retorno (CONFIRMADO, correcto)
El backend persiste y devuelve la reserva (201). El riesgo era la doble
confirmación del cliente (E), no el manejo de commit — ahora con idempotencia.

### G. Disponibilidad solo por stock>0 (CONFIRMADO)
`ConsultarDisponibilidad` respondía «disponible» con cualquier stock>0.
Corrección: compara stock contra la cantidad pedida (`available = publicada and
cantidad >= pedido`), devuelve `requested` y un `reason` diferenciado
(«Sin unidades…», «Solo hay N unidad(es) y pediste M.», «La prenda ya no está
publicada.»). El backend rechaza la reserva con el detalle si no alcanza, y en
el formulario cada fila muestra «Disponible · N» o el motivo (estado
Sin consultar / Consultando / Error de consulta).

### H. Sin token de invalidación (CONFIRMADO)
Las respuestas de disponibilidad podían pisarse al cambiar sucursal o selección.
Corrección: cada consulta incrementa un `requestId`; una respuesta tardía que ya
no corresponda se descarta (`current !== this.requestId`). Igual en el panel
administrativo al cambiar filtros.

### I. Submit sin validaciones ni protección doble envío (CONFIRMADO)
- `canConfirm()` exige: prendas, sucursal, horario futuro (regla unificada con el
  backend y timezone Bolivia mostrada al usuario), estado de consulta resuelto y
  todas las variantes disponibles.
- El botón se deshabilita mientras `busy()`; el `client_key` idempotente nace en
  el primer envío y se conserva para reintentos del mismo intento (un fallo de
  red no duplica la visita), y se regenera tras confirmar con éxito.
- Se sigue validando del lado del servidor: `validar_horario`, límites tras la
  fusión de repetidos (≤20 variantes distintas, ≤10 unidades por talla), y stock
  por cantidad.

### J. Sin paginación (CONFIRMADO)
- `MisReservas`: paginación con total de páginas y verificación real de
  confirmación.
- `AdminReservas`: paginación (página X de N), columnas N.º/Fecha/Cliente/
  Sucursal/Prendas/Estado/Acciones, filtros de búsqueda (cliente, email, id),
  sucursal, estado y rango de fechas que vuelven a página 1 y descartan
  respuestas viejas (H). El backend admin filtra y ordena
  (`q`, `date_from`, `date_to`, `order`, `direction`) sin N+1 (enriquecido por
  lotes: `branch_name`, `user_name` = first+last, `user_email`).

### K. Errores con detail que no se mostraban (CONFIRMADO)
`errors.ts` solo leía `error.message/error.details`. Ahora soporta el envoltorio
propio y el `detail` de FastAPI/HTTPException (string o lista `{loc,msg,type}`),
mostrando el mensaje del servidor y el detalle de cada campo.

## Limitaciones
- La lista de prendas es del lado del cliente (sessionStorage); no hay borrador
  en el backend. Si el usuario cierra la pestaña, se pierde (aviso solo con
  `memoryOnly`; con storage normal persiste en sessionStorage).
- Migración `20260916_0006` (columna `client_key` + unique) creada pero no
  ejecutada contra la base real; `qa_backend.py` la cubre con
  `create_all()` (no se tocó producción).
- El horario se interpreta en hora local del navegador (GMT-04:00 Bolivia se
  muestra al usuario); el backend la recibe en UTC y exige futuro.
- El panel de administración no ofrece edición de horario/ítems: el admin
  confirma, prepara, atiende o cancela.