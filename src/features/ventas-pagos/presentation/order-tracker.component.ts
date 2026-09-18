import { Component, Input, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IconComponent } from '../../../shared/icon.component';
import { Order, commerceLabel } from '../domain/commerce.models';
import { etapasDelPedido, progresoPedido, resumenPedido } from '../domain/order-progress';

/**
 * Seguimiento visual del pedido: en qué etapa está, cuáles ya pasaron y cuándo.
 *
 * Reemplaza la lista de eventos en texto por una línea de tiempo que se lee de
 * un vistazo, que es lo que el cliente quiere saber cuando entra a "Mis
 * pedidos": dónde está su compra.
 */
@Component({
  selector: 'fs-order-tracker',
  imports: [DatePipe, IconComponent],
  template: `<div class="tracker">
    <p class="tracker-summary">
      <strong>{{ etapaActual()?.titulo || 'Pedido' }}</strong>
      <span>{{ resumen() }}</span>
    </p>

    <!-- Línea de tiempo: la barra se llena hasta donde llegó el pedido. -->
    <div class="tracker-line" role="list" [attr.aria-label]="'Estado del pedido ' + order.number">
      <!-- El avance viaja como propiedad CSS: la barra es horizontal en
           escritorio y vertical en teléfono, y cada caso la usa a su manera. -->
      <div class="tracker-rail" [style.--avance]="progreso() + '%'"><span></span></div>
      @for (etapa of etapas(); track etapa.clave) {
        <div class="tracker-step" [class]="'is-' + etapa.estado" role="listitem">
          <span class="tracker-dot"><fs-icon [name]="etapa.icono" /></span>
          <span class="tracker-label">{{ etapa.titulo }}</span>
          @if (etapa.fecha) {
            <small>{{ etapa.fecha | date: 'dd/MM HH:mm' }}</small>
          }
        </div>
      }
    </div>

    @if (order.carrier || order.tracking_number) {
      <p class="tracker-carrier">
        <fs-icon name="box" />
        {{ order.carrier || 'Transporte asignado' }}
        @if (order.tracking_number) {
          · Seguimiento <strong>{{ order.tracking_number }}</strong>
        }
      </p>
    }

    @if (order.tracking?.length) {
      <button type="button" class="tracker-toggle" (click)="detalle.set(!detalle())">
        <fs-icon [name]="detalle() ? 'close' : 'list'" />
        {{ detalle() ? 'Ocultar detalle' : 'Ver detalle del recorrido' }}
      </button>
      @if (detalle()) {
        <ol class="tracker-events">
          @for (evento of eventos(); track $index) {
            <li>
              <strong>{{ etiqueta(evento.status) }}</strong>
              <small>{{ evento.date | date: 'dd/MM/yyyy HH:mm' }}</small>
              @if (evento.note) {
                <p>{{ evento.note }}</p>
              }
            </li>
          }
        </ol>
      }
    }
  </div>`,
})
export class OrderTrackerComponent {
  @Input({ required: true }) set pedido(value: Order) {
    this.order = value;
    this.actualizado.set(value);
  }
  order!: Order;
  private actualizado = signal<Order | null>(null);
  detalle = signal(false);
  etiqueta = commerceLabel;

  etapas = computed(() => {
    const pedido = this.actualizado();
    return pedido ? etapasDelPedido(pedido) : [];
  });
  etapaActual = computed(() => this.etapas().find((e) => e.estado === 'actual'));
  progreso = computed(() => progresoPedido(this.etapas()));
  resumen = computed(() => {
    const pedido = this.actualizado();
    return pedido ? resumenPedido(pedido) : '';
  });
  /** El recorrido se lee de lo más reciente a lo más antiguo. */
  eventos = computed(() => [...(this.actualizado()?.tracking || [])].reverse());
}
