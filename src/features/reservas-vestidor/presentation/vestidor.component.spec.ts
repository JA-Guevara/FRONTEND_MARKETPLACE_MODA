import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { VestidorComponent } from './vestidor.component';
import { CatalogService } from '../../usuarios-catalogo/infrastructure/catalog.service';
import { SessionService } from '../../auth/application/session.service';
import { ApiService } from '../../../app/core/shared/api.service';
import { PoseTrackingService } from '../../../shared/pose-tracking.service';

describe('Probador manual: cámara y recursos', () => {
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
    const value = {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream;
    return { track, value };
  }
  async function setup(hasAsset = true, authenticated = false) {
    const route = new BehaviorSubject(convertToParamMap({ slug: 'polera' }));
    const catalog = {
      product: vi
        .fn()
        .mockReturnValue(
          of({
            id: 'p1',
            name: 'Polera',
            ar_assets: hasAsset
              ? [{ is_active: true, asset_type: 'image_overlay', asset_url: '/polera.webp' }]
              : [],
          }),
        ),
    };
    const api = { write: vi.fn().mockReturnValue(of({ data: {} })) };
    const pose = { ensure: vi.fn().mockResolvedValue(true), detectTorso: vi.fn(), ready: vi.fn(), dispose: vi.fn() };
    TestBed.configureTestingModule({
      imports: [VestidorComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: route } },
        { provide: CatalogService, useValue: catalog },
        { provide: ApiService, useValue: api },
        { provide: PoseTrackingService, useValue: pose },
        {
          provide: SessionService,
          useValue: { user: () => (authenticated ? { id: 'u1' } : null) },
        },
      ],
    });
    const fixture = TestBed.createComponent(VestidorComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    if (hasAsset) {
      fixture.nativeElement.querySelector('img').dispatchEvent(new Event('load'));
      fixture.detectChanges();
    }
    return { fixture, component: fixture.componentInstance, api, route, catalog, pose };
  }
  it('crea el video antes del permiso y no activa la cámara automáticamente', async () => {
    const { fixture, component, api } = await setup();
    expect(fixture.nativeElement.querySelector('video')).toBeTruthy();
    expect(component.cameraState()).toBe('off');
    expect(camera).not.toHaveBeenCalled();
    expect(api.write).not.toHaveBeenCalled();
  });
  it('conecta el stream al video y libera los tracks al cerrar', async () => {
    const { fixture, component, api } = await setup(true, true);
    const media = stream();
    camera.mockResolvedValue(media.value);
    await component.startCamera();
    expect(component.cameraState()).toBe('active');
    expect(fixture.nativeElement.querySelector('video').srcObject).toBe(media.value);
    expect(api.write).toHaveBeenCalledWith('POST', '/vestidor/sessions', { product_id: 'p1' });
    component.stopCamera();
    expect(media.track.stop).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('video').srcObject).toBeNull();
  });
  it('rechaza aperturas duplicadas y detiene un permiso que llega después de cancelar', async () => {
    const { component } = await setup();
    const media = stream();
    let resolve!: (value: MediaStream) => void;
    camera.mockReturnValue(new Promise<MediaStream>((r) => (resolve = r)));
    const pending = component.startCamera();
    await component.startCamera();
    expect(camera).toHaveBeenCalledOnce();
    component.stopCamera();
    resolve(media.value);
    await pending;
    expect(media.track.stop).toHaveBeenCalledOnce();
    expect(component.cameraState()).toBe('off');
  });
  it('detiene el stream si el usuario sale mientras el permiso está pendiente', async () => {
    const { fixture, component } = await setup();
    const media = stream();
    let resolve!: (value: MediaStream) => void;
    camera.mockReturnValue(new Promise<MediaStream>((r) => (resolve = r)));
    const pending = component.startCamera();
    fixture.destroy();
    resolve(media.value);
    await pending;
    expect(media.track.stop).toHaveBeenCalledOnce();
  });
  it('informa permiso rechazado y permite reintentar', async () => {
    const { component } = await setup();
    camera.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    await component.startCamera();
    expect(component.cameraError()).toContain('Permití');
    camera.mockResolvedValue(stream().value);
    await component.startCamera();
    expect(component.cameraState()).toBe('active');
    expect(component.cameraError()).toBe('');
  });
  it('libera la cámara si el video no puede reproducirse', async () => {
    const { component } = await setup();
    const media = stream();
    camera.mockResolvedValue(media.value);
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error('play failed'));
    await component.startCamera();
    expect(media.track.stop).toHaveBeenCalledOnce();
    expect(component.cameraState()).toBe('error');
  });
  it('no ofrece cámara ni controles para una prenda sin recurso', async () => {
    const { fixture, component } = await setup(false);
    expect(component.error()).toContain('imagen preparada');
    expect(fixture.nativeElement.querySelector('video')).toBeNull();
    await component.startCamera();
    expect(camera).not.toHaveBeenCalled();
  });
  it('una imagen rota impide continuar y apaga la cámara', async () => {
    const { component } = await setup();
    const media = stream();
    camera.mockResolvedValue(media.value);
    await component.startCamera();
    component.onImageError();
    expect(media.track.stop).toHaveBeenCalledOnce();
    expect(component.imageReady()).toBe(false);
    await component.startCamera();
    expect(camera).toHaveBeenCalledOnce();
  });
  it('cierra el stream anterior al cambiar de cámara', async () => {
    const { component } = await setup();
    const first = stream();
    camera.mockResolvedValueOnce(first.value).mockResolvedValueOnce(stream().value);
    await component.startCamera();
    await component.switchCamera();
    expect(first.track.stop).toHaveBeenCalledOnce();
    expect(camera).toHaveBeenLastCalledWith({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  });
  it('informa desconexión del dispositivo', async () => {
    const { component } = await setup();
    const media = stream();
    camera.mockResolvedValue(media.value);
    await component.startCamera();
    media.track.dispatchEvent(new Event('ended'));
    expect(component.cameraState()).toBe('error');
    expect(component.cameraError()).toContain('desconectó');
  });
  it('el fallo de bitácora no bloquea la cámara y se comunica', async () => {
    const { component, api } = await setup(true, true);
    api.write.mockReturnValue(throwError(() => new Error('offline')));
    camera.mockResolvedValue(stream().value);
    await component.startCamera();
    await Promise.resolve();
    expect(component.cameraState()).toBe('active');
    expect(component.auditNotice()).toContain('no pudimos registrar');
  });
  it('cambiar de producto apaga la cámara y restablece la posición', async () => {
    const { component, route, fixture } = await setup();
    const media = stream();
    camera.mockResolvedValue(media.value);
    await component.startCamera();
    component.nudge(12, 12);
    route.next(convertToParamMap({ slug: 'camisa' }));
    await fixture.whenStable();
    expect(media.track.stop).toHaveBeenCalledOnce();
    expect(component.slug).toBe('camisa');
    expect(component.offsetX()).toBe(0);
    expect(component.cameraState()).toBe('off');
  });
  it('avisa cuando el navegador no ofrece getUserMedia', async () => {
    const { component } = await setup();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    await component.startCamera();
    expect(component.cameraState()).toBe('error');
    expect(component.cameraError()).toContain('HTTPS');
  });
  it('apaga una cámara activa al ocultar la pestaña', async () => {
    const { component } = await setup();
    const media = stream();
    camera.mockResolvedValue(media.value);
    await component.startCamera();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    component.onVisibilityChange();
    expect(media.track.stop).toHaveBeenCalledOnce();
    expect(component.cameraState()).toBe('off');
  });
  it('permite ajustar con controles y restablecer sin arrastrar', async () => {
    const { component } = await setup();
    component.nudge(12, -12);
    component.setScale({ target: { value: '99' } } as unknown as Event);
    expect(component.offsetX()).toBe(12);
    expect(component.offsetY()).toBe(-12);
    expect(component.scale()).toBe(3);
    component.reset();
    expect(component.offsetX()).toBe(0);
    expect(component.offsetY()).toBe(0);
    expect(component.scale()).toBe(1);
  });
  it('re-acota la prenda si el escenario cambia de tamaño (probador estable)', async () => {
    const { component } = await setup();
    const stage = (component as any).stageRef.nativeElement;
    const rect = (w: number, h: number) =>
      ({ width: w, height: h, top: 0, left: 0, right: w, bottom: h, x: 0, y: 0 }) as DOMRect;
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue(rect(300, 400));
    component.nudge(500, 600);
    // Núcleo del ajuste: el movimiento no se sale de la zona de la prenda.
    expect(component.offsetX()).toBe(135);
    expect(component.offsetY()).toBe(180);
    // Rotación / ventana más chica mientras la cámara está activa: la prenda
    // sigue dentro aunque el usuario no la haya tocado.
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue(rect(120, 160));
    (component as any).ensureClamped();
    expect(component.offsetX()).toBe(54);
    expect(component.offsetY()).toBe(72);
  });
  it('no activa el seguimiento de postura sin cámara y avisa', async () => {
    const { component, pose } = await setup();
    await component.togglePose();
    expect(component.poseMode()).toBe(false);
    expect(component.poseError()).toContain('Activá la cámara');
    expect(pose.ensure).not.toHaveBeenCalled();
  });
  it('con cámara activa, seguir la postura mueve la prenda y se puede apagar', async () => {
    const { component, pose } = await setup();
    const media = stream();
    camera.mockResolvedValue(media.value);
    await component.startCamera();
    pose.detectTorso.mockReturnValue({ x: 0.65, y: 0.6 });
    await component.togglePose();
    expect(component.poseMode()).toBe(true);
    expect(pose.ensure).toHaveBeenCalled();
    expect(component.poseTracking()).toBe(true);
    // Cámara frontal (espejada): x 0.65 del torso queda a la izquierda del centro.
    expect(component.offsetX()).toBeLessThan(0);
    // El torso está debajo del centro del escenario.
    expect(component.offsetY()).toBeGreaterThan(0);
    component.togglePose();
    expect(component.poseMode()).toBe(false);
  });
  it('si el modelo de postura no se puede cargar, queda el ajuste manual', async () => {
    const { component, pose } = await setup();
    const media = stream();
    camera.mockResolvedValue(media.value);
    await component.startCamera();
    pose.ensure.mockResolvedValue(false);
    await component.togglePose();
    expect(component.poseMode()).toBe(false);
    expect(component.poseError()).toContain('ajuste manual sigue disponible');
  });
  it('ofrece comprar o reservar desde el probador resolviendo la variante en la ficha', async () => {
    const { fixture } = await setup();
    const buttons = fixture.nativeElement.querySelectorAll('.fitting-shopping button');
    expect(buttons.length).toBe(2);
    expect(buttons[0]?.textContent).toContain('Elegir color/talla y comprar');
    expect(buttons[1]?.textContent).toContain('Reservar esta prenda');
  });
});
