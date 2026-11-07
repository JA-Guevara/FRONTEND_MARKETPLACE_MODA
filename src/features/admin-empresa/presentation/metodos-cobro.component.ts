import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { errorMessage } from '../../../shared/errors';
interface Method {
  id: string;
  kind: string;
  label: string;
  qr_image_url: string | null;
  bank_name: string | null;
  account_holder: string | null;
  account_number: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
}
@Component({
  selector: 'fs-metodos-cobro',
  imports: [FormsModule],
  template: ` <section class="methods">
    <h2>Otros medios de cobro de tu tienda</h2>
    <p>
      Estos datos aparecen al cliente cuando coordina el pago de un pedido. El personal confirma el
      ingreso después de comprobarlo.
    </p>
    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }
    @if (message()) {
      <p role="status">{{ message() }}</p>
    }
    <div class="method-grid">
      @for (m of methods(); track m.id) {
        <article>
          <h3>{{ m.label }}</h3>
          <p>{{ kindLabel(m.kind) }} · {{ m.is_active ? 'Activo' : 'Desactivado' }}</p>
          <p>{{ m.instructions }}</p>
          <button (click)="edit(m)">Editar</button
          ><button [disabled]="busy()" (click)="toggle(m)">
            {{ m.is_active ? 'Desactivar' : 'Activar' }}
          </button>
        </article>
      }
    </div>
    @if (!form()) {
      <button (click)="newMethod()">Añadir medio de cobro</button>
    }
    @if (form(); as model) {
      <form #f="ngForm" (ngSubmit)="f.valid && save()">
        <h3>{{ editing ? 'Editar medio de cobro' : 'Nuevo medio de cobro' }}</h3>
        <label
          >Tipo<select name="kind" [(ngModel)]="model.kind">
            <option value="PAY_IN_STORE">Pago en sucursal</option>
            <option value="TRANSFER">Transferencia bancaria</option>
            <option value="QR">Código QR</option>
          </select></label
        >
        <label
          >Nombre visible<input name="label" [(ngModel)]="model.label" required maxlength="80"
        /></label>
        @if (model.kind === 'TRANSFER') {
          <label
            >Banco<input name="bank" [(ngModel)]="model.bank_name" required maxlength="80" /></label
          ><label
            >Titular<input
              name="holder"
              [(ngModel)]="model.account_holder"
              required
              maxlength="120" /></label
          ><label
            >Número de cuenta<input
              name="account"
              [(ngModel)]="model.account_number"
              required
              maxlength="40"
          /></label>
        }
        @if (model.kind === 'QR') {
          <label
            >Enlace seguro a la imagen QR<input
              type="url"
              name="qr"
              [(ngModel)]="model.qr_image_url"
              required
              pattern="https://.*"
              maxlength="300"
          /></label>
        }
        <label
          >Instrucciones al cliente<textarea
            name="instructions"
            [(ngModel)]="model.instructions"
            maxlength="500"
          ></textarea>
        </label>
        <button type="submit" [disabled]="busy() || !f.valid">Guardar medio de cobro</button
        ><button type="button" [disabled]="busy()" (click)="form.set(null)">Cancelar</button>
      </form>
    }
  </section>`,
  styles: [
    `
      .methods {
        margin-top: 28px;
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 24px;
        background: var(--paper);
      }
      .method-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 15px;
        margin-bottom: 18px;
      }
      .method-grid article {
        padding: 18px;
        border: 1px solid var(--line);
        border-radius: 10px;
      }
      form {
        max-width: 650px;
      }
      label {
        display: grid;
        gap: 6px;
        margin: 15px 0;
      }
      button {
        margin-right: 8px;
      }
    `,
  ],
})
export class MetodosCobroComponent {
  private api = inject(ApiService);
  methods = signal<Method[]>([]);
  form = signal<Omit<Method, 'id'> | null>(null);
  editing = '';
  busy = signal(false);
  error = signal('');
  message = signal('');
  constructor() {
    void this.load();
  }
  kindLabel(kind: string) {
    return (
      (
        {
          PAY_IN_STORE: 'En sucursal',
          QR: 'Código QR',
          TRANSFER: 'Transferencia',
          GATEWAY: 'Pasarela',
        } as Record<string, string>
      )[kind] || kind
    );
  }
  async load() {
    try {
      this.methods.set(await firstValueFrom(this.api.get<Method[]>('/tenant/payment-methods')));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
  newMethod() {
    this.editing = '';
    this.form.set({
      kind: 'PAY_IN_STORE',
      label: 'Pago en sucursal',
      qr_image_url: null,
      bank_name: null,
      account_holder: null,
      account_number: null,
      instructions: null,
      is_active: true,
      sort_order: 0,
    });
  }
  edit(m: Method) {
    this.editing = m.id;
    const { id, ...data } = m;
    void id;
    this.form.set({ ...data });
  }
  async save() {
    const form = this.form();
    if (!form || this.busy()) return;
    await this.work(async () => {
      await firstValueFrom(
        this.editing
          ? this.api.patch('/tenant/payment-methods/' + this.editing, form)
          : this.api.post('/tenant/payment-methods', form),
      );
      this.form.set(null);
      this.message.set('Medio de cobro guardado.');
    });
  }
  async toggle(m: Method) {
    await this.work(async () => {
      const { id, ...body } = m;
      await firstValueFrom(
        m.is_active
          ? this.api.post('/tenant/payment-methods/' + id + '/deactivate')
          : this.api.patch('/tenant/payment-methods/' + id, { ...body, is_active: true }),
      );
    });
  }
  private async work(action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
