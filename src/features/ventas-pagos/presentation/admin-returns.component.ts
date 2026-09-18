import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/icon.component';
import { CommerceService } from '../infrastructure/commerce.service';
import { Branch, OrderReturn, commerceLabel } from '../domain/commerce.models';
import { SessionService } from '../../auth/application/session.service';
import { errorMessage } from '../../../shared/errors';

/** Qué puede hacer administración con una devolución según su estado (CU19). */
const SIGUIENTES: Record<string, { status: string; titulo: string; icono: string }[]> = {
  requested: [
    { status: 'approved', titulo: 'Aprobar', icono: 'check' },
    { status: 'rejected', titulo: 'Rechazar', icono: 'close' },
  ],
  approved: [
    { status: 'completed', titulo: 'Registrar prendas recibidas', icono: 'box' },
    { status: 'rejected', titulo: 'Rechazar', icono: 'close' },
  ],
};

/**
 * Gestión de devoluciones (CU19).
 *
 * Aprobar no devuelve stock: las unidades vuelven recién al registrar que las
 * prendas llegaron a la sucursal, que es cuando existen físicamente de nuevo.
 */
@Component({
  selector: 'fs-admin-returns',
  imports: [FormsModule, DatePipe, DecimalPipe, UpperCasePipe, IconComponent],
  styleUrl: './commerce.scss',
  template: `<section class="commerce-page">
    <p class="eyebrow">GESTIÓN COMERCIAL</p>
    <h1>Devoluciones</h1>
    <p class="muted">
      Revisá las solicitudes de los clientes. Las prendas vuelven al stock cuando registrás que
      llegaron a la sucursal.
    </p>

    <form class="orders-filters" (ngSubmit)="$event.preventDefault(); filtrar()">
      <label>
        Estado
        <select [ngModel]="filtro()" (ngModelChange)="filtro.set($event); filtrar()" name="estado">
          <option value="">Todas</option>
          <option value="requested">Solicitadas</option>
          <option value="approved">Aprobadas</option>
          <option value="completed">Cerradas</option>
          <option value="rejected">Rechazadas</option>
        </select>
      </label>
      <label>
        Sucursal
        <select [ngModel]="sucursal()" (ngModelChange)="sucursal.set($event); filtrar()" name="sucursal">
          <option value="">Todas</option>
          @for (b of branches(); track b.id) {
            <option [value]="b.id">{{ b.name }}</option>
          }
        </select>
      </label>
      <label class="orders-search">
        Buscar
        <input name="q" [(ngModel)]="consulta" type="search" placeholder="N.º de pedido" />
      </label>
      <button type="submit" [disabled]="busy()"><fs-icon name="search" /> Buscar</button>
      <button type="button" (click)="load()" [disabled]="busy()"><fs-icon name="refresh" /> Actualizar</button>
    </form>

    @if (pendientes().length) {
      <!-- Lo que hay que resolver, y cuánto dinero está comprometido en ello. -->
      <p class="alert" role="status">
        <strong>{{ pendientes().length }}</strong> devolución(es) sin resolver por
        <strong>{{ comprometido() | number: '1.2-2' }}</strong>.
      </p>
    }

    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }
    @if (message()) {
      <p class="alert" role="status">{{ message() }}</p>
    }
    @if (busy()) {
      <p role="status">Actualizando…</p>
    }

    <div class="orders-grid">
      @for (d of devoluciones(); track d.id) {
        <article class="order-card">
          <div class="order-header">
            <div>
              <h2>
                Pedido {{ d.order_number || '—' }}
                @if (d.sales_channel === 'pos') {
                  <span class="order-flag">Caja</span>
                }
              </h2>
              <p class="muted">
                Devolución {{ codigo(d) }} · {{ d.created_at | date: 'dd/MM/yyyy HH:mm' }}
              </p>
              <p class="muted">
                {{ d.customer_name || 'Consumidor final' }}
                @if (d.customer_email) {
                  · {{ d.customer_email }}
                }
                @if (d.branch_name) {
                  · {{ d.branch_name }}
                }
              </p>
            </div>
            <div>
              <span class="commerce-status">{{ label(d.status) }}</span>
              <p>
                <strong>{{ d.currency | uppercase }} {{ d.refund_amount | number: '1.2-2' }}</strong>
              </p>
            </div>
          </div>

          <p><strong>Motivo del cliente:</strong> {{ d.reason }}</p>
          @for (i of d.items; track i.variant_id) {
            <div class="commerce-item">
              @if (i.image_url) {
                <img [src]="i.image_url" [alt]="i.name" />
              } @else {
                <span>F.</span>
              }
              <div>
                <h3>{{ i.name }}</h3>
                <p>{{ i.size }} · {{ i.color }} · {{ i.quantity }} unidad(es)</p>
                <small>{{ i.sku }}</small>
              </div>
              <strong>{{ d.currency | uppercase }} {{ i.line_total | number: '1.2-2' }}</strong>
            </div>
          }
          @if (d.resolution_note) {
            <p class="muted">Resolución: {{ d.resolution_note }}</p>
          }

          @if (session.can('commerce.write') && acciones(d).length) {
            <div class="commerce-actions">
              @for (accion of acciones(d); track accion.status) {
                <button (click)="abrir(d, accion.status)" [disabled]="busy()">
                  <fs-icon [name]="accion.icono" /> {{ accion.titulo }}
                </button>
              }
            </div>
          }

          @if (editando() === d.id) {
            <form
              #form="ngForm"
              (ngSubmit)="form.valid && guardar(d)"
              class="checkout-summary"
              style="position:static;margin-top:16px"
            >
              <h3>{{ titulo() }}</h3>
              <label
                >Nota para el cliente{{ destino() === 'rejected' ? ' (obligatoria)' : '' }}
                <textarea
                  name="nota"
                  [(ngModel)]="nota"
                  [required]="destino() === 'rejected'"
                  maxlength="500"
                ></textarea>
              </label>
              @if (destino() === 'completed') {
                <p class="muted">
                  Al guardar, las unidades vuelven al stock de la sucursal con su movimiento de
                  inventario.
                </p>
              }
              <div class="commerce-actions">
                <button type="submit" class="primary" [disabled]="busy() || !form.valid">
                  Guardar</button
                ><button type="button" (click)="editando.set('')" [disabled]="busy()">Volver</button>
              </div>
            </form>
          }
        </article>
      } @empty {
        @if (!busy()) {
          <div class="empty-state">
            <h2>No hay devoluciones con ese estado</h2>
          </div>
        }
      }
    </div>

    <div class="commerce-actions">
      <button (click)="page(-1)" [disabled]="offset() === 0 || busy()">Anterior</button
      ><span>Página {{ offset() / 50 + 1 }}</span
      ><button (click)="page(1)" [disabled]="devoluciones().length < 50 || busy()">Siguiente</button>
    </div>
  </section>`,
})
export class AdminReturnsComponent {
  private api = inject(CommerceService);
  session = inject(SessionService);
  devoluciones = signal<OrderReturn[]>([]);
  branches = signal<Branch[]>([]);
  busy = signal(false);
  error = signal('');
  message = signal('');
  editando = signal('');
  destino = signal('');
  filtro = signal('');
  sucursal = signal('');
  consulta = '';
  offset = signal(0);
  nota = '';
  label = commerceLabel;

