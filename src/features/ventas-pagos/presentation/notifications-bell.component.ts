import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/icon.component';
import { ApiService } from '../../../app/core/shared/api.service';
import { firstValueFrom } from 'rxjs';

/** Un aviso del feed del cliente, tal como lo arma el servidor. */
export interface Aviso {
  id: string;
  tipo: 'pedido' | 'reserva' | 'devolucion';
  estado: string;
  titulo: string;
  detalle: string;
  fecha: string;
  enlace: string;
  referencia: string;
}

/** Ícono por tipo de aviso, para reconocerlo sin leer. */
const ICONOS: Record<string, string> = {
  pedido: 'box',
  reserva: 'calendar',
  devolucion: 'refresh',
};

/** Marca de tiempo del último aviso que la persona ya vio. */
const CLAVE_VISTO = 'fashionstore.avisos.visto';

/**
 * Campanita de avisos en la barra superior.
 *
 * Muestra lo que le pasó a la persona —compras, reservas, devoluciones— con los
 * mismos textos que le llegaron por correo, para que no sean dos versiones de
 * la misma historia.
 *
 * Lo leído se recuerda con la fecha del último aviso visto, guardada en el
 * navegador. Es a propósito: evita una tabla y una migración, a cambio de que
 * el punto rojo sea por dispositivo. Para una campanita es un intercambio
 * razonable; si algún día hay que saber en el servidor qué se leyó, eso sí pide
 * su propia tabla.
 */
@Component({
  selector: 'fs-notifications-bell',
  imports: [RouterLink, DatePipe, IconComponent],
  template: `<div class="bell">
    <button
      type="button"
      class="bell-button"
      [attr.aria-expanded]="abierto()"
      [attr.aria-label]="
        sinLeer() ? sinLeer() + ' avisos sin leer' : 'Avisos'
      "
      (click)="alternar()"
    >
      <fs-icon name="chat" />
      @if (sinLeer()) {
        <span class="bell-dot">{{ sinLeer() > 9 ? '9+' : sinLeer() }}</span>
      }
    </button>

    @if (abierto()) {
      <!-- Capa para cerrar tocando fuera, sin escuchar clics en todo el documento. -->
      <div class="bell-backdrop" (click)="abierto.set(false)"></div>
      <div class="bell-panel" role="dialog" aria-label="Avisos">
        <header>
          <strong>Avisos</strong>
          @if (avisos().length) {
            <button type="button" (click)="marcarLeidos()">Marcar como leídos</button>
          }
        </header>

        @if (cargando()) {
          <p class="bell-vacio">Cargando…</p>
        } @else if (error()) {
          <p class="bell-vacio">{{ error() }}</p>
        } @else {
          <ul>
            @for (a of avisos(); track a.id) {
              <li [class.is-nuevo]="esNuevo(a)">
                <a [routerLink]="a.enlace" (click)="abierto.set(false)">
                  <span class="bell-icono"><fs-icon [name]="icono(a)" /></span>
                  <span class="bell-texto">
                    <strong>{{ a.titulo }}</strong>
                    <small>{{ a.referencia }} · {{ a.fecha | date: 'dd/MM HH:mm' }}</small>
                    <em>{{ a.detalle }}</em>
                  </span>
                </a>
              </li>
            } @empty {
              <li class="bell-vacio">
                Todavía no hay avisos. Acá vas a ver tus compras, reservas y devoluciones.
              </li>
            }
          </ul>
        }
      </div>
    }
  </div>`,
})
export class NotificationsBellComponent {
  private api = inject(ApiService);
  abierto = signal(false);
  cargando = signal(false);
  error = signal('');
  avisos = signal<Aviso[]>([]);
  private visto = signal(this.leerVisto());

  /** Cuántos avisos son posteriores a la última visita. */
  sinLeer = computed(() => {
    const desde = this.visto();
    return this.avisos().filter((a) => a.fecha > desde).length;
  });

  constructor() {
    void this.cargar();
  }

  icono(a: Aviso) {
    return ICONOS[a.tipo] || 'box';
  }
  esNuevo(a: Aviso) {
    return a.fecha > this.visto();
  }

  async alternar() {
    this.abierto.update((v) => !v);
    // Al abrir se refresca: entre carga y apertura pudo cambiar algo.
    if (this.abierto()) await this.cargar();
  }

  async cargar() {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set('');
    try {
      this.avisos.set(await firstValueFrom(this.api.get<Aviso[]>('/notifications', { limit: 20 })));
    } catch {
      // Un fallo acá no puede romper la barra de navegación.
      this.error.set('No pudimos cargar los avisos.');
    } finally {
      this.cargando.set(false);
    }
  }

  marcarLeidos() {
    const ultimo = this.avisos()[0]?.fecha;
    if (!ultimo) return;
    this.visto.set(ultimo);
    try {
      localStorage.setItem(CLAVE_VISTO, ultimo);
    } catch {
      // Sin almacenamiento el punto rojo vuelve al recargar; no es grave.
    }
  }

  private leerVisto(): string {
    try {
      return localStorage.getItem(CLAVE_VISTO) || '';
    } catch {
      return '';
    }
  }
}
