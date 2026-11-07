import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../../app/core/shared/api.service';
import { environment } from '../../../environments/environment';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { errorMessage } from '../../../shared/errors';
import { ApiResponse } from '../../../shared/models';

interface StoreConfig {
  slug: string;
  trade_name: string;
  is_published: boolean;
  logo_url: string | null;
  banner_url: string | null;
  brand_color: string | null;
  slogan: string | null;
  about: string | null;
  whatsapp: string | null;
  city: string | null;
  shipping_policy: string | null;
  seo_title: string | null;
  seo_description: string | null;
  missing_requirements: string[];
}
@Component({
  selector: 'fs-configuracion-empresa',
  imports: [FormsModule, RouterLink],
  template: `<p class="eyebrow">MI EMPRESA / CONFIGURACIÓN</p>
    <h1>Tu empresa, tu tienda</h1>
    <p>Configurá la presencia pública y los cobros de tu empresa desde un mismo lugar.</p>
    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }
    @if (message()) {
      <p class="alert success" role="status">{{ message() }}</p>
    }
    @if (store(); as s) {
      <section class="store-head">
        <div>
          <span class="badge">{{ s.is_published ? 'Publicada' : 'Sin publicar' }}</span>
          <h2>{{ s.trade_name }}</h2>
          <p>
            Catálogo exclusivo de tu empresa:
            <a [routerLink]="'/tienda/' + s.slug" target="_blank">/tienda/{{ s.slug }} ↗</a>
          </p>
        </div>
        <button
          [disabled]="busy() || (!s.is_published && s.missing_requirements.length > 0)"
          (click)="publish(!s.is_published)"
        >
          {{ s.is_published ? 'Despublicar tienda' : 'Publicar tienda' }}
        </button>
      </section>
      @if (s.missing_requirements.length) {
        <aside class="requirements">
          <strong>{{s.is_published?'Mejoras pendientes para tu tienda':'Antes de publicar'}}</strong>
          <ul>
            @for (item of s.missing_requirements; track item) {
              <li>{{ requirement(item) }}</li>
            }
          </ul>
        </aside>
      }
      <form #f="ngForm" (ngSubmit)="f.valid && save()" class="config-grid">
        <section>
          <h2>Marca e imágenes</h2>
          <label
            >Color de marca<input type="color" name="brand" [(ngModel)]="form.brand_color"
          /></label>
          <label>Eslogan<input name="slogan" [(ngModel)]="form.slogan" maxlength="160" /></label>
          <div class="image-pair">
            @for (kind of imageKinds; track kind) {
              <label
                >{{ kind === 'logo' ? 'Logo' : 'Portada' }}
                @if (kind === 'logo' ? s.logo_url : s.banner_url) {
                  <img [src]="kind === 'logo' ? s.logo_url : s.banner_url" [alt]="kind" />
                }
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  [disabled]="busy()"
                  (change)="upload(kind, $event)"
              /></label>
            }
          </div>
          <label
            >Acerca de tu tienda<textarea
              name="about"
              [(ngModel)]="form.about"
              maxlength="1000"
              rows="5"
            ></textarea>
          </label>
        </section>
        <section>
          <h2>Contacto y condiciones</h2>
          <label
            >WhatsApp<input
              name="whatsapp"
              [(ngModel)]="form.whatsapp"
              maxlength="30"
              placeholder="+591…"
          /></label>
          <label>Ciudad<input name="city" [(ngModel)]="form.city" maxlength="80" /></label>
          <label
            >Envíos y retiro en sucursal<textarea
              name="shipping"
              [(ngModel)]="form.shipping_policy"
              maxlength="1000"
              rows="5"
            ></textarea>
          </label>
          <h3>Aparición en buscadores</h3>
          <label
            >Título<input name="seo_title" [(ngModel)]="form.seo_title" maxlength="70"
          /></label>
          <label
            >Descripción<textarea
              name="seo_description"
              [(ngModel)]="form.seo_description"
              maxlength="160"
            ></textarea>
          </label>
        </section>
        <footer>
          <p>Los cambios se aplican solo a la tienda de esta empresa.</p>
          <button class="primary" type="submit" [disabled]="busy() || !f.valid">
            Guardar configuración
          </button>
        </footer>
      </form>
    } @else {
      <p role="status">Cargando configuración…</p>
    }`,
  styles: [
    `
      :host {
        display: block;
        max-width: 1200px;
        margin: auto;
      }
      .settings-links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 24px 0;
      }
      .settings-links a {
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: 8px;
      }
      .store-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        margin: 25px 0;
      }
      .config-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
      }
      .config-grid section,
      .requirements {
        background: var(--paper);
        border: 1px solid var(--line);
        padding: 24px;
        border-radius: 14px;
      }
      .config-grid label {
        display: grid;
        gap: 8px;
        margin: 18px 0;
      }
      .config-grid input,
      .config-grid textarea {
        width: 100%;
        box-sizing: border-box;
      }
      .config-grid input[type='color'] {
        width: 70px;
        height: 45px;
      }
      .config-grid footer {
        grid-column: 1/-1;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .image-pair {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .image-pair img {
        width: 100%;
        max-height: 110px;
        object-fit: contain;
      }
      .image-pair input {
        font-size: 12px;
      }
      @media (max-width: 750px) {
        .config-grid {
          grid-template-columns: 1fr;
        }
        .store-head {
          align-items: start;
          flex-direction: column;
        }
      }
    `,
  ],
})
export class ConfiguracionEmpresaComponent {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  session = inject(SessionService);
  store = signal<StoreConfig | null>(null);
  busy = signal(false);
  error = signal('');
  message = signal('');
  imageKinds = ['logo', 'banner'] as const;
  form = {
    brand_color: '#773c57',
    slogan: '',
    about: '',
    whatsapp: '',
    city: '',
    shipping_policy: '',
    seo_title: '',
    seo_description: '',
  };
  constructor() {
    void this.load();
  }
  async load() {
    try {
      const s = await firstValueFrom(this.api.get<StoreConfig>('/tenant/storefront'));
      this.store.set(s);
      for (const key of Object.keys(this.form) as (keyof typeof this.form)[])
        this.form[key] = s[key] || this.form[key];
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
  requirement(code: string) {
    return (
      (
        {
          subscription_active: 'Suscripción activa',
          branch_with_hours: 'Sucursal activa con horarios de atención',
          logo: 'Logo de la tienda',
          products_with_photo: 'Al menos tres prendas activas con fotografía',
          payment_method: 'Al menos un método de cobro activo',
        } as Record<string, string>
      )[code] || code
    );
  }
  async save() {
    await this.action(async () => {
      const result = await firstValueFrom(
        this.api.patch<StoreConfig>('/tenant/storefront', this.form),
      );
      this.store.set(result);
      this.message.set('Configuración guardada.');
    });
  }
  async publish(publish: boolean) {
    await this.action(async () => {
      this.store.set(
        await firstValueFrom(
          this.api.post<StoreConfig>('/tenant/storefront/' + (publish ? 'publish' : 'unpublish')),
        ),
      );
      this.message.set(publish ? 'Tu tienda ya está publicada.' : 'Tienda despublicada.');
    });
  }
  async upload(kind: 'logo' | 'banner', event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.error.set('La imagen no debe superar 5 MB.');
      return;
    }
    await this.action(async () => {
      const data = new FormData();
      data.append('file', file);
      await firstValueFrom(
        this.http.post<ApiResponse<unknown>>(
          environment.apiUrl + '/tenant/storefront/images/' + kind,
          data,
        ),
      );
      const s = await firstValueFrom(this.api.get<StoreConfig>('/tenant/storefront'));
      this.store.set(s);
      this.message.set('Imagen actualizada.');
    });
  }
  private async action(work: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      await work();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
