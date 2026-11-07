import {chromium} from '../../node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const output=resolve(process.env.QA_ARTIFACTS_DIR||'../tmp'); await mkdir(output,{recursive:true});
const password=process.env.QA_PASSWORD; if(!password)throw new Error('Falta la clave del fixture sintético.');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1365,height:900}});
const failures=[]; let order;
await context.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.hostname==='127.0.0.1')return route.continue();
 if(url.hostname==='checkout.stripe.com')return route.fulfill({contentType:'text/html',body:'<html><body><h1>Stripe simulado para QA local</h1></body></html>'});
 if(url.origin!=='https://backendmarketplacemoda-production.up.railway.app')return route.abort();
 const response=await route.fetch({url:'http://127.0.0.1:57521'+url.pathname+url.search});
 if(response.status()>=400&&!url.pathname.includes('/health/'))failures.push([url.pathname,response.status()]);
 return route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':'http://127.0.0.1:57520'}});
});
const page=await context.newPage(); page.on('pageerror',e=>failures.push(['pageerror',e.message]));
async function login(email,company){
 await page.goto('http://127.0.0.1:57520/iniciar-sesion'); await page.locator('[name=empresa]').selectOption(company);
 await page.locator('[name=email]').fill(email);await page.locator('[name=password]').fill(password);
 await page.locator('button[type=submit]').click(); await page.waitForURL(u=>!u.pathname.includes('iniciar-sesion'));
}
try{
 await login('cliente0@example.com','moda-a');
 await page.goto('http://127.0.0.1:57520/tienda/moda-a/prendas/prenda-demo');
 await page.getByRole('button',{name:'Agregar al carrito',exact:true}).click();
 await page.getByRole('link',{name:'Ver carrito',exact:true}).click();
 await page.locator('.checkout-summary select').first().selectOption({index:1});
 const quantity=page.locator('.commerce-item input[type=number]').first(); await quantity.fill('1'); await quantity.press('Tab');
 await page.getByRole('button',{name:'Continuar con la compra',exact:true}).click();
 await page.locator('[name=recipient]').fill('Cliente QA');await page.locator('[name=phone]').fill('70000000');
 await page.locator('[name=line1]').fill('Dirección ficticia QA 123');await page.locator('[name=city]').fill('Santa Cruz');
 await page.locator('[name=method]').selectOption('stripe'); await page.locator('[name=saveToProfile]').uncheck();
 const created=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/commerce/orders'));
 await page.getByRole('button',{name:'Confirmar pedido',exact:true}).click(); order=(await(await created).json()).data;
 const modal=page.getByRole('alertdialog'); await modal.getByRole('heading',{name:'Pedido creado · pago pendiente'}).waitFor();
 assert.equal(order.payment_status,'pending'); await modal.getByRole('button',{name:'Entendido'}).click();
 await page.locator('article.order-card').filter({hasText:order.number}).getByRole('button',{name:'Pagar con Stripe',exact:true}).click(); await page.waitForURL('https://checkout.stripe.com/**');
 const sid=new URL(page.url()).pathname.split('/').at(-1);
 // Un retorno inventado success nunca confirma el pago.
 await page.goto('http://127.0.0.1:57520/mi-cuenta/pedidos?payment=success&pedido='+order.id);
 await modal.getByRole('heading',{name:'Pago pendiente de confirmación',exact:true}).waitFor();
 assert.equal(await modal.getByRole('heading',{name:'Pago confirmado',exact:true}).count(),0);
 await modal.getByRole('button',{name:'Entendido'}).click(); console.log('RETURN_URL_CANNOT_CONFIRM_PAYMENT');
 const paid=await(await fetch('http://127.0.0.1:57521/qa/pay/'+sid,{method:'POST'})).json(); assert.equal(paid.account,'acct_test_0');
 await page.locator('article.order-card').filter({hasText:order.number}).getByRole('button',{name:'Verificar pago con Stripe',exact:true}).click();
 await modal.getByRole('heading',{name:'Pago confirmado',exact:true}).waitFor();
 assert.match(await modal.innerText(),/150.00 BOB/);assert.ok((await modal.innerText()).includes(order.number));
 await page.screenshot({path:resolve(output,'payment-confirmed-desktop-qa.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844}); await page.screenshot({path:resolve(output,'payment-confirmed-mobile-web-qa.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await modal.getByRole('button',{name:'Entendido'}).click(); await page.reload();
 await page.getByRole('heading',{name:'Mis pedidos',exact:true}).waitFor(); assert.equal(await modal.count(),0);
 console.log('PURCHASE_STRIPE_ACCOUNT_A_SIGNED_WEBHOOK_NOTICE_AND_DEDUPLICATION_OK');
 await login('cliente1@example.com','moda-b'); await page.goto('http://127.0.0.1:57520/mi-cuenta/pedidos');
 await page.getByRole('heading',{name:'Mis pedidos',exact:true}).waitFor();
 assert.equal(await page.getByText(order.number,{exact:false}).count(),0); assert.equal(await modal.count(),0);
 assert.deepEqual(failures,[]);console.log('TENANT_B_HAS_NO_TENANT_A_ORDER_OR_POPUP; NO_BROWSER_OR_API_ERRORS');
}catch(error){console.log('PAGE',page.url(),(await page.locator('body').innerText()).slice(-2600));throw error;}
finally{await context.unrouteAll({behavior:'wait'});await browser.close();}
