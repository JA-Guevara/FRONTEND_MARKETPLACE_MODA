# Ensayo de los recorridos SaaS

Usa dos empresas, usuarios ficticios, SQLite temporal y una clave de cifrado efímera. Todas las llamadas del navegador a la dirección habitual de la API se redirigen a `127.0.0.1:57519`. No usa producción, cuentas reales ni dinero real. Los secretos Stripe están deshabilitados en este ensayo.

1. Compilar la web con `npm run build`.
2. En la carpeta del backend iniciar `python tests/e2e/saas_workflows_server.py` con su entorno virtual.
3. En la carpeta de la web iniciar `python scripts/qa/serve-offline.py`. Sirve únicamente en `127.0.0.1:57520`.
4. Definir `QA_PASSWORD` en la sesión con la clave de los usuarios sintéticos de `backend/tests/unit/plataforma_saas/conftest.py`. No usar una clave real. Si Chromium no está instalado en la ubicación estándar de Playwright, definir `PLAYWRIGHT_CHROMIUM_EXECUTABLE` con su ejecutable.
5. Ejecutar `node scripts/qa/saas-workflows.mjs` y luego `node scripts/qa/saas-platform.mjs` sobre una instancia recién iniciada.

El primer recorrido comprueba configuración pública, medios de cobro, reserva → pedido sin doble descuento → pago → retiro en sucursal sin envío → cambio en mostrador. También verifica la solicitud de un cambio con diferencia y la recepción con pago en efectivo. El segundo verifica gráficos reales, filtros y exportación XLSX de plataforma, copia de la empresa A con restauración de prueba y descarga, aislamiento de B y conservación de sus reportes.

Los scripts verifican respuestas de la API y errores de la página; guardan capturas y archivos sintéticos en `../tmp/`, fuera de los repositorios. Puede elegirse otro destino con `QA_ARTIFACTS_DIR`. El servidor elimina su SQLite temporal al cerrarse; reiniciarlo permite repetir el recorrido desde cero.

La prueba de desconexión, reapertura de PWA y conflicto de existencias se conserva por separado en `offline-e2e.mjs`. Los cobros adicionales con tarjeta, webhooks firmados, fallos del proveedor y reintegros están cubiertos por las pruebas del backend; este ensayo de interfaz no reemplaza la comprobación de una cuenta Stripe de pruebas configurada.
