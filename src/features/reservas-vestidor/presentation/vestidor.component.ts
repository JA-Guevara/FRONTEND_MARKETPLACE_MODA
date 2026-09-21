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
import { Entity } from '../../../shared/models';
import { PoseTrackingService } from '../../../shared/pose-tracking.service';
import { POSE_LOST_MS, VideoBox } from '../../../shared/pose-projection';
import {
  BodyRegion,
  GarmentAnchors,
  Guidance,
  esRegion,
  evaluarPostura,
} from '../../../shared/garment-fit';
import {
  FormaPrenda,
  Punto,
  dibujarPrenda,
  estimarOcultos,
  formaDePrenda,
} from '../../../shared/garment-renderer';
import { FotoRealistaComponent } from '../../probador-virtual/presentation/foto-realista.component';

type CameraState = 'off' | 'requesting' | 'active' | 'error';

/** Recurso preparado que devuelve /vestidor/sessions. */
interface TryOnResource {
  asset_type?: string;
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
  imports: [RouterLink, IconComponent, FotoRealistaComponent],
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

    @if (!loading() && productName() && !error()) {
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

        <!-- Prenda dibujada sobre el cuerpo: no depende de ninguna fotografía,
             así que nunca aparece un fondo recortado a medias. -->
        <canvas
          #lienzo
          class="fitting-canvas"
          [class.mirrored]="facing() === 'user'"
          [hidden]="cameraState() !== 'active'"
        ></canvas>

        <!-- La foto preparada ya no es una capa: se dibuja dentro del lienzo
             como relleno del polígono que sigue al cuerpo. -->

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
              aria-label="Ajustar posición de la prenda"
            >
              <fs-icon name="maximize" />Ajustar posición
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
        @if (cameraState() === 'active' && !usaFoto()) {
          <!-- Honestidad con quien mira: esto es una silueta con el color de la
               prenda, no su foto. Antes se veía un dibujo gris sin explicación
               y parecía que el probador estaba fallando. -->
          <p class="fitting-aproximado">
            <fs-icon name="eye" />
            Vista aproximada: mostramos la silueta de la prenda con su color. Esta prenda
            todavía no tiene su foto preparada para el probador.
          </p>
        }
        <p class="fitting-resource-status" [class.ready]="usaFoto()" aria-live="polite">
          <fs-icon [name]="usaFoto() ? 'check' : 'image'" />{{ resourceNotice() }}
        </p>
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
      <fs-foto-realista
        [productId]="productId"
        [colorId]="colorId"
        [productName]="productName()"
      />
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
  @ViewChild('lienzo') lienzoRef?: ElementRef<HTMLCanvasElement>;

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
  /** Explica qué se está viendo. Antes el error de cargar el recurso se
   * ocultaba y el cliente interpretaba la silueta como un probador roto. */
  resourceNotice = signal('Comprobando la imagen de la prenda…');
  tuning = signal(false);
  /** Con recurso preparado se usa la foto recortada (se ve el producto real);
   * sin él se dibuja la prenda, que siempre está disponible. */
  usaFoto = signal(false);
  forma = signal<FormaPrenda>('remera');
  colorPrenda = signal('#7a7a7a');

  /** Ajuste calculado a partir del cuerpo; null mientras no se ubica. */
  /** Corrección manual opcional, sumada al ajuste automático. */
  /** Ajuste fino del cliente: escala y desplazamiento sobre el dibujo. */
  tuneScale = signal(1);
  tuneY = signal(0);
  guidance = signal<Guidance>({
    code: 'sin-camara',
    message: 'Activá la cámara para probarte la prenda.',
    ok: false,
  });
  /**
   * Si la prenda está puesta sobre el cuerpo ahora mismo.
   *
   * Antes dependía de la transformación rígida de la capa de imagen. Ahora que
   * todo se dibuja en el lienzo, lo que importa es que el último cuadro haya
   * conseguido dibujar y que la postura sea utilizable.
   */
  placed = computed(() => this.dibujada() && this.guidance().ok);
  /** El último cuadro pudo dibujar la prenda sobre el cuerpo. */
  dibujada = signal(false);

  productId = '';
  colorId: string | null = null;
  private region: BodyRegion = 'upper_body';
  private anchors: GarmentAnchors | null = null;
  private imageSize = { width: 0, height: 0 };
  /** La foto preparada, ya cargada, para usarla como relleno del dibujo. */
  private textura: HTMLImageElement | null = null;
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
    this.usaFoto.set(false);
    this.textura = null;
    this.auditNotice.set('');
    this.resourceNotice.set('Comprobando la imagen de la prenda…');
    this.recorded = false;
    this.clearTuning();
    try {
      const product = await firstValueFrom(this.catalog.product(slug));
      if (this.destroyed || version !== this.loadVersion) return;
      this.productName.set(product.name);
      this.productId = product.id;
      // El recurso depende del color: se toma el de la variante elegida. Si se
      // entró al probador sin elegir talla, se usa la primera variante con
      // color cargado: dibujar la prenda en gris cuando el catálogo sabe de qué
      // color es era la razón por la que «no se reflejaba» la prenda.
      const variantes = (product.variants || []) as Entity[];
      const elegida = variantes.find((v) => v.id === this.varianteId);
      const conColor = (v?: Entity) =>
        (v?.['color'] as { id?: string; hex_code?: string } | undefined)?.hex_code
          ? (v!['color'] as { id?: string; hex_code?: string })
          : undefined;
      const color =
        conColor(elegida) ||
        (elegida?.['color'] as { id?: string; hex_code?: string } | undefined) ||
        conColor(variantes.find((v) => conColor(v)));
      this.colorId = color?.id || null;
      if (color?.hex_code) this.colorPrenda.set(color.hex_code);

      // La prenda se puede probar siempre: el dibujo se arma con el tipo y el
      // color. El recurso preparado, si existe, mejora la vista con la foto real.
      const categoria = (product.category as { name?: string } | undefined)?.name;
      this.forma.set(formaDePrenda(`${product.name} ${categoria || ''}`));
      this.region = 'upper_body';

      const recurso = await this.fetchResource();
      if (this.destroyed || version !== this.loadVersion) return;
      // Solo una imagen preparada por el servidor puede ponerse sobre la
      // cámara. Los recursos antiguos `image_overlay` eran fotos comerciales
      // sin alfa y producían el rectángulo blanco que se veía en el probador.
      // Es preferible el dibujo geométrico antes que ocultar a la persona con
      // una foto de fondo.
      if (recurso?.asset_url && recurso.asset_type === 'prepared_2_5d') {
        const url = new URL(recurso.asset_url, window.location.origin);
        if (['https:', 'http:'].includes(url.protocol)) {
          this.assetUrl.set(url.href);
          this.region = esRegion(recurso.body_region) ? recurso.body_region : this.region;
          this.anchors = recurso.anchor_points || null;
          if (recurso.garment_type) this.forma.set(formaDePrenda(recurso.garment_type, this.region));
          await this.preloadImage(url.href, version);
          this.usaFoto.set(!this.imageFailed());
          this.resourceNotice.set(
            this.imageFailed()
              ? 'La imagen preparada no pudo abrirse; usamos la vista aproximada.'
              : 'Imagen preparada: al activar la cámara verás la prenda real sin fondo.',
          );
        } else {
          this.resourceNotice.set(
            'Esta prenda aún no tiene una imagen preparada. Mostramos una vista aproximada hasta que se prepare su foto.',
          );
        }
      }
    } catch (e) {
      if (!this.destroyed && version === this.loadVersion) this.error.set(errorMessage(e));
    } finally {
      if (!this.destroyed && version === this.loadVersion) this.loading.set(false);
    }
  }

