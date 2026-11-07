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

## Compra y ventanas de pago

Para el ensayo específico iniciar `python tests/e2e/payments_server.py` en backend (puerto local 57521), mantener el servidor estático en 57520 y ejecutar `node scripts/qa/payment-notices.mjs` con las mismas variables de QA. Reiniciar ese servidor antes de cada recorrido independiente. El navegador bloquea servicios externos y sustituye Checkout por una página local simulada; el backend usa su webhook real con firma sintética.

Comprueba compra de una prenda, importe calculado por servidor, cuenta Connect de la empresa A, retorno sin pagar que no acredita, confirmación válida, ventana destacada en escritorio y a 390 px, persistencia sin repetir el aviso y empresa B sin acceso a pedido ni ventana de A. Guarda `payment-confirmed-desktop-qa.png` y `payment-confirmed-mobile-web-qa.png`. La campana mantiene el historial; el diálogo muestra referencia, importe y acceso al detalle. La consulta de novedades se pausa con la pestaña oculta y se retoma al volver. Los identificadores de avisos vistos se separan por usuario, empresa y sesión de soporte; los textos no se persisten en ese registro.

Cobros de prendas y pago del plan son circuitos distintos. El retorno `pago=ok` del plan informa que se espera confirmación, sin activar ni marcar un pago. Cada empresa completa su alta de Connect en «Configuración de empresa → Cobros de prendas»; no introduce claves secretas propias. La integración permanece en modo de prueba. No se validaron cargos externos reales ni notificaciones del sistema con la aplicación cerrada.
