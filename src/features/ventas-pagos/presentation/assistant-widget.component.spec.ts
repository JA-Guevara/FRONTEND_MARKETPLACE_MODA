import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AssistantWidgetComponent } from './assistant-widget.component';
import { CommerceService } from '../infrastructure/commerce.service';
import { SessionService } from '../../auth/application/session.service';
import { CatalogService } from '../../usuarios-catalogo/infrastructure/catalog.service';
import { DashboardService } from '../../ia-reportes/infrastructure/dashboard.service';
import { AssistantContextService } from '../../../shared/assistant-context.service';

function setup(options: { permissions?: string[] } = {}) {
  const user = signal<{ id: string } | null>(null);
  const deferreds: { res: (v: { available: boolean; reply: string }) => void; rej: (e: Error) => void }[] = [];
  const write = vi.fn().mockImplementation(
    () =>
      new Promise<{ available: boolean; reply: string }>((res, rej) => {
        deferreds.push({ res, rej });
      }),
  );
  const catalog = {
    reference: vi.fn().mockReturnValue(
      of([
        { id: 'cat-1', name: 'Camperas' },
        { id: 'cat-2', name: 'Camisas' },
      ]),
    ),
    draftProduct: vi.fn(),
    createProduct: vi.fn(),
  };
  const dashboard = { interpret: vi.fn(), explain: vi.fn(), insights: vi.fn(), executeTool: vi.fn() };
  TestBed.configureTestingModule({
    imports: [AssistantWidgetComponent],
    providers: [
      { provide: CommerceService, useValue: { write } },
      { provide: SessionService, useValue: { user, can: (p: string) => (options.permissions ?? []).includes(p) } },
      { provide: CatalogService, useValue: catalog },
      { provide: DashboardService, useValue: dashboard },
      { provide: Router, useValue: { url: '/', navigate: vi.fn().mockResolvedValue(true), events: of(new NavigationEnd(1, '/', '/')) } },
    ],
  });
  const fixture = TestBed.createComponent(AssistantWidgetComponent);
  fixture.detectChanges();
  const ctx = TestBed.inject(AssistantContextService);
  return { fixture, write, catalog, dashboard, deferreds, ctx, user };
}

