import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConnectivityService } from '../../../app/core/offline/connectivity.service';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { CatalogPageComponent } from '../../usuarios-catalogo/presentation/catalog-page.component';
import { LandingPageComponent } from '../../publico/presentation/landing-page.component';
import { CatalogoOfflineComponent } from './catalogo-offline.component';

@Component({
  selector: 'fs-catalogo-adaptable',
  imports: [CatalogPageComponent, LandingPageComponent, CatalogoOfflineComponent],
  template: `
    @if (!conexion.online()) {
      @if (!slug || slug === session.tenant()?.slug) {
        <fs-catalogo-offline />
      } @else {
        <section class="container section"><h1>Esta tienda no está descargada</h1>
          <p>El catálogo guardado pertenece a tu empresa. Conectate para consultar otra tienda.</p>
        </section>
      }
    } @else if (directorio) {
      <fs-landing-page />
    } @else {
      <fs-catalog-page />
    }
  `,
})
export class CatalogoAdaptableComponent {
  conexion = inject(ConnectivityService);
  session = inject(SessionService);
  private route = inject(ActivatedRoute);
  get slug() { return this.route.snapshot.paramMap.get('tenantSlug'); }
  get directorio() { return this.route.snapshot.routeConfig?.path === ''; }
}
