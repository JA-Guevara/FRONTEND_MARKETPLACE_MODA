import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AccountPageComponent } from './account-page.component';
import { SessionService } from '../application/session.service';
import { environment } from '../../../environments/environment';

describe('Perfil del cliente', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [AccountPageComponent], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(AccountPageComponent);
    const session = TestBed.inject(SessionService);
    session.user.set({ id:'qa', email:'qa@example.com', first_name:'Ana', last_name:'Pérez', phone:null, is_active:true, is_verified:true, roles:[] });
    const http = TestBed.inject(HttpTestingController);
    return { component:fixture.componentInstance, session, http };
  }
  /** El perfil pide sus direcciones al abrirse; se responden para aislar la prueba. */
  function answerAddresses(http: HttpTestingController, addresses: unknown[] = []) {
    http.expectOne(environment.apiUrl + '/users/me/addresses')
      .flush({ success: true, message: 'ok', data: addresses });
  }
  it('actualiza la identidad visible después de guardar', async () => {
    const {component,session,http} = setup();
    answerAddresses(http);
    component.editing.set(true);
    const pending = component.saveProfile({first_name:'Ana María',last_name:'Pérez',phone:'70000000'});
    const request = http.expectOne(environment.apiUrl + '/commerce/profile');
    expect(request.request.method).toBe('PATCH');
    request.flush({success:true,message:'ok',data:{}});
    await pending;
    expect(session.user()?.first_name).toBe('Ana María');
    expect(component.editing()).toBe(false);
    http.verify();
  });
  it('marca una dirección como predeterminada y recarga la lista', async () => {
    const {component,http} = setup();
    const casa = {id:'a1',label:'Casa',recipient_name:'Ana',phone:'700',address_line:'Av. 1',city:'SCZ',postal_code:'0001',country:'BO',reference:null,is_default:true};
    const oficina = {...casa, id:'a2', label:'Oficina', is_default:false};
    answerAddresses(http, [casa, oficina]);
    await Promise.resolve();
    const pending = component.makeDefault(oficina as never);
    const patch = http.expectOne(environment.apiUrl + '/users/me/addresses/a2');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({is_default:true});
    patch.flush({success:true,message:'ok',data:{}});
    // El componente recarga la lista recién después de resolver el PATCH.
    await Promise.resolve();
    await Promise.resolve();
    answerAddresses(http, [{...casa, is_default:false}, {...oficina, is_default:true}]);
    await pending;
    expect(component.addresses().find(a => a.is_default)?.label).toBe('Oficina');
    expect(component.message()).toContain('Oficina');
    http.verify();
  });
  it('conserva los datos vigentes y permite corregir cuando el servidor rechaza', async () => {
    const {component,session,http} = setup();
    answerAddresses(http);
    component.editing.set(true);
    const pending = component.saveProfile({first_name:'Otro',last_name:'Nombre'});
    http.expectOne(environment.apiUrl + '/commerce/profile').flush({message:'Datos inválidos'}, {status:422,statusText:'Invalid'});
    await pending;
    expect(session.user()?.first_name).toBe('Ana');
    expect(component.editing()).toBe(true);
    expect(component.error()).not.toBe('');
    expect(component.busy()).toBe(false);
    http.verify();
  });
});
