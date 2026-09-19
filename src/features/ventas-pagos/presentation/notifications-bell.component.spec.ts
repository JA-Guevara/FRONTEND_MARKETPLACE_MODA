import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Aviso, NotificationsBellComponent } from './notifications-bell.component';
import { ApiService } from '../../../app/core/shared/api.service';

function aviso(cambios: Partial<Aviso> = {}): Aviso {
  return {
    id: 'order:o1:0',
    tipo: 'pedido',
    estado: 'paid',
    titulo: 'Confirmamos tu pago',
    detalle: 'El pago quedó registrado.',
    fecha: '2026-09-18T10:00:00+00:00',
    enlace: '/mi-cuenta/pedidos',
    referencia: 'FS-001',
    ...cambios,
  };
}

/** `visto` simula lo que la persona ya habia leido en este navegador. */
async function setup(avisos: Aviso[] = [aviso()], falla = false, visto = '') {
  localStorage.clear();
  if (visto) localStorage.setItem('fashionstore.avisos.visto', visto);
  const api = {
    get: vi.fn().mockReturnValue(falla ? throwError(() => new Error('caido')) : of(avisos)),
  };
  TestBed.configureTestingModule({
    imports: [NotificationsBellComponent],
    providers: [provideRouter([]), { provide: ApiService, useValue: api }],
  });
  const fixture = TestBed.createComponent(NotificationsBellComponent);
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, api, campana: fixture.componentInstance };
}

describe('Campanita de avisos', () => {
  it('cuenta como sin leer todo lo que llegó desde la última visita', async () => {
    const { campana } = await setup([
      aviso({ id: 'a', fecha: '2026-09-18T12:00:00+00:00' }),
      aviso({ id: 'b', fecha: '2026-09-18T09:00:00+00:00' }),
    ]);
    expect(campana.sinLeer()).toBe(2);
  });

  it('marcar como leídos apaga el contador y sobrevive a recargar', async () => {
    const { campana } = await setup([
      aviso({ id: 'a', fecha: '2026-09-18T12:00:00+00:00' }),
      aviso({ id: 'b', fecha: '2026-09-18T09:00:00+00:00' }),
    ]);
    campana.marcarLeidos();
    expect(campana.sinLeer()).toBe(0);
    expect(localStorage.getItem('fashionstore.avisos.visto')).toBe('2026-09-18T12:00:00+00:00');
  });

  it('un aviso posterior a lo leído vuelve a contar', async () => {
    const { campana } = await setup(
      [
        aviso({ id: 'nuevo', fecha: '2026-09-18T11:00:00+00:00' }),
        aviso({ id: 'viejo', fecha: '2026-09-18T09:00:00+00:00' }),
      ],
      false,
      '2026-09-18T10:00:00+00:00',
    );
    expect(campana.sinLeer()).toBe(1);
    expect(campana.esNuevo(aviso({ fecha: '2026-09-18T11:00:00+00:00' }))).toBe(true);
    expect(campana.esNuevo(aviso({ fecha: '2026-09-18T09:00:00+00:00' }))).toBe(false);
  });

  it('cada tipo de aviso tiene su ícono', async () => {
    const { campana } = await setup();
    expect(campana.icono(aviso({ tipo: 'pedido' }))).toBe('box');
    expect(campana.icono(aviso({ tipo: 'reserva' }))).toBe('calendar');
    expect(campana.icono(aviso({ tipo: 'devolucion' }))).toBe('refresh');
  });

  it('el panel muestra el aviso con su referencia y su detalle', async () => {
    const { fixture, campana } = await setup();
    await campana.alternar();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Confirmamos tu pago');
    expect(texto).toContain('FS-001');
    expect(texto).toContain('El pago quedó registrado.');
  });

  it('sin avisos explica para qué sirve en vez de quedar en blanco', async () => {
    const { fixture, campana } = await setup([]);
    await campana.alternar();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay avisos');
  });

  it('si el servidor falla, la barra no se rompe', async () => {
    // Un fallo acá no puede tumbar la navegación del sitio entero.
    const { fixture, campana } = await setup([], true);
    expect(campana.error()).toBeTruthy();
    expect(campana.avisos()).toEqual([]);
    await campana.alternar();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar');
  });

  it('abrir vuelve a consultar, por si algo cambió mientras tanto', async () => {
    const { api, campana } = await setup();
    expect(api.get).toHaveBeenCalledTimes(1);
    await campana.alternar();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('marcar como leídos sin avisos no rompe nada', async () => {
    const { campana } = await setup([]);
    campana.marcarLeidos();
    expect(campana.sinLeer()).toBe(0);
  });
});
