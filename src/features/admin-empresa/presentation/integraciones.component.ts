import { Component, OnInit, inject, signal, computed } from '@angular/core';
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

export interface WebhookSimulateResult {
  event_id: string;
  event_type: string;
  timestamp: string;
  payload: any;
  signature_preview: string;
  dispatched: boolean;
  delivery_status?: string | null;
  status_code?: number | null;
  headers_example: Record<string, string>;
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

  readonly activeTab = signal<'gestion' | 'playground' | 'simulador'>('gestion');

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
  keyScopes = 'sales.read, stock.read, stock.write, catalog.read';
  readonly newRawKey = signal<string | null>(null);

  readonly showWebhookForm = signal(false);
  webhookUrl = '';
  webhookEvents = 'sale.confirmed, order.paid, stock.low, stock.updated';
  readonly newWebhookSecret = signal<string | null>(null);

  // Playground de Conectores & SDK
  readonly playgroundEndpoint = signal<'catalog' | 'stock' | 'stock_adjust' | 'sales'>('catalog');
  readonly playgroundLang = signal<'curl' | 'python' | 'js'>('curl');

  // Simulador de Webhooks & Verificador HMAC
  readonly simulateEventType = signal<string>('sale.confirmed');
  readonly simulateEndpointId = signal<string>('');
  readonly simulateResult = signal<WebhookSimulateResult | null>(null);
  readonly simulating = signal<boolean>(false);

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

  runSimulation(): void {
    this.simulating.set(true);
    this.error.set(null);
    this.simulateResult.set(null);

    const payload = {
      event_type: this.simulateEventType(),
      endpoint_id: this.simulateEndpointId() ? this.simulateEndpointId() : null,
    };

    this.http.post<ApiResponse<WebhookSimulateResult>>(`${this.apiUrl}/tenant/integrations/webhooks/simulate`, payload).subscribe({
      next: (res) => {
        this.simulateResult.set(res.data ?? null);
        this.simulating.set(false);
        if (res.data?.dispatched) {
          this.successMessage.set(`Simulación enviada exitosamente (Código HTTP: ${res.data?.status_code ?? 'OK'}).`);
          this.loadAll();
        } else {
          this.successMessage.set('Simulación generada. Revisa la firma HMAC y cabeceras.');
        }
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Fallo al simular el webhook.');
        this.simulating.set(false);
      },
    });
  }

  getActiveApiKeyPrefix(): string {
    const key = this.apiKeys().find((k) => !k.revoked_at);
    return key ? `${key.prefix}...` : 'fs_live_tu_api_key_aqui';
  }

  getCodeSnippet(): string {
    const ep = this.playgroundEndpoint();
    const lang = this.playgroundLang();
    const apiKey = this.getActiveApiKeyPrefix();
    const host = window?.location?.origin || 'https://fashionstore.app';

    if (lang === 'curl') {
      switch (ep) {
        case 'catalog':
          return `curl -X GET "${host}/api/v1/integrations/v1/catalog?limit=50" \\
  -H "X-API-Key: ${apiKey}"`;
        case 'stock':
          return `curl -X GET "${host}/api/v1/integrations/v1/stock" \\
  -H "X-API-Key: ${apiKey}"`;
        case 'stock_adjust':
          return `curl -X POST "${host}/api/v1/integrations/v1/stock/adjust" \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "items": [
      { "sku": "CAMISA-OX-01", "branch_code": "CENTRAL", "quantity": 30, "mode": "set" }
    ]
  }'`;
        case 'sales':
          return `curl -X GET "${host}/api/v1/integrations/v1/sales?limit=25" \\
  -H "X-API-Key: ${apiKey}"`;
      }
    } else if (lang === 'python') {
      switch (ep) {
        case 'catalog':
          return `import requests

url = "${host}/api/v1/integrations/v1/catalog"
headers = {"X-API-Key": "${apiKey}"}
resp = requests.get(url, headers=headers)
print("Catálogo:", resp.json())`;
        case 'stock':
          return `import requests

url = "${host}/api/v1/integrations/v1/stock"
headers = {"X-API-Key": "${apiKey}"}
resp = requests.get(url, headers=headers)
print("Inventario:", resp.json())`;
        case 'stock_adjust':
          return `import requests

url = "${host}/api/v1/integrations/v1/stock/adjust"
headers = {"X-API-Key": "${apiKey}", "Content-Type": "application/json"}
payload = {
    "items": [
        {"sku": "CAMISA-OX-01", "branch_code": "CENTRAL", "quantity": 30, "mode": "set"}
    ]
}
resp = requests.post(url, headers=headers, json=payload)
print("Stock actualizado:", resp.json())`;
        case 'sales':
          return `import requests

url = "${host}/api/v1/integrations/v1/sales"
headers = {"X-API-Key": "${apiKey}"}
resp = requests.get(url, headers=headers, params={"limit": 25})
print("Ventas:", resp.json())`;
      }
    } else {
      // JavaScript / TypeScript fetch
      switch (ep) {
        case 'catalog':
          return `const resp = await fetch('${host}/api/v1/integrations/v1/catalog', {
  headers: { 'X-API-Key': '${apiKey}' }
});
const data = await resp.json();
console.log('Catálogo:', data);`;
        case 'stock':
          return `const resp = await fetch('${host}/api/v1/integrations/v1/stock', {
  headers: { 'X-API-Key': '${apiKey}' }
});
const data = await resp.json();
console.log('Stock:', data);`;
        case 'stock_adjust':
          return `const resp = await fetch('${host}/api/v1/integrations/v1/stock/adjust', {
  method: 'POST',
  headers: {
    'X-API-Key': '${apiKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    items: [{ sku: 'CAMISA-OX-01', branch_code: 'CENTRAL', quantity: 30, mode: 'set' }]
  })
});
const data = await resp.json();
console.log('Resultado ajuste:', data);`;
        case 'sales':
          return `const resp = await fetch('${host}/api/v1/integrations/v1/sales?limit=25', {
  headers: { 'X-API-Key': '${apiKey}' }
});
const data = await resp.json();
console.log('Ventas:', data);`;
      }
    }
  }

  formatDate(isoDate?: string | null): string {
    if (!isoDate) return '-';
    const d = new Date(isoDate);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
}