  /** Lo que todavía espera una decisión. */
  pendientes = computed(() =>
    this.devoluciones().filter((d) => d.status === 'requested' || d.status === 'approved'),
  );
  /** Dinero comprometido en esas devoluciones sin resolver. */
  comprometido = computed(() =>
    this.pendientes().reduce((suma, d) => suma + Number(d.refund_amount), 0),
  );

  constructor() {
    void this.load();
    void this.cargarSucursales();
  }

  private async cargarSucursales() {
    try {
      this.branches.set(await this.api.branches());
    } catch {
      // Sin la lista, el filtro de sucursal queda vacío: el resto sigue sirviendo.
    }
  }

  codigo(d: OrderReturn) {
    return d.id.replace(/-/g, '').slice(0, 8).toUpperCase();
  }
  acciones(d: OrderReturn) {
    return SIGUIENTES[d.status] || [];
  }
  titulo() {
    return (
      { approved: 'Aprobar la devolución', rejected: 'Rechazar la devolución', completed: 'Registrar prendas recibidas' }[
        this.destino()
      ] || 'Resolver devolución'
    );
  }

  /** Filtros vigentes de la bandeja; los vacíos no viajan. */
  private filtros() {
    return { status: this.filtro(), branch_id: this.sucursal(), q: this.consulta.trim() };
  }

  async load() {
    this.busy.set(true);
    this.error.set('');
    try {
      this.devoluciones.set(await this.api.adminReturns(this.filtros(), this.offset()));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  filtrar() {
    // Un filtro nuevo empieza por la primera página.
    this.offset.set(0);
    void this.load();
  }
  page(direccion: number) {
    this.offset.update((v) => Math.max(0, v + direccion * 50));
    void this.load();
  }
  abrir(d: OrderReturn, status: string) {
    this.editando.set(d.id);
    this.destino.set(status);
    this.nota = '';
  }
  async guardar(d: OrderReturn) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      await this.api.resolveReturn(d.id, { status: this.destino(), note: this.nota || null });
      this.editando.set('');
      this.message.set('Devolución actualizada. El cliente recibió el aviso por correo.');
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
