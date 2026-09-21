import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TryOnAiService } from './tryon-ai.service';
import { TryOnJob } from '../domain/tryon-jobs.models';

function trabajo(status = 'queued'): TryOnJob {
  return {
    id: 'j1',
    product_id: 'p1',
    color_id: null,
    status,
    provider: 'mock',
    result_url: status === 'ready' ? '/media/fotos/persona_result.png' : null,
    error: status === 'failed' ? 'La generación falló.' : null,
    expires_at: null,
    created_at: '2026-09-20T10:00:00Z',
    is_simulation: true,
  };
}

describe('TryOnAiService', () => {
  let service: TryOnAiService;
  let http: HttpTestingController;
  const file = new File(['foto'], 'persona.png', { type: 'image/png' });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TryOnAiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('crea un trabajo con la foto, la prenda, el color y el consentimiento', async () => {
    const promise = service.create(file, 'p1', 'c1', true);
    const request = http.expectOne('/api/v1/tryon-ai/jobs');
    expect(request.request.method).toBe('POST');
    const body = request.request.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('product_id')).toBe('p1');
    expect(body.get('color_id')).toBe('c1');
    expect(body.get('privacy_consent')).toBe('true');
    request.flush({ success: true, message: 'Foto IA en curso.', data: trabajo('queued') });
    expect((await promise).status).toBe('queued');
  });

  it('sin color ni consentimiento no manda esos campos al servidor', async () => {
    const promise = service.create(file, 'p1', null, false);
    const request = http.expectOne('/api/v1/tryon-ai/jobs');
    const body = request.request.body as FormData;
    expect(body.get('color_id')).toBeNull();
    expect(body.get('privacy_consent')).toBe('false');
    request.flush({ success: true, message: 'Foto IA en curso.', data: trabajo('queued') });
    await promise;
  });

  it('lista, consulta, cancela y elimina los trabajos propios', async () => {
    const mine = service.mine();
    let request = http.expectOne('/api/v1/tryon-ai/jobs');
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, message: 'Trabajos obtenidos.', data: [trabajo('ready')] });
    expect((await mine).length).toBe(1);

    const one = service.one('j1');
    request = http.expectOne('/api/v1/tryon-ai/jobs/j1');
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, message: 'Trabajo obtenido.', data: trabajo('ready') });
    expect((await one).status).toBe('ready');

    const cancel = service.cancel('j1');
    request = http.expectOne('/api/v1/tryon-ai/jobs/j1/cancel');
    expect(request.request.method).toBe('PATCH');
    request.flush({ success: true, message: 'Trabajo cancelado.', data: trabajo('cancelled') });
    expect((await cancel).status).toBe('cancelled');

    const remove = service.remove('j1');
    request = http.expectOne('/api/v1/tryon-ai/jobs/j1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await expect(remove).resolves.toBeUndefined();
  });
});