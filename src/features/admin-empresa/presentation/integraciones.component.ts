import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../../shared/models';

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
}

export interface WebhookEndpointItem {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export interface WebhookDeliveryItem {
  id: string;
  endpoint_id: string;
  event_id: string;
  attempt: number;
  status_code?: number | null;
  status: string;
  next_retry_at?: string | null;
  delivered_at?: string | null;
  error?: string | null;
  created_at: string;
}

@Component({
  selector: 'fs-integraciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './integraciones.component.html',
  styleUrls: ['./integraciones.component.scss'],
})
export class IntegracionesComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  readonly apiKeys = signal<ApiKeyItem[]>([]);
  readonly webhooks = signal<WebhookEndpointItem[]>([]);
  readonly deliveries = signal<WebhookDeliveryItem[]>([]);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Formularios y secretos temporales
  readonly showKeyForm = signal(false);
  keyName = '';
  keyScopes = 'sales.read, stock.read, catalog.read';
  readonly newRawKey = signal<string | null>(null);

  readonly showWebhookForm = signal(false);
  webhookUrl = '';
  webhookEvents = 'sale.confirmed, order.paid, stock.low';
  readonly newWebhookSecret = signal<string | null>(null);

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<ApiResponse<ApiKeyItem[]>>(`${this.apiUrl}/tenant/integrations/api-keys`).subscribe({
      next: (res) => this.apiKeys.set(res.data ?? []),
      error: () => {},
    });

    this.http.get<ApiResponse<WebhookEndpointItem[]>>(`${this.apiUrl}/tenant/integrations/webhooks`).subscribe({
      next: (res) => this.webhooks.set(res.data ?? []),
      error: () => {},
    });

    this.http.get<ApiResponse<WebhookDeliveryItem[]>>(`${this.apiUrl}/tenant/integrations/webhooks/deliveries`).subscribe({
      next: (res) => {
        this.deliveries.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  createApiKey(): void {
    if (!this.keyName.trim()) return;
    this.busy.set(true);
    this.error.set(null);
    this.newRawKey.set(null);

    const scopes = this.keyScopes.split(',').map((s) => s.trim()).filter(Boolean);
    this.http.post<ApiResponse<any>>(`${this.apiUrl}/tenant/integrations/api-keys`, {
      name: this.keyName.trim(),
      scopes,
    }).subscribe({
      next: (res) => {
        this.newRawKey.set(res.data?.raw_key ?? null);
        this.showKeyForm.set(false);
        this.keyName = '';
        this.busy.set(false);
        this.loadAll();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Error al crear la clave de API.');
        this.busy.set(false);
      },
    });
  }

  revokeApiKey(id: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    this.http.delete<ApiResponse<null>>(`${this.apiUrl}/tenant/integrations/api-keys/${id}`).subscribe({
      next: () => {
        this.successMessage.set('Clave de API revocada.');
        this.busy.set(false);
        this.loadAll();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo revocar la clave de API.');
        this.busy.set(false);
      },
    });
  }

  createWebhook(): void {
    if (!this.webhookUrl.trim()) return;
    this.busy.set(true);
    this.error.set(null);
    this.newWebhookSecret.set(null);

    const events = this.webhookEvents.split(',').map((e) => e.trim()).filter(Boolean);
    this.http.post<ApiResponse<any>>(`${this.apiUrl}/tenant/integrations/webhooks`, {
      url: this.webhookUrl.trim(),
      events,
    }).subscribe({
      next: (res) => {
        this.newWebhookSecret.set(res.data?.secret ?? null);
        this.showWebhookForm.set(false);
        this.webhookUrl = '';
        this.busy.set(false);
        this.loadAll();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Error al registrar el webhook.');
        this.busy.set(false);
      },
    });
  }

  deleteWebhook(id: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    this.http.delete<ApiResponse<null>>(`${this.apiUrl}/tenant/integrations/webhooks/${id}`).subscribe({
      next: () => {
        this.successMessage.set('Webhook eliminado.');
        this.busy.set(false);
        this.loadAll();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo eliminar el webhook.');
        this.busy.set(false);
      },
    });
  }

  testWebhook(id: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    this.http.post<ApiResponse<any>>(`${this.apiUrl}/tenant/integrations/webhooks/${id}/test`, {}).subscribe({
      next: (res) => {
        const code = res.data?.status_code ?? 'OK';
        this.successMessage.set(`Evento de prueba enviado (Respuesta: ${code}).`);
        this.busy.set(false);
        this.loadAll();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Fallo al despachar la prueba.');
        this.busy.set(false);
      },
    });
  }

  redeliver(id: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    this.http.post<ApiResponse<any>>(`${this.apiUrl}/tenant/integrations/webhooks/deliveries/${id}/redeliver`, {}).subscribe({
      next: () => {
        this.successMessage.set('Entrega encolada para reintento.');
        this.busy.set(false);
        this.loadAll();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo reenviar la entrega.');
        this.busy.set(false);
      },
    });
  }

  formatDate(isoDate?: string | null): string {
    if (!isoDate) return '-';
    const d = new Date(isoDate);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
}
