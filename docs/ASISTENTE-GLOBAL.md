# Asistente global · 07/11/2026

El botón flotante inferior derecho se monta una sola vez desde `App`, fuera de los diseños de tienda y administración. Se carga de forma diferida inmediata y permanece al navegar por plataforma, empresa, cuenta, tienda y operación offline. No depende de iniciar sesión ni excluye al superadministrador.

## Alcance

- Visitante: orientación para elegir tienda, iniciar sesión y reservar; no llama endpoints autenticados ni solicita contraseñas por chat.
- Plataforma: orientación y apertura de las secciones reales del menú, con sus mismos permisos. Explica Billing frente a Connect, empresas, planes, usuarios, roles, módulos, soporte, modelos, auditoría y operación. Abrir una gestión no afirma haber modificado datos: el administrador revisa su formulario.
- Empresa y cliente: conserva el registro existente de acciones, borradores, confirmaciones, reportes, consultas y voz. Las escrituras usan los endpoints autorizados del servidor.
- Sin conexión: orientación local sobre instantánea, operaciones provisionales y sincronización. No intenta cobrar tarjetas, reintegrar dinero ni modificar configuración por red.

Al cambiar de usuario, empresa o sesión de soporte se limpia la conversación, los archivos y las confirmaciones. Se descartan respuestas del chat general que pertenecen al contexto anterior. Escape minimiza el panel; las áreas seguras del dispositivo se respetan en el botón.

## Verificación

Pruebas de navegación entre diseños comprueban que existe un solo asistente y que conserva su instancia. Pruebas funcionales cubren visitante sin llamadas autenticadas, plataforma autorizada/no autorizada, orientación sin conexión y respuesta tardía al cambiar de empresa. Se mantienen las pruebas de acciones, reportes y voz existentes.

Resultado de cierre: 672 pruebas web y compilación de producción aprobadas. El ensayo `scripts/qa/assistant-global.mjs` verificó visitantes, navegación de plataforma con una sola instancia, guía offline, Escape y encuadre móvil; sin errores HTTP ni de página. También pasó `offline-e2e.mjs`: reapertura de PWA con catálogo, venta y reserva locales, sincronización sin duplicados, conflicto y aislamiento A/B.

Para repetir el ensayo del asistente, usar el servidor sintético `backend/tests/e2e/offline_server.py`, el servidor estático `scripts/qa/serve-offline.py` y `QA_PASSWORD` con la clave del fixture local, siguiendo el mismo aislamiento de `scripts/qa/README-SAAS.md`. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permite elegir el Chromium instalado.

La IA conversacional y la transcripción dependen de la configuración del servidor. La orientación pública, la navegación de plataforma y la guía offline funcionan sin esa dependencia. El asistente no ofrece ejecución libre de cualquier endpoint ni sustituye los permisos, las validaciones y las confirmaciones del sistema.
