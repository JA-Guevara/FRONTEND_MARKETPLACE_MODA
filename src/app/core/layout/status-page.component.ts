import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
@Component({
  selector: 'fs-status-page',
  imports: [RouterLink],
  template: `<section class="container empty section">
    <p class="eyebrow">{{ forbidden ? 'ACCESO RESTRINGIDO' : '404' }}</p>
    <h1>{{ forbidden ? 'No tenés acceso a esta sección' : 'No encontramos esta página' }}</h1>
    <p>
      {{
        forbidden
          ? 'Pedí al administrador los permisos correspondientes.'
          : 'El enlace puede haber cambiado.'
      }}
    </p>
    <a class="button primary" routerLink="/">Volver al catálogo</a>
  </section>`,
})
export class StatusPageComponent {
  forbidden = inject(ActivatedRoute).snapshot.data['forbidden'];
}
