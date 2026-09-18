import { DecimalPipe, UpperCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../../shared/icon.component';
import { CommerceService } from '../infrastructure/commerce.service';
import { Branch, CartItem, CashPoint, Order } from '../domain/commerce.models';
import { PosReturnsComponent } from './pos-returns.component';
import { errorMessage } from '../../../shared/errors';
import { environment } from '../../../environments/environment';

/**
 * Medios con los que se puede cobrar en el mostrador (RF18).
 *
 * Cada uno deja un rastro distinto, así que la referencia que se pide cambia:
 * un pago con QR deja el identificador de la transacción, la tarjeta deja el
 * voucher del terminal. Pedir siempre «n.º de recibo» llevaba a cargar
 * cualquier cosa, y esa referencia es lo que después permite auditar el cobro.
 */
const MEDIOS_DE_PAGO = [
  { valor: 'cash', titulo: 'Efectivo', icono: 'cart', referencia: 'N.º de recibo', ejemplo: 'REC-0098' },
  { valor: 'qr', titulo: 'QR', icono: 'image', referencia: 'ID de la transacción', ejemplo: 'QR-20260918-0042' },
  { valor: 'card', titulo: 'Tarjeta', icono: 'tag', referencia: 'Voucher del terminal', ejemplo: 'VCH-778120' },
  { valor: 'transfer', titulo: 'Transferencia', icono: 'upload', referencia: 'N.º de comprobante', ejemplo: 'TRF-556677' },
] as const;

type MedioDePago = (typeof MEDIOS_DE_PAGO)[number]['valor'];

/** Una prenda en la venta en curso. */
interface Linea {
  item: CartItem;
  cantidad: number;
}

/**
 * Punto de venta (RF17, RF18).
 *
 * Es la pantalla que el cajero usa con el cliente enfrente, así que prioriza la
 * velocidad sobre la densidad: buscar y agregar con el teclado, ver el total de
 * lejos y saber el vuelto sin calcularlo de cabeza.
 *
 * Los precios, los totales y la disponibilidad **siempre** los decide el
 * servidor; acá solo se eligen identidades y cantidades. El importe que se ve
 * en pantalla es una previsualización para el cobro, no la fuente de la verdad.
 */
@Component({
  selector: 'fs-pos-page',
  imports: [FormsModule, DecimalPipe, UpperCasePipe, IconComponent, PosReturnsComponent],
  styleUrls: ['./commerce.scss', './pos.scss'],
  template: `<section class="commerce-page">
    <p class="eyebrow">PUNTO DE VENTA</p>
    <h1>Caja</h1>

    <div class="pos-bar">
      <label>
        Sucursal
        <select [(ngModel)]="branch" (ngModelChange)="cargarSucursal()" [disabled]="busy()">
          <option value="">Seleccioná una sucursal</option>
          @for (b of branches(); track b.id) {
            <option [value]="b.id">{{ b.name }}</option>
          }
        </select>
      </label>
      <label>
        Punto de caja
        <select [(ngModel)]="cashPoint" [disabled]="!branch || busy()">
          <option value="">Seleccioná una caja</option>
          @for (p of cashPoints(); track p.id) {
            <option [value]="p.id">{{ p.code }} · {{ p.name }}</option>
          }
        </select>
      </label>
      <div class="pos-tabs">
        <button type="button" [class.is-active]="vista() === 'venta'" (click)="vista.set('venta')">
          <fs-icon name="cart" /> Vender
        </button>
        <button type="button" [class.is-active]="vista() === 'devolucion'" (click)="vista.set('devolucion')">
          <fs-icon name="refresh" /> Devolver
        </button>
      </div>
    </div>

    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }

    @if (vista() === 'devolucion') {
      <fs-pos-returns [sucursal]="branch" />
    } @else if (cobrada(); as venta) {
      <!-- Venta cerrada: lo único que importa ahora es el vuelto y el comprobante. -->
      <div class="pos-recibo">
        <h2><fs-icon name="check" /> Venta {{ venta.number }} registrada</h2>
        <dl>
          <dt>Total cobrado</dt>
          <dd><strong>{{ venta.currency | uppercase }} {{ venta.total | number: '1.2-2' }}</strong></dd>
          @if (vueltoCobrado() !== null) {
            <dt>Vuelto</dt>
            <dd><strong>{{ vueltoCobrado() | number: '1.2-2' }}</strong></dd>
          }
          <dt>Comprobante por correo</dt>
          <dd>{{ venta.customer_email ? 'Enviado a ' + venta.customer_email : 'Sin correo del cliente' }}</dd>
        </dl>
        <div class="pos-actions">
          <button type="button" class="primary" (click)="imprimir(venta)" [disabled]="busy()">
            <fs-icon name="download" /> Comprobante PDF
          </button>
          <button type="button" (click)="nuevaVenta()"><fs-icon name="plus" /> Nueva venta</button>
        </div>
      </div>
    } @else {
      <div class="pos-layout">
        <section class="pos-panel">
          <form class="pos-search" (ngSubmit)="$event.preventDefault(); agregarPorCodigo()">
            <label>
              Buscar o escanear
              <input
                name="buscar"
                [(ngModel)]="search"
                type="search"
                placeholder="Nombre, talla, color o SKU — Enter agrega"
                autocomplete="off"
                [disabled]="!branch"
              />
            </label>
          </form>
          <p class="muted">
            Con un lector de código de barras alcanza con escanear: el SKU exacto se agrega solo.
          </p>

          <div class="pos-stock">
            <table>
              <thead>
                <tr><th>Prenda</th><th>Disponible</th><th></th></tr>
              </thead>
              <tbody>
                @for (item of filtradas(); track item.variant_id) {
                  <tr [class.is-agotado]="disponibleReal(item) <= 0">
                    <td>
                      <strong>{{ item.name }}</strong>
                      <small>{{ item.size }} · {{ item.color }} · {{ item.sku }}</small>
                    </td>
                    <td>
                      {{ disponibleReal(item) }}
                      <small>{{ item.unit_price }} {{ moneda }}</small>
                    </td>
                    <td>
                      <button type="button" (click)="cambiar(item, 1)" [disabled]="disponibleReal(item) <= 0">
                        <fs-icon name="plus" /> Añadir
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="3" class="muted">
                      {{ branch ? 'No hay prendas con esa búsqueda.' : 'Elegí una sucursal para empezar.' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <aside class="pos-ticket">
          <section class="pos-panel">
            <h2>Venta actual</h2>
            @for (linea of lineas(); track linea.item.variant_id) {
              <div class="pos-line">
                <div>
                  <strong>{{ linea.item.name }}</strong>
                  <small>{{ linea.item.size }} · {{ linea.item.color }} · {{ linea.item.unit_price }} {{ moneda }}</small>
                </div>
                <div class="pos-qty">
                  <button type="button" (click)="cambiar(linea.item, -1)" aria-label="Quitar una unidad">−</button>
                  <input
                    type="number"
                    [name]="'cant-' + linea.item.variant_id"
                    [ngModel]="linea.cantidad"
                    (ngModelChange)="fijar(linea.item, $event)"
                    min="0"
                    [max]="linea.item.available"
                  />
                  <button type="button" (click)="cambiar(linea.item, 1)" [disabled]="disponibleReal(linea.item) <= 0" aria-label="Agregar una unidad">+</button>
                  <button type="button" (click)="fijar(linea.item, 0)" aria-label="Quitar la prenda">
                    <fs-icon name="trash" />
                  </button>
                </div>
              </div>
            } @empty {
              <p class="muted">Agregá prendas desde el listado o escaneá su código.</p>
            }

            <div class="pos-total">
              <span>{{ unidades() }} unidad(es)</span>
              <strong>{{ total() | number: '1.2-2' }} {{ moneda }}</strong>
            </div>
          </section>

          <section class="pos-panel">
            <h2>Cobro</h2>
            <div class="pos-medios" role="group" aria-label="Forma de pago">
              @for (medio of MEDIOS; track medio.valor) {
                <button
                  type="button"
                  [class.is-active]="paymentMethod === medio.valor"
                  (click)="elegirMedio(medio.valor)"
                >
                  <fs-icon [name]="medio.icono" />
                  {{ medio.titulo }}
                </button>
              }
            </div>

            @if (paymentMethod === 'cash') {
              <label>
                Paga con
                <input type="number" name="recibido" [(ngModel)]="recibido" min="0" step="0.5" placeholder="0.00" />
              </label>
              @if (recibido) {
                <div class="pos-vuelto" [class.is-insuficiente]="vuelto() < 0">
                  <span>{{ vuelto() < 0 ? 'Falta' : 'Vuelto' }}</span>
                  <strong>{{ (vuelto() < 0 ? -vuelto() : vuelto()) | number: '1.2-2' }} {{ moneda }}</strong>
                </div>
              }
            }

            <label>
              {{ etiquetaReferencia() }}
              <input
                name="referencia"
                [(ngModel)]="reference"
                [placeholder]="ejemploReferencia()"
                maxlength="255"
              />
            </label>
            <label>
              Cliente
              <input name="cliente" [(ngModel)]="customerName" autocomplete="off" placeholder="Consumidor final" />
            </label>
            <label>
              Correo (para enviarle el comprobante)
              <input name="correo" [(ngModel)]="customerEmail" type="email" autocomplete="off" placeholder="cliente@correo.com" />
            </label>
            <label class="check">
              <input type="checkbox" name="recibido-ok" [(ngModel)]="received" />
              Confirmo que el pago fue recibido.
            </label>

            <button type="button" class="primary" (click)="cobrar()" [disabled]="busy() || !lineas().length">
              {{ busy() ? 'Registrando…' : 'Cobrar y emitir comprobante' }}
            </button>
            <p class="muted">
              El servidor confirma precios y existencias antes de guardar. Si el cliente deja su
              correo, recibe el comprobante automáticamente.
            </p>
          </section>
        </aside>
      </div>
    }
  </section>`,
})
export class PosPageComponent {
  private api = inject(CommerceService);
  private http = inject(HttpClient);

  vista = signal<'venta' | 'devolucion'>('venta');
  branches = signal<Branch[]>([]);
  cashPoints = signal<CashPoint[]>([]);
  items = signal<CartItem[]>([]);
  lineas = signal<Linea[]>([]);
  cobrada = signal<Order | null>(null);
  vueltoCobrado = signal<number | null>(null);
  busy = signal(false);
  error = signal('');

  branch = '';
  cashPoint = '';
  search = '';
  customerName = '';
  customerEmail = '';
  paymentMethod: MedioDePago = 'cash';
  readonly MEDIOS = MEDIOS_DE_PAGO;
  reference = '';
  recibido: number | null = null;
  received = false;
  readonly moneda = 'BOB';

  total = computed(() =>
    this.lineas().reduce((suma, l) => suma + Number(l.item.unit_price) * l.cantidad, 0),
  );
  unidades = computed(() => this.lineas().reduce((suma, l) => suma + l.cantidad, 0));
  vuelto = computed(() => Number(this.recibido || 0) - this.total());

  constructor() {
    void this.inicializar();
  }

  private async inicializar() {
    try {
      this.branches.set(await this.api.branches());
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  /** Solo el efectivo da vuelto; los demás se cobran por el importe exacto. */
  elegirMedio(valor: MedioDePago) {
    this.paymentMethod = valor;
    if (valor !== 'cash') this.recibido = null;
    this.reference = '';
  }
  private medio() {
    return MEDIOS_DE_PAGO.find((m) => m.valor === this.paymentMethod) || MEDIOS_DE_PAGO[0];
  }
  etiquetaReferencia() {
    return this.medio().referencia;
  }
  ejemploReferencia() {
    return this.medio().ejemplo;
  }

  filtradas() {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter((i) =>
      [i.name, i.sku, i.size, i.color].join(' ').toLowerCase().includes(q),
    );
  }

  /** Lo que queda en góndola descontando lo que ya está en esta venta. */
  disponibleReal(item: CartItem) {
    return item.available - (this.lineas().find((l) => l.item.variant_id === item.variant_id)?.cantidad || 0);
  }

  /** Enter en el buscador: con un SKU exacto agrega sin tocar el mouse. */
  agregarPorCodigo() {
    const q = this.search.trim().toLowerCase();
    if (!q) return;
    const exacta = this.items().find((i) => i.sku.toLowerCase() === q);
    const candidatas = this.filtradas();
    const elegida = exacta || (candidatas.length === 1 ? candidatas[0] : null);
    if (!elegida) return;
    if (this.disponibleReal(elegida) <= 0) {
      this.error.set(`No queda stock de ${elegida.name} (${elegida.size}/${elegida.color}).`);
      return;
    }
    this.cambiar(elegida, 1);
    this.search = '';
    this.error.set('');
  }

  cambiar(item: CartItem, delta: number) {
    const actual = this.lineas().find((l) => l.item.variant_id === item.variant_id)?.cantidad || 0;
    this.fijar(item, actual + delta);
  }

  fijar(item: CartItem, cantidad: number) {
    // Nunca por encima de lo que la sucursal tiene: el servidor lo rechazaría.
    const valor = Math.max(0, Math.min(Number(cantidad) || 0, item.available));
    this.lineas.update((lineas) => {
      const resto = lineas.filter((l) => l.item.variant_id !== item.variant_id);
      return valor === 0 ? resto : [...resto, { item, cantidad: valor }];
    });
  }

  async cargarSucursal() {
    this.items.set([]);
    this.lineas.set([]);
    this.cashPoints.set([]);
    this.cashPoint = '';
    this.cobrada.set(null);
    if (!this.branch) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const [puntos, stock] = await Promise.all([
        this.api.cashPoints(this.branch),
        this.api.posStock(this.branch),
      ]);
      this.cashPoints.set(puntos);
      this.items.set(stock);
      // Con una sola caja no tiene sentido obligar a elegirla.
      if (puntos.length === 1) this.cashPoint = puntos[0].id;
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  nuevaVenta() {
    this.cobrada.set(null);
    this.vueltoCobrado.set(null);
    this.lineas.set([]);
    this.reference = '';
    this.customerName = '';
    this.customerEmail = '';
    this.recibido = null;
    this.received = false;
    this.search = '';
    void this.cargarSucursal();
  }

  private validar(): string {
    if (!this.branch || !this.cashPoint) return 'Elegí la sucursal y el punto de caja.';
    if (this.customerName.trim().length < 2) return 'Escribí el nombre del cliente.';
    if (this.reference.trim().length < 3) return 'Indicá la referencia del cobro.';
    if (!this.received) return 'Confirmá que ya recibiste el pago.';
    if (this.paymentMethod === 'cash' && this.recibido !== null && this.vuelto() < 0)
      return 'El efectivo recibido no alcanza para cubrir el total.';
    return '';
  }

  async cobrar() {
    const problema = this.validar();
    if (problema) {
      this.error.set(problema);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const vuelto = this.paymentMethod === 'cash' && this.recibido !== null ? this.vuelto() : null;
    try {
      const venta = await this.api.posSale({
        client_request_id: crypto.randomUUID(),
        branch_id: this.branch,
        cash_point_id: this.cashPoint,
        customer_name: this.customerName.trim(),
        customer_email: this.customerEmail.trim() || undefined,
        payment_method: this.paymentMethod,
        payment_reference: this.reference.trim(),
        payment_received: true,
        items: this.lineas().map((l) => ({ variant_id: l.item.variant_id, quantity: l.cantidad })),
      });
      this.vueltoCobrado.set(vuelto);
      this.cobrada.set(venta);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async imprimir(venta: Order) {
    this.busy.set(true);
    try {
      const pdf = await firstValueFrom(
        this.http.get(environment.apiUrl + '/commerce/admin/orders/' + venta.id + '/receipt', {
          responseType: 'blob',
        }),
      );
      const url = URL.createObjectURL(pdf);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
