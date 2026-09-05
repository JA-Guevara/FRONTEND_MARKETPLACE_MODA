import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ResourcePageComponent } from './resource-page.component';
import { resources } from '../app/core/shared/resources';
import { addressesResource } from '../features/usuarios-catalogo/application/resources';
import { Resource } from './form-schema';
import { SessionService } from '../features/auth/application/session.service';

describe('Contratos de las pantallas administrativas', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<ResourcePageComponent>;
  async function setup(config: Resource) {
    TestBed.configureTestingModule({
      imports: [ResourcePageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        {provide: ActivatedRoute, useValue: {data: of({resource: config})}},
        {provide: SessionService, useValue: {can: () => true}},
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ResourcePageComponent);
    fixture.detectChanges();
    backend.expectOne(r => r.url === '/api/v1' + (config.listPath || config.path)).flush({success:true,message:'OK',data:config.paginated ? {items:[],total:0,page:1,page_size:20,pages:0} : []});
    await Promise.resolve();
    if(config.key === 'cash-points') {
      backend.expectOne(r => r.url === '/api/v1/organization/branches').flush({success:true,message:'OK',data:[]});
    }
    await fixture.whenStable();
  }
  afterEach(() => backend?.verify());
  it.each([...resources, addressesResource])('renderiza $title y su estado vacío', async config => {
    await setup(config);
    expect(fixture.nativeElement.textContent).toContain(config.title);
    expect(fixture.nativeElement.textContent).toContain('No hay registros');
    expect(fixture.componentInstance.error()).toBe('');
  });
  it('consulta permisos desde el listado sin inventar un GET de detalle', async () => {
    await setup(resources.find(r => r.key === 'permissions')!);
    await fixture.componentInstance.detail({id:'p1',name:'Consultar'});
    backend.expectNone('/api/v1/roles/permissions/p1');
    expect(fixture.componentInstance.viewing()?.id).toBe('p1');
  });
  it('mantiene el borrador cuando el backend devuelve conflicto', async () => {
    await setup(resources.find(r => r.key === 'colors')!);
    const component = fixture.componentInstance;
    component.open();
    const saving = component.save({name:'Duplicado',hex_code:'#111111'});
    backend.expectOne('/api/v1/catalog/admin/colors').flush({error:{message:'El color ya existe.'}}, {status:409,statusText:'Conflict'});
    await saving;
    expect(component.editing()).toBe(true);
    expect(component.formError()).toContain('ya existe');
    expect(component.busy()).toBe(false);
  });
  it('no envía escrituras sin permiso', async () => {
    await setup(resources.find(r => r.key === 'categories')!);
    vi.spyOn(fixture.componentInstance.session, 'can').mockReturnValue(false);
    await fixture.componentInstance.save({name:'No autorizado'});
    backend.expectNone('/api/v1/catalog/admin/categories');
  });
});
