import '@angular/compiler';
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PromotionsPageComponent } from './promotions-page.component';
import { EngagementService } from '../infrastructure/engagement.service';
import { ApiService } from '../../../app/core/shared/api.service';
import { of } from 'rxjs';

describe('PromotionsPageComponent', () => {
  const mockEngagementService = {
    promotions: vi.fn().mockResolvedValue([
      {
        id: 'p1',
        name: 'Promo 1',
        code: 'SALE20',
        description: 'Desc',
        discount_type: 'percent',
        discount_value: '20',
        minimum_order: '0',
        customer_scope: 'all',
        minimum_paid_orders: 0,
        applies_online: true,
        applies_pos: true,
        applies_offline: true,
        starts_at: null,
        ends_at: null,
        max_uses: null,
        uses_count: 0,
        per_user_limit: null,
        is_active: true,
      },
    ]),
    previewPromotion: vi.fn().mockResolvedValue({
      items: [
        { variant_id: 'v1', product_name: 'Camisa', regular: 100, final: 80, discount_applied: 20 },
      ],
      errors: [],
    }),
    createPromotion: vi.fn().mockResolvedValue({ id: 'p2' }),
    updatePromotion: vi.fn().mockResolvedValue({ id: 'p1' }),
    activatePromotion: vi.fn().mockResolvedValue({ id: 'p1', is_active: true }),
    deactivatePromotion: vi.fn().mockResolvedValue({ id: 'p1', is_active: false }),
  };

  const mockApiService = {
    get: vi.fn((url: string) => {
      if (url.includes('/catalog/categories')) return of([]);
      if (url.includes('/catalog/products')) return of({ items: [], total: 0 });
      return of({});
    }),
  };

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: EngagementService, useValue: mockEngagementService },
        { provide: ApiService, useValue: mockApiService },
      ],
    });
    return TestBed.runInInjectionContext(() => new PromotionsPageComponent());
  }

  it('inicializa y carga promociones', async () => {
    const comp = setup();
    await comp.load();
    expect(mockEngagementService.promotions).toHaveBeenCalled();
    expect(comp.promotions().length).toBe(1);
    expect(comp.promotions()[0].name).toBe('Promo 1');
  });

  it('formatea texto de estado correctamente', () => {
    const comp = setup();
    const promoActiva: any = {
      id: '1',
      name: 'Activa',
      is_active: true,
      discount_type: 'percent',
      discount_value: '10',
      minimum_order: '0',
      customer_scope: 'all',
      applies_online: true,
      applies_pos: true,
      applies_offline: true,
      uses_count: 0,
      max_uses: null,
    };
    expect(comp.estadoTexto(promoActiva)).toBe('Vigente');

    const promoPausada = { ...promoActiva, is_active: false };
    expect(comp.estadoTexto(promoPausada)).toBe('Pausada');
  });

  it('ejecuta previsualización de precios', async () => {
    const comp = setup();
    comp.draft.name = 'Test Promo';
    comp.draft.discount_value = 20;
    await comp.preview();
    expect(mockEngagementService.previewPromotion).toHaveBeenCalled();
    expect(comp.previewResult()?.items.length).toBe(1);
  });
});
