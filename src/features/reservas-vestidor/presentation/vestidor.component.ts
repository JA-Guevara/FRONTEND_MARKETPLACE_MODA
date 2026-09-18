import {
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CatalogService } from '../../usuarios-catalogo/infrastructure/catalog.service';
import { ApiService } from '../../../app/core/shared/api.service';
import { IconComponent } from '../../../shared/icon.component';
import { errorMessage } from '../../../shared/errors';
import { PoseTrackingService } from '../../../shared/pose-tracking.service';
import { POSE_LOST_MS, VideoBox } from '../../../shared/pose-projection';
import {
  BodyRegion,
  GarmentAnchors,
  GarmentFit,
  Guidance,
  calcularAjuste,
  esRegion,
  evaluarPostura,
  suavizarAjuste,
} from '../../../shared/garment-fit';

type CameraState = 'off' | 'requesting' | 'active' | 'error';

/** Recurso preparado que devuelve /vestidor/sessions. */
interface TryOnResource {
  asset_url: string;
  body_region?: string | null;
  anchor_points?: GarmentAnchors | null;
  garment_type?: string | null;
}

/**
 * Probador virtual: la prenda se ubica sola sobre el cuerpo.
 *
 * El recurso preparado trae el recorte sin fondo, la región del cuerpo que
 * cubre y sus puntos de anclaje; la detección de pose aporta el cuerpo. Con eso
 * la prenda se posiciona, escala e inclina automáticamente, y a la persona solo
 * se le indica cómo pararse. El ajuste fino existe como respaldo, guardado
 * detrás de un botón, no como la forma normal de usarlo.
 *
 * Es una vista orientativa: no determina la talla ni simula la tela.
 */
