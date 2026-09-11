# Dashboard comercial — 10/09/2026

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