  /**
   * Pide el recurso preparado y deja el registro en bitácora. Que no exista no
   * impide probarse la prenda: en ese caso se dibuja, que es el camino normal
   * para el catálogo sin preparar.
   */
  private async fetchResource(): Promise<TryOnResource | null> {
    const cuerpo: Record<string, string> = { product_id: this.productId };
    if (this.colorId) cuerpo['color_id'] = this.colorId;
    try {
      const respuesta = await firstValueFrom(
        this.api.write<TryOnResource>('POST', '/vestidor/sessions', cuerpo),
      );
      this.recorded = true;
      return respuesta.data;
    } catch (e) {
      // El resto de la pantalla sigue funcionando con el dibujo, pero el
      // motivo deja de ser invisible para quien prueba la prenda.
      this.auditNotice.set('');
      this.resourceNotice.set(
        errorMessage(e).includes('todavía no está preparado')
          ? 'Esta combinación de color todavía no tiene una imagen preparada.'
          : 'No pudimos recuperar la imagen preparada; usamos una vista aproximada.',
      );
      return null;
    }
  }

  /** Carga la imagen en memoria para tener sus dimensiones y detectar un
   * recurso roto antes de pedir la cámara. */
  private preloadImage(url: string, version: number) {
    return new Promise<void>((resolve) => {
      const img = new Image();
      // Sin esto, el lienzo no puede usar la imagen como textura: al dibujar
      // una imagen de otro origen, el canvas queda «manchado» y no se puede leer.
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!this.destroyed && version === this.loadVersion) {
          this.imageSize = { width: img.naturalWidth, height: img.naturalHeight };
          this.textura = img;
        }
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
    this.dibujada.set(false);
    this.limpiarLienzo();
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
      // Sin detector no hay cuerpo que seguir: no se dibuja nada y se explica
      // por qué, en vez de dejar una prenda flotando en el centro.
      this.dibujada.set(false);
      this.limpiarLienzo();
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

      // Un solo camino de dibujo: el lienzo. Con foto preparada se usa como
      // relleno del polígono; sin ella, color liso. Antes la foto era una capa
      // aparte con un transform rígido y por eso no se deformaba con el cuerpo.
      if (landmarks && this.pintar(landmarks, box, guia.ok)) {
        this.poseLast = ahora;
        this.dibujada.set(true);
      }
      // Si hace rato que no se ve a nadie, la prenda no se queda flotando.
      if (this.poseLast && ahora - this.poseLast > POSE_LOST_MS) {
        this.dibujada.set(false);
        this.limpiarLienzo();
      }
      this.guidance.set(guia);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  /** Dibuja la prenda sobre el lienzo, alineada con el video. */
  private pintar(landmarks: { x: number; y: number; visibility?: number }[], box: VideoBox, postura: boolean) {
    const lienzo = this.lienzoRef?.nativeElement;
    const ctx = lienzo?.getContext('2d');
    if (!lienzo || !ctx) return false;
    // El lienzo comparte tamaño con el escenario para que las coordenadas
    // coincidan con lo que se ve del video.
    if (lienzo.width !== Math.round(box.containerW) || lienzo.height !== Math.round(box.containerH)) {
      lienzo.width = Math.round(box.containerW);
      lienzo.height = Math.round(box.containerH);
    }
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    if (!postura) return false;

    // El lienzo va espejado por CSS igual que el video, así que se dibuja en las
    // coordenadas del video sin invertir.
    const cover = Math.max(box.containerW / box.videoW, box.containerH / box.videoH);
    const dx = (box.containerW - box.videoW * cover) / 2;
    const dy = (box.containerH - box.videoH * cover) / 2;
    const puntos: Punto[] = landmarks.map((p) => ({
      x: dx + p.x * box.videoW * cover,
      y: dy + p.y * box.videoH * cover,
    }));
    const visible = (i: number) => (landmarks[i]?.visibility ?? 0) >= 0.5;
    const completos = estimarOcultos(puntos, visible);
    const escala = this.tuneScale();
    if (escala !== 1) {
      // El ajuste fino agranda o achica respecto del centro del cuerpo.
      const centro = completos[11] && completos[12]
        ? { x: (completos[11].x + completos[12].x) / 2, y: (completos[11].y + completos[12].y) / 2 }
        : { x: lienzo.width / 2, y: lienzo.height / 2 };
      for (const punto of completos) {
        if (!punto) continue;
        punto.x = centro.x + (punto.x - centro.x) * escala;
        punto.y = centro.y + (punto.y - centro.y) * escala + this.tuneY();
      }
    } else if (this.tuneY()) {
      for (const punto of completos) if (punto) punto.y += this.tuneY();
    }
    return dibujarPrenda(ctx, completos, {
      forma: this.forma(),
      color: this.colorPrenda(),
      // Con foto preparada, el polígono es el molde y la foto el relleno: la
      // prenda se deforma con el cuerpo en vez de flotar rígida encima.
      textura: this.textura,
    });
  }

  private limpiarLienzo() {
    const lienzo = this.lienzoRef?.nativeElement;
    lienzo?.getContext('2d')?.clearRect(0, 0, lienzo.width, lienzo.height);
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
