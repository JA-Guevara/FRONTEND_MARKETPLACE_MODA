import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FotoRealistaComponent } from './foto-realista.component';
import { TryOnAiService } from '../infrastructure/tryon-ai.service';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { TryOnJob } from '../domain/tryon-jobs.models';

function trabajo(cambios: Partial<TryOnJob> = {}): TryOnJob {
  return {
    id: 'j1',
    product_id: 'p1',
    color_id: 'c1',
    status: 'ready',
    provider: 'mock',
    result_url: '/media/fotos/persona_result.png',
    error: null,
    expires_at: null,
    created_at: '2026-09-20T10:00:00Z',
    is_simulation: true,
    ...cambios,
  };
}

const usuario = {
  id: 'u1',
  email: 'comprador@example.test',
  first_name: 'Comprador',
  last_name: 'Test',
  phone: null,
  roles: [],
  is_active: true,
  is_verified: true,
};

async function setup(user: unknown, historial: TryOnJob[]) {
  const api = {
    create: vi.fn().mockResolvedValue(trabajo({ status: 'queued' })),
    mine: vi.fn().mockResolvedValue(historial),
    one: vi.fn().mockResolvedValue(trabajo({ status: 'ready' })),
    cancel: vi.fn().mockResolvedValue(trabajo({ status: 'cancelled' })),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  TestBed.configureTestingModule({
    imports: [FotoRealistaComponent],
    providers: [
      { provide: TryOnAiService, useValue: api },
      { provide: SessionService, useValue: { user: () => user } },
      provideRouter([]),
    ],
  });
  const fixture = TestBed.createComponent(FotoRealistaComponent);
  fixture.componentInstance.productId = 'p1';
  fixture.componentInstance.colorId = 'c1';
  fixture.componentInstance.productName = 'Polera básica';
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, api, componente: fixture.componentInstance };
}

/** Rellena el input de archivo con una foto como si la eligiera el usuario. */
function elegirFoto(host: HTMLElement, file: File) {
  const input = host.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
}

describe('Panel de foto realista con IA', () => {
  it('sin sesión ofrece entrar y no pide el historial', async () => {
    const { fixture, api } = await setup(null, []);
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Entrar para generar mi foto');
    // Cada foto IA se muestra con su aviso permanente de simulación.
    expect(texto).toContain('simulación visual');
    expect(api.mine).not.toHaveBeenCalled();
  });

  it('con sesión carga el historial de la prenda que se está viendo', async () => {
    const { fixture, api, componente } = await setup(usuario, [
      trabajo(),
      trabajo({ id: 'j2', product_id: 'p2', status: 'failed' }),
    ]);
    expect(api.mine).toHaveBeenCalled();
    // Solo se listan los trabajos de esta prenda, no los de otras.
    expect(componente.jobs().length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Lista');
    expect(fixture.nativeElement.textContent).not.toContain('Falló');
  });

  it('genera, consulta el estado hasta que termina y avisa la lista', async () => {
    const { fixture, api } = await setup(usuario, []);
    const file = new File(['foto'], 'yo.png', { type: 'image/png' });
    elegirFoto(fixture.nativeElement, file);
    fixture.componentInstance.consent.set(true);
    fixture.detectChanges();
    const boton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('Generar foto realista')) as HTMLButtonElement;
    boton.click();
    await fixture.whenStable();

    expect(api.create).toHaveBeenCalledWith(file, 'p1', 'c1', true);
    expect(api.one).toHaveBeenCalledWith('j1');
    expect(fixture.nativeElement.textContent).toContain('Tu foto realista está lista.');
  });

  it('cancela un trabajo en curso', async () => {
    const { fixture, api } = await setup(usuario, [trabajo({ status: 'queued', result_url: null })]);
    fixture.detectChanges();
    const boton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('Cancelar')) as HTMLButtonElement;
    boton.click();
    await fixture.whenStable();
    expect(api.cancel).toHaveBeenCalledWith('j1');
  });
});
