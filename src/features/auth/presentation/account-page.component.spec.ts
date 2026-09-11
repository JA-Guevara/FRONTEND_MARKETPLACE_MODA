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
    return { component:fixture.componentInstance, session, http:TestBed.inject(HttpTestingController) };
  }
  it('actualiza la identidad visible después de guardar', async () => {
    const {component,session,http} = setup();
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
  it('conserva los datos vigentes y permite corregir cuando el servidor rechaza', async () => {
    const {component,session,http} = setup();
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