@Component({
  selector: 'fs-vestidor',
  imports: [RouterLink, IconComponent],
  styleUrl: './vestidor.scss',
  host: { '(document:visibilitychange)': 'onVisibilityChange()' },
  template: `<section class="fitting-page">
    <a
      class="fitting-back"
      [routerLink]="['/prendas', slug]"
      [queryParams]="varianteId ? { variante: varianteId } : undefined"
      >← Volver a la prenda</a
    >

    @if (loading()) {
      <p role="status">Cargando prenda…</p>
    }
    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
      <button type="button" (click)="load(slug)">
        <fs-icon name="refresh" />Reintentar
      </button>
    }

    @if (!loading() && assetUrl()) {
      <div class="fitting-stage" #stage [class.camera-on]="cameraState() === 'active'">
        <video
          #video
          autoplay
          playsinline
          muted
          [class.mirrored]="facing() === 'user'"
          [hidden]="cameraState() !== 'active'"
          aria-label="Vista de tu cámara"
        ></video>

        @if (cameraState() === 'active' && !imageFailed()) {
          <img
            class="fitting-overlay"
            [src]="assetUrl()"
            [alt]="productName()"
            draggable="false"
            [class.ready]="placed()"
            [style.transform]="transform()"
            (load)="onImageLoad($event)"
            (error)="onImageError()"
          />
        }

        <!-- Indicación única y grande: qué tiene que hacer la persona. -->
        @if (cameraState() !== 'active') {
          <div class="fitting-hint">
            <fs-icon name="camera" />
            <p>{{ productName() }}</p>
            <button
              type="button"
              class="primary"
              [disabled]="cameraState() === 'requesting'"
              (click)="startCamera()"
            >
              {{ cameraState() === 'requesting' ? 'Pidiendo permiso…' : 'Probármela' }}
            </button>
            @if (cameraError()) {
              <p class="alert error" role="alert">{{ cameraError() }}</p>
            }
          </div>
        } @else if (!guidance().ok) {
          <p class="fitting-hint-live" role="status">
            <fs-icon name="users" />{{ guidance().message }}
          </p>
        }
      </div>

      <div class="fitting-bar">
        <p class="fitting-name">{{ productName() }}</p>
        <div class="fitting-buttons">
          @if (cameraState() === 'active') {
            <button type="button" (click)="switchCamera()" aria-label="Cambiar cámara">
              <fs-icon name="refresh" />Cambiar cámara
            </button>
            <button
              type="button"
              [class.active]="tuning()"
              (click)="tuning.set(!tuning())"
              aria-label="Ajuste fino"
            >
              <fs-icon name="maximize" />Ajustar
            </button>
            <button type="button" (click)="stopCamera()">
              <fs-icon name="close" />Terminar
            </button>
          }
          <a
            class="button primary"
            [routerLink]="['/prendas', slug]"
            [queryParams]="varianteId ? { variante: varianteId } : undefined"
            >Elegir talla</a
          >
        </div>
      </div>

      <!-- Respaldo: solo si el encaje automático no convence. -->
      @if (tuning() && cameraState() === 'active') {
        <div class="fitting-tuning" role="group" aria-label="Ajuste fino de la prenda">
          <button type="button" (click)="adjustScale(-0.06)" aria-label="Más chica">−</button>
          <span>Tamaño</span>
          <button type="button" (click)="adjustScale(0.06)" aria-label="Más grande">+</button>
          <button type="button" (click)="adjustOffset(0, -10)" aria-label="Subir">↑</button>
          <button type="button" (click)="adjustOffset(0, 10)" aria-label="Bajar">↓</button>
          <button type="button" (click)="clearTuning()">
            <fs-icon name="refresh" />Automático
          </button>
        </div>
      }

      <p class="fitting-note">
        La cámara se procesa en tu dispositivo y no se envía ni se graba. La vista es orientativa:
        no determina tu talla.
      </p>
      @if (auditNotice()) {
        <p class="fitting-note" role="status">{{ auditNotice() }}</p>
      }
    }
  </section>`,
})
export class VestidorComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private catalog = inject(CatalogService);
  private api = inject(ApiService);
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
  imageFailed = signal(false);
  auditNotice = signal('');
  tuning = signal(false);

  /** Ajuste calculado a partir del cuerpo; null mientras no se ubica. */
  private fit = signal<GarmentFit | null>(null);
  /** Corrección manual opcional, sumada al ajuste automático. */
  private tuneScale = signal(1);
  private tuneY = signal(0);
  guidance = signal<Guidance>({
    code: 'sin-camara',
    message: 'Activá la cámara para probarte la prenda.',
    ok: false,
  });
  placed = computed(() => !!this.fit() && this.guidance().ok);
  transform = computed(() => {
    const ajuste = this.fit();
    if (!ajuste) return 'translate(-50%, -50%) scale(0.9)';
    const escala = ajuste.scale * this.tuneScale();
    return (
      `translate(-50%, -50%) translate(${ajuste.offsetX.toFixed(1)}px, ` +
      `${(ajuste.offsetY + this.tuneY()).toFixed(1)}px) ` +
      `rotate(${ajuste.rotation.toFixed(3)}rad) scale(${escala.toFixed(3)})`
    );
  });

  private productId = '';
  private colorId: string | null = null;
  private region: BodyRegion = 'upper_body';
  private anchors: GarmentAnchors | null = null;
  private imageSize = { width: 0, height: 0 };
  private destroyed = false;
  private loadVersion = 0;
  private cameraVersion = 0;
  private poseVersion = 0;
  private poseLast = 0;
  private recorded = false;
  private stream: MediaStream | null = null;
  private detachEnded: (() => void) | null = null;

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
    this.imageFailed.set(false);
    this.auditNotice.set('');
    this.recorded = false;
    this.clearTuning();
    try {
      const product = await firstValueFrom(this.catalog.product(slug));
      if (this.destroyed || version !== this.loadVersion) return;
      this.productName.set(product.name);
      this.productId = product.id;
      // El recurso depende del color: se toma el de la variante elegida.
      const variante = (product.variants || []).find((v) => v.id === this.varianteId);
      this.colorId = (variante?.['color'] as { id?: string } | undefined)?.id || null;

      const recurso = await this.fetchResource();
      if (this.destroyed || version !== this.loadVersion) return;
      const url = new URL(recurso.asset_url, window.location.origin);
      if (!['https:', 'http:'].includes(url.protocol))
        throw new Error('El recurso del probador no tiene una dirección válida.');
      this.assetUrl.set(url.href);
      this.region = esRegion(recurso.body_region) ? recurso.body_region : 'upper_body';
      this.anchors = recurso.anchor_points || null;
      // Se precarga para conocer su tamaño antes de encender la cámara: el
      // encaje necesita las dimensiones reales para calcular la escala.
      await this.preloadImage(url.href, version);
    } catch (e) {
      if (!this.destroyed && version === this.loadVersion) this.error.set(errorMessage(e));
    } finally {
      if (!this.destroyed && version === this.loadVersion) this.loading.set(false);
    }
  }

  /** Pide el recurso preparado; deja el registro en bitácora del lado del servidor. */
  private async fetchResource(): Promise<TryOnResource> {
    const cuerpo: Record<string, string> = { product_id: this.productId };
    if (this.colorId) cuerpo['color_id'] = this.colorId;
    const respuesta = await firstValueFrom(
      this.api.write<TryOnResource>('POST', '/vestidor/sessions', cuerpo),
    );
    this.recorded = true;
    return respuesta.data;
  }

  /** Carga la imagen en memoria para tener sus dimensiones y detectar un
   * recurso roto antes de pedir la cámara. */
  private preloadImage(url: string, version: number) {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (!this.destroyed && version === this.loadVersion)
          this.imageSize = { width: img.naturalWidth, height: img.naturalHeight };
        resolve();
      };
      img.onerror = () => {
        if (!this.destroyed && version === this.loadVersion) this.imageFailed.set(true);
        resolve();
      };
      img.src = url;
    });
  }

  onImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    this.imageSize = { width: img.naturalWidth, height: img.naturalHeight };
  }

  async startCamera() {
    if (this.destroyed || ['requesting', 'active'].includes(this.cameraState())) return;
    this.cameraError.set('');
    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraState.set('error');
      this.cameraError.set(
        'La cámara no está disponible en este navegador. Abrí el sitio por HTTPS.',
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
      const real = track?.getSettings?.().facingMode;
      if (real === 'user' || real === 'environment') this.facing.set(real);
      const ended = () => {
        if (version !== this.cameraVersion) return;
        this.stopCamera();
        this.cameraState.set('error');
        this.cameraError.set('La cámara se desconectó. Podés volver a activarla.');
      };
      track?.addEventListener('ended', ended);
      this.detachEnded = () => track?.removeEventListener('ended', ended);
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      if (this.destroyed || version !== this.cameraVersion) return;
      this.cameraState.set('active');
      // El seguimiento arranca solo: no hay nada que activar a mano.
      void this.runTracking();
    } catch (e) {
      if (this.destroyed || version !== this.cameraVersion) return;
      this.stopCamera();
      this.cameraState.set('error');
      const name = e && typeof e === 'object' && 'name' in e ? String(e.name) : '';
      this.cameraError.set(
        name === 'NotAllowedError'
          ? 'Permití el acceso a la cámara para probarte la prenda.'
          : name === 'NotFoundError'
            ? 'No encontramos una cámara en este dispositivo.'
            : name === 'NotReadableError'
              ? 'No pudimos abrir la cámara. Cerrá otras aplicaciones que la estén usando.'
              : 'No se pudo iniciar la cámara.',
      );
    }
  }

  stopCamera() {
    ++this.cameraVersion;
    ++this.poseVersion;
    this.detachEnded?.();
    this.detachEnded = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    const video = this.videoRef?.nativeElement;
    if (video?.srcObject) {
      video.pause();
      video.srcObject = null;
    }
    this.cameraState.set('off');
    this.cameraError.set('');
    this.fit.set(null);
    this.poseLast = 0;
    this.guidance.set({
      code: 'sin-camara',
      message: 'Activá la cámara para probarte la prenda.',
      ok: false,
    });
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
    this.imageFailed.set(true);
    this.stopCamera();
  }

  /**
   * Bucle de seguimiento (~120 ms): lee el cuerpo, calcula el encaje y ajusta
   * la indicación. No usa ningún modelo generativo: solo detección de pose en
   * el dispositivo y geometría.
   */
  private async runTracking() {
    const version = ++this.poseVersion;
    const listo = await this.poseService.ensure();
    if (this.destroyed || version !== this.poseVersion) return;
    if (!listo) {
      this.guidance.set({
        code: 'sin-camara',
        message: 'No se pudo cargar el detector de postura. Usá «Ajustar» para acomodar la prenda.',
        ok: false,
      });
      // Sin detector, al menos se muestra centrada para poder ajustarla a mano.
      this.fit.set({ offsetX: 0, offsetY: 0, rotation: 0, scale: 1 });
      return;
    }
    while (!this.destroyed && this.poseVersion === version && this.cameraState() === 'active') {
      const video = this.videoRef?.nativeElement;
      const landmarks = video ? this.poseService.detectTorso(video) : null;
      const bounds = this.stageRef?.nativeElement?.getBoundingClientRect();
      const box: VideoBox = {
        videoW: video?.videoWidth || 640,
        videoH: video?.videoHeight || 480,
        containerW: bounds?.width || 360,
        containerH: bounds?.height || 480,
        mirrored: this.facing() === 'user',
      };
      const guia = evaluarPostura(landmarks, this.region, box);
      const ahora = Date.now();

      if (landmarks) {
        const objetivo = calcularAjuste(landmarks, this.region, this.anchors, this.imageSize, box);
        if (objetivo) {
          this.fit.set(suavizarAjuste(this.fit(), objetivo));
          this.poseLast = ahora;
        }
      }
      // Si hace rato que no se ve a nadie, la prenda no se queda flotando.
      if (this.poseLast && ahora - this.poseLast > POSE_LOST_MS) this.fit.set(null);
      this.guidance.set(guia);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  adjustScale(delta: number) {
    this.tuneScale.set(Math.max(0.5, Math.min(2, this.tuneScale() + delta)));
  }
  adjustOffset(_x: number, y: number) {
    this.tuneY.set(Math.max(-160, Math.min(160, this.tuneY() + y)));
  }
  clearTuning() {
    this.tuneScale.set(1);
    this.tuneY.set(0);
  }

  ngOnDestroy() {
    this.destroyed = true;
    ++this.loadVersion;
    this.stopCamera();
    this.poseService.dispose();
  }
}
