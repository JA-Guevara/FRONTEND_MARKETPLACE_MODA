import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { EstadoCuentaComponent } from './estado-cuenta.component';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { SubscriptionInvoice } from '../domain/suscripcion.models';

describe('EstadoCuentaComponent', () => {
  const mockInvoices: SubscriptionInvoice[] = [
    {
      id: 'inv-1',
      number: 'FS-2026-0142',
      tenant_id: 't1',
      subscription_id: 'sub-1',
      period_start: '2026-11-01T00:00:00Z',
      period_end: '2026-11-30T00:00:00Z',
      amount: 690.0,
      currency: 'BOB',
      status: 'overdue',
      issued_at: '2026-11-01T00:00:00Z',
      due_at: '2026-11-05T00:00:00Z',
    },
    {
      id: 'inv-2',
      number: 'FS-2026-0118',
      tenant_id: 't1',
      subscription_id: 'sub-1',
      period_start: '2026-10-01T00:00:00Z',
      period_end: '2026-10-31T00:00:00Z',
      amount: 690.0,
      currency: 'BOB',
      status: 'paid',
      issued_at: '2026-10-01T00:00:00Z',
      due_at: '2026-10-05T00:00:00Z',
      paid_at: '2026-10-03T10:00:00Z',
      paid_reference: 'TRANSF-7788',
    },
  ];

  it('muestra la lista de comprobantes con número, período, monto y estado', async () => {
    await TestBed.configureTestingModule({
      imports: [EstadoCuentaComponent],
      providers: [
        {
          provide: PlataformaApi,
          useValue: {
            myInvoices: () => of(mockInvoices),
            downloadInvoicePdf: () => of(new Blob(['pdf'], { type: 'application/pdf' })),
          },
        },
        { provide: SessionService, useValue: { can: () => false } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(EstadoCuentaComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Estado de cuenta');
    expect(text).toContain('FS-2026-0142');
    expect(text).toContain('FS-2026-0118');
    expect(text).toContain('690.00');
    expect(text).toContain('Vencido');
    expect(text).toContain('Pagado');
    expect(text).toContain('⇩ PDF');
  });

  it('descarga el comprobante en PDF al pulsar el botón', async () => {
    let pdfRequested = false;
    await TestBed.configureTestingModule({
      imports: [EstadoCuentaComponent],
      providers: [
        {
          provide: PlataformaApi,
          useValue: {
            myInvoices: () => of(mockInvoices),
            downloadInvoicePdf: () => {
              pdfRequested = true;
              return of(new Blob(['fake-pdf'], { type: 'application/pdf' }));
            },
          },
        },
        { provide: SessionService, useValue: { can: () => false } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(EstadoCuentaComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const pdfBtn = fixture.nativeElement.querySelector('button.btn.sm') as HTMLButtonElement;
    pdfBtn.click();
    expect(pdfRequested).toBe(true);
  });

  it('permite a un administrador de plataforma registrar pago con referencia', async () => {
    let markedPaidParams: { tenantId: string; invoiceId: string; ref: string } | null = null;
    await TestBed.configureTestingModule({
      imports: [EstadoCuentaComponent],
      providers: [
        {
          provide: PlataformaApi,
          useValue: {
            tenantInvoices: () => of(mockInvoices),
            markInvoicePaid: (tId: string, invId: string, ref: string) => {
              markedPaidParams = { tenantId: tId, invoiceId: invId, ref };
              return of({ ...mockInvoices[0], status: 'paid', paid_reference: ref });
            },
          },
        },
        { provide: SessionService, useValue: { can: (p: string) => p === 'subscriptions.write' } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 't1' }) } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(EstadoCuentaComponent);
    fixture.componentInstance.tenantId = 't1';
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Registrar pago');

    // Abre modal
    fixture.componentInstance.openPayModal(mockInvoices[0]);
    fixture.detectChanges();

    expect(fixture.componentInstance.payingInvoice()).toBe(mockInvoices[0]);

    // Establece referencia y confirma
    fixture.componentInstance.paymentReference.set('BNB-992211');
    fixture.componentInstance.confirmPayment();
    fixture.detectChanges();

    expect(markedPaidParams).toEqual({
      tenantId: 't1',
      invoiceId: 'inv-1',
      ref: 'BNB-992211',
    });
  });

  it('muestra estado vacío cuando no hay comprobantes emitidos', async () => {
    await TestBed.configureTestingModule({
      imports: [EstadoCuentaComponent],
      providers: [
        {
          provide: PlataformaApi,
          useValue: {
            myInvoices: () => of([]),
          },
        },
        { provide: SessionService, useValue: { can: () => false } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(EstadoCuentaComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Todavía no hay comprobantes.');
  });
});
