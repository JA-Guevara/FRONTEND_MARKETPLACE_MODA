import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminRecursosComponent } from './admin-recursos.component';
import { VestidorAdminService } from '../infrastructure/vestidor-admin.service';
import { SessionService } from '../../auth/application/session.service';
import { RecursoTryOn } from '../domain/vestidor-admin.models';

function recurso(cambios: Partial<RecursoTryOn> = {}): RecursoTryOn {
  return {
    id: 'rrrrrrrr-0000-0000-0000-000000000001',
    product_id: 'p1',
    color_id: 'c1',
    enabled: true,
    source_image_url: '/media/products/p1.jpg',
    preview_url: null,
    transparent_url: '/media/tryon/p1_t.png',
    ai_status: 'review',
    quality_score: 58,
    quality_reason: 'Silueta dudosa',
    reviewed_by: null,
    ...cambios,
  } as RecursoTryOn;
}

async function setup() {
  const revisado = recurso({ id: 'r2', product_id: 'p2', color_id: 'c2', ai_status: 'failed', quality_score: 41, ai_error: 'El fondo no se recortó.' });
  const service = {
    list: vi.fn().mockResolvedValue([recurso(), revisado]),
    vistaDe: (r: RecursoTryOn) => r.preview_url || r.transparent_url || r.source_image_url,
    retry: vi.fn().mockResolvedValue(recurso({ ai_status: 'processing' })),
    review: vi.fn().mockResolvedValue(recurso({ ai_status: 'ready', reviewed_by: 'u1' })),
    adjust: vi.fn().mockResolvedValue(recurso({ ai_status: 'manual', reviewed_by: 'u1' })),
    bulk: vi.fn().mockResolvedValue({ processed: 2, ready: 1, review: 1, failed: 0, errors: 0, details: [] }),
  };
  TestBed.configureTestingModule({
    imports: [AdminRecursosComponent],
    providers: [
      { provide: VestidorAdminService, useValue: service },
      { provide: SessionService, useValue: { can: () => true } },
      provideRouter([]),
    ],
  });
  const fixture = TestBed.createComponent(AdminRecursosComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, service, componente: fixture.componentInstance };
}

describe('Bandeja de recursos del probador', () => {
  it('muestra el estado, la calidad y por qué quedó así cada recurso', async () => {
    const { fixture } = await setup();
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Esperando revisión');
    expect(texto).toContain('Necesita otra foto');
    expect(texto).toContain('41/100');
    expect(texto).toContain('Silueta dudosa');
  });

  it('aprobar una revisión manda la decisión con su nota', async () => {
    const { service, componente } = await setup();
    const item = recurso();
    componente.abrirRevision(item);
    componente.nota = 'La silueta quedó bien.';
    await componente.enviarRevision(item, true);
    expect(service.review).toHaveBeenCalledWith(item.id, true, 'La silueta quedó bien.');
  });

  it('reintenta un recurso que quedó con errores', async () => {
    const { service, componente } = await setup();
    await componente.reintentar(recurso({ id: 'r2', ai_status: 'failed' }));
    expect(service.retry).toHaveBeenCalledWith('r2');
  });

  it('la corrección a mano arma el payload de la región y el tipo', async () => {
    const { service, componente } = await setup();
    const item = recurso();
    componente.abrirAjuste(item);
    componente.regionSeleccionada = 'lower_body';
    componente.tipoAjuste = 'polo';
    await componente.guardarAjuste(item);
    expect(service.adjust).toHaveBeenCalledWith(item.id, {
      enabled: true,
      body_region: 'lower_body',
      garment_type: 'polo',
    });
  });

  it('la preparación en lote resume lo procesado', async () => {
    const { service, componente } = await setup();
    await componente.bulk();
    expect(service.bulk).toHaveBeenCalledWith(true);
    expect(componente.resumen()).toContain('2 procesados');
  });
});