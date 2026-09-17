import {
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CatalogService } from '../../usuarios-catalogo/infrastructure/catalog.service';
import { SessionService } from '../../auth/application/session.service';
import { ApiService } from '../../../app/core/shared/api.service';
import { IconComponent } from '../../../shared/icon.component';
import { errorMessage } from '../../../shared/errors';
import { PoseTrackingService } from '../../../shared/pose-tracking.service';
import {
  shoulderPose,
  smoothPose,
  scaleFromShoulders,
  POSE_LOST_MS,
  VideoBox,
} from '../../../shared/pose-projection';

type CameraState = 'off' | 'requesting' | 'active' | 'error';
type PoseState = 'off' | 'busy' | 'searching' | 'tracking' | 'lost';

/** Superposición 2D manual o guiada por postura; no determina la talla. */
@Component({
  selector: 'fs-vestidor',
  imports: [RouterLink, IconComponent],
  styleUrl: './vestidor.scss',
  host: { '(document:visibilitychange)': 'onVisibilityChange()' },
  template: `<section class="fitting-page">
    <a
      [routerLink]="['/prendas', slug]"
      [queryParams]="varianteId ? { variante: varianteId } : undefined"
      >← Volver a la prenda</a
    >
    <header>
      <p class="eyebrow">PROBADOR VIRTUAL · CÁMARA Y POSTURA</p>
      <h1>{{ productName() || 'Probador virtual' }}</h1>
      <p>
        Ubicá la imagen de la prenda sobre tu cámara. Esta vista es orientativa y no determina tu
        talla.
      </p>
    </header>
    @if (loading()) {
      <p role="status">Cargando prenda…</p>
    }
    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
      <button type="button" (click)="load(slug)">Reintentar carga</button>
    }
    @if (!loading() && assetUrl()) {
      <div class="fitting-layout">
        <div class="fitting-stage" #stage>
          <video
            #video
            autoplay
            playsinline
            muted
            [class.mirrored]="facing() === 'user'"
              [hidden]="cameraState() === 'off' || cameraState() === 'error'"
            aria-label="Vista de tu cámara"
          ></video>
          @if (cameraState() !== 'active') {
            <div class="fitting-guide">
              <fs-icon name="camera" />
              <p>
                {{
                  cameraState() === 'requesting'
                    ? 'Aceptá el permiso de cámara para continuar.'
                    : 'Activá la cámara para verte con la prenda.'
                }}
              </p>
            </div>
          }
          @if (!imageFailed()) {
            <img
              class="fitting-overlay"
              [src]="assetUrl()"
              [alt]="'Vista frontal de ' + productName()"
              draggable="false"
              [class.ready]="imageReady() && cameraState() === 'active'"
              [class.pose-faded]="poseFaded()"
              [style.transform]="
                'translate(-50%, -50%) translate(' +
                offsetX() +
                'px,' +
                offsetY() +
                'px) rotate(' +
                poseRot() +
                'rad) scale(' +
                scale() +
                ')'
              "
              (load)="imageReady.set(true)"
              (error)="onImageError()"
              (pointerdown)="startDrag($event)"
              (pointermove)="moveDrag($event)"
              (pointerup)="endDrag()"
              (pointercancel)="endDrag()"
              (lostpointercapture)="endDrag()"
            />
          }
        </div>
        <aside class="fitting-settings" aria-label="Controles del probador">
          <h2>Tu vista previa</h2>
          <p>
            Dejá visibles tus hombros y cintura. Arrastrá la prenda o usá los controles para
            acomodarla.
          </p>
          @if (!imageReady() && !imageFailed()) {
            <p role="status">Cargando imagen de la prenda…</p>
          }
          @if (imageFailed()) {
            <p class="alert error" role="alert">
              No se pudo cargar la imagen. Volvé a intentar o elegí otra prenda.
            </p>
            <button type="button" (click)="load(slug)">Reintentar imagen</button>
          }
          @if (cameraError()) {
            <p class="alert error" role="alert">{{ cameraError() }}</p>
          }
          <div class="fitting-actions">
            @if (cameraState() === 'active' || cameraState() === 'requesting') {
              <button type="button" (click)="stopCamera()">
                <fs-icon name="close" />{{
                  cameraState() === 'requesting' ? 'Cancelar activación' : 'Apagar cámara'
                }}
              </button>
            } @else {
              <button
                type="button"
                class="primary"
                [disabled]="!imageReady()"
                (click)="startCamera()"
              >
                <fs-icon name="camera" />{{
                  cameraState() === 'error' ? 'Reintentar cámara' : 'Activar cámara'
                }}
              </button>
            }
            <button type="button" [disabled]="cameraState() !== 'active'" (click)="switchCamera()">
              <fs-icon name="refresh" />Cambiar cámara
            </button>
            <button
              type="button"
              [class.active]="poseMode()"
              [disabled]="cameraState() !== 'active' || poseBusy()"
              (click)="togglePose()"
            >
              <fs-icon name="camera" />{{ poseBusy() ? 'Preparando…' : poseMode() ? 'Apagar seguimiento' : 'Seguir mi postura' }}
            </button>
          </div>
          @if (poseError()) {
            <p class="alert error" role="alert">{{ poseError() }}</p>
          }
          @if (poseState() !== 'off' && poseState() !== 'busy' && cameraState() === 'active') {
            <p class="pose-status" [class.lost]="poseState() === 'lost'" role="status">
              @switch (poseState()) {
                @case ('searching') {
                  Buscando a una persona… Encuadrá hombros y cintura a buena luz.
                }
                @case ('tracking') {
                  Seguimiento activo: la prenda sigue tu torso, inclinación y distancia.
                }
                @case ('lost') {
                  Te perdimos de vista. Volvé al encuadre y el seguimiento se reanuda solo.
                }
              }
            </p>
          }
          <fieldset [disabled]="cameraState() !== 'active' || !imageReady()">
            <legend>Ajustar prenda</legend>
            <label
              >Tamaño
              <input
                type="range"
                min="0.4"
                max="3"
                step="0.05"
                [value]="scale()"
                (input)="setScale($event)"
            /></label>
            <div class="fitting-directions" role="group" aria-label="Mover prenda">
              <button type="button" (click)="nudge(0, -12)">↑ Arriba</button
              ><button type="button" (click)="nudge(0, 12)">↓ Abajo</button>
              <button type="button" (click)="nudge(-12, 0)">← Izquierda</button
              ><button type="button" (click)="nudge(12, 0)">→ Derecha</button>
            </div>
            <button type="button" (click)="reset()">
              <fs-icon name="refresh" />Centrar y restablecer
            </button>
          </fieldset>
          @if (productName()) {
            <div class="fitting-shopping" role="group" aria-label="Comprar o reservar esta prenda">
              <p>
                La variante (color y talla) se elige en la ficha de la prenda al agregar al carrito
                o al reservar.
              </p>
              <button
                type="button"
                class="primary"
                [routerLink]="['/prendas', slug]"
                [queryParams]="varianteId ? { variante: varianteId } : undefined"
              >
                Elegir talla y comprar
              </button>
              <button
                type="button"
                [routerLink]="['/prendas', slug]"
                [queryParams]="varianteId ? { variante: varianteId } : undefined"
              >
                Elegir talla y reservar
              </button>
            </div>
          }
          <p class="fitting-note">
            La cámara no se graba ni se envía al servidor. Elegí ajuste manual o seguimiento de postura.
          </p>
          <p class="fitting-note">
            {{
              poseMode()
                ? 'El seguimiento procesa el video en tu navegador (MediaPipe): ajusta posición, tamaño e inclinación a medida que te movés. No se promete talla exacta, tela ni comportamiento 3D. Podés arrastrar/ajustar en cualquier momento.'
                : 'Modo manual: mové y ajustá el tamaño de la prenda. Podés activar el seguimiento para que la prenda siga tu torso.'
            }}
          </p>
          @if (auditNotice()) {
            <p class="fitting-note" role="status">{{ auditNotice() }}</p>
          }
        </aside>
      </div>
    }
  </section>`,
})
export class VestidorComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private catalog = inject(CatalogService);
  private api = inject(ApiService);
  private session = inject(SessionService);
  private poseService = inject(PoseTrackingService);
  private destroyRef = inject(DestroyRef);
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('stage') stageRef?: ElementRef<HTMLDivElement>;
  slug = '';
  varianteId: string | null = null;
  loading = signal(true);
  error = signal('');
  cameraError = signal('');
  cameraState = signal<CameraState>('off');
  facing = signal<'user' | 'environment'>('user');
  productName = signal('');
  assetUrl = signal('');
  imageReady = signal(false);
  imageFailed = signal(false);
  auditNotice = signal('');
  poseMode = signal(false);
  poseBusy = signal(false);
  poseError = signal('');
  poseTracking = signal(false);
  poseState = signal<PoseState>('off');
  poseFaded = signal(false);
  poseRot = signal(0);
  offsetX = signal(0);
  offsetY = signal(0);
  scale = signal(1);
  private productId = '';
  private destroyed = false;
  private loadVersion = 0;
  private cameraVersion = 0;
  private poseVersion = 0;
  private poseTarget = { x: 0, y: 0 };
  private poseInitialized = false;
  private poseLast = 0;
  private poseRefShoulder = 0;
  private poseStartScale = 1;
  private poseSmoothScale = 1;
  private poseSmoothRot = 0;
  private recorded = false;
  private stream: MediaStream | null = null;
  private detachEnded: (() => void) | null = null;
  private detachResize: (() => void) | null = null;
  private stageObserver: ResizeObserver | null = null;
  private drag: {
    id: number;
    element: HTMLElement;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null = null;

  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.slug = params.get('slug') || '';
      this.varianteId = this.route.snapshot?.queryParamMap?.get('variante') || null;
      void this.load(this.slug);
    });
  }
  async load(slug: string) {
    const version = ++this.loadVersion;
    this.stopCamera();
    this.loading.set(true);
    this.error.set('');
    this.assetUrl.set('');
    this.productName.set('');
    this.imageReady.set(false);
    this.imageFailed.set(false);
    this.auditNotice.set('');
    this.recorded = false;
    this.stopPose();
    this.reset();
    try {
      const product = await firstValueFrom(this.catalog.product(slug));
      if (this.destroyed || version !== this.loadVersion) return;
      this.productName.set(product.name);
      this.productId = product.id;
      const asset = (product.ar_assets || []).find(
        (a) => a['is_active'] && a['asset_type'] === 'image_overlay',
      );
      if (!asset)
        throw new Error('Esta prenda todavía no tiene una imagen preparada para el probador.');
      const url = new URL(asset['asset_url'], window.location.origin);
      if (!['https:', 'http:'].includes(url.protocol))
        throw new Error('El recurso del probador no tiene una dirección válida.');
      this.assetUrl.set(url.href);
      this.observeStage();
    } catch (e) {
      if (!this.destroyed && version === this.loadVersion) this.error.set(errorMessage(e));
    } finally {
      if (!this.destroyed && version === this.loadVersion) this.loading.set(false);
    }
  }
  async startCamera() {
    if (
      this.destroyed ||
      !this.imageReady() ||
      this.cameraState() === 'requesting' ||
      this.cameraState() === 'active'
    )
      return;
    this.cameraError.set('');
    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraState.set('error');
      this.cameraError.set(
        'La cámara no está disponible en este navegador. Abrí el sitio mediante HTTPS en un navegador compatible.',
      );
      return;
    }
    const version = ++this.cameraVersion;
    this.cameraState.set('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: this.facing() } },
        audio: false,
      });
      if (this.destroyed || version !== this.cameraVersion) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      const video = this.videoRef?.nativeElement;
      if (!video) throw new Error('Vista de cámara no disponible.');
      const track = stream.getVideoTracks()[0];
      const actualFacing = track?.getSettings?.().facingMode;
      if (actualFacing === 'user' || actualFacing === 'environment') this.facing.set(actualFacing);
      const ended = () => {
        if (version !== this.cameraVersion) return;
        this.stopCamera();
        this.cameraState.set('error');
        this.cameraError.set('La cámara se desconectó. Podés volver a activarla.');
      };
      track?.addEventListener('ended', ended);
      this.detachEnded = () => track?.removeEventListener('ended', ended);
      const onResize = () => this.ensureClamped();
      video.addEventListener('resize', onResize);
      this.detachResize = () => video.removeEventListener('resize', onResize);
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      if (this.destroyed || version !== this.cameraVersion) return;
      this.cameraState.set('active');
      this.observeStage();
      void this.recordSession(this.loadVersion);
    } catch (e) {
      if (this.destroyed || version !== this.cameraVersion) return;
      this.stopCamera();
      this.cameraState.set('error');
      const name = e && typeof e === 'object' && 'name' in e ? String(e.name) : '';
      this.cameraError.set(
        name === 'NotAllowedError'
          ? 'Permití el acceso a la cámara en tu navegador y volvé a intentarlo.'
          : name === 'NotFoundError'
            ? 'No encontramos una cámara disponible en este dispositivo.'
            : name === 'NotReadableError'
              ? 'No pudimos abrir la cámara. Cerrá otras aplicaciones que puedan estar usándola.'
              : 'No se pudo iniciar la cámara. Revisá el dispositivo y volvé a intentarlo.',
      );
    }
  }
  stopCamera() {
    ++this.cameraVersion;
    this.stopPose();
    this.endDrag();
    this.detachEnded?.();
    this.detachEnded = null;
    this.detachResize?.();
    this.detachResize = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    const video = this.videoRef?.nativeElement;
    if (video?.srcObject) {
      video.pause();
      video.srcObject = null;
    }
    this.cameraState.set('off');
    this.cameraError.set('');
  }
  async switchCamera() {
    if (this.cameraState() !== 'active') return;
    this.stopCamera();
    this.facing.set(this.facing() === 'user' ? 'environment' : 'user');
    await this.startCamera();
  }
  onVisibilityChange() {
    if (document.hidden) this.stopCamera();
  }
  onImageError() {
    this.imageReady.set(false);
    this.imageFailed.set(true);
    this.stopCamera();
  }
  /** Etapa 6: seguimiento corporal (MediaPipe Pose). Descarga el modelo la
   * primera vez; si no se puede, sigue funcionando el ajuste manual y se avisa. */
  async togglePose() {
    if (this.poseBusy()) return;
    if (this.poseMode()) {
      this.stopPose();
      return;
    }
    if (this.cameraState() !== 'active') {
      this.poseError.set('Activá la cámara antes de usar el seguimiento de postura.');
      return;
    }
    const generation = ++this.poseVersion;
    this.poseBusy.set(true);
    this.poseError.set('');
    this.poseState.set('busy');
    try {
      const ok = await this.poseService.ensure();
      if (this.destroyed || generation !== this.poseVersion || this.cameraState() !== 'active') return;
      if (!ok) {
        this.poseMode.set(false);
        this.poseState.set('off');
        this.poseError.set(
          'No se pudo descargar el modelo de seguimiento (¿sin conexión?). El ajuste manual sigue disponible.',
        );
        return;
      }
      this.poseMode.set(true);
      this.poseStartScale = this.scale();
      this.poseSmoothScale = this.poseStartScale;
      this.poseSmoothRot = 0;
      this.poseInitialized = false;
      this.poseLast = 0;
      this.poseRefShoulder = 0;
      this.poseState.set('searching');
      void this.runPoseLoop();
    } catch (e) {
      if (this.destroyed || generation !== this.poseVersion) return;
      this.poseMode.set(false);
      this.poseState.set('off');
      this.poseError.set(errorMessage(e));
    } finally {
      if (generation === this.poseVersion) this.poseBusy.set(false);
    }
  }
  private stopPose(cameraEnded = false) {
    ++this.poseVersion;
    this.poseBusy.set(false);
    this.poseMode.set(false);
    this.poseTracking.set(false);
    this.poseInitialized = false;
    this.poseState.set('off');
    this.poseFaded.set(false);
    this.poseLast = 0;
    this.poseRefShoulder = 0;
    if (cameraEnded) this.poseError.set('');
  }
  private clampScale(value: number) {
    return Math.max(0.4, Math.min(3, value));
  }
  /** Bucle frugal (~130 ms): proyecta el torso al escenario (teniendo en cuenta
   * el recorte por cover y el espejo), suaviza posición/escala/inclinación y
   * reacciona a la pérdida de detección. No se lanzan detecciones superpuestas:
   * cada iteración espera su intervalo y el versionado corta al salir. */
  private async runPoseLoop() {
    const version = this.poseVersion;
    while (!this.destroyed && this.poseMode() && this.cameraState() === 'active') {
      if (this.poseVersion !== version) return;
      const video = this.videoRef?.nativeElement;
      const landmarks = video ? this.poseService.detectTorso(video) : null;
      const now = Date.now();
      if (landmarks) {
        const stage = this.stageRef?.nativeElement;
        const bounds = stage?.getBoundingClientRect ? stage.getBoundingClientRect() : null;
        const box: VideoBox = {
          videoW: video?.videoWidth || 640,
          videoH: video?.videoHeight || 480,
          containerW: bounds?.width || 320,
          containerH: bounds?.height || 420,
          mirrored: this.facing() === 'user',
        };
        const pose = shoulderPose(landmarks, box);
        if (pose) {
          if (!this.poseRefShoulder) {
            this.poseRefShoulder = pose.shoulderPx;
            this.poseSmoothScale = this.poseStartScale;
          }
          const targetScale = this.clampScale(
            this.poseStartScale * scaleFromShoulders(pose.shoulderPx, this.poseRefShoulder),
          );
          const targetRot = pose.rotation * 0.6;
          this.poseSmoothScale += (targetScale - this.poseSmoothScale) * 0.3;
          this.poseSmoothRot += (targetRot - this.poseSmoothRot) * 0.3;
          this.poseTarget = smoothPose(this.poseTarget, { x: pose.offsetX, y: pose.offsetY }, 0.5);
          this.poseLast = now;
          this.poseTracking.set(true);
          this.poseState.set('tracking');
          this.poseFaded.set(false);
          if (!this.drag) {
            this.offsetX.set(Math.round(this.poseTarget.x * 100) / 100);
            this.offsetY.set(Math.round(this.poseTarget.y * 100) / 100);
            this.scale.set(Math.round(this.clampScale(this.poseSmoothScale) * 100) / 100);
            this.poseRot.set(Math.round(this.poseSmoothRot * 1000) / 1000);
          } else {
            // El usuario arrastra a mano: no pelear con la postura.
            this.poseSmoothScale = this.scale();
            this.poseSmoothRot = this.poseRot();
            this.poseTarget = { x: this.offsetX(), y: this.offsetY() };
          }
        }
      } else if (this.poseLast && now - this.poseLast > POSE_LOST_MS) {
        this.poseState.set('lost');
        this.poseTracking.set(false);
        this.poseFaded.set(true);
      } else if (!this.poseLast) {
        this.poseState.set('searching');
        this.poseFaded.set(false);
      }
      await new Promise((resolve) => setTimeout(resolve, 130));
    }
  }
  private async recordSession(version: number) {
    if (this.recorded || !this.session.user()) return;
    this.recorded = true;
    try {
      await firstValueFrom(
        this.api.write('POST', '/vestidor/sessions', { product_id: this.productId }),
      );
      if (!this.destroyed && version === this.loadVersion) this.auditNotice.set('');
    } catch {
      if (!this.destroyed && version === this.loadVersion) {
        this.recorded = false;
        this.auditNotice.set(
          'La vista funciona, pero no pudimos registrar su apertura en tu actividad.',
        );
      }
    }
  }
  setScale(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) this.scale.set(Math.max(0.4, Math.min(3, value)));
  }
  private position(x: number, y: number) {
    const bounds = this.stageRef?.nativeElement.getBoundingClientRect();
    const w = (bounds?.width || 320) * 0.45,
      h = (bounds?.height || 420) * 0.45;
    this.offsetX.set(Math.max(-w, Math.min(w, x)));
    this.offsetY.set(Math.max(-h, Math.min(h, y)));
  }
  /** Mantiene la prenda dentro de la zona del escenario cuando cambia el
   * tamaño de la cámara o de la pantalla (rotación, cambio de dispositivo)
   * sin disparar gestos: solo re-acota la posición actual. */
  private ensureClamped() {
    this.position(this.offsetX(), this.offsetY());
  }
  /** Estabilidad del probador: re-acota la superposición si el escenario cambia
   * de tamaño mientras la cámara está activa. */
  private observeStage() {
    this.stageObserver?.disconnect();
    this.stageObserver = null;
    try {
      const stage = this.stageRef?.nativeElement;
      if (stage && typeof ResizeObserver !== 'undefined') {
        this.stageObserver = new ResizeObserver(() => this.ensureClamped());
        this.stageObserver.observe(stage);
      }
    } catch {
      /* observación opcional: no rompe el probador */
    }
  }
  nudge(x: number, y: number) {
    this.position(this.offsetX() + x, this.offsetY() + y);
  }
  startDrag(event: PointerEvent) {
    if (this.cameraState() !== 'active' || !this.imageReady() || this.drag || event.button !== 0)
      return;
    event.preventDefault();
    const element = event.currentTarget as HTMLElement;
    element.setPointerCapture(event.pointerId);
    this.drag = {
      id: event.pointerId,
      element,
      x: event.clientX,
      y: event.clientY,
      left: this.offsetX(),
      top: this.offsetY(),
    };
  }
  moveDrag(event: PointerEvent) {
    if (!this.drag || this.drag.id !== event.pointerId) return;
    this.position(
      this.drag.left + event.clientX - this.drag.x,
      this.drag.top + event.clientY - this.drag.y,
    );
  }
  endDrag() {
    const drag = this.drag;
    this.drag = null;
    if (drag?.element.hasPointerCapture(drag.id)) drag.element.releasePointerCapture(drag.id);
  }
  reset() {
    this.endDrag();
    this.offsetX.set(0);
    this.offsetY.set(0);
    this.scale.set(1);
    this.poseRot.set(0);
    this.poseSmoothRot = 0;
  }
  ngOnDestroy() {
    this.destroyed = true;
    ++this.loadVersion;
    this.stopPose();
    this.stopCamera();
    this.stageObserver?.disconnect();
    this.stageObserver = null;
    this.poseService.dispose();
  }
}
