import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BranchesService } from '../infrastructure/branches.service';
import { Branch } from '../domain/branch';
import { errorMessage } from '../../../shared/errors';
@Component({
  selector: 'fs-branches-page',
  template: `<section class="container section">
    <p class="eyebrow">CERCA DE VOS</p>
    <h1>Nuestras sucursales</h1>
    <p class="muted">Encontrá tu tienda y consultá los horarios antes de visitarnos.</p>
    @if (error()) {
      <div class="alert error" role="alert">
        {{ error() }}<button (click)="load()">Reintentar</button>
      </div>
    }
    @if (loading()) {
      <p class="empty" role="status">Cargando sucursales…</p>
    } @else {
      <div class="branch-grid">
        @for (b of branches(); track b.id) {
          <article class="panel">
            <p class="eyebrow">{{ b.city['name'] }}</p>
            <h2>{{ b.name }}</h2>
            <p>{{ b.address }}</p>
            @if (b.phone) {
              <p>{{ b.phone }}</p>
            }
            <dl class="hours-public">
              @for (day of days; track day.key) {
                @if (b.opening_hours?.[day.key]; as hours) {
                  <dt>{{ day.label }}</dt>
                  <dd>{{ hours.open }} – {{ hours.close }}</dd>
                }
              }
            </dl>
            @if (!b.opening_hours) {
              <p class="muted">Consultá el horario con la sucursal.</p>
            }
            @if (b.latitude !== null && b.longitude !== null) {
              <a [href]="mapLink(b)" target="_blank" rel="noopener noreferrer">Ver ubicación ↗</a>
            }
          </article>
        } @empty {
          @if (!error()) {
            <p class="empty">Todavía no hay sucursales publicadas.</p>
          }
        }
      </div>
    }
  </section>`,
})
export class BranchesPageComponent {
  private api = inject(BranchesService);
  branches = signal<Branch[]>([]);
  loading = signal(true);
  error = signal('');
  days = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
  ];
  constructor() {
    void this.load();
  }
  mapLink(b: Branch) {
    return 'https://www.google.com/maps?q=' + encodeURIComponent(b.latitude + ',' + b.longitude);
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.branches.set(await firstValueFrom(this.api.list()));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
