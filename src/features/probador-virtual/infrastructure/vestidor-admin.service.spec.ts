import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VestidorAdminService } from './vestidor-admin.service';
import { RecursoTryOn } from '../domain/vestidor-admin.models';

function recurso(cambios: Partial<RecursoTryOn> = {}): RecursoTryOn {
  return {
    id: 'rrrrrrrr-0000-0000-0000-000000000001',
    product_id: 'p1',
    color_id: 'c1',
    enabled: true,
    source_image_url: '/media/products/p1.jpg',
    transparent_url: null,
    preview_url: null,
    ai_status: 'review',
    quality_score: 58,
    quality_reason: 'Silueta dudosa',
    reviewed_by: null,
    ...cambios,
  } as RecursoTryOn;
}

describe('VestidorAdminService', () => {
  let service: VestidorAdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VestidorAdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista los recursos por estado, como la cola de revisión', async () => {
    const promise = service.list('review');
    const request = http.expectOne('/api/v1/vestidor/admin/assets?status=review');
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, message: 'Recursos obtenidos.', data: [recurso()] });
    expect((await promise)[0].ai_status).toBe('review');
  });

  it('manda la decisión de revisión con su nota', async () => {
    const promise = service.review('r1', false, 'La silueta no es confiable');
    const request = http.expectOne('/api/v1/vestidor/admin/assets/r1/review');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ approve: false, note: 'La silueta no es confiable' });
    request.flush({
      success: true,
      message: 'Recurso descartado.',
      data: recurso({ ai_status: 'failed', reviewed_by: 'u1' }),
    });
    expect((await promise).ai_status).toBe('failed');
  });

  it('una aprobación sin nota viaja sin el campo nota', async () => {
    const promise = service.review('r1', true);
    const request = http.expectOne('/api/v1/vestidor/admin/assets/r1/review');
    expect(request.request.body).toEqual({ approve: true, note: null });
    request.flush({
      success: true,
      message: 'Recurso aprobado.',
      data: recurso({ ai_status: 'ready', reviewed_by: 'u1' }),
    });
    expect((await promise).ai_status).toBe('ready');
  });

  it('prepara en lote solo los pendientes', async () => {
    const promise = service.bulk(true);
    const request = http.expectOne('/api/v1/vestidor/admin/bulk-prepare');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ only_pending: true });
    request.flush({
      success: true,
      message: 'Preparación masiva terminada.',
      data: { processed: 4, ready: 2, review: 1, failed: 1, errors: 0, details: [] },
    });
    expect((await promise).processed).toBe(4);
  });

  it('en la bandeja se muestra la vista previa antes que el recorte', () => {
    expect(
      service.vistaDe(
        recurso({ preview_url: '/preview.png', transparent_url: '/transparente.png' }),
      ),
    ).toBe('/preview.png');
    expect(service.vistaDe(recurso({ transparent_url: '/transparente.png' }))).toBe(
      '/transparente.png',
    );
    expect(service.vistaDe(recurso({ transparent_url: null }))).toBe('/media/products/p1.jpg');
  });
});