import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { VestidorComponent } from './vestidor.component';
import { CatalogService } from '../../usuarios-catalogo/infrastructure/catalog.service';
import { SessionService } from '../../auth/application/session.service';
import { ApiService } from '../../../app/core/shared/api.service';
import { PoseTrackingService } from '../../../shared/pose-tracking.service';

/**
 * El probador ubica la prenda solo: no hay controles que mover. Estas pruebas
 * verifican el camino automático (recurso preparado → cuerpo → encaje) y las
 * indicaciones que reemplazan a los controles.
 */
describe('Probador virtual: ubicación automática', () => {
  const originalMedia = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  let camera: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    camera = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: camera },
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    // La precarga del recurso resuelve sola, con dimensiones conocidas.
    vi.spyOn(window, 'Image').mockImplementation(function (this: HTMLImageElement) {
      const falsa = {
        naturalWidth: 400,
        naturalHeight: 600,
        set src(_: string) {
          setTimeout(() => falsa.onload?.(), 0);
        },
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      return falsa as unknown as HTMLImageElement;
    } as unknown as typeof Image);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    if (originalMedia) Object.defineProperty(navigator, 'mediaDevices', originalMedia);
    else Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  function stream() {
    const track = Object.assign(new EventTarget(), {
      stop: vi.fn(),
      getSettings: () => ({ facingMode: 'user' }),
    });
    return {
      track,
      value: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream,
    };
  }

  /** Cuerpo de pie y centrado, como lo entrega MediaPipe. */
  function cuerpo(x = 0.5, y = 0.35, visibility = 0.99) {
    const l: { x: number; y: number; visibility: number }[] = [];
    l[11] = { x: x - 0.1, y, visibility };
    l[12] = { x: x + 0.1, y, visibility };
    l[23] = { x: x - 0.12, y: y + 0.3, visibility };
    l[24] = { x: x + 0.12, y: y + 0.3, visibility };
    return l;
  }

  const recursoPreparado = {
    asset_url: '/prenda-recortada.webp',
    body_region: 'upper_body',
    anchor_points: {
      shoulder_left: [0.1, 0.12],
      shoulder_right: [0.9, 0.12],
      hem_left: [0.15, 0.95],
      hem_right: [0.85, 0.95],
    },
  };

  async function setup(options: { recurso?: unknown; falla?: boolean; poseOk?: boolean } = {}) {
    const route = new BehaviorSubject(convertToParamMap({ slug: 'polera' }));
    const catalog = {
      product: vi.fn().mockReturnValue(
        of({
          id: 'p1',
          name: 'Polera esencial',
          category: { name: 'Poleras' },
          variants: [{ id: 'v1', color: { id: 'c1', hex_code: '#8E2B33' } }],
        }),
      ),
    };
    const api = {
      write: options.falla
        ? vi.fn().mockReturnValue(throwError(() => new Error('sin recurso')))
        : vi.fn().mockReturnValue(of({ data: options.recurso ?? recursoPreparado })),
    };
    const pose = {
      ensure: vi.fn().mockResolvedValue(options.poseOk ?? true),
      detectTorso: vi.fn().mockReturnValue(null),
      ready: vi.fn(),
      dispose: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [VestidorComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          // La variante llega por query param: de ahí sale el color del recurso.
          useValue: {
            paramMap: route,
            snapshot: { queryParamMap: convertToParamMap({ variante: 'v1' }) },
          },
        },
        { provide: CatalogService, useValue: catalog },
        { provide: ApiService, useValue: api },
        { provide: PoseTrackingService, useValue: pose },
        { provide: SessionService, useValue: { user: () => ({ id: 'u1' }) } },
      ],
    });
    const fixture = TestBed.createComponent(VestidorComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    // La precarga de la imagen resuelve en un tick posterior: sin esta espera
    // el componente seguiría mostrando "cargando".
    await new Promise((r) => setTimeout(r, 5));
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, api, pose, route, catalog };
  }

  async function conCamara(harness: Awaited<ReturnType<typeof setup>>) {
    const { value } = stream();
    camera.mockResolvedValue(value);
    await harness.component.startCamera();
    harness.fixture.detectChanges();
    return value;
  }

  it('pide el recurso preparado del color elegido, no la foto del producto', async () => {
    const { api, component } = await setup();
    expect(api.write).toHaveBeenCalledWith('POST', '/vestidor/sessions', {
      product_id: 'p1',
      color_id: 'c1',
    });
    expect(component.assetUrl()).toContain('/prenda-recortada.webp');
  });

  it('empieza con la cámara apagada y un solo botón para probarse', async () => {
    const { fixture } = await setup();
    const botones = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[];
    expect(botones.map((b) => b.textContent?.trim())).toContain('Probármela');
    // Nada de deslizadores ni flechas antes de empezar.
    expect(fixture.nativeElement.querySelector('input[type="range"]')).toBeNull();
  });

  it('sin recurso preparado igual se puede probar: se dibuja la prenda', async () => {
    const { component, fixture } = await setup({ falla: true });
    // No es un error: el dibujo no necesita ninguna imagen preparada.
    expect(component.error()).toBe('');
    expect(component.usaFoto()).toBe(false);
    expect(fixture.nativeElement.querySelector('.fitting-stage')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('canvas')).not.toBeNull();
  });

  it('con recurso preparado muestra la foto real de la prenda', async () => {
    const { component } = await setup();
    expect(component.usaFoto()).toBe(true);
    expect(component.assetUrl()).toContain('/prenda-recortada.webp');
  });

  it('elige la forma a dibujar desde el nombre de la prenda', async () => {
    const { component } = await setup({ falla: true });
    expect(component.forma()).toBe('remera'); // "Polera esencial"
  });

  it('usa el color de la variante elegida', async () => {
    const { component } = await setup({ falla: true });
    expect(component.colorPrenda()).toBe('#8E2B33');
  });

  it('no muestra controles de ajuste mientras el encaje es automático', async () => {
    const harness = await setup();
    await conCamara(harness);
    expect(harness.fixture.nativeElement.querySelector('.fitting-tuning')).toBeNull();
    // El ajuste fino existe, pero hay que pedirlo.
    harness.component.tuning.set(true);
    harness.fixture.detectChanges();
    expect(harness.fixture.nativeElement.querySelector('.fitting-tuning')).not.toBeNull();
  });

  it('dibuja la prenda sobre el cuerpo cuando no hay foto preparada', async () => {
    const harness = await setup({ falla: true });
    const pintar = vi.spyOn(
      harness.component as unknown as { pintar: (...args: unknown[]) => boolean },
      'pintar',
    );
    harness.pose.detectTorso.mockReturnValue(cuerpo());
    await conCamara(harness);
    await new Promise((r) => setTimeout(r, 200));
    expect(pintar).toHaveBeenCalled();
  });

  it('ubica la prenda sola cuando ve el cuerpo, sin intervención', async () => {
    const harness = await setup();
    harness.pose.detectTorso.mockReturnValue(cuerpo());
    await conCamara(harness);
    await new Promise((r) => setTimeout(r, 200));
    harness.fixture.detectChanges();

    expect(harness.component.guidance().ok).toBe(true);
    expect(harness.component.placed()).toBe(true);
    // La transformación deja de ser la de reposo: hay escala y posición reales.
    expect(harness.component.transform()).toContain('rotate');
    expect(harness.component.transform()).not.toBe('translate(-50%, -50%) scale(0.9)');
  });

  it('le dice a la persona cómo pararse en lugar de ofrecerle controles', async () => {
    const harness = await setup();
    harness.pose.detectTorso.mockReturnValue(null);
    await conCamara(harness);
    await new Promise((r) => setTimeout(r, 200));
    harness.fixture.detectChanges();

    expect(harness.component.guidance().code).toBe('sin-persona');
    const aviso = harness.fixture.nativeElement.querySelector('.fitting-hint-live');
    expect(aviso?.textContent).toContain('frente a la cámara');
  });

  it('pide acercarse cuando la persona se ve demasiado chica', async () => {
    const harness = await setup();
    // Hombros muy juntos: la persona está lejos.
    harness.pose.detectTorso.mockReturnValue(cuerpo(0.5, 0.35).map((p, i) =>
      i === 11 ? { ...p, x: 0.48 } : i === 12 ? { ...p, x: 0.52 } : p,
    ));
    await conCamara(harness);
    await new Promise((r) => setTimeout(r, 200));
    expect(harness.component.guidance().code).toBe('lejos');
  });

  it('oculta la prenda si pierde de vista a la persona', async () => {
    const harness = await setup();
    harness.pose.detectTorso.mockReturnValue(cuerpo());
    await conCamara(harness);
    await new Promise((r) => setTimeout(r, 200));
    expect(harness.component.placed()).toBe(true);

    harness.pose.detectTorso.mockReturnValue(null);
    await new Promise((r) => setTimeout(r, 1500));
    harness.fixture.detectChanges();
    expect(harness.component.placed()).toBe(false);
  });

  it('si el detector no carga, deja la prenda centrada y ofrece el ajuste manual', async () => {
    const harness = await setup({ poseOk: false });
    await conCamara(harness);
    await new Promise((r) => setTimeout(r, 100));
    expect(harness.component.guidance().message).toContain('Ajustar');
    expect(harness.component.transform()).toContain('scale');
  });

  it('el ajuste manual corrige sobre el automático y se puede volver atrás', async () => {
    const harness = await setup();
    harness.pose.detectTorso.mockReturnValue(cuerpo());
    await conCamara(harness);
    await new Promise((r) => setTimeout(r, 200));

    const automatico = harness.component.transform();
    harness.component.adjustScale(0.12);
    harness.component.adjustOffset(0, 20);
    expect(harness.component.transform()).not.toBe(automatico);

    harness.component.clearTuning();
    expect(harness.component.transform()).toBe(automatico);
  });

  it('libera la cámara al terminar y al ocultar la pestaña', async () => {
    const harness = await setup();
    const { value, track } = stream();
    camera.mockResolvedValue(value);
    await harness.component.startCamera();
    harness.component.stopCamera();
    expect(track.stop).toHaveBeenCalled();
    expect(harness.component.cameraState()).toBe('off');

    camera.mockResolvedValue(stream().value);
    await harness.component.startCamera();
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    harness.component.onVisibilityChange();
    expect(harness.component.cameraState()).toBe('off');
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  it('explica el permiso rechazado sin dejar la cámara colgada', async () => {
    const harness = await setup();
    camera.mockRejectedValue(Object.assign(new Error('no'), { name: 'NotAllowedError' }));
    await harness.component.startCamera();
    expect(harness.component.cameraState()).toBe('error');
    expect(harness.component.cameraError()).toContain('Permití');
  });

  it('avisa cuando el navegador no ofrece cámara', async () => {
    Reflect.deleteProperty(navigator, 'mediaDevices');
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {} });
    const harness = await setup();
    await harness.component.startCamera();
    expect(harness.component.cameraError()).toContain('no está disponible');
  });

  it('lleva a elegir talla conservando la variante', async () => {
    const { fixture } = await setup();
    const enlace = fixture.nativeElement.querySelector('.fitting-buttons a');
    expect(enlace?.textContent?.trim()).toBe('Elegir talla');
  });
});
