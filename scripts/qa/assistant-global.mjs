// Solo datos sintéticos del servidor tests/e2e/offline_server.py.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const password = process.env.QA_PASSWORD;
if (!password) throw new Error('Definí QA_PASSWORD con la clave del fixture local, nunca una cuenta real.');
const output = resolve(process.env.QA_ARTIFACTS_DIR || '../tmp');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
const failures = [];
let assistantRequests = 0;
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.hostname === '127.0.0.1') return route.continue();
  if (url.origin !== 'https://backendmarketplacemoda-production.up.railway.app') return route.abort();
  if (url.pathname.endsWith('/commerce/assistant')) assistantRequests++;
  const response = await route.fetch({ url: 'http://127.0.0.1:57519' + url.pathname + url.search });
  if (response.status() >= 400) failures.push([url.pathname, response.status()]);
  return route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': 'http://127.0.0.1:57520' } });
});
const page = await context.newPage();
page.on('pageerror', error => failures.push(['pageerror', error.message]));
const launcher = () => page.getByRole('button', { name: 'Asistente de FashionStore', exact: true });
async function ask(text) {
  await page.getByRole('textbox', { name: 'Mensaje al asistente' }).fill(text);
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
}
async function login(email, company) {
  await page.goto('http://127.0.0.1:57520/iniciar-sesion');
  await launcher().hover();
  assert.notEqual(await launcher().evaluate(el => getComputedStyle(el).backgroundImage), 'none');
  await page.locator('[name=empresa]').selectOption(company);
  await page.locator('[name=email]').fill(email);
  await page.locator('[name=password]').fill(password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(url => !url.pathname.includes('iniciar-sesion'));
}
try {
  await page.goto('http://127.0.0.1:57520/iniciar-sesion');
  await launcher().click();
  await ask('¿Cómo ingreso a mi empresa?');
  await page.getByText(/En Ingresar elegí tu empresa/).waitFor();
  assert.equal(assistantRequests, 0);
  console.log('GUEST_GUIDANCE_WITHOUT_AUTHENTICATED_REQUESTS_OK');
  await login('plataforma@example.com', '__platform__');
  await launcher().click();
  await page.locator('fs-assistant-widget').evaluate(el => el.dataset.qaIdentity = 'global');
  await ask('Abrí los planes');
  await page.waitForURL('**/admin/plataforma/planes');
  await page.getByText(/Los planes definen funciones/).waitFor();
  await ask('Mostrame empresas y suscripciones');
  await page.waitForURL('**/admin/plataforma/empresas');
  assert.equal(await page.locator('fs-assistant-widget').count(), 1);
  assert.equal(await page.locator('fs-assistant-widget').getAttribute('data-qa-identity'), 'global');
  assert.equal(assistantRequests, 0);
  await page.screenshot({ path: resolve(output, 'assistant-platform-global.png'), fullPage: true });
  console.log('PLATFORM_AUTHORIZED_NAVIGATION_ONE_PERSISTENT_ASSISTANT_OK');
  await login('admin0@example.com', 'moda-a');
  await page.goto('http://127.0.0.1:57520/admin/empresa/configuracion');
  await launcher().click();
  await page.getByRole('dialog', { name: 'Asistente FashionStore' }).waitFor();
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }));
  await ask('Registrá una venta sin conexión');
  await page.getByText(/Sin conexión puedo orientarte/).waitFor();
  assert.equal(assistantRequests, 0);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('.ai-launcher')?.getAttribute('aria-expanded') === 'false');
  assert.equal(await launcher().getAttribute('aria-expanded'), 'false');
  console.log('TENANT_OFFLINE_GUIDANCE_AND_ESCAPE_OK');
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await launcher().boundingBox();
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844);
  await launcher().click();
  const panel = await page.locator('#assistant-panel').boundingBox();
  assert.ok(panel && panel.x >= 0 && panel.y >= 0 && panel.x + panel.width <= 391 && panel.y + panel.height <= 845);
  await page.screenshot({ path: resolve(output, 'assistant-mobile-global.png'), fullPage: true });
  console.log('MOBILE_BUTTON_AND_PANEL_IN_VIEWPORT_OK');
  assert.deepEqual(failures, []);
  console.log('NO_API_OR_BROWSER_ERRORS');
} finally {
  await context.unrouteAll({ behavior: 'wait' });
  await browser.close();
}
