import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { GlobalUser } from '../domain/consola.models';
import { DrawerComponent } from '../../../shared/ui/drawer.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';

@Component({
  selector: 'fs-administradores',
  standalone: true,
  imports: [CommonModule, FormsModule, DrawerComponent, ConfirmDialogComponent],
  template: `
    <div class="crumbs">Personas y seguridad</div>
    <div class="page-h">
      <div>
        <h1>Administradores de la plataforma</h1>
        <p>Cuentas con rol de super administrador con acceso completo al plano de control de FashionStore.</p>
      </div>
      <div class="acts">
        <button class="btn primary" (click)="openDrawer()">＋ Invitar administrador</button>
      </div>
    </div>

    @if (notice()) {
      <div class="alert ok" style="margin-bottom:12px"><span>✔</span><div>{{ notice() }}</div></div>
    }
    @if (error()) {
      <div class="alert danger" style="margin-bottom:12px"><span>⚠</span><div>{{ error() }}</div></div>
    }

    <div class="card" style="padding:0">
      @if (loading()) {
        <p style="padding:16px" class="muted">Cargando administradores…</p>
      } @else {
        <table class="tbl">
          <thead>
            <tr>
              <th>Administrador</th>
              <th>Correo electrónico</th>
              <th>Estado</th>
              <th>Fecha de registro</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (adm of admins(); track adm.id) {
              <tr>
                <td>
                  <div style="display:flex;gap:10px;align-items:center">
                    <span class="av">{{ getInitials(adm.first_name + ' ' + adm.last_name) }}</span>
                    <div>
                      <b>{{ adm.first_name }} {{ adm.last_name }}</b>
                      <span class="sub">Super administrador</span>
                    </div>
                  </div>
                </td>
                <td class="mono">{{ adm.email }}</td>
                <td>
                  <span class="badge" [class.ok]="adm.is_active" [class.neutral]="!adm.is_active">
                    {{ adm.is_active ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td class="muted">{{ adm.created_at | date:'short' }}</td>
                <td style="text-align:right">
                  @if (adm.is_active) {
                    <button class="btn sm danger" (click)="confirmDeactivate(adm)">Desactivar</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="muted" style="text-align:center;padding:16px">No hay administradores registrados.</td></tr>
            }
          </tbody>
        </table>
      }
    </div>

    <!-- Drawer de invitación -->
    <fs-drawer
      [open]="drawerOpen()"
      title="Invitar super administrador"
      (closed)="drawerOpen.set(false)"
    >
      <form (ngSubmit)="submitInvite()" class="sp2-stack">
        <p class="muted" style="margin:0 0 8px;font-size:13px">
          Se creará una cuenta sin empresa asociada y se enviará una invitación por correo para establecer la contraseña.
        </p>

        <div>
          <label><b>Nombre *</b></label>
          <input
            class="input"
            style="width:100%;margin-top:4px"
            [(ngModel)]="inviteForm.first_name"
            name="firstName"
            required
            minlength="2"
            maxlength="80"
            placeholder="Ej. Laura"
          />
        </div>

        <div>
          <label><b>Apellido *</b></label>
          <input
            class="input"
            style="width:100%;margin-top:4px"
            [(ngModel)]="inviteForm.last_name"
            name="lastName"
            required
            minlength="2"
            maxlength="80"
            placeholder="Ej. Paz"
          />
        </div>

        <div>
          <label><b>Correo electrónico *</b></label>
          <input
            type="email"
            class="input"
            style="width:100%;margin-top:4px"
            [(ngModel)]="inviteForm.email"
            name="email"
            required
            placeholder="laura.paz@example.com"
          />
        </div>

        @if (drawerError()) {
          <div class="alert danger"><span>⚠</span><div>{{ drawerError() }}</div></div>
        }

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
          <button type="button" class="btn ghost" (click)="drawerOpen.set(false)">Cancelar</button>
          <button type="submit" class="btn primary" [disabled]="submitting() || !isInviteValid()">
            {{ submitting() ? 'Enviando…' : 'Enviar invitación' }}
          </button>
        </div>
      </form>
    </fs-drawer>

    @if (deactivatingAdmin(); as adm) {
      <fs-confirm-dialog
        title="¿Desactivar administrador?"
        [message]="'El super administrador ' + adm.first_name + ' ' + adm.last_name + ' perderá acceso inmediato a la consola de plataforma.'"
        (confirmed)="executeDeactivate(adm.id)"
        (cancelled)="deactivatingAdmin.set(null)"
      />
    }
  `,
  styleUrl: './administradores.component.scss',
})
export class AdministradoresComponent implements OnInit {
  private api = inject(PlataformaApi);

  readonly admins = signal<GlobalUser[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly drawerOpen = signal(false);
  readonly drawerError = signal<string | null>(null);
  readonly deactivatingAdmin = signal<GlobalUser | null>(null);

  inviteForm = {
    first_name: '',
    last_name: '',
    email: '',
  };

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.error.set(null);
    this.api.admins().subscribe({
      next: (list) => {
        this.admins.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Error al cargar administradores.');
        this.loading.set(false);
      },
    });
  }

  openDrawer() {
    this.inviteForm = { first_name: '', last_name: '', email: '' };
    this.drawerError.set(null);
    this.drawerOpen.set(true);
  }

  isInviteValid(): boolean {
    return (
      this.inviteForm.first_name.trim().length >= 2 &&
      this.inviteForm.last_name.trim().length >= 2 &&
      this.inviteForm.email.includes('@') &&
      this.inviteForm.email.includes('.')
    );
  }

  submitInvite() {
    if (!this.isInviteValid()) return;
    this.submitting.set(true);
    this.drawerError.set(null);

    this.api.inviteAdmin({
      first_name: this.inviteForm.first_name.trim(),
      last_name: this.inviteForm.last_name.trim(),
      email: this.inviteForm.email.trim(),
    }).subscribe({
      next: (newUser) => {
        this.submitting.set(false);
        this.drawerOpen.set(false);
        this.notice.set(`Invitación enviada a ${newUser.email}.`);
        this.cargar();
      },
      error: (err) => {
        this.submitting.set(false);
        this.drawerError.set(err?.error?.message ?? 'Error al invitar al administrador.');
      },
    });
  }

  confirmDeactivate(adm: GlobalUser) {
    this.deactivatingAdmin.set(adm);
  }

  executeDeactivate(id: string) {
    this.deactivatingAdmin.set(null);
    this.error.set(null);
    this.notice.set(null);

    this.api.deactivateAdmin(id).subscribe({
      next: () => {
        this.notice.set('Administrador desactivado correctamente.');
        this.cargar();
      },
      error: (err) => {
        const code = err?.error?.error?.code ?? err?.error?.code;
        if (code === 'last_platform_admin' || err?.status === 409) {
          this.error.set('No se puede desactivar el último administrador de la plataforma.');
        } else {
          this.error.set(err?.error?.message ?? 'Error al desactivar al administrador.');
        }
      },
    });
  }

  getInitials(name: string): string {
    if (!name) return 'SA';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
}
