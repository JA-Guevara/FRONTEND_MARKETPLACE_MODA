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

type CameraState = 'off' | 'requesting' | 'active' | 'error';

/** Superposición manual 2D: no detecta postura ni determina la talla. */
@Component({
  selector: 'fs-vestidor',
  imports: [RouterLink, IconComponent],
  styleUrl: './vestidor.scss',
  host: { '(document:visibilitychange)': 'onVisibilityChange()' },
  template: `<section class="fitting-page">
    <a [routerLink]="['/prendas', slug]">← Volver a la prenda</a>
    <header>
      <p class="eyebrow">PROBADOR VIRTUAL · AJUSTE MANUAL</p>
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
              [style.transform]="
                'translate(-50%, -50%) translate(' +
                offsetX() +
                'px,' +
                offsetY() +
                'px) scale(' +
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
          </div>
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
          <p class="fitting-note">
            La cámara no se graba ni se envía al servidor. El movimiento de la prenda se ajusta
            manualmente.
          </p>
          <p class="fitting-note">
            Se muestra el recurso general del producto; el color y la talla no se adaptan
            automáticamente.
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
  private destroyRef = inject(DestroyRef);
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('stage') stageRef?: ElementRef<HTMLDivElement>;
  slug = '';
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
  offsetX = signal(0);
  offsetY = signal(0);
  scale = signal(1);
  private productId = '';
  private destroyed = false;
  private loadVersion = 0;
  private cameraVersion = 0;
  private recorded = false;
  private stream: MediaStream | null = null;
  private detachEnded: (() => void) | null = null;
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
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      if (this.destroyed || version !== this.cameraVersion) return;
      this.cameraState.set('active');
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
    this.endDrag();
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
  }
  ngOnDestroy() {
    this.destroyed = true;
    ++this.loadVersion;
    this.stopCamera();
  }
}
