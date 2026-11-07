import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { errorMessage } from '../../../shared/errors';
import { ADMIN_NAV } from '../../../app/core/layout/admin-nav';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { SandboxStatus } from '../domain/gobierno.models';

@Component({
  selector: 'fs-demo-sandbox',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sandbox-container">
      <header class="header">
        <div>
          <h2>Empresa Demo (Sandbox)</h2>
          <p class="subtitle">Entorno seguro para probar módulos antes de publicarlos en planes GA</p>
        </div>
        <div class="actions">
          <button class="btn btn-secondary" (click)="loadSandbox()">Actualizar</button>
          <button class="btn btn-danger" [disabled]="loading() || resetting()" (click)="confirmReset()">
            {{ resetting() ? 'Preparando…' : sandbox()?.tenant_id ? 'Restablecer demo' : 'Preparar demo' }}
          </button>
        </div>
      </header>

      @if (loading()) {
        <div class="loading">Cargando estado del sandbox...</div>
      } @else if (error()) {
        <div class="alert alert-error">{{ error() }}</div>
      } @else if (sandbox(); as s) {
        <div class="overview-cards">
          <div class="card stat">
            <span class="label">Empresa</span>
            <span class="value">{{ s.trade_name }}</span>
            <small class="slug">Slug: {{ s.slug }}</small>
          </div>
          <div class="card stat">
            <span class="label">Sucursales</span>
            <span class="value">{{ s.branches_count }}</span>
          </div>
          <div class="card stat">
            <span class="label">Prendas en catálogo</span>
            <span class="value">{{ s.products_count }}</span>
          </div>
          <div class="card stat">
            <span class="label">Estado</span>
            <span class="badge" [class.active]="s.is_active">{{ s.is_active ? 'Activa' : 'Inactiva' }}</span>
          </div>
        </div>

        @if (!s.tenant_id) {
          <p>Prepará la empresa demo para crear sus sucursales, el catálogo de prueba y habilitar la vista previa de módulos.</p>
        } @else {
        <section class="section">
          <h3>Módulos activos en Demo</h3>
          <p class="section-desc">Selecciona un módulo para previsualizarlo mediante una sesión de soporte de escritura</p>

          <div class="modules-table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Origen</th>
                  <th>Ciclo</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                @for (m of s.modules; track m.code) {
                  <tr>
                    <td><code>{{ m.code }}</code></td>
                    <td><strong>{{ m.name }}</strong></td>
                    <td><span class="tag">{{ m.origin }}</span></td>
                    <td><span class="lifecycle-badge">{{ m.lifecycle }}</span></td>
                    <td>
                      <button class="btn btn-sm btn-primary" (click)="previewModule(m.code)">
                        Probar módulo
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
        }
      }
    </div>
  `,
  styles: [`
    .sandbox-container {
      padding: 1.5rem;
      max-width: 1100px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }
    .header h2 { margin: 0 0 0.25rem 0; color: var(--color-text-primary, #111827); }
    .subtitle { margin: 0; color: var(--color-text-secondary, #6b7280); font-size: 0.875rem; }
    .actions { display: flex; gap: 0.75rem; }
    .btn {
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .btn-sm { padding: 0.25rem 0.625rem; font-size: 0.8125rem; }
    .btn-primary { background: var(--color-primary, #4f46e5); color: #fff; }
    .btn-secondary { background: var(--color-surface, #fff); border-color: var(--color-border, #d1d5db); color: var(--color-text-primary, #374151); }
    .btn-danger { background: #dc2626; color: #fff; }
    .overview-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .card {
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e5e7eb);
      border-radius: 0.5rem;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
    }
    .stat .label { font-size: 0.75rem; color: var(--color-text-secondary, #6b7280); margin-bottom: 0.25rem; }
    .stat .value { font-size: 1.25rem; font-weight: 700; color: var(--color-text-primary, #111827); }
    .stat .slug { font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem; }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      width: fit-content;
      background: #f3f4f6; color: #4b5563;
    }
    .badge.active { background: #dcfce7; color: #15803d; }
    .section { margin-top: 2rem; }
    .section h3 { margin: 0 0 0.25rem 0; color: var(--color-text-primary, #111827); }
    .section-desc { font-size: 0.875rem; color: var(--color-text-secondary, #6b7280); margin: 0 0 1rem 0; }
    .table {
      width: 100%;
      border-collapse: collapse;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e5e7eb);
      border-radius: 0.5rem;
      overflow: hidden;
    }
    .table th, .table td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--color-border, #e5e7eb);
    }
    .table th { background: var(--color-surface-hover, #f9fafb); font-size: 0.75rem; color: var(--color-text-secondary, #6b7280); }
    .tag { font-size: 0.75rem; background: #e0e7ff; color: #3730a3; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-weight: 500; }
    .lifecycle-badge { font-size: 0.75rem; background: #f3f4f6; color: #374151; padding: 0.125rem 0.375rem; border-radius: 0.25rem; }
    .loading { text-align: center; padding: 3rem; color: var(--color-text-secondary, #6b7280); }
    .alert-error { background: #fee2e2; color: #991b1b; padding: 1rem; border-radius: 0.375rem; }
  `]
})
export class DemoSandboxComponent implements OnInit {
  private api = inject(PlataformaApi);
  private session = inject(SessionService);
  private router = inject(Router);

  sandbox = signal<SandboxStatus | null>(null);
  loading = signal<boolean>(false);
  resetting = signal<boolean>(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadSandbox();
  }

  loadSandbox(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.sandbox().subscribe({
      next: (data) => {
        this.sandbox.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      }
    });
  }

  confirmReset(): void {
    const mensaje = this.sandbox()?.tenant_id
      ? '¿Restablecer el catálogo, las existencias y las sucursales de la demo? Se conservará el historial de operaciones.'
      : '¿Preparar la empresa demo con un catálogo y sucursales de prueba?';
    if (!confirm(mensaje)) {
      return;
    }
    this.resetting.set(true);
    this.api.sandboxReset(true).subscribe({
      next: (data) => {
        this.sandbox.set(data);
        this.resetting.set(false);
      },
      error: (err) => {
        alert(errorMessage(err));
        this.resetting.set(false);
      }
    });
  }

  previewModule(code: string): void {
    this.api.sandboxPreview(code).subscribe({
      next: (start) => {
        if (!start.access_token) {
          alert('La sesión de prueba todavía no está disponible.');
          return;
        }
        this.session.startSupport(start);
        const item = ADMIN_NAV.filter(section => section.scope === 'tenant')
          .flatMap(section => section.items.flatMap(item => [item, ...(item.children ?? [])]))
          .find(item => item.feature === code);
        const path = code === 'products' ? '/admin/products' : item?.path ?? '/admin';
        void this.router.navigateByUrl(path);
      },
      error: (err) => {
        alert(errorMessage(err));
      }
    });
  }
}
