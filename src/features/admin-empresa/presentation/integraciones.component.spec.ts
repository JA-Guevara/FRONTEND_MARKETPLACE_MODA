import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '@angular/common/http';
import {
  IntegracionesComponent,
  ApiKeyItem,
  WebhookEndpointItem,
  WebhookDeliveryItem,
} from './integraciones.component';

describe('IntegracionesComponent', () => {
  const mockKeys: ApiKeyItem[] = [
    {
      id: 'k-1',
      name: 'Clave ERP',
      prefix: 'fs_live_abcd',
      scopes: ['sales.read', 'catalog.read'],
      created_at: '2026-11-05T12:00:00Z',
      last_used_at: null,
      revoked_at: null,
    },
  ];

  const mockWebhooks: WebhookEndpointItem[] = [
    {
      id: 'wh-1',
      url: 'https://erp.empresa.com/webhooks',
      events: ['sale.confirmed'],
      is_active: true,
      created_at: '2026-11-05T12:00:00Z',
    },
  ];

  const mockDeliveries: WebhookDeliveryItem[] = [
    {
      id: 'del-1',
      endpoint_id: 'wh-1',
      event_id: 'ev-1',
      attempt: 1,
      status_code: 200,
      status: 'delivered',
      created_at: '2026-11-05T12:05:00Z',
      delivered_at: '2026-11-05T12:05:01Z',
    },
  ];

  it('lista claves de API, webhooks y entregas recientes', async () => {
    const mockHttp = {
      get: vi.fn((url: string) => {
        if (url.includes('/api-keys')) return of({ message: 'ok', data: mockKeys });
        if (url.includes('/webhooks/deliveries')) return of({ message: 'ok', data: mockDeliveries });
        if (url.includes('/webhooks')) return of({ message: 'ok', data: mockWebhooks });
        return of({ message: 'ok', data: [] });
      }),
      post: vi.fn().mockReturnValue(of({ message: 'ok', data: {} })),
      delete: vi.fn().mockReturnValue(of({ message: 'ok', data: null })),
    };

    await TestBed.configureTestingModule({
      imports: [IntegracionesComponent],
      providers: [{ provide: HttpClient, useValue: mockHttp }],
    }).compileComponents();

    const fixture = TestBed.createComponent(IntegracionesComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Clave ERP');
    expect(el.textContent).toContain('fs_live_abcd');
    expect(el.textContent).toContain('https://erp.empresa.com/webhooks');
    expect(el.textContent).toContain('sale.confirmed');
  });

  it('permite crear y revocar claves de API', async () => {
    const mockHttp = {
      get: vi.fn().mockReturnValue(of({ message: 'ok', data: [] })),
      post: vi.fn().mockReturnValue(of({ message: 'ok', data: { raw_key: 'fs_live_supersecretkey123' } })),
      delete: vi.fn().mockReturnValue(of({ message: 'ok', data: null })),
    };

    await TestBed.configureTestingModule({
      imports: [IntegracionesComponent],
      providers: [{ provide: HttpClient, useValue: mockHttp }],
    }).compileComponents();

    const fixture = TestBed.createComponent(IntegracionesComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const comp = fixture.componentInstance;
    comp.keyName = 'Nueva Clave Test';
    comp.keyScopes = 'sales.read';
    comp.createApiKey();

    expect(mockHttp.post).toHaveBeenCalledWith(
      expect.stringContaining('/tenant/integrations/api-keys'),
      { name: 'Nueva Clave Test', scopes: ['sales.read'] }
    );
    expect(comp.newRawKey()).toBe('fs_live_supersecretkey123');

    comp.revokeApiKey('k-1');
    expect(mockHttp.delete).toHaveBeenCalledWith(
      expect.stringContaining('/tenant/integrations/api-keys/k-1')
    );
  });

  it('permite probar webhooks y reenviar entregas', async () => {
    const mockHttp = {
      get: vi.fn().mockReturnValue(of({ message: 'ok', data: [] })),
      post: vi.fn().mockReturnValue(of({ message: 'ok', data: { status_code: 200 } })),
      delete: vi.fn().mockReturnValue(of({ message: 'ok', data: null })),
    };

    await TestBed.configureTestingModule({
      imports: [IntegracionesComponent],
      providers: [{ provide: HttpClient, useValue: mockHttp }],
    }).compileComponents();

    const fixture = TestBed.createComponent(IntegracionesComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const comp = fixture.componentInstance;
    comp.testWebhook('wh-1');
    expect(mockHttp.post).toHaveBeenCalledWith(
      expect.stringContaining('/tenant/integrations/webhooks/wh-1/test'),
      {}
    );

    comp.redeliver('del-1');
    expect(mockHttp.post).toHaveBeenCalledWith(
      expect.stringContaining('/tenant/integrations/webhooks/deliveries/del-1/redeliver'),
      {}
    );
  });

  it('genera snippets de integración en el playground y ejecuta simulación de webhooks', async () => {
    const mockSimResult = {
      event_id: 'ev-test-123',
      event_type: 'sale.confirmed',
      timestamp: '1700000000',
      payload: { id: 'ev-test-123', type: 'sale.confirmed', data: { order_id: 'ORD-100' } },
      signature_preview: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      dispatched: false,
      status_code: null,
      headers_example: { 'X-FS-Signature': 'abcdef...' },
    };

    const mockHttp = {
      get: vi.fn().mockReturnValue(of({ message: 'ok', data: mockKeys })),
      post: vi.fn((url: string) => {
        if (url.includes('/simulate')) return of({ message: 'ok', data: mockSimResult });
        return of({ message: 'ok', data: {} });
      }),
      delete: vi.fn().mockReturnValue(of({ message: 'ok', data: null })),
    };

    await TestBed.configureTestingModule({
      imports: [IntegracionesComponent],
      providers: [{ provide: HttpClient, useValue: mockHttp }],
    }).compileComponents();

    const fixture = TestBed.createComponent(IntegracionesComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const comp = fixture.componentInstance;
    comp.activeTab.set('playground');
    comp.playgroundEndpoint.set('catalog');
    comp.playgroundLang.set('curl');

    const curlCode = comp.getCodeSnippet();
    expect(curlCode).toContain('/api/v1/integrations/v1/catalog');
    expect(curlCode).toContain('X-API-Key: fs_live_abcd...');

    comp.playgroundLang.set('python');
    const pythonCode = comp.getCodeSnippet();
    expect(pythonCode).toContain('import requests');
    expect(pythonCode).toContain('/api/v1/integrations/v1/catalog');

    // Cambiar a tab simulador
    comp.activeTab.set('simulador');
    comp.simulateEventType.set('sale.confirmed');
    comp.runSimulation();

    expect(mockHttp.post).toHaveBeenCalledWith(
      expect.stringContaining('/tenant/integrations/webhooks/simulate'),
      { event_type: 'sale.confirmed', endpoint_id: null }
    );
    expect(comp.simulateResult()).toEqual(mockSimResult);
  });
});
