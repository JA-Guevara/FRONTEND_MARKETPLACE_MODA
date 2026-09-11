import { Component, Input, OnChanges, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { ApiResponse, Entity } from './models';

interface Draft {
  key: number;
  id?: string;
  url: string;
  preview: string;
  file?: File;
  alt: string;
  primary: boolean;
  failed: boolean;
}
@Component({
  selector: 'fs-product-images',
  imports: [FormsModule],
  template: ` <section class="photos" aria-label="Imágenes de la prenda">
    <h3>Imágenes de la prenda</h3>
    <p class="muted">Agregá archivos o enlaces. Revisá las imágenes antes de guardar la prenda.</p>
    <div class="sources">
      <label
        >Desde tu dispositivo<input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          (change)="files($event)"
          [disabled]="busy"
        /><small>JPEG, PNG o WebP · hasta 5 MB por imagen.</small></label
      >
      <div>
        <label
          >Desde un enlace<input
            type="url"
            [(ngModel)]="link"
            placeholder="https://…"
            [disabled]="busy"
            (keydown.enter)="$event.preventDefault(); addLink()" /></label
        ><button type="button" (click)="addLink()" [disabled]="busy">Añadir enlace</button>
      </div>
    </div>
    @if (error) {
      <p class="alert error" role="alert">{{ error }}</p>
    }
    @if (items[index]; as photo) {
      <div class="stage">
        @if (!photo.failed) {
          <img
            [src]="photo.preview"
            [alt]="photo.alt || 'Vista previa de la prenda'"
            (error)="photo.failed = true"
          />
        } @else {
          <p>No se pudo mostrar esta imagen. Revisá el enlace o reemplazala.</p>
        }
      </div>
      <div class="controls">
        <button
          type="button"
          (click)="move(-1)"
          [disabled]="busy || items.length < 2"
          aria-label="Imagen anterior"
        >
          ←</button
        ><span aria-live="polite">{{ index + 1 }} de {{ items.length }}</span
        ><button
          type="button"
          (click)="move(1)"
          [disabled]="busy || items.length < 2"
          aria-label="Imagen siguiente"
        >
          →</button
        ><button type="button" (click)="remove()" [disabled]="busy">Quitar imagen</button>
      </div>
      <label
        >Descripción<input
          [(ngModel)]="photo.alt"
          maxlength="255"
          [disabled]="busy"
          placeholder="Ej.: Vista frontal, camisa beige" /></label
      ><label class="check"
        ><input
          type="checkbox"
          [(ngModel)]="photo.primary"
          [disabled]="busy"
          (ngModelChange)="makePrimary(photo)"
        />Usar como imagen principal</label
      >
      <div class="thumbs">
        @for (image of items; track image.key; let i = $index) {
          <button
            type="button"
            (click)="index = i"
            [class.selected]="index === i"
            [disabled]="busy"
            [attr.aria-label]="'Ver imagen ' + (i + 1)"
          >
            <img [src]="image.preview" alt="" />
          </button>
        }
      </div>
    } @else {
      <div class="stage empty">Todavía no agregaste imágenes.</div>
    }
    @if (removed.length) {
      <p class="muted">
        {{ removed.length }} imagen(es) se quitarán al guardar. Cancelar conserva las imágenes
        actuales.
      </p>
    }
  </section>`,
  styles: [
    `
      :host {
        display: block;
      }
      .photos {
        border: 1px solid var(--line);
        padding: 16px;
        border-radius: 12px;
        margin-top: 18px;
      }
      .photos h3 {
        margin: 0 0 8px;
      }
      .photos p {
        font-size: 13px;
      }
      .sources {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .sources label,
      .photos > label {
        display: grid;
        gap: 6px;
        font-size: 13px;
        margin: 10px 0;
      }
      .sources input {
        max-width: 100%;
      }
      .sources > div {
        min-width: 0;
      }
      .stage {
        height: 200px;
        display: grid;
        place-items: center;
        background: #f2eee7;
        border-radius: 10px;
        overflow: hidden;
        margin-top: 14px;
      }
      .stage img {
        height: 100%;
        width: 100%;
        object-fit: contain;
      }
      .controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;
        margin: 10px 0;
      }
      .thumbs {
        display: flex;
        gap: 8px;
        overflow: auto;
        margin-top: 12px;
      }
      .thumbs button {
        padding: 2px;
        flex: 0 0 58px;
      }
      .thumbs img {
        width: 54px;
        height: 54px;
        object-fit: cover;
      }
      .thumbs .selected {
        border: 2px solid #665a43;
      }
      .photos > label.check {
        display: flex;
      }
      .stage p {
        padding: 16px;
      }
      @media (max-width: 600px) {
        .sources {
          grid-template-columns: minmax(0, 1fr);
        }
        .photos {
          padding: 12px;
        }
        .stage {
          height: 170px;
        }
      }
    `,
  ],
})
export class ProductImagesComponent implements OnChanges, OnDestroy {
  @Input() existing: Entity[] = [];
  @Input() busy = false;
  items: Draft[] = [];
  removed: string[] = [];
  index = 0;
  link = '';
  error = '';
  private counter = 0;
  private http = inject(HttpClient);
  ngOnChanges(changes: Record<string, unknown>) {
    if (changes['existing']) {
      this.release();
      this.items = (this.existing || []).map((i) => ({
        key: ++this.counter,
        id: i.id,
        url: i['url'],
        preview: i['url'],
        alt: i['alt_text'] || '',
        primary: !!i['is_primary'],
        failed: false,
      }));
      this.index = 0;
      this.removed = [];
    }
  }
  addLink() {
    if (this.busy) return;
    const url = this.link.trim();
    if (!/^https?:\/\/[^\s]+$/.test(url)) {
      this.error = 'Pegá un enlace HTTP o HTTPS válido.';
      return;
    }
    this.items.push({
      key: ++this.counter,
      url,
      preview: url,
      alt: '',
      primary: this.items.length === 0,
      failed: false,
    });
    this.index = this.items.length - 1;
    this.link = '';
    this.error = '';
  }
  files(event: Event) {
    if (this.busy) return;
    const input = event.target as HTMLInputElement;
    this.error = '';
    for (const file of Array.from(input.files || [])) {
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      ) {
        this.error = 'Algunos archivos no se agregaron: usá JPEG, PNG o WebP de hasta 5 MB.';
        continue;
      }
      this.items.push({
        key: ++this.counter,
        file,
        url: '',
        preview: URL.createObjectURL(file),
        alt: '',
        primary: this.items.length === 0,
        failed: false,
      });
      this.index = this.items.length - 1;
    }
    input.value = '';
  }
  move(direction: number) {
    this.index = (this.index + direction + this.items.length) % this.items.length;
  }
  makePrimary(photo: Draft) {
    if (photo.primary)
      this.items.forEach((i) => {
        if (i !== photo) i.primary = false;
      });
  }
  remove() {
    const photo = this.items[this.index];
    if (!photo || this.busy) return;
    if (photo.id) this.removed.push(photo.id);
    if (photo.file) URL.revokeObjectURL(photo.preview);
    this.items.splice(this.index, 1);
    this.index = Math.max(0, Math.min(this.index, this.items.length - 1));
  }
  async prepare() {
    if (this.link.trim())
      throw new Error('Añadí el enlace pendiente al carrusel o borrá el campo antes de guardar.');
    for (const item of this.items) {
      if (item.failed && !item.id)
        throw new Error('Revisá o quitá la imagen cuya vista previa falló.');
      if (item.file && !item.url) {
        const body = new FormData();
        body.append('file', item.file);
        const r = await firstValueFrom(
          this.http.post<ApiResponse<{ url: string }>>(environment.apiUrl + '/media/images', body),
        );
        item.url = r.data.url;
      }
    }
    return this.items.map((i) => ({
      ...(i.id ? { id: i.id } : {}),
      url: i.url,
      alt_text: i.alt.trim() || null,
      is_primary: i.primary,
      sort_order: this.items.indexOf(i),
    }));
  }
  private release() {
    this.items.filter((i) => i.file).forEach((i) => URL.revokeObjectURL(i.preview));
  }
  ngOnDestroy() {
    this.release();
  }
}
