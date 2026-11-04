import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { GlobalUser, maskEmail } from '../domain/consola.models';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';

@Component({
  selector: 'fs-usuarios-globales',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  template: `
    <div class="crumbs">Personas y seguridad</div>
    <div class="page-h">
      <div>
        <h1>Usuarios globales</h1>
        <p>Busca cualquier cuenta de cualquier empresa para resolver accesos: desbloquear, reenviar verificación o cerrar sesiones.</p>
      </div>
    </div>

    @if (notice()) {
      <div class="alert info" style="margin-bottom:12px"><span>ⓘ</span><div>{{ notice() }}</div></div>
    }
    @if (error()) {
      <div class="alert danger" style="margin-bottom:12px"><span>⚠</span><div>{{ error() }}</div></div>
    }

    <div class="fbar">
      <input
        class="input grow"
        placeholder="⌕ Correo, nombre o documento"
        [(ngModel)]="searchQuery"
        (ngModelChange)="onSearchChange()"
      />
      @for (chip of chips; track chip.id) {
        <button
          class="chip"
          [class.on]="selectedFilter() === chip.id"
          (click)="selectChip(chip.id)"
        >
          {{ chip.label }}
        </button>
      }
    </div>

    <div class="grid2" style="grid-template-columns:1.6fr 1fr;align-items:start">
      <div class="card" style="padding:0">
        @if (loading()) {
          <p style="padding:16px" class="muted">Cargando usuarios…</p>
        } @else {
          <table class="tbl">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Empresa</th>
                <th>Rol</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (u of users(); track u.id) {
                <tr [class.selected]="selectedUser()?.id === u.id" (click)="selectedUser.set(u)" style="cursor:pointer">
                  <td>
                    <div style="display:flex;gap:10px;align-items:center">
                      <span class="av">{{ getInitials(u.first_name + ' ' + u.last_name) }}</span>
                      <div>
                        <b>{{ u.first_name }} {{ u.last_name }}</b>
                        <div class="sub mono">
                          @if (revealedEmails().has(u.id)) {
                            <span>{{ u.email }}</span>
                            <button class="btn-show" (click)="$event.stopPropagation(); toggleEmail(u.id)">Ocultar</button>
                          } @else {
                            <span>{{ maskEmail(u.email) }}</span>
                            <button class="btn-show" (click)="$event.stopPropagation(); toggleEmail(u.id)">Mostrar</button>
                          }
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{{ u.tenant_name || '— Plataforma' }}</td>
                  <td>{{ u.roles.join(', ') || 'Sin rol' }}</td>
                  <td>
                    <span
                      class="badge"
                      [class.ok]="u.is_active && !u.locked_until && u.is_verified"
                      [class.warn]="!!u.locked_until"
                      [class.info]="!u.is_verified"
                      [class.neutral]="!u.is_active"
                    >
                      {{ u.locked_until ? 'Bloqueado' : (!u.is_verified ? 'Sin verificar' : (u.is_active ? 'Activo' : 'Inactivo')) }}
                    </span>
                  </td>
                  <td style="text-align:right">
                    <button class="btn sm" (click)="$event.stopPropagation(); selectedUser.set(u)">⋯</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="muted" style="text-align:center;padding:16px">No se encontraron usuarios.</td></tr>
              }
            </tbody>
          </table>
        }
      </div>

      <!-- Panel lateral de acciones -->
      @if (selectedUser(); as u) {
        <div class="card">
          <h3>{{ u.first_name }} {{ u.last_name }}</h3>
          <p class="muted mono" style="margin:4px 0 12px">
            {{ revealedEmails().has(u.id) ? u.email : maskEmail(u.email) }} · {{ u.tenant_name || 'Plataforma' }}
          </p>

          @if (u.locked_until) {
            <div class="alert warn" style="margin-bottom:12px">
              <span>⚠</span>
              <div>
                <b>Cuenta bloqueada temporalmente</b>
                Bloqueada hasta {{ u.locked_until | date:'short' }} por intentos fallidos.
              </div>
            </div>
          }

          <div style="display:grid;gap:8px;margin-top:12px">
            <button class="btn" (click)="confirmAction('unlock', '¿Desbloquear la cuenta de ' + u.first_name + '?', 'El usuario podrá volver a iniciar sesión inmediatamente.')">
              🔓 Desbloquear cuenta
            </button>
            <button class="btn" (click)="confirmAction('resend-verification', '¿Reenviar correo de verificación a ' + u.first_name + '?', 'Se enviará un nuevo enlace para activar la cuenta.')">
              ✉ Reenviar verificación
            </button>
            <button class="btn" (click)="confirmAction('revoke-sessions', '¿Cerrar todas las sesiones activas?', 'Se revocarán todos los tokens de acceso del usuario.')">
              ⏏ Cerrar todas sus sesiones
            </button>
            <button
              class="btn danger"
              (click)="confirmAction(u.is_active ? 'deactivate' : 'activate', '¿' + (u.is_active ? 'Desactivar' : 'Activar') + ' cuenta?', 'El estado de la cuenta cambiará en el sistema.')"
            >
              {{ u.is_active ? 'Desactivar cuenta' : 'Activar cuenta' }}
            </button>
          </div>

          <p class="muted" style="font-size:12px;margin:12px 0 0">
            Cambiar roles o datos de la cuenta se hace dentro de la empresa con una sesión de soporte.
          </p>
        </div>
      } @else {
        <div class="card">
          <p class="muted" style="text-align:center;padding:20px">
            Selecciona un usuario de la lista para gestionar sus accesos.
          </p>
        </div>
      }
    </div>

    @if (pendingAction(); as p) {
      <fs-confirm-dialog
        [title]="p.title"
        [message]="p.message"
        (confirmed)="executeAction(p.action)"
        (cancelled)="pendingAction.set(null)"
      />
    }
  `,
  styleUrl: './usuarios-globales.component.scss',
})
export class UsuariosGlobalesComponent implements OnInit {
  private api = inject(PlataformaApi);

