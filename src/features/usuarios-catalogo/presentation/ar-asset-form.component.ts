import { Component, EventEmitter, Input, OnDestroy, Output, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule, NgForm } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../../shared/models';
import { errorMessage } from '../../../shared/errors';

/** Recurso del probador virtual: una imagen frontal preparada (PNG/WebP con
 * transparencia) que el vestidor superpone a la cámara. Los formatos 3D
 * (GLB/GLTF/USDZ) solo se registran: el visor web actual es de imágenes 2D. */
@Component({
  selector: 'fs-ar-asset-form',
  imports: [FormsModule],
  template: `
    <form #form="ngForm" (ngSubmit)="submit(form)" class="asset-editor">
      <label
        >Tipo de recurso<select name="asset_type" [(ngModel)]="assetType" required>
          <option value="image_overlay">Imagen superpuesta (probador 2D)</option>
          <option value="glb">GLB (solo se registra)</option>
          <option value="gltf">GLTF (solo se registra)</option>
          <option value="usdz">USDZ (solo se registra)</option>
        </select></label
      >
      @if (assetType === 'image_overlay') {
        <div class="tabs" aria-label="Origen de la imagen">
          <button type="button" [class.selected]="mode === 'url'" (click)="mode = 'url'; previewFailed = false">
            Pegar enlace
          </button>
          <button type="button" [class.selected]="mode === 'file'" (click)="mode = 'file'; previewFailed = false">
            Subir imagen
          </button>
        </div>
        @if (mode === 'url') {
          <label
            >URL de la imagen<input
              type="url"
              name="asset_url"
              [(ngModel)]="assetUrl"
              (ngModelChange)="previewFailed = false"
              placeholder="https://… (PNG o WebP con transparencia)"
              required
              pattern="https?://.+"
          /></label>
        } @else {
          <label class="upload-area"
            >Elegí la imagen preparada<input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              (change)="selectFile($event)" /><small
              >PNG o WebP con transparencia, hasta 5 MB. La imagen se sube al guardar.</small
            ></label
          >
        }
        <div class="image-preview">
          @if (preview() && !previewFailed) {
            <img [src]="preview()" alt="Vista previa del recurso del probador" (error)="previewFailed = true" />
          } @else {
            <span>{{ previewFailed ? 'No se pudo cargar la vista previa. Revisá el enlace.' : 'Vista previa del recurso' }}</span>
          }
        </div>
      } @else {
        <p class="muted">
          Los recursos 3D se guardan y listan, pero el probador web actual solo superpone
          imágenes 2D.
        </p>
        <label
          >URL del modelo<input type="url" name="asset_url_3d" [(ngModel)]="assetUrl" required /></label
        >
      }
      <label
        >URL de vista previa (opcional)<input
          type="url"
          name="preview_url"
          [(ngModel)]="previewUrl"
          placeholder="https://…"
      /></label>
      @if (editing) {
        <label class="check"
          ><input type="checkbox" name="is_active" [(ngModel)]="isActive" />Activo (recurso por
          defecto del probador)</label
        >
      }
      @if (error()) {
        <p class="alert error" role="alert">{{ error() }}</p>
      }
      <div class="form-actions">
        <button class="primary" [disabled]="busy || uploading()">
          {{ uploading() ? 'Subiendo imagen…' : busy ? 'Guardando…' : 'Guardar recurso' }}
        </button>
        <button type="button" [disabled]="busy || uploading()" (click)="cancel.emit()">
          Cancelar
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .asset-editor {
        display: grid;
        gap: 16px;
      }
      .image-preview {
        height: 160px;
        background: #eeeae2;
        border: 1px dashed #b7afa0;
        border-radius: 10px;
        display: grid;
        place-items: center;
        color: #706b60;
        font-size: 12px;
        overflow: hidden;
      }
      .image-preview img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .upload-area {
        padding: 16px;
        background: #f0ede6;
        border-radius: 8px;
        display: grid;
        gap: 6px;
      }
      .form-actions {
        margin-top: 0;
      }
    `,
  ],
})
export class ArAssetFormComponent implements OnDestroy {
  @Input() busy = false;
  @Input() current: Record<string, unknown> | null = null;
  @Output() saved = new EventEmitter<Record<string, unknown>>();
  @Output() cancel = new EventEmitter<void>();
  private http = inject(HttpClient);
  mode: 'url' | 'file' = 'url';
  assetType = 'image_overlay';
  assetUrl = '';
  previewUrl = '';
  isActive = true;
  editing = false;
  file: File | null = null;
  objectUrl = '';
  previewFailed = false;
  uploading = signal(false);
  error = signal('');
  ngOnChanges() {
    if (!this.current) {
      this.editing = false;
      return;
    }
    this.editing = true;
    this.assetType = String(this.current['asset_type'] ?? 'image_overlay');
    this.assetUrl = String(this.current['asset_url'] ?? '');
    this.previewUrl = String(this.current['preview_url'] ?? '');
    this.isActive = Boolean(this.current['is_active']);
  }
  preview() {
    if (this.mode === 'file') return this.objectUrl || '';
    return /^https?:\/\//.test(this.assetUrl) ? this.assetUrl : '';
  }
  selectFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.error.set('');
    this.file = null;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      this.error.set('Elegí un JPEG, PNG o WebP de hasta 5 MB.');
      input.value = '';
      return;
    }
    this.file = file;
    this.objectUrl = URL.createObjectURL(file);
    this.previewFailed = false;
  }
  async submit(form: NgForm) {
    if (this.busy || this.uploading()) return;
    form.control.markAllAsTouched();
    this.error.set('');
    if (form.invalid || (!this.assetUrl && !this.file)) {
      this.error.set('Completá la imagen del recurso (URL o archivo).');
      return;
    }
    if (this.mode === 'file' && !this.file) {
      this.error.set('Elegí una imagen antes de continuar.');
      return;
    }
    this.uploading.set(true);
    try {
      let url = this.assetUrl.trim();
      if (this.mode === 'file' && this.file) {
        const body = new FormData();
        body.append('file', this.file);
        const response = await firstValueFrom(
          this.http.post<ApiResponse<{ url: string }>>(environment.apiUrl + '/media/images', body),
        );
        url = response.data.url;
        this.assetUrl = url;
        this.mode = 'url';
      }
      const payload: Record<string, unknown> = {
        asset_type: this.assetType,
        asset_url: url,
        preview_url: this.previewUrl.trim() || null,
      };
      if (this.editing) payload['is_active'] = this.isActive;
      this.saved.emit(payload);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.uploading.set(false);
    }
  }
  ngOnDestroy() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }
}