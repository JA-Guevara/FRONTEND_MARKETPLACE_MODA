import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CatalogService } from '../../usuarios-catalogo/infrastructure/catalog.service';
import { ApiService } from '../../../app/core/shared/api.service';
import { IconComponent } from '../../../shared/icon.component';
import { errorMessage } from '../../../shared/errors';

/** Vestidor virtual "AR ligera": cámara del navegador + overlay 2D de la
 * prenda, que el cliente arrastra y escala sobre su propia imagen. No usa
 * reconstrucción 3D; es la alternativa realista sin la app móvil. */
@Component({
  selector: 'fs-vestidor',
  imports: [RouterLink, IconComponent],
  template: `<section class="vestidor-page">
    <a class="back-link" [routerLink]="'/prendas/' + slug">← Volver a la prenda</a>
    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }
    @if (loading()) {
      <p class="empty" role="status">Cargando vestidor virtual…</p>
    } @else {
      <div class="vestidor-stage" #stage>
        @if (cameraDenied()) {
          <div class="vestidor-fallback">
            <span>F.</span>
            <p>No pudimos acceder a tu cámara. Podés seguir viendo la prenda superpuesta igual.</p>
          </div>
        } @else {
          <video #video autoplay playsinline muted></video>
        }
        @if (assetUrl()) {
          <img
            class="vestidor-overlay"
            [src]="assetUrl()"
            alt="Prenda superpuesta"
            [style.transform]="
              'translate(-50%,-50%) translate(' +
              offsetX() +
              'px,' +
              offsetY() +
              'px) scale(' +
              scale() +
              ')'
            "
            (pointerdown)="startDrag($event)"
          />
        }
      </div>
      <div class="vestidor-controls">
        <button type="button" (click)="scale.set(Math.max(0.4, scale() - 0.1))">
          <fs-icon name="close" />Achicar
        </button>
        <button type="button" (click)="scale.set(Math.min(3, scale() + 0.1))">
          <fs-icon name="plus" />Agrandar
        </button>
        <button type="button" (click)="reset()"><fs-icon name="refresh" />Centrar</button>
      </div>
      <p class="muted">Arrastrá la prenda para ubicarla sobre tu imagen.</p>
    }
  </section>`,
})
export class VestidorComponent implements AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private catalog = inject(CatalogService);
  private api = inject(ApiService);
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;
  slug = this.route.snapshot.paramMap.get('slug') || '';
  loading = signal(true);
  error = signal('');
  cameraDenied = signal(false);
  assetUrl = signal('');
  offsetX = signal(0);
  offsetY = signal(0);
  scale = signal(1);
  Math = Math;
  private stream: MediaStream | null = null;
  private dragging = false;
  private dragStart = { x: 0, y: 0, offsetX: 0, offsetY: 0 };
  async ngAfterViewInit() {
    this.error.set('');
    try {
      const product = await firstValueFrom(this.catalog.product(this.slug));
      const asset = (product.ar_assets || []).find(
        (a) => a['is_active'] && a['asset_type'] === 'image_overlay',
      );
      if (!asset) {
        this.error.set('Esta prenda todavía no tiene un vestidor virtual disponible.');
        return;
      }
      this.assetUrl.set(asset['asset_url']);
      try {
        await firstValueFrom(
          this.api.write('POST', '/vestidor/sessions', { product_id: product.id }),
        );
      } catch {
        /* el registro en bitácora es solo trazabilidad; no bloquea la vista */
      }
      await this.startCamera();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      if (this.videoRef) this.videoRef.nativeElement.srcObject = this.stream;
    } catch {
      this.cameraDenied.set(true);
    }
  }
  startDrag(event: PointerEvent) {
    this.dragging = true;
    this.dragStart = { x: event.clientX, y: event.clientY, offsetX: this.offsetX(), offsetY: this.offsetY() };
    const move = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.offsetX.set(this.dragStart.offsetX + (e.clientX - this.dragStart.x));
      this.offsetY.set(this.dragStart.offsetY + (e.clientY - this.dragStart.y));
    };
    const up = () => {
      this.dragging = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  reset() {
    this.offsetX.set(0);
    this.offsetY.set(0);
    this.scale.set(1);
  }
  ngOnDestroy() {
    this.stream?.getTracks().forEach((t) => t.stop());
  }
}