describe('Asistente: indicador de espera con tres puntos', () => {

  it('el reintento de un borrador vuelve a preparar el borrador y no cae en el chat general', async () => {
    const { fixture, write, catalog } = setup({ permissions: ['catalog.write'] });
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    catalog.draftProduct.mockRejectedValueOnce(new Error('Conexión perdida'));

    const first = fixture.componentInstance.send('registrame una campera de cuero negra a 450 Bs');
    await first;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(write).not.toHaveBeenCalled();

    const userMessages = () => fixture.nativeElement.querySelectorAll('.ai-msg--user').length;
    const before = userMessages();

    catalog.draftProduct.mockResolvedValueOnce({
      available: true, matched: true, name: 'Campera de cuero negra', description: 'Campera de cuero',
      base_price: '450.00', category_id: 'cat-1', brand: 'FashionStore', gender: 'mujer',
    });
    const retry = fixture.componentInstance.retry();
    await retry;
    fixture.detectChanges();

    // Se llamó otra vez a la preparación del borrador, nunca al chat general.
    expect(catalog.draftProduct).toHaveBeenCalledTimes(2);
    expect(catalog.draftProduct).toHaveBeenLastCalledWith('registrame una campera de cuero negra a 450 Bs');
    expect(write).not.toHaveBeenCalled();
    expect(userMessages()).toBe(before);
    expect(fixture.componentInstance.productDraft()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('"registrame una prenda" crea SOLO tras confirmar el borrador (una sola llamada)', async () => {
    const { fixture, catalog } = setup({ permissions: ['catalog.write'] });
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    catalog.draftProduct.mockResolvedValueOnce({
      available: true, matched: true, name: 'Campera de cuero negra', description: 'Campera de cuero',
      base_price: '450.00', category_id: 'cat-1', brand: 'FashionStore', gender: 'mujer',
    });
    await fixture.componentInstance.send('registrame una campera de cuero negra a 450 Bs');
    fixture.detectChanges();
    expect(catalog.createProduct).not.toHaveBeenCalled();
    // El borrador se revisa (formulario en pantalla) y al confirmar se crea la prenda.
    catalog.createProduct.mockResolvedValueOnce({
      id: 'p-1', name: 'Campera de cuero negra', slug: 'campera-de-cuero-negra', base_price: '450.00',
      description: '', gender: 'mujer', brand: 'FashionStore', is_active: true, deleted_at: null,
      category: { id: 'cat-1', name: 'Camperas' }, season: null, collection: null, is_featured: false,
      variants: [], images: [], ar_assets: [], suppliers: [],
    } as any);
    const draft = fixture.componentInstance.productDraft();
    expect(draft).not.toBeNull();
    const confirmed = fixture.componentInstance.confirmDraft();
    await confirmed;
    fixture.detectChanges();
    expect(catalog.createProduct).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.productDraft()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Prenda creada:');
  });

  it('muestra tres puntos sin robot en el mensaje de espera y desaparecen al responder', async () => {
    const { fixture, deferreds } = setup();
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    // Robot del botón + robot de la cabecera se conservan al abrir.
    expect(fixture.nativeElement.querySelectorAll('fs-bot-avatar').length).toBe(2);

    const pending = fixture.componentInstance.send('¿Cómo sigo mi pedido?');
    fixture.detectChanges();
    expect(fixture.componentInstance.busy()).toBe(true);

    const typing = fixture.nativeElement.querySelector('.ai-msg--typing');
    expect(typing).not.toBeNull();
    expect(typing.querySelectorAll('.ai-dot').length).toBe(3);
    expect(typing.querySelector('fs-bot-avatar')).toBeNull();
    expect(typing.getAttribute('role')).toBe('status');

    deferreds[0].res({ available: true, reply: 'Tu pedido se ve en Mi cuenta > Mis pedidos.' });
    await pending;
    fixture.detectChanges();
    expect(fixture.componentInstance.busy()).toBe(false);
    expect(fixture.nativeElement.querySelector('.ai-msg--typing')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Mis pedidos');
    expect(fixture.nativeElement.querySelectorAll('fs-bot-avatar').length).toBe(2);
  });

  it('quita los puntos cuando la solicitud falla y el reintento repite la consulta sin duplicar el mensaje', async () => {
    const { fixture, write, deferreds } = setup();
    fixture.componentInstance.toggle();
    fixture.detectChanges();

    const first = fixture.componentInstance.send('promedio de ventas');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ai-msg--typing')).not.toBeNull();

    deferreds[0].rej(new Error('Servidor no disponible'));
    await first;
    fixture.detectChanges();
    expect(fixture.componentInstance.busy()).toBe(false);
    expect(fixture.nativeElement.querySelector('.ai-msg--typing')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();

    const userMessages = () => fixture.nativeElement.querySelectorAll('.ai-msg--user').length;
    const before = userMessages();

    const retry = fixture.componentInstance.retry();
    fixture.detectChanges();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1][2]).toEqual({ message: 'promedio de ventas', context: undefined });
    expect(userMessages()).toBe(before);
    expect(fixture.nativeElement.querySelector('.ai-msg--typing')).not.toBeNull();

    deferreds[1].res({ available: true, reply: 'La semana que viene suben.' });
    await retry;
    fixture.detectChanges();
    expect(fixture.componentInstance.busy()).toBe(false);
    expect(fixture.nativeElement.querySelector('.ai-msg--typing')).toBeNull();
  });
});

describe('Asistente: contexto compartido de reportes', () => {
  /** No se dispara el descargo real del navegador en el test. */
  function fakeDownload() {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const create = URL.createObjectURL;
    const revoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    return () => {
      click.mockRestore();
      URL.createObjectURL = create;
      URL.revokeObjectURL = revoke;
    };
  }

  function allNullInterpret() {
    return of({
      ok: true, vista: 'resumen', agrupacion: null, metrica: 'revenue', comparacion: 'none',
      aclaraciones: [],
      filtros: { branch_id: null, category_id: null, date_from: null, date_to: null, status: null },
    });
  }

  function toolResponse(replay = false) {
    return of({
      body: new Blob(['x'], { type: 'application/octet-stream' }),
      headers: new HttpHeaders({ 'X-Idempotent-Replay': String(replay) }),
    });
  }

  it('ejecuta el pedido real con errores de escritura y deja un enlace descargable', async () => {
    const { fixture, dashboard, write } = setup({ permissions: ['dashboard.read'] });
    fixture.componentInstance.toggle();
    dashboard.interpret.mockReturnValue(allNullInterpret());
    dashboard.executeTool.mockReturnValue(toolResponse());
    const restore = fakeDownload();
    try {
      await fixture.componentInstance.send('ESPORTAME RPEORTE EN EXCEL DE VENTAS');
      fixture.detectChanges();
      expect(write).not.toHaveBeenCalled();
      expect(dashboard.executeTool).toHaveBeenCalledWith(expect.any(String), 'export_report', ['ventas'], 'xlsx', expect.any(Object));
      expect(fixture.nativeElement.querySelector('a[download]')?.getAttribute('download')).toBe('fashionstore_ventas.xlsx');
      fixture.destroy();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    } finally { restore(); }
  });

  it('exporta varios reportes y conserva su selección y filtros al pedir ahora PDF', async () => {
    const { fixture, dashboard, ctx } = setup({ permissions: ['dashboard.read'] });
    ctx.setReport({ branch_id: 'b-centro', date_from: '2026-09-01' });
    dashboard.interpret.mockReturnValue(allNullInterpret());
    dashboard.executeTool.mockReturnValue(toolResponse());
    const restore = fakeDownload();
    try {
      await fixture.componentInstance.send('exportame ventas y pedidos en Excel');
      ctx.setReport({ branch_id: null });
      await fixture.componentInstance.send('ahora en PDF');
      expect(dashboard.executeTool).toHaveBeenLastCalledWith(expect.any(String), 'export_report', ['ventas', 'pedidos'], 'pdf', expect.objectContaining({ branch_id: 'b-centro', date_from: '2026-09-01' }));
      expect(fixture.componentInstance.downloads().at(-1)?.name).toBe('fashionstore_ventas_pedidos.pdf');
      fixture.destroy();
    } finally { restore(); }
  });

  it('entrega los seis reportes CSV como ZIP', async () => {
    const { fixture, dashboard } = setup({ permissions: ['dashboard.read'] });
    dashboard.interpret.mockReturnValue(allNullInterpret());
    dashboard.executeTool.mockReturnValue(toolResponse());
    const restore = fakeDownload();
    try {
      await fixture.componentInstance.send('exportame todos los reportes en CSV');
      expect(dashboard.executeTool.mock.calls[0][2]).toHaveLength(6);
      expect(fixture.componentInstance.downloads()[0].name).toMatch(/\.zip$/);
      fixture.destroy();
    } finally { restore(); }
  });

  it('quita filtros del dashboard sin volver a heredarlos del contexto', async () => {
    const { fixture, dashboard, ctx } = setup({ permissions: ['dashboard.read'] });
    ctx.setReport({ branch_id: 'b-centro', category_id: 'cat-1', date_from: '2026-09-01', status: 'paid' });
    dashboard.interpret.mockReturnValue(allNullInterpret());
    await fixture.componentInstance.send('limpia todos los filtros');
    expect(ctx.applyRequest()?.query).toEqual({ branch_id: null, category_id: null, date_from: undefined, date_to: undefined, status: undefined });
  });

  it('un cliente sin permisos no ejecuta reportes administrativos ni deriva la orden al chat', async () => {
    const { fixture, dashboard, write } = setup();
    await fixture.componentInstance.send('exportame ventas en Excel');
    expect(dashboard.interpret).not.toHaveBeenCalled();
    expect(dashboard.executeTool).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('descarta una descarga tardía si se cerró la conversación', async () => {
    const { fixture, dashboard } = setup({ permissions: ['dashboard.read'] });
    dashboard.interpret.mockReturnValue(allNullInterpret());
    const response = new Subject<any>();
    dashboard.executeTool.mockReturnValue(response);
    const restore = fakeDownload();
    try {
      const pending = fixture.componentInstance.send('exportame ventas');
      await Promise.resolve();
      fixture.componentInstance.close();
      response.next({ body: new Blob(['x']), headers: new HttpHeaders() });
      response.complete();
      await pending;
      expect(URL.createObjectURL).not.toHaveBeenCalled();
      expect(fixture.componentInstance.downloads()).toEqual([]);
    } finally { restore(); }
  });

  it('elimina los archivos de la conversación cuando cambia el usuario', async () => {
    const { fixture, dashboard, user } = setup({ permissions: ['dashboard.read'] });
    user.set({ id: 'admin' });
    fixture.detectChanges();
    dashboard.interpret.mockReturnValue(allNullInterpret());
    dashboard.executeTool.mockReturnValue(toolResponse());
    const restore = fakeDownload();
    try {
      await fixture.componentInstance.send('exportame ventas');
      user.set(null);
      fixture.detectChanges();
      expect(fixture.componentInstance.downloads()).toEqual([]);
      expect(fixture.componentInstance.history()).toEqual([]);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    } finally { restore(); }
  });

  it('"exportá esto" usa los filtros visibles del dashboard y exporta eso, no todo', async () => {
    const { fixture, dashboard, ctx } = setup({ permissions: ['dashboard.read'] });
    fixture.componentInstance.toggle();
    const visible = { branch_id: 'b-x', category_id: null, date_from: '2026-08-01', date_to: '2026-09-01', status: undefined };
    ctx.setReport(visible);
    dashboard.interpret.mockReturnValue(allNullInterpret());
    dashboard.executeTool.mockReturnValue(toolResponse());
    const restore = fakeDownload();
    try {
      await fixture.componentInstance.send('exportá esto');
      fixture.detectChanges();
    } finally {
      restore();
    }
    // La interpretación se hace sobre el contexto visible, no en el vacío.
    expect(dashboard.interpret).toHaveBeenCalledWith('exportá esto', visible);
    // La herramienta export_report recibe el reporte y los campos que el
    // intérprete no resolvió caen al contexto visible.
    expect(dashboard.executeTool).toHaveBeenCalledWith(
      expect.any(String), 'export_report', ['ventas'], 'xlsx',
      {
        branch_id: 'b-x', category_id: null, status: undefined,
        date_from: '2026-08-01', date_to: '2026-09-01',
      },
    );
    expect(fixture.nativeElement.textContent).toContain('Archivo generado: ventas');
  });

  it('"ventas de la sucursal norte" resuelta exporta ventas (no sucursales) filtradas por esa sucursal', async () => {
    const { fixture, dashboard, ctx } = setup({ permissions: ['dashboard.read'] });
    fixture.componentInstance.toggle();
    dashboard.interpret.mockReturnValue(
      of({
        ok: true, vista: 'resumen', agrupacion: null, metrica: 'revenue', comparacion: 'none',
        aclaraciones: [],
        filtros: { branch_id: 'b-norte', category_id: null, date_from: null, date_to: null, status: null },
      }),
    );
    dashboard.executeTool.mockReturnValue(toolResponse());
    const restore = fakeDownload();
    try {
      await fixture.componentInstance.send('exportame ventas de la sucursal norte');
      fixture.detectChanges();
    } finally {
      restore();
    }
    expect(dashboard.executeTool).toHaveBeenCalledWith(
      expect.any(String), 'export_report', ['ventas'], 'xlsx',
      {
        branch_id: 'b-norte', category_id: null, status: undefined,
        date_from: undefined, date_to: undefined,
      },
    );
    expect(fixture.nativeElement.textContent).toContain('Archivo generado: ventas');
  });

  it('rehúsa descargar todo si mencionó una sucursal que no pudo resolver y no hay contexto', async () => {
    const { fixture, dashboard } = setup({ permissions: ['dashboard.read'] });
    fixture.componentInstance.toggle();
    dashboard.interpret.mockReturnValue(
      of({
        ok: true, vista: 'resumen', agrupacion: 'sucursal', metrica: 'revenue', comparacion: 'none',
        aclaraciones: ['No encontré esa sucursal'],
        filtros: { branch_id: null, category_id: null, date_from: null, date_to: null, status: null },
      }),
    );
    await fixture.componentInstance.send('exportame ventas de la sucursal norte');
    fixture.detectChanges();
    expect(dashboard.executeTool).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Sin ese filtro no descargo el reporte');
  });

  it('"mostrame ventas de la sucursal norte" aplica el filtro en la pantalla del dashboard', async () => {
    const { fixture, dashboard, ctx } = setup({ permissions: ['dashboard.read'] });
    fixture.componentInstance.toggle();
    dashboard.interpret.mockReturnValue(
      of({
        ok: true, vista: 'resumen', agrupacion: null, metrica: 'revenue', comparacion: 'none',
        aclaraciones: [],
        filtros: { branch_id: 'b-norte', category_id: null, date_from: null, date_to: null, status: null },
      }),
    );
    await fixture.componentInstance.send('mostrame las ventas de la sucursal norte');
    fixture.detectChanges();
    // El filtro resuelto se encola para que el dashboard lo aplique, no se
    // queda solo como texto del chat.
    const applied = ctx.applyRequest();
    expect(applied).not.toBeNull();
    expect(applied!.query.branch_id).toBe('b-norte');
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/admin/dashboard']);
    expect(fixture.nativeElement.textContent).toContain('los filtros de sucursal');
  });

  it('"explicame esto" usa el contexto y la respuesta incluye las limitaciones del análisis', async () => {
    const { fixture, dashboard, ctx } = setup({ permissions: ['dashboard.read'] });
    fixture.componentInstance.toggle();
    const visible = { branch_id: null, category_id: null, date_from: '2026-08-01', date_to: '2026-09-01', status: undefined };
    ctx.setReport(visible);
    dashboard.explain.mockReturnValue(
      of({
        available: true,
        message: '',
        sections: {
          hallazgo: 'Los pedidos bajaron 12%.',
          cifras: '12% menos que el mes anterior.',
          interpretacion: 'Menos tráfico en redes.',
          accion: 'Reforzar promos.',
          limitaciones: 'Análisis sobre pedidos pagos.',
        },
      }),
    );
    await fixture.componentInstance.send('explicame esto');
    fixture.detectChanges();
    expect(dashboard.explain).toHaveBeenCalledWith('explicame esto', visible);
    expect(fixture.nativeElement.textContent).toContain('Los pedidos bajaron 12%');
    expect(fixture.nativeElement.textContent).toContain('Limitaciones: Análisis sobre pedidos pagos.');
  });

  it('la voz deja la transcripción en el input lista para revisar, sin enviarla sola', async () => {
    const FakeRecognition = vi.fn().mockImplementation(function (this: any) {
      this.lang = '';
      this.interimResults = false;
      this.maxAlternatives = 1;
      this.handlers = {} as Record<string, (e?: any) => void>;
      this.addEventListener = (ev: string, fn: (e?: any) => void) => (this.handlers[ev] = fn);
      this.start = vi.fn();
      this.stop = vi.fn();
    });
    const prev = (globalThis as any).SpeechRecognition;
    (globalThis as any).SpeechRecognition = FakeRecognition;
    try {
      const { fixture } = setup();
      const recognition = (fixture.componentInstance as any).recognition;
      expect(recognition).not.toBeNull();
      fixture.componentInstance.toggle();
      fixture.componentInstance.toggleVoice();
      recognition.handlers.result({ results: [{ 0: { transcript: 'agenda una visita para mañana' } }] });
      fixture.detectChanges();
      expect(fixture.componentInstance.draft).toBe('agenda una visita para mañana');
      expect(fixture.nativeElement.querySelectorAll('.ai-msg--user').length).toBe(0);
    } finally {
      (globalThis as any).SpeechRecognition = prev;
    }
  });
});
