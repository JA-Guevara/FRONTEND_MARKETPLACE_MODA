import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { PlatformAuditEvent } from '../domain/consola.models';
import { DrawerComponent } from '../../../shared/ui/drawer.component';

@Component({
  selector: 'fs-auditoria-global',
  standalone: true,
  imports: [CommonModule, FormsModule, DrawerComponent],
  template: `
    <div class="crumbs">Personas y seguridad</div>
    <div class="page-h">
      <div>
        <h1>Auditoría global</h1>
        <p>Eventos de todas las empresas y de la plataforma. Los realizados en soporte muestran al actor real.</p>
      </div>
    </div>

    @if (error()) {
      <div class="alert danger" style="margin-bottom:12px"><span>⚠</span><div>{{ error() }}</div></div>
    }

    <div class="fbar">
      <input
        class="input grow"
        placeholder="⌕ Filtrar por acción, actor o empresa…"
        [(ngModel)]="searchAction"
        (ngModelChange)="cargar()"
      />
      @for (chip of chips; track chip.id) {
        <button
          class="chip"
          [class.on]="selectedChip() === chip.id"
          (click)="selectChip(chip.id)"
        >
          {{ chip.label }}
        </button>
      }
    </div>

    <div class="card" style="padding:0">
      @if (loading()) {
        <p style="padding:16px" class="muted">Cargando eventos de auditoría…</p>
      } @else {
        <table class="tbl">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Actor</th>
              <th>Empresa</th>
              <th>Acción</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            @for (ev of events(); track ev.id) {
              <tr [class.hl]="ev.support_session_id" (click)="selectedEvent.set(ev)" style="cursor:pointer">
                <td class="muted" style="white-space:nowrap">{{ ev.created_at | date:'dd/MM HH:mm' }}</td>
                <td>
                  <b>{{ ev.actor_name || 'Sistema' }}</b>
                  @if (ev.support_session_id) {
                    <span class="badge warn" style="margin-left:4px">⛑ soporte</span>
                  }
                </td>
                <td>{{ ev.tenant_name || '— Plataforma' }}</td>
                <td class="mono">{{ ev.action }}</td>
                <td>{{ ev.description }}</td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="muted" style="text-align:center;padding:16px">No hay eventos para los filtros seleccionados.</td></tr>
            }
          </tbody>
        </table>
      }
    </div>

    <!-- Drawer de detalle de evento -->
    <fs-drawer
      [open]="!!selectedEvent()"
      title="Evento de auditoría"
      (closed)="selectedEvent.set(null)"
    >
      @if (selectedEvent(); as ev) {
        <div class="sp2-stack">
          <div>
            <span class="muted" style="font-size:12px">Acción</span>
            <div class="mono" style="font-weight:600;font-size:14px">{{ ev.action }}</div>
          </div>

          <div class="grid2">
            <div>
              <span class="muted" style="font-size:12px">Actor real</span>
              <div>
                <b>{{ ev.actor_name || 'Sistema' }}</b>
                <div class="muted" style="font-size:12px">{{ ev.actor_email }}</div>
              </div>
            </div>
            <div>
              <span class="muted" style="font-size:12px">Empresa</span>
              <div><b>{{ ev.tenant_name || '— Plataforma' }}</b></div>
            </div>
          </div>

          @if (ev.support_session_id) {
            <div class="alert warn">
              <span>⛑</span>
              <div>
                <b>Sesión de soporte</b>
                <div class="mono" style="font-size:12px">ID: {{ ev.support_session_id }}</div>
              </div>
            </div>
          }

          <div>
            <span class="muted" style="font-size:12px">Descripción</span>
            <div>{{ ev.description }}</div>
          </div>

          @if (ev.metadata) {
            <div>
              <span class="muted" style="font-size:12px">Detalle (metadatos)</span>
              <pre class="mono">{{ formatMetadata(ev.metadata) }}</pre>
            </div>
          }

          <div class="grid2">
            <div>
              <span class="muted" style="font-size:12px">Dirección IP</span>
              <div class="mono">{{ ev.ip_address || '—' }}</div>
            </div>
            <div>
              <span class="muted" style="font-size:12px">Fecha y hora</span>
              <div>{{ ev.created_at | date:'dd/MM/yyyy HH:mm:ss' }}</div>
            </div>
          </div>
        </div>
      }
    </fs-drawer>
  `,
  styleUrl: './auditoria-global.component.scss',
})
export class AuditoriaGlobalComponent implements OnInit {
  private api = inject(PlataformaApi);

  readonly events = signal<PlatformAuditEvent[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedEvent = signal<PlatformAuditEvent | null>(null);

  searchAction = '';
  readonly selectedChip = signal<'todo' | 'soporte' | 'plataforma'>('todo');

  readonly chips: Array<{ id: 'todo' | 'soporte' | 'plataforma'; label: string }> = [
    { id: 'todo', label: 'Todo' },
    { id: 'soporte', label: 'Solo soporte' },
    { id: 'plataforma', label: 'Solo plataforma' },
  ];

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.error.set(null);

    const q: Record<string, unknown> = {};
    if (this.searchAction.trim()) {
      q['action'] = this.searchAction.trim();
    }

    if (this.selectedChip() === 'soporte') {
      q['support_only'] = true;
    } else if (this.selectedChip() === 'plataforma') {
      q['platform_only'] = true;
    }

    this.api.audit(q).subscribe({
      next: (page) => {
        this.events.set(page.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Error al cargar auditoría.');
        this.loading.set(false);
      },
    });
  }

  selectChip(chipId: 'todo' | 'soporte' | 'plataforma') {
    this.selectedChip.set(chipId);
    this.cargar();
  }

  formatMetadata(meta: any): string {
    try {
      return JSON.stringify(meta, null, 2);
    } catch {
      return String(meta);
    }
  }
}
