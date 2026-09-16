# Dashboard comercial — 10/09/2026

## Actualización 16/09 — Asistente (Etapas 2 y 3)
- El widget de asistente exporta reportes vía la herramienta tipada
  `POST /analytics/assistant/execute` (en `dashboard.service.ts`, método `executeTool`),
  con `request_id` para repeticiones sin duplicar la bitácora.
- El dashboard aplica recomendaciones filtradas: el widget emite `applyRequest` cuando
  detecta sucursal/categoría/fecha; `DashboardComponent.applyFilterQuery` selecciona los
  filtros y recarga. Precisión SÍ/NO y estados "IA no disponible" honestos.
- Pruebas: dashboard + widget ✓ (ver suite completa de 120 pruebas abajo).

## Implementado
- Resumen en administración visible con permiso `dashboard.read`.
- Métricas reales desde `GET /analytics/dashboard`: ingresos cobrados, pedidos, catálogo y stock bajo.
- Ventas por día, cinco prendas más vendidas y distribución de estados; sin datos simulados ni tendencias inventadas.
- Actualización manual, estado de carga, error recuperable y vacíos explicativos.
- Recomendaciones solo tras pulsar el botón y cuando el servidor indica `ai_ready`. Ninguna solicitud externa automática.
- Cuatro tarjetas en escritorio, dos en móvil, reportes apilados bajo 1000 px, textos y cifras ajustables; estilos encapsulados.

## Arquitectura
`domain/dashboard.ts` define contrato, `infrastructure/dashboard.service.ts` usa el cliente API compartido, `presentation/dashboard.component.ts` presenta el resumen. `admin-home` conserva accesos de gestión.

## Límites explícitos
Las métricas son acumuladas. La serie incluye hasta 30 fechas **con ventas**, no un período fijo de 30 días. No se ofrecen filtros que el servidor no implementa. El conteo `customers` no se muestra porque actualmente cuenta todas las cuentas, incluidos administradores. Stock bajo cuenta registros por sucursal con menos de cinco unidades.

## Validación y pendientes
Pruebas del componente cubren vacío real, error y ausencia de llamadas automáticas a IA. Verificación visual con sesión administrativa queda pendiente; no se utilizaron claves ni se llamó IA real. Para próxima etapa: filtros por fecha/sucursal y exportación de reportes solo después de extender contrato y pruebas del servidor; comprobar visualmente 320, 768 y 1440 px en sesión autorizada.

## Actualización 2026-09-16 — exportación múltiple (Etapa 1)
- Panel "Exportar reportes" en el encabezado: multi-selección de los 6 reportes
  (con seleccionar todos / limpiar), botones Excel / PDF / CSV y un resumen de los
  **filtros visibles** que llevará el archivo; el botón queda deshabilitado sin
  selección y ninguna exportación sale con filtros distintos a los visibles.
- `dashboard.service.ts.exportMultiple` hace `POST /analytics/reports/export-multiple`
  (blob) y lee `Content-Disposition` para el nombre y `X-Export-Truncated` para la
  advertencia honesta de límite de filas ("revisa el detalle en el archivo").
- La espera se muestra como tres puntos compactos animados (`.busy`), sin overlay.
- Se mantiene el endpoint individual (`exportUrl`) retrocompatible; el botón
  "Ver detalle y exportar existencias" ahora abre el panel con existencias
  preseleccionada.
- Pruebas: 3 tests nuevos en `dashboard.component.spec.ts` (bloqueo sin selección,
  solicitud única con filtros visibles y aviso de truncamiento, resumen honesto).
  `npm run test:ci` → 108 passed; `ng build` completo (warning de presupuesto de
  estilos del componente ya existente, por debajo del límite de error).
