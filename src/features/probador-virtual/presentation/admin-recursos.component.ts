import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/icon.component';
import { DialogFocusDirective } from '../../../shared/dialog-focus.directive';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { errorMessage } from '../../../shared/errors';
import { VestidorAdminService } from '../infrastructure/vestidor-admin.service';
import {
  REGIONES_CUERPO,
  RecursoTryOn,
  cuerpoRegionLabel,
  recursoEstadoLabel,
} from '../domain/vestidor-admin.models';

/**
 * Bandeja administrativa de los recursos del probador (plan de evolución, F1).
 *
 * Toda la preparación automática termina acá: los recursos quedan listos o a la
 * espera de revisión. Esta bandeja permite ver lo que el análisis propuso
 * (vista previa y calidad), aprobar o descartar lo dudoso, reintentar lo que
 * falló, ajustar a mano la región/tipo y disparar la preparación en lote de lo
 * pendiente.
 *
 * El permiso de lectura alcanza para ver; las acciones editoriales piden el de
 * escritura y se ocultan si no se tiene.
 */
@Component({
  selector: 'fs-admin-recursos',
  imports: [FormsModule, RouterLink, IconComponent, DialogFocusDirective],
  styles: [
    `
      strong.baja {
        color: #a4453a;
      }
    `,
  ],
  template: `<p class="eyebrow">PROBADOR VIRTUAL</p>
    <h1>Recursos del probador</h1>
    <p class="muted">
      Revisá la preparación automática de las prendas: aprobá o descartá las que
      quedaron en revisión, reintentá las que fallaron y prepará en lote las
      pendientes. Un recurso dudoso nunca se publica solo.
    </p>
    <div class="toolbar" aria-label="Recursos del probador">
      <label
        >Estado<select [(ngModel)]="status" (ngModelChange)="apply()">
          <option value="">Todos</option>
          <option value="review">Esperando revisión</option>
          <option value="ready">Listos</option>
          <option value="failed">Con errores</option>
          <option value="manual">Ajustados a mano</option>
          <option value="pending">Pendientes</option>
        </select></label
      >
      <button type="button" [disabled]="loading()" (click)="apply()">
        <fs-icon name="refresh" />Actualizar bandeja
      </button>
      @if (canWrite()) {
        <button type="button" [disabled]="preparando()" (click)="bulk()">
          {{ preparando() ? 'Preparando…' : 'Preparar pendientes en lote' }}
        </button>
      }
      @if (resumen()) {
        <p class="alert success" role="status">{{ resumen() }}</p>
      }
    </div>
    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }
    @if (loading()) {
      <p class="empty" role="status">Cargando recursos…</p>
    } @else {
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Prenda</th>
              <th>Vista</th>
              <th>Estado</th>
              <th>Calidad</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (item of assets(); track item.id) {
              <tr>
                <td>
                  <a [routerLink]="['/admin/products', item.product_id]">{{
                    corto(item.product_id)
                  }}</a>
                  <p class="muted">Color {{ corto(item.color_id) }}</p>
                  @if (!item.enabled) {
                    <span class="badge inactive">Deshabilitado</span>
                  }
                </td>
                <td>
                  @if (vista(item)) {
                    <img class="table-image" [src]="vista(item)" [alt]="'Vista del recurso del color ' + corto(item.color_id)" loading="lazy" />
                  } @else {
                    <span class="muted">Sin vista</span>
                  }
                </td>
                <td>
                  <span class="badge">{{ recursoEstadoLabel(item.ai_status) }}</span>
                  @if (item.body_region || item.garment_type) {
                    <p class="muted">
                      {{ item.body_region ? cuerpoRegionLabel(item.body_region) : '' }}
                      {{ item.garment_type ? '· ' + item.garment_type : '' }}
                    </p>
                  }
                </td>
                <td>
                  @if (item.quality_score !== null && item.quality_score !== undefined) {
                    <strong [class.baja]="item.quality_score < 60">{{ item.quality_score }}/100</strong>
                  } @else {
                    —
                  }
                  <p class="muted">{{ item.quality_reason || item.ai_error || 'Sin detalle' }}</p>
                </td>
                <td>
                  @if (canWrite()) {
                    <div class="row-actions">
                      @if (item.ai_status === 'review') {
                        <button class="primary" (click)="abrirRevision(item)">Revisar</button>
                      }
                      @if (['failed', 'review'].includes(item.ai_status)) {
                        <button [disabled]="busy() === item.id" (click)="reintentar(item)">
                          Reintentar
                        </button>
                      }
                      <button (click)="abrirAjuste(item)">Corregir datos</button>
                    </div>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="empty">No hay recursos para este estado.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (revision(); as item) {
      <div class="modal-backdrop">
        <section
          class="modal small"
          role="dialog"
          aria-modal="true"
          aria-label="Revisar recurso del probador"
          (dismissed)="revision.set(null); formError.set('')"
        >
          <h2>Revisar recurso</h2>
          <p class="muted">
            Prenda {{ corto(item.product_id) }} · color {{ corto(item.color_id) }}.
          </p>
          @if (formError()) {
            <p class="alert error">{{ formError() }}</p>
          }
          <label>Nota (opcional)<textarea
            name="nota"
            rows="3"
            maxlength="500"
            [(ngModel)]="nota"
            placeholder="Por ejemplo, el porqué de la decisión…"
          ></textarea></label>
          <div class="form-actions">
            <button class="primary" [disabled]="busy()" (click)="enviarRevision(item, true)">
              Aprobar y publicar
            </button>
            <button [disabled]="busy()" (click)="enviarRevision(item, false)">
              Descartar
            </button>
            <button [disabled]="busy()" (click)="revision.set(null); formError.set('')">
              Cancelar
            </button>
          </div>
        </section>
      </div>
    }

    @if (ajuste(); as item) {
      <div class="modal-backdrop">
        <section
          class="modal small"
          role="dialog"
          aria-modal="true"
          aria-label="Corregir datos del recurso del probador"
          (dismissed)="ajuste.set(null); formError.set('')"
        >
          <h2>Corregir datos del recurso</h2>
          <p class="muted">
            Corregí la región o tipo que propuso el análisis. Esto no reemplaza la
            imagen preparada ni agrega un modelo 3D.
          </p>
          @if (formError()) {
            <p class="alert error">{{ formError() }}</p>
          }
          <label>Región del cuerpo<select name="region" [(ngModel)]="regionSeleccionada">
            <option value="">Sin cambio</option>
            @for (region of REGIONES_CUERPO; track region.id) {
              <option [value]="region.id">{{ region.label }}</option>
            }
          </select></label>
          <label>Tipo de prenda<input name="tipo" [(ngModel)]="tipoAjuste" maxlength="40" placeholder="Por ejemplo: remera" /></label>
          <label class="check"><input type="checkbox" name="activo" [(ngModel)]="activoAjuste" />Recurso habilitado</label>
          <div class="form-actions">
            <button class="primary" [disabled]="busy()" (click)="guardarAjuste(item)">
              Guardar ajuste
            </button>
            <button [disabled]="busy()" (click)="ajuste.set(null); formError.set('')">Cancelar</button>
          </div>
        </section>
      </div>
    }
  `,
})
export class AdminRecursosComponent {
  private service = inject(VestidorAdminService);
  session = inject(SessionService);

