import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { SyncApi } from './sync.api';

describe('Contrato HTTP de sincronización', () => {
  beforeEach(() => TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]}));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('envía el dispositivo y deriva los totales del resultado real', async () => {
    const promise = TestBed.inject(SyncApi).postBatch([{
      client_request_id: 'op', type: 'SALE', device_id: 'device-001', branch_id: 'branch',
      client_created_at: new Date().toISOString(), payload: { items: [] },
    }]);
    const req = TestBed.inject(HttpTestingController).expectOne(environment.apiUrl + '/sync/batch');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.device_id).toBe('device-001');
    expect(req.request.body.client_version).toBeTruthy();
    req.flush({success: true, data: {batch_id: 'batch', results: [{client_request_id: 'op', status: 'CONFIRMED', message: 'OK'}]}});
    expect((await promise).confirmed).toBe(1);
  });

  it('consulta estados mediante POST sin perder el resultado confirmado', async () => {
    const promise = TestBed.inject(SyncApi).getStatus(['op']);
    const req = TestBed.inject(HttpTestingController).expectOne(environment.apiUrl + '/sync/status');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({client_request_ids: ['op']});
    req.flush({success: true, data: [{client_request_id: 'op', status: 'CONFIRMED', message: 'OK'}]});
    expect((await promise).operations[0].status).toBe('CONFIRMED');
  });

  it('traduce acciones y cantidades al contrato de resolución', async () => {
    const promise = TestBed.inject(SyncApi).resolveConflict('conflict', {
      resolution: 'ADJUST', resolution_notes: 'Conservar una unidad', line_adjustments: {variant: 1},
    });
    const req = TestBed.inject(HttpTestingController).expectOne(environment.apiUrl + '/sync/conflicts/conflict/resolve');
    expect(req.request.body).toEqual({action: 'ADJUST', note: 'Conservar una unidad', quantities: {variant: 1}});
    req.flush({success: true, data: {id: 'conflict', client_request_id: 'op', branch_id: 'branch',
      operation_type: 'SALE', type: 'STOCK', status: 'RESOLVED', created_at: new Date().toISOString(), lines: []}});
    expect((await promise).status).toBe('RESOLVED');
  });
});
