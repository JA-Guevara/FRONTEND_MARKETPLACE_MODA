import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController,provideHttpClientTesting} from '@angular/common/http/testing';
import {ExchangesApi} from './exchanges.api';
import {environment} from '../../../environments/environment';

describe('Contrato de cambios de prenda',()=>{
 beforeEach(()=>TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]}));
 afterEach(()=>TestBed.inject(HttpTestingController).verify());
 it('la política y el pedido llegan sin una segunda extracción de data',async()=>{
   const api=TestBed.inject(ExchangesApi),http=TestBed.inject(HttpTestingController);
   const policy=api.getPolicy(),order=api.lookupOrder('FS 01');
   http.expectOne(environment.apiUrl+'/commerce/admin/exchanges/policy').flush({success:true,data:{exchange_days:30,tenant_id:'A'}});
   http.expectOne(environment.apiUrl+'/commerce/admin/exchanges/lookup/FS%2001').flush({success:true,data:{order_id:'pedido-A',items:[]}});
   expect((await policy).exchange_days).toBe(30);expect((await order).order_id).toBe('pedido-A');
 });
 it('el cálculo incluye el pedido para usar descuentos reales y el reemplazo se consulta por sucursal',async()=>{
   const api=TestBed.inject(ExchangesApi),http=TestBed.inject(HttpTestingController);
   const calculation=api.calculate('sucursal-A',[],'pedido-A'),options=api.options('sucursal-A');
   const request=http.expectOne(environment.apiUrl+'/commerce/admin/exchanges/calculate');
   expect(request.request.body.original_order_id).toBe('pedido-A');
   request.flush({success:true,data:{difference_amount:'30.00',lineas:[]}});
   http.expectOne(environment.apiUrl+'/commerce/admin/exchanges/options/sucursal-A').flush({success:true,data:[]});
   expect((await calculation).difference_amount).toBe('30.00');expect(await options).toEqual([]);
 });
});
