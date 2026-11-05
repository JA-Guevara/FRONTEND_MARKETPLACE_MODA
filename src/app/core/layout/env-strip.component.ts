import { Component, computed, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpErrorsState } from '../http-errors.interceptor';

@Component({
  standalone: true,
  selector: 'fs-env-strip',
  styleUrl: './env-strip.component.scss',
  template: `
    @if (visible()) {
      <aside class="env-strip" aria-label="Ambiente de la aplicación">
        <strong>{{ label() }}</strong>
        @if (mismatch()) {
          <span>La web usa {{ configured }} y la API usa {{ effective() }}.</span>
        } @else { <span>Ambiente de pruebas · APP_ENV={{ effective() }}</span> }
      </aside>
    }
    @if (state.notice()) {
      <aside class="service-notice" [class.maintenance]="state.maintenance()" role="alert">
        <span>{{ state.notice() }}</span>
        <button type="button" (click)="state.dismiss()" aria-label="Cerrar aviso">Cerrar</button>
      </aside>
    }
  `,
})
export class EnvStripComponent {
  readonly state = inject(HttpErrorsState);
  readonly configured = environment.appEnv;
  readonly effective = computed(() => this.state.apiEnvironment() ?? this.configured);
  readonly mismatch = computed(() => !!this.state.apiEnvironment() && this.state.apiEnvironment() !== this.configured);
  readonly visible = computed(() => this.configured !== 'production' || this.effective() !== 'production');
  readonly label = computed(() => this.mismatch() ? 'AMBIENTES DISTINTOS' : this.effective().toUpperCase());
}