  assets = signal<RecursoTryOn[]>([]);
  loading = signal(true);
  error = signal('');
  formError = signal('');
  busy = signal('');
  preparando = signal(false);
  resumen = signal('');
  status = '';
  revision = signal<RecursoTryOn | null>(null);
  ajuste = signal<RecursoTryOn | null>(null);
  nota = '';
  regionSeleccionada = '';
  tipoAjuste = '';
  activoAjuste = true;
  REGIONES_CUERPO = REGIONES_CUERPO;
  recursoEstadoLabel = recursoEstadoLabel;
  cuerpoRegionLabel = cuerpoRegionLabel;

  constructor() {
    void this.apply();
  }

  canWrite() {
    return this.session.can('catalog.write');
  }

  corto(id: string) {
    return id.slice(0, 8);
  }

  vista(item: RecursoTryOn) {
    return this.service.vistaDe(item);
  }

  async apply() {
    this.loading.set(true);
    this.error.set('');
    this.resumen.set('');
    try {
      this.assets.set(await this.service.list(this.status));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  abrirRevision(item: RecursoTryOn) {
    this.nota = '';
    this.formError.set('');
    this.revision.set(item);
  }

  async enviarRevision(item: RecursoTryOn, approve: boolean) {
    if (this.busy() || !this.canWrite()) return;
    this.busy.set(item.id);
    this.formError.set('');
    try {
      await this.service.review(item.id, approve, this.nota.trim());
      this.revision.set(null);
      await this.apply();
    } catch (e) {
      this.formError.set(errorMessage(e));
    } finally {
      this.busy.set('');
    }
  }

  async reintentar(item: RecursoTryOn) {
    if (this.busy() || !this.canWrite()) return;
    this.busy.set(item.id);
    this.error.set('');
    try {
      await this.service.retry(item.id);
      await this.apply();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set('');
    }
  }

  abrirAjuste(item: RecursoTryOn) {
    this.regionSeleccionada = item.body_region || '';
    this.tipoAjuste = item.garment_type || '';
    this.activoAjuste = item.enabled !== false;
    this.formError.set('');
    this.ajuste.set(item);
  }

  async guardarAjuste(item: RecursoTryOn) {
    if (this.busy() || !this.canWrite()) return;
    const cuerpo: Record<string, unknown> = { enabled: this.activoAjuste };
    if (this.regionSeleccionada) cuerpo['body_region'] = this.regionSeleccionada;
    if (this.tipoAjuste.trim()) cuerpo['garment_type'] = this.tipoAjuste.trim();
    this.busy.set(item.id);
    this.formError.set('');
    try {
      await this.service.adjust(item.id, cuerpo);
      this.ajuste.set(null);
      await this.apply();
    } catch (e) {
      this.formError.set(errorMessage(e));
    } finally {
      this.busy.set('');
    }
  }

  async bulk() {
    if (this.preparando() || !this.canWrite()) return;
    this.preparando.set(true);
    this.error.set('');
    this.resumen.set('');
    try {
      const r = await this.service.bulk(true);
      // Primero se refresca la bandeja (que limpia el resumen al arrancar) y
      // recién después se muestra el resultado, para que no lo borre el reload.
      await this.apply();
      this.resumen.set(
        `Preparación en lote: ${r.processed} procesados, ${r.ready} listos, ` +
          `${r.review} en revisión, ${r.failed} con errores, ${r.errors} sin procesar.`,
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.preparando.set(false);
    }
  }
}

