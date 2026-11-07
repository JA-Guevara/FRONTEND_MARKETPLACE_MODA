# Ensayo real de operación offline de la PWA

Requiere los repos backend y web vecinos, Python 3.12 con las dependencias de pruebas del backend, Node y Chromium de Playwright (`npx playwright install chromium`). Todos los datos son sintéticos. La API de QA enlaza exclusivamente a 127.0.0.1 y crea un SQLite temporal; no lee Supabase. El navegador usa un contexto aislado y redirige las llamadas del backend al servidor local; bloquea los demás destinos remotos.

1. En web: `npm ci` y `npm run build`.
2. En una terminal del backend: `.venv/Scripts/python.exe tests/e2e/offline_server.py`.
3. En otra terminal de web: `python scripts/qa/serve-offline.py`.
4. En web: `npm run test:offline:e2e`.

Si se usa un Chromium ya instalado, definir `PLAYWRIGHT_EXECUTABLE_PATH` con su ejecutable. Los puertos locales son 57519 (API) y 57520 (PWA).

Reiniciar el servidor de QA entre ejecuciones: las aserciones parten de la empresa sintética nueva con 20 unidades. El ensayo descarga el catálogo, espera al service worker, desconecta, cierra y reabre, registra una venta y una reserva, vuelve a conectar, verifica que no se dupliquen, provoca un conflicto con otra existencia central, lo ajusta como encargado y comprueba que otra empresa no vea el catálogo ni la cola anteriores. El stock final es cero con dos ventas confirmadas. Terminar ambos servidores al concluir.
