import {chromium} from '../../node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const output=resolve(process.env.QA_ARTIFACTS_DIR||fileURLToPath(new URL('../../../tmp',import.meta.url)));
await mkdir(output,{recursive:true});
const artifact=name=>resolve(output,name);
const password=process.env.QA_PASSWORD;
if(!password)throw new Error('Definí QA_PASSWORD con la clave del fixture sintético; nunca uses una cuenta real.');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:true});
const failures=[];
await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='127.0.0.1')return route.continue();
  if(url.origin!=='https://backendmarketplacemoda-production.up.railway.app')return route.abort();
  const response=await route.fetch({url:'http://127.0.0.1:57519'+url.pathname+url.search});
  if(response.status()>=400 && !url.pathname.includes('/health/'))failures.push([url.pathname,response.status()]);
  return route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':'http://127.0.0.1:57520'}});
});
const page=await context.newPage();
async function login(email,company){await page.goto('http://127.0.0.1:57520/iniciar-sesion');await page.locator('[name=empresa]').selectOption(company);await page.locator('[name=email]').fill(email);await page.locator('[name=password]').fill(password);await page.locator('button[type=submit]').click();await page.waitForURL(u=>!u.pathname.includes('iniciar-sesion'));}
try{
  await login('plataforma@example.com','__platform__');
  await page.getByRole('heading',{name:'Panel ejecutivo',exact:true}).waitFor();
  await page.locator('fs-pie-chart svg').first().waitFor();
  await page.locator('fs-trend-chart svg').waitFor();
  assert.equal(await page.locator('article.detail tbody tr').count(),2);
  await page.locator('select[name=plan]').selectOption('BASICO');await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('article.detail tbody tr').length===1);
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'XLSX',exact:true}).click();
  const workbook=await downloaded;await workbook.saveAs(artifact('bi-platform-qa.xlsx'));
  await page.screenshot({path:artifact('bi-platform-qa.png'),fullPage:true});
  console.log('REAL_FILTERED_DASHBOARD_CHARTS_AND_XLSX_OK');
  const ids=await(await fetch('http://127.0.0.1:57519/qa/ids')).json();
  await page.goto('http://127.0.0.1:57520/admin/plataforma/empresas/'+ids.tenant_a+'/datos');
  await page.getByRole('button',{name:/Crear copia de (mi|esta) empresa/,exact:true}).click();
  await page.getByText('Solicitud guardada.',{exact:false}).waitFor();
  await fetch('http://127.0.0.1:57519/qa/process',{method:'POST'});
  await page.getByRole('button',{name:'Actualizar',exact:true}).click();
  await page.getByText('Verificada en ensayo',{exact:true}).waitFor();
  const archive=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar ZIP',exact:true}).click();
  await(await archive).saveAs(artifact('bi-company-backup-qa.zip'));
  console.log('COMPANY_BACKUP_REHEARSAL_AND_DOWNLOAD_OK');
  await login('admin1@example.com','moda-b');
  await page.goto('http://127.0.0.1:57520/admin/empresa/datos');
  await page.getByText('Todavía no se solicitaron copias para esta empresa.',{exact:true}).waitFor();
  await page.goto('http://127.0.0.1:57520/admin/dashboard');
  await page.getByText('Todavía no hay prendas vendidas',{exact:false}).waitFor();
  console.log('TENANT_B_BACKUP_ISOLATION_AND_EXISTING_REPORTS_OK');
  console.log('API_FAILURES',JSON.stringify(failures));
}catch(error){console.log('PAGE',page.url(),(await page.locator('body').innerText()).slice(-2500));throw error;}
finally{await context.unrouteAll({behavior:'wait'});await browser.close();}
