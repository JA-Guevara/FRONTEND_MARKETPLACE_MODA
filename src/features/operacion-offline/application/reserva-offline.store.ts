import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { OfflineCatalogStore } from './offline-catalog.store';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { ReservasLocalesRepository } from '../infrastructure/reservas-locales.repository';
import {
  ItemReservaLocal,
  ReservaLocal,
  OperacionPendiente,
  puedeAgregar,
  validarVisita,
  construirPayload,
} from '../domain/reserva-offline.models';
import { getDeviceId } from '../../../app/core/offline/device-id';
@Injectable({ providedIn: 'root' })
export class ReservaOfflineStore {
  private scope = '';
  catalogo = inject(OfflineCatalogStore);
  private session = inject(SessionService);
  private repo = inject(ReservasLocalesRepository);
  readonly items = signal<Pick<ItemReservaLocal, 'variante_id' | 'cantidad'>[]>([]);
  readonly sucursalId = signal('');
  readonly fecha = signal('');
  readonly hora = signal('');
  readonly clienteId = signal('');
  readonly notas = signal('');
  readonly error = signal('');
  readonly guardando = signal(false);
  constructor() {
    effect(() => {
      const scope = [
        this.session.user()?.id,
        this.session.tenant()?.id,
        this.catalogo.meta().sucursalId,
      ].join(':');
      if (scope !== this.scope) {
        this.scope = scope;
        untracked(() => this.limpiar());
      }
    });
  }
  agregar(id: string, cantidad = 1) {
    if (this.guardando()) return 'La reserva se está guardando.';
    if (
      this.session.readOnly() ||
      !this.session.hasFeature('offline') ||
      !this.session.hasFeature('reservations')
    )
      return 'Tu suscripción no permite registrar reservas sin conexión.';
    if (!this.catalogo.datos().variantes.some((v) => v.id === id && v.activa))
      return 'Esta variante no está disponible en el catálogo local.';
    const stock = this.catalogo
      .datos()
      .existencias.filter(
        (x) => x.variante_id === id && x.sucursal_id === this.catalogo.meta().sucursalId,
      )
      .reduce((n, x) => n + x.cantidad, 0);
    const error = puedeAgregar(this.items(), id, cantidad, stock);
    if (error) {
      this.error.set(error);
      return error;
    }
    this.error.set('');
    this.sucursalId.set(this.catalogo.meta().sucursalId ?? '');
    this.items.update((items) =>
      items.some((i) => i.variante_id === id)
        ? items.map((i) => (i.variante_id === id ? { ...i, cantidad: i.cantidad + cantidad } : i))
        : [...items, { variante_id: id, cantidad }],
    );
    return null;
  }
  quitar(id: string) {
    this.items.update((xs) => xs.filter((x) => x.variante_id !== id));
  }
  cambiarCantidad(id: string, n: number) {
    const previous = this.items().find((i) => i.variante_id === id);
    if (!previous) return;
    if (n < 1) {
      this.quitar(id);
      return;
    }
    const stock =
      this.catalogo.datos().existencias.find((x) => x.variante_id === id)?.cantidad ?? 0;
    const error = puedeAgregar([], id, n, stock);
    if (error) {
      this.error.set(error);
      return;
    }
    this.items.update((xs) => xs.map((x) => (x.variante_id === id ? { ...x, cantidad: n } : x)));
    this.error.set('');
  }
  async confirmar() {
    if (this.guardando()) throw new Error('La reserva se está guardando.');
    const user = this.session.user(),
      tenant = this.session.tenant();
    if (!user || !tenant) throw new Error('Inicia sesión con una cuenta de empresa.');
    if (this.catalogo.meta().usuarioId !== user.id || this.catalogo.meta().tenantId !== tenant.id)
      throw new Error('Descarga el catálogo para esta cuenta antes de reservar.');
    if (
      this.session.readOnly() ||
      !this.session.hasFeature('reservations') ||
      !this.session.hasFeature('offline')
    )
      throw new Error('Tu suscripción no permite registrar reservas sin conexión.');
    const visita = new Date(this.fecha() + 'T' + this.hora());
    const error = validarVisita(visita, new Date());
    if (error) throw new Error(error);
    if (!this.items().length) throw new Error('Selecciona al menos una prenda.');
    this.guardando.set(true);
    try {
      const id = crypto.randomUUID(),
        now = new Date().toISOString(),
        device = await getDeviceId();
      const reserva: ReservaLocal = {
        id,
        tenant_id: tenant.id,
        sucursal_id: this.sucursalId(),
        usuario_id: user.id,
        cliente_id: this.session.can('reservations.write') ? this.clienteId() || null : null,
        agendada_para: visita.toISOString(),
        notas: this.notas(),
        estado: 'PENDIENTE_CONFIRMACION',
        creada_en: now,
      };
      const items = this.items().map((i) => ({ ...i, reserva_id: id }));
      const op: OperacionPendiente = {
        id: crypto.randomUUID(),
        tipo: 'RESERVA',
        estado: 'PENDIENTE',
        tenant_id: tenant.id,
        sucursal_id: reserva.sucursal_id,
        usuario_id: user.id,
        dispositivo_id: device,
        payload: construirPayload(reserva, items, device),
        intentos: 0,
        ultimo_error: null,
        creada_en: now,
        actualizada_en: now,
      };
      await this.repo.registrar(reserva, items, op);
      this.limpiar();
      await this.catalogo.cargarLocal();
      return id;
    } finally {
      this.guardando.set(false);
    }
  }
  limpiar() {
    this.items.set([]);
    this.fecha.set('');
    this.hora.set('');
    this.clienteId.set('');
    this.notas.set('');
    this.error.set('');
  }
}
