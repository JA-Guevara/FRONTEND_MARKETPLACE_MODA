import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EntityFormComponent } from './entity-form.component';
import { Field } from './form-schema';

describe('Formularios de administración', () => {
  let fixture: ComponentFixture<EntityFormComponent>;
  let component: EntityFormComponent;
  let backend: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EntityFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(EntityFormComponent);
    component = fixture.componentInstance;
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());
  async function setup(fields: Field[], value: unknown = null) {
    fixture.componentRef.setInput('fields', fields);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    await Promise.resolve();
  }
  it('rechaza fechas invertidas sin enviar datos', async () => {
    await setup([
      { key: 'start_date', label: 'Desde', type: 'date' },
      { key: 'end_date', label: 'Hasta', type: 'date' },
    ]);
    component.form.setValue({ start_date: '2026-12-01', end_date: '2026-01-01' });
    const emit = vi.spyOn(component.saved, 'emit');
    component.submit();
    expect(emit).not.toHaveBeenCalled();
    expect(component.localError()).toContain('fecha final');
  });
  it('envía null al limpiar una relación existente', async () => {
    await setup([{ key: 'season_id', label: 'Temporada', type: 'select' }], {
      id: 'p1',
      season_id: 's1',
    });
    component.form.setValue({ season_id: '' });
    const emit = vi.spyOn(component.saved, 'emit');
    component.submit();
    expect(emit).toHaveBeenCalledWith({ season_id: null });
  });
  it('conserva cero y false al guardar', async () => {
    await setup([
      { key: 'base_price', label: 'Precio', type: 'number', required: true, min: 0 },
      { key: 'is_featured', label: 'Destacada', type: 'checkbox' },
    ]);
    component.form.setValue({ base_price: 0, is_featured: false });
    const emit = vi.spyOn(component.saved, 'emit');
    component.submit();
    expect(emit).toHaveBeenCalledWith({ base_price: 0, is_featured: false });
  });
  it('omite contraseña y roles del PATCH de usuario', async () => {
    await setup(
      [
        { key: 'first_name', label: 'Nombre', required: true },
        { key: 'password', label: 'Contraseña', type: 'password', createOnly: true },
        { key: 'role_ids', label: 'Roles', type: 'multi', createOnly: true },
      ],
      { id: 'u1', first_name: 'Ana' },
    );
    const emit = vi.spyOn(component.saved, 'emit');
    component.submit();
    expect(emit).toHaveBeenCalledWith({ first_name: 'Ana' });
  });
  it('exige al menos un rol al asignar usuarios', async () => {
    await setup([{ key: 'role_ids', label: 'Roles', type: 'multi', required: true }]);
    const emit = vi.spyOn(component.saved, 'emit');
    component.submit();
    expect(emit).not.toHaveBeenCalled();
  });
  it('permite quitar todos los permisos de un rol', async () => {
    await setup([{ key: 'permission_ids', label: 'Permisos', type: 'multi' }], {
      id: 'r1',
      permission_ids: [],
    });
    const emit = vi.spyOn(component.saved, 'emit');
    component.submit();
    expect(emit).toHaveBeenCalledWith({ permission_ids: [] });
  });
  it('rechaza horarios inválidos', async () => {
    await setup([{ key: 'opening_hours', label: 'Horarios', type: 'hours' }]);
    component.form
      .get('opening_hours.monday')!
      .setValue({ enabled: true, open: '18:00', close: '09:00' });
    const emit = vi.spyOn(component.saved, 'emit');
    component.submit();
    expect(emit).not.toHaveBeenCalled();
    expect(component.localError()).toContain('lunes');
  });
  it('no permite guardar si falla una lista de relaciones', async () => {
    await setup([
      {
        key: 'category_id',
        label: 'Categoría',
        type: 'select',
        lookup: '/catalog/admin/categories',
        required: true,
      },
    ]);
    backend
      .expectOne('/api/v1/catalog/admin/categories?include_inactive=true')
      .flush({}, { status: 403, statusText: 'Forbidden' });
    await Promise.resolve();
    await Promise.resolve();
    component.form.setValue({ category_id: 'c1' });
    const emit = vi.spyOn(component.saved, 'emit');
    component.submit();
    expect(emit).not.toHaveBeenCalled();
  });
  it('no borra el formulario cuando cambia busy', async () => {
    await setup([{ key: 'name', label: 'Nombre', required: true }]);
    component.form.setValue({ name: 'Borrador' });
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    expect(component.form.value['name']).toBe('Borrador');
  });
});
