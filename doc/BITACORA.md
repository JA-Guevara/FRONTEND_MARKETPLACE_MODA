# Bitácora — estado al 10/09/2026

Tabla principal: N.º, Fecha, Actor (nombre y correo), Acción, Entidad, Descripción e IP. N.º es posición dentro del resultado filtrado y paginado; no es identificador permanente. El UUID estable está en el detalle.

Filtro de actor por nombre/correo mediante actor_query, sin descargar usuarios ni solicitar permisos de gestión de usuarios. Detalle: ID de evento, correlación de solicitud si fue registrada, fecha, actor, entidad e ID, descripción, IP, navegador y metadatos del servicio. Los eventos son sólo lectura.

Se conservan filtros de acción/entidad/fechas y paginación. Estilos locales ajustan filtros, modal y textos a pantallas pequeñas; la tabla permite desplazamiento horizontal para conservar sus columnas. No se supone que un evento sin usuario sea necesariamente anónimo: se muestra «Sin usuario asociado».

Pendiente externo: los eventos históricos sin actor o IP no pueden reconstruirse desde la interfaz; verificar configuración de proxy confiable en producción según backend/doc/BITACORA.md.