  readonly users = signal<GlobalUser[]>([]);
  readonly selectedUser = signal<GlobalUser | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly revealedEmails = signal<Set<string>>(new Set());

  searchQuery = '';
  readonly selectedFilter = signal<'todos' | 'administradores' | 'bloqueados' | 'sin_verificar' | 'plataforma'>('todos');

  readonly pendingAction = signal<{ action: 'unlock' | 'resend-verification' | 'revoke-sessions' | 'deactivate' | 'activate'; title: string; message: string } | null>(null);

  readonly chips: Array<{ id: 'todos' | 'administradores' | 'bloqueados' | 'sin_verificar' | 'plataforma'; label: string }> = [
    { id: 'todos', label: 'Todos' },
    { id: 'administradores', label: 'Administradores' },
    { id: 'bloqueados', label: 'Bloqueados' },
    { id: 'sin_verificar', label: 'Sin verificar' },
    { id: 'plataforma', label: 'Plataforma' },
  ];

  readonly maskEmail = maskEmail;

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.error.set(null);

    const query: Record<string, unknown> = {};
    if (this.searchQuery.trim()) query['search'] = this.searchQuery.trim();

    const f = this.selectedFilter();
    if (f === 'administradores') query['kind'] = 'tenant_admin';
    if (f === 'plataforma') query['kind'] = 'platform';
    if (f === 'bloqueados') query['status'] = 'blocked';
    if (f === 'sin_verificar') query['status'] = 'unverified';

    this.api.users(query).subscribe({
      next: (page) => {
        this.users.set(page.items);
        this.loading.set(false);
        if (this.selectedUser()) {
          const updated = page.items.find((u) => u.id === this.selectedUser()?.id);
          if (updated) this.selectedUser.set(updated);
        } else if (page.items.length > 0) {
          this.selectedUser.set(page.items[0]);
        }
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Error al cargar usuarios.');
        this.loading.set(false);
      },
    });
  }

  onSearchChange() {
    this.cargar();
  }

  selectChip(id: 'todos' | 'administradores' | 'bloqueados' | 'sin_verificar' | 'plataforma') {
    this.selectedFilter.set(id);
    this.cargar();
  }

  toggleEmail(userId: string) {
    const current = new Set(this.revealedEmails());
    if (current.has(userId)) current.delete(userId);
    else current.add(userId);
    this.revealedEmails.set(current);
  }

  confirmAction(action: 'unlock' | 'resend-verification' | 'revoke-sessions' | 'deactivate' | 'activate', title: string, message: string) {
    this.pendingAction.set({ action, title, message });
  }

  executeAction(action: 'unlock' | 'resend-verification' | 'revoke-sessions' | 'deactivate' | 'activate') {
    const u = this.selectedUser();
    if (!u) return;
    this.pendingAction.set(null);
    this.notice.set(null);
    this.error.set(null);

    this.api.userAction(u.id, action).subscribe({
      next: (updated) => {
        this.notice.set(`Acción realizada correctamente sobre ${updated.first_name}.`);
        this.selectedUser.set(updated);
        this.cargar();
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Error al ejecutar la acción.');
      },
    });
  }

  getInitials(name: string): string {
    if (!name) return 'US';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
}
