import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { resources } from '../shared/resources';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
@Component({
  selector: 'fs-admin-home',
  imports: [RouterLink],
  template: `@if (session.isPlatformAdmin()) {
      <p class="eyebrow">FASHIONSTORE / PLATAFORMA SAAS</p>
      <h1>Tu plataforma, en un solo lugar.</h1>
      <p class="muted">Administra las empresas contratantes, sus planes y suscripciones.</p>
      <div class="admin-cards">
        <a class="panel admin-card" routerLink="/admin/plataforma/empresas"
          ><h2>Empresas →</h2>
          <p>Registro, actividad y suscripciones de cada empresa.</p></a
        >
        @if (session.can('plans.read')) {
          <a class="panel admin-card" routerLink="/admin/plataforma/planes"
            ><h2>Planes →</h2>
            <p>Funcionalidades, límites y vigencia.</p></a
          >
        }
      </div>
    } @else {
      <p class="eyebrow">FASHIONSTORE / ADMINISTRACIÓN</p>
      <h1>Tu tienda, al día.</h1>
      <p class="muted">Hola, {{ session.user()?.first_name }}. Elegí un área para comenzar.</p>
      @if (session.can('dashboard.read')) {
        <a class="panel admin-card admin-card-featured" routerLink="/admin/dashboard">
          <p class="eyebrow">REPORTES</p>
          <h2>Centro de reportes <span>↗</span></h2>
          <p>KPIs, gráficos, comparativas y exportación — con IA para interpretar y explicar.</p>
        </a>
      }
      <h2>Gestionar la tienda</h2>
      <div class="admin-cards">
        @for (item of available(); track item.key) {
          <a class="panel admin-card" [routerLink]="['/admin', item.key]"
            ><p class="eyebrow">{{ item.group }}</p>
            <h2>{{ item.title }} <span>↗</span></h2>
            <p>
              {{
                session.can(item.writePermission)
                  ? 'Consultar y gestionar registros'
                  : 'Consultar registros'
              }}
            </p></a
          >
        } @empty {
          <div class="panel">Tu cuenta no tiene permisos administrativos asignados.</div>
        }
        @if (session.can('audit.read')) {
          <a class="panel admin-card" routerLink="/admin/bitacora"
            ><p class="eyebrow">ACTIVIDAD</p>
            <h2>Bitácora ↗</h2>
            <p>Consultar el historial de operaciones</p></a
          >
        }
        @if (session.can('catalog.read')) {
          <a class="panel admin-card" routerLink="/admin/probador"
            ><p class="eyebrow">PROBADOR VIRTUAL</p>
            <h2>Recursos del probador ↗</h2>
            <p>Revisar, aprobar y preparar en lote los recursos del probador</p></a
          >
        }
      </div>
    }`,
})
export class AdminHomeComponent {
  session = inject(SessionService);
  available() {
    return resources.filter((r) => this.session.can(r.permission));
  }
}
