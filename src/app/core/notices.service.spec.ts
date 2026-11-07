import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { SessionService } from '../../features/usuarios-catalogo/application/session.service';
import { ApiService } from './shared/api.service';
import { NoticesService } from './notices.service';
import { AccountNotice, NotificationFeedService } from './notification-feed.service';
import { NoticesHostComponent } from '../../shared/ui/notices-host.component';

function setup() {
  localStorage.clear();
  const session = { user: signal<any>({ id: 'customer-a' }), tenant: signal<any>({ id: 'company-a' }), support: signal<any>(null) };
  const api = { get: vi.fn(() => of([] as AccountNotice[])) };
  TestBed.configureTestingModule({providers: [provideRouter([]), {provide: SessionService, useValue: session}, {provide: ApiService, useValue: api}]});
  return {session, api, notices: TestBed.inject(NoticesService), feed: TestBed.inject(NotificationFeedService)};
}
const paid = (): AccountNotice => ({id: 'order:1:0', event_key: 'payment:1:paid', tipo: 'pedido', estado: 'paid', titulo: 'Pago confirmado', detalle: '150.00 BOB · Acreditado por el servidor', referencia: 'FS-001', enlace: '/mi-cuenta/pedidos?pedido=1', importante: true, tono: 'success', fecha: new Date().toISOString()});

describe('Avisos de pago aislados por cuenta y empresa', () => {
  it('conserva el aviso importante hasta cerrarlo y no lo repite al volver a consultar', () => {
    const {notices} = setup();
    notices.show({key: 'payment:1:paid', title: 'Pago confirmado', detail: '150.00 BOB', important: true});
    expect(notices.modal()?.title).toBe('Pago confirmado');
    notices.dismiss('payment:1:paid');
    notices.show({key: 'payment:1:paid', title: 'Duplicado', detail: '', important: true});
    expect(notices.modal()).toBeUndefined();
  });
  it('borra la ventana anterior al cambiar de empresa y guarda solo identificadores', () => {
    const {notices, session} = setup();
    notices.show({key: 'a', title: 'Dato privado', detail: 'correo del cliente', important: true});
    expect(localStorage.getItem('fashionstore.popups.customer-a:company-a:')).toBe('["a"]');
    session.tenant.set({id: 'company-b'});
    TestBed.tick();
    expect(notices.messages()).toEqual([]);
    notices.show({key: 'a', title: 'Aviso de B', detail: '', important: true});
    expect(notices.modal()?.title).toBe('Aviso de B');
  });
  it('descarta enlaces externos y muestra avisos generales sin bloquear la pantalla', () => {
    const {notices} = setup();
    notices.show({key: 'saved', title: 'Operación registrada', detail: '', link: '//otro.example'});
    expect(notices.modal()).toBeUndefined();
    expect(notices.toasts()[0].link).toBeUndefined();
  });
  it('convierte el evento confirmado del servidor en una ventana y deduplica actualizaciones', async () => {
    const {notices, api, feed} = setup();
    api.get.mockReturnValue(of([paid()]));
    await feed.refresh();
    expect(notices.modal()?.tone).toBe('success');
    expect(notices.modal()?.detail).toContain('150.00 BOB');
    notices.dismiss('payment:1:paid');
    await feed.refresh();
    expect(notices.messages()).toEqual([]);
    expect(feed.items()).toHaveLength(1);
  });
  it('mantiene avisos antiguos en el historial sin abrir ventanas antiguas', async () => {
    const {notices, api, feed} = setup();
    api.get.mockReturnValue(of([{...paid(), fecha: '2020-01-01T00:00:00Z'}]));
    await feed.refresh();
    expect(feed.items()).toHaveLength(1);
    expect(notices.messages()).toEqual([]);
  });
  it('no muestra una respuesta de A que llega después de entrar en B', async () => {
    const {notices, session, api, feed} = setup();
    const delayed = new Subject<AccountNotice[]>();
    api.get.mockReturnValue(delayed);
    const request = feed.refresh();
    session.tenant.set({id: 'company-b'});
    delayed.next([paid()]); delayed.complete();
    await request;
    expect(notices.messages()).toEqual([]);
    expect(feed.items()).toEqual([]);
  });
  it('una falla de red no inventa una confirmación ni borra el pedido', async () => {
    const {notices, api, feed} = setup();
    api.get.mockReturnValue(throwError(() => new Error('sin conexión')));
    await feed.refresh();
    expect(notices.messages()).toEqual([]);
  });
  it('renderiza una ventana accesible, con referencia y cierre explícito', async () => {
    const {notices} = setup();
    const fixture = TestBed.createComponent(NoticesHostComponent);
    notices.show({key: 'confirmed', title: 'Pago confirmado', detail: 'FS-001 · 150.00 BOB', tone: 'success', important: true});
    await fixture.whenStable(); fixture.detectChanges();
    const dialog: HTMLElement = fixture.nativeElement.querySelector('[role=alertdialog]');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('FS-001 · 150.00 BOB');
    (dialog.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alertdialog]')).toBeNull();
    fixture.destroy();
  });
});
