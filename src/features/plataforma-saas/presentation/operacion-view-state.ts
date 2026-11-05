import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { EstadoOperacion, OperacionApi } from '../infrastructure/operacion.api';
import { errorMessage } from '../../../shared/errors';

export class OperacionViewState {
  readonly api = inject(OperacionApi);
  readonly session = inject(SessionService);
  readonly destroy = inject(DestroyRef);
  readonly estado = signal<EstadoOperacion | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly permitted = () => this.session.scope() === 'platform' && this.session.can('platform.ops.read');
  constructor() { this.reload(); }
  reload(): void {
    if (!this.permitted()) { this.error.set('No tenés permiso para consultar Operación.'); return; }
    this.error.set(''); this.loading.set(true);
    this.api.estado().pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false))).subscribe({
      next: status => this.estado.set(status), error: e => this.error.set(errorMessage(e)),
    });
  }
}
