import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OfflineCatalogStore } from '../application/offline-catalog.store';
import { OperacionesLocalesRepository } from '../infrastructure/operaciones-locales.repository';
import { openOfflineDb, CajaLocal, ClienteLocal, VentaItemLocal, VentaLocal } from '../../../app/core/offline/offline-db';
import { getDeviceId } from '../../../app/core/offline/device-id';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { errorMessage } from '../../../shared/errors';
import { CatalogoLocalRepository } from '../infrastructure/catalogo-local.repository';

@Component({
  selector: 'fs-venta-offline',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="container section">
      <p><a routerLink="/sin-conexion">Sin conexión</a></p>
      <h1>Venta de contado sin conexión</h1>
      <p>Se cobra en efectivo y queda pendiente de confirmación en el servidor.</p>
      @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
      @if (comprobante(); as venta) {
        <article class="panel">
          <h2>Comprobante provisional</h2>
          <strong>{{ venta.folio }}</strong>
          <p>Pendiente de sincronizar · {{ venta.creada_en | date:'short' }}</p>
          <p>Cliente: {{ venta.cliente_nombre || 'Sin cliente' }}</p>
          <p>Total Bs {{ venta.total | number:'1.2-2' }} · Efectivo Bs {{ venta.recibido | number:'1.2-2' }}</p>
          <p>Vuelto Bs {{ venta.vuelto | number:'1.2-2' }}</p>
          <a routerLink="/sin-conexion/operaciones">Consultar operaciones locales</a>
          <button type="button" (click)="comprobante.set(null)">Nueva venta</button>
        </article>
      } @else if (!catalogo.meta().version) {
        <p>Descargá el catálogo de tu empresa antes de vender.</p>
        <a routerLink="/sin-conexion">Preparar catálogo</a>
      } @else {
        <p>Catálogo descargado {{ catalogo.meta().descargadoEn | date:'short' }}</p>
        <label>Caja
          <select [(ngModel)]="cajaId">
            <option value="">Elegí una caja</option>
            @for (caja of cajas(); track caja.id) { <option [value]="caja.id">{{ caja.nombre }}</option> }
          </select>
        </label>
        <fieldset class="cliente">
          <legend>Cliente (opcional)</legend>
          <label>Buscar cliente por nombre
            <input [ngModel]="busquedaCliente()" (ngModelChange)="busquedaCliente.set($event)"
              placeholder="Ej.: Ana" aria-label="Buscar cliente por nombre" /></label>
          <label>Cliente
            <select [ngModel]="clienteId()" (ngModelChange)="clienteId.set($event)" aria-label="Cliente de la venta">
              <option value="">Sin cliente (venta de mostrador)</option>
              @if (clienteSeleccionado(); as c) {
                @if (!clientesFiltrados().includes(c)) { <option [value]="c.id">{{ etiquetaCliente(c) }}</option> }
              }
              @for (c of clientesFiltrados(); track c.id) { <option [value]="c.id">{{ etiquetaCliente(c) }}</option> }
            </select>
          </label>
          @if (busquedaCliente() && !clientesFiltrados().length) {
            <p class="muted">No hay clientes descargados con ese nombre. Podés vender sin cliente.</p>
          }
        </fieldset>
        <label>Buscar por nombre o SKU <input [(ngModel)]="busqueda" /></label>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Prenda</th><th>Precio</th><th>Disponible</th><th>Cantidad</th></tr></thead>
            <tbody>
              @for (item of opciones(); track item.id) {
                @if (!busqueda || (item.nombre + ' ' + item.sku).toLowerCase().includes(busqueda.toLowerCase())) {
                  <tr><td>{{ item.nombre }} · {{ item.talla }} · {{ item.color }}<br />{{ item.sku }}</td>
                    <td>Bs {{ item.precio | number:'1.2-2' }}</td><td>{{ item.stock }}</td>
                    <td><input type="number" min="0" [max]="item.stock" [ngModel]="cantidades()[item.id] ?? 0"
                      (ngModelChange)="cantidad(item.id, $event)" aria-label="Cantidad" /></td></tr>
                }
              }
            </tbody>
          </table>
        </div>
        <p>Total Bs {{ total() | number:'1.2-2' }}</p>
        <label>Efectivo recibido <input type="number" min="0" [(ngModel)]="recibido" /></label>
        <button class="primary" [disabled]="guardando() || total() <= 0" (click)="confirmar()">Cobrar y guardar venta local</button>
      }
    </section>
  `,
  styles: [`.table-wrap { overflow-x: auto; } label { display: block; margin: 1rem 0; }
    input[type=number] { max-width: 8rem; } fieldset.cliente { border: 1px solid var(--line, #ddd); padding: 0 1rem; } .panel { display: grid; gap: 1rem; }`],
})
export class VentaOfflineComponent {
  catalogo = inject(OfflineCatalogStore);
  private session = inject(SessionService);
  private repo = inject(OperacionesLocalesRepository);
  private catalogoRepo = inject(CatalogoLocalRepository);
  cajas = signal<CajaLocal[]>([]);
  cantidades = signal<Record<string, number>>({});
  comprobante = signal<VentaLocal | null>(null);
  guardando = signal(false);
  error = signal('');
  cajaId = '';
  busqueda = '';
  recibido = 0;
  /** CU-18: cliente opcional elegido entre los descargados en el snapshot. */
  busquedaCliente = signal('');
  clienteId = signal('');
  clienteSeleccionado = computed(() =>
    this.catalogo.datos().clientes.find(cliente => cliente.id === this.clienteId()) ?? null);
  clientesFiltrados = computed(() => {
    const q = this.busquedaCliente().trim().toLowerCase();
    const clientes = this.catalogo.datos().clientes;
    return (q ? clientes.filter(cliente => cliente.nombre.toLowerCase().includes(q)) : clientes).slice(0, 50);
  });
  opciones = computed(() => this.catalogo.datos().variantes.filter(variant => variant.activa).flatMap(variant => {
    const product = this.catalogo.datos().productos.find(product => product.id === variant.producto_id);
    if (!product) return [];
    const stock = this.catalogo.datos().existencias.find(stock => stock.variante_id === variant.id)?.cantidad ?? 0;
    return [{ id: variant.id, nombre: product.nombre, sku: variant.sku, talla: variant.talla, color: variant.color,
      stock, precio: variant.precio ?? product.precio_base }];
  }));
  total = computed(() => this.opciones().reduce((total, item) =>
    total + Math.round(item.precio * 100) * (this.cantidades()[item.id] ?? 0), 0) / 100);

  constructor() { void this.cargar().catch(error => this.error.set(errorMessage(error))); }

  private async cargar() {
    await this.catalogo.cargarLocal();
    const meta = await this.catalogoRepo.meta();
    const user = this.session.user();
    if (!user?.tenant || meta.tenantId !== user.tenant.id || meta.usuarioId !== user.id) return;
    const db = await openOfflineDb();
    try {
      const cajas = await db.getAllFromIndex('cajas', 'sucursal_id', meta.sucursalId ?? '');
      this.cajas.set(cajas.filter(caja => caja.activa));
      this.cajaId = this.cajas()[0]?.id ?? '';
    } finally { db.close(); }
  }

  etiquetaCliente(c: ClienteLocal) {
    return c.nombre + (c.documento_final ? ' · doc. …' + c.documento_final : '');
  }

  cantidad(id: string, cantidad: number) { this.cantidades.update(items => ({ ...items, [id]: cantidad })); }

  async confirmar() {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.error.set('');
    try {
      const user = this.session.user();
      if (!user?.tenant || !this.session.can('commerce.write') || this.session.readOnly() ||
          !this.session.hasFeature('offline') || !this.session.hasFeature('sales'))
        throw new Error('Tu cuenta o suscripción no permite registrar ventas.');
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const items: VentaItemLocal[] = this.opciones().filter(item => this.cantidades()[item.id] > 0).map(item => ({
        venta_id: id, variante_id: item.id, producto_nombre: item.nombre,
        variante_desc: item.talla + ' · ' + item.color, cantidad: this.cantidades()[item.id],
        precio_unitario: item.precio, precio_regular: item.precio,
        total_linea: Math.round(item.precio * 100) * this.cantidades()[item.id] / 100,
      }));
      const total = this.total();
      const venta: VentaLocal = {
        id, folio: 'OFF-' + id.slice(0, 8).toUpperCase(), tenant_id: user.tenant.id,
        sucursal_id: this.catalogo.meta().sucursalId ?? '', caja_id: this.cajaId, usuario_id: user.id,
        subtotal: total, descuento: 0, total, recibido: this.recibido,
        vuelto: Math.round((this.recibido - total) * 100) / 100, forma_pago: 'EFECTIVO',
        estado: 'PENDIENTE_SINCRONIZAR', catalogo_descargado_en: this.catalogo.meta().descargadoEn ?? '',
        creada_en: now,
        cliente_id: this.clienteSeleccionado()?.id ?? null,
        cliente_nombre: this.clienteSeleccionado()?.nombre ?? null,
      };
      await this.repo.guardarVentaLocal(venta, items, {
        id, venta_id: id, tipo: 'VENTA', estado: 'PENDIENTE', tenant_id: user.tenant.id,
        sucursal_id: venta.sucursal_id, usuario_id: user.id, dispositivo_id: await getDeviceId(),
        intentos: 0, creada_en: now, actualizada_en: now,
      });
      this.comprobante.set(venta);
      this.cantidades.set({});
      this.recibido = 0;
      this.clienteId.set('');
      this.busquedaCliente.set('');
      await this.catalogo.cargarLocal();
    } catch (error) { this.error.set(errorMessage(error)); }
    finally { this.guardando.set(false); }
  }
}
