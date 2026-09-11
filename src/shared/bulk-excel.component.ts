import { Component, OnChanges, inject, input, output, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { ApiResponse } from './models';
import { errorMessage } from './errors';
import { IconComponent } from './icon.component';

interface ImportReport {
  digest: string;
  mode: 'create' | 'update';
  total: number;
  valid: number;
  imported: number;
  errors: { row: number; message: string }[];
  rows: { row: number; key: string; action: string }[];
}

export const EXCEL_RESOURCES = new Set([
  'products', 'variants', 'categories', 'sizes', 'colors', 'seasons', 'collections',
  'suppliers', 'cities', 'branches', 'cash-points',
]);

@Component({
  selector: 'fs-bulk-excel',
  imports: [FormsModule, IconComponent],
  styles: [`
    :host { display:block; margin-bottom:1rem; }
    .excel-tools,.excel-controls { display:flex; align-items:center; flex-wrap:wrap; gap:.65rem; }
    .excel-panel { margin-top:.8rem; padding:clamp(.8rem,2vw,1.4rem); border:1px solid var(--border,#dce4e1); border-radius:16px; background:var(--surface,#fff); min-width:0; }
    .excel-controls { align-items:end; }
    label { display:grid; gap:.4rem; min-width:0; }
    input[type=file] { max-width:100%; width:22rem; }
    .excel-preview { max-height:20rem; overflow:auto; margin-block:1rem; }
    .excel-preview table { min-width:28rem; width:100%; }
    .excel-note { max-width:80ch; }
    .excel-tools button,.excel-controls button { white-space:normal; min-height:44px; }
    .excel-tools { padding:12px; background:#f0ede6; border:1px solid #d8d2c6; border-radius:10px; }
    .excel-tools button { color:#292820; background:white; border-color:#aaa18f; }
    .excel-tools .import-button { background:#292820; color:#fff; border-color:#292820; }
    .excel-panel h2 { font-size:1.2rem; margin:0 0 12px; }
    .excel-note { color:#555047; line-height:1.6; font-size:.85rem; }
    .excel-preview th { background:#eee9df; color:#292820; }
    @media(max-width:600px) { .excel-tools button { flex:1 1 140px; } }
    @media(max-width:600px) { .excel-controls { align-items:stretch; } .excel-controls>* { width:100%; } }
  `],
  template: `
    <div class="excel-tools">
      <button type="button" (click)="download(false)" [disabled]="busy()"><fs-icon name="download" />Exportar Excel</button>
      @if (canWrite()) {
        <button class="import-button" type="button" (click)="expanded.set(!expanded())" [attr.aria-expanded]="expanded()" [disabled]="busy()"><fs-icon [name]="expanded() ? 'close' : 'upload'" />{{ expanded() ? 'Cerrar carga masiva' : 'Importar Excel' }}</button>
      }
    </div>
    @if (notice()) { <p class="alert success" role="status">{{ notice() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
    @if (expanded() && canWrite()) {
      <section class="excel-panel" aria-label="Carga masiva de Excel">
        <h2>Carga masiva</h2>
        <p class="muted excel-note">Descargá la plantilla, completá la hoja Datos y revisá las filas antes de confirmar. Las hojas auxiliares incluyen los códigos y nombres disponibles. Hasta 1000 filas y 5 MB por archivo.</p>
        <div class="excel-controls">
          @if (resource() === 'products') {
            <label>Contenido
              <select [(ngModel)]="target" (ngModelChange)="resetFile()" [disabled]="busy()">
                <option value="products">Prendas</option><option value="variants">Variantes de prendas (SKU)</option>
              </select>
            </label>
          }
          <button type="button" (click)="download(true)" [disabled]="busy()">Descargar plantilla .xlsx</button>
          @if (target === 'variants') { <button type="button" (click)="download(false, true)" [disabled]="busy()">Exportar variantes</button> }
          <label>Operación
            <select [(ngModel)]="mode" (ngModelChange)="report.set(null)" [disabled]="busy()">
              <option value="create">Crear registros nuevos</option><option value="update">Actualizar por clave existente</option>
            </select>
          </label>
          <label>Archivo .xlsx
            <input #fileInput type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" (change)="choose($event)" [disabled]="busy()" />
          </label>
          <button type="button" class="primary" (click)="preview()" [disabled]="!file || busy()">{{ busy() ? 'Procesando…' : 'Revisar archivo' }}</button>
        </div>
        <p class="muted excel-note">Crear rechaza duplicados. Actualizar exige una clave existente y conserva los campos vacíos. No cambia estados ni existencias. Si alguna fila falla, no se guarda ninguna.</p>
        @if (target === 'products') { <p class="muted">Primero importá prendas, después sus variantes. Agregá imágenes y proveedores asociados desde «Variantes y recursos».</p> }
        @if (report(); as result) {
          <p role="status"><strong>{{ result.total }} filas:</strong> {{ result.valid }} válidas y {{ result.errors.length }} con errores.</p>
          <div class="excel-preview">
            @if (result.errors.length) {
              <table><thead><tr><th>Fila Excel</th><th>Corrección necesaria</th></tr></thead>
                <tbody>@for (item of result.errors; track item.row) { <tr><td>{{ item.row }}</td><td>{{ item.message }}</td></tr> }</tbody>
              </table>
            } @else {
              <table><thead><tr><th>Fila Excel</th><th>Clave</th><th>Operación</th></tr></thead>
                <tbody>@for (item of result.rows.slice(0, 30); track item.row) { <tr><td>{{ item.row }}</td><td>{{ item.key }}</td><td>{{ result.mode === 'create' ? 'Crear' : 'Actualizar' }}</td></tr> }</tbody>
              </table>
              @if (result.rows.length > 30) { <p>Se muestran las primeras 30 de {{ result.total }} filas verificadas.</p> }
            }
          </div>
          @if (!result.errors.length && !result.imported) {
            <button type="button" class="primary" (click)="confirm()" [disabled]="busy()">Confirmar {{ result.total }} {{ result.mode === 'create' ? 'altas' : 'actualizaciones' }}</button>
          }
        }
      </section>
    }
  `,
})
export class BulkExcelComponent implements OnChanges {
  private http = inject(HttpClient);
  resource = input.required<string>();
  canWrite = input(false);
  filters = input<Record<string, unknown>>({});
  imported = output<void>();
  expanded = signal(false);
  busy = signal(false);
  error = signal('');
  notice = signal('');
  report = signal<ImportReport | null>(null);
  target = '';
  mode: 'create' | 'update' = 'create';
  file: File | null = null;
  private generation = 0;

  ngOnChanges(changes: Record<string, unknown>) {
    if (changes['resource']) {
      this.target = this.resource();
      this.expanded.set(false);
      this.busy.set(false);
      this.resetFile();
    }
  }

  resetFile() {
    this.generation++;
    this.file = null;
    this.report.set(null);
    this.error.set('');
    this.notice.set('');
  }

  choose(event: Event) {
    this.resetFile();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 5 * 1024 * 1024) {
      this.error.set('Seleccioná un archivo .xlsx de hasta 5 MB.');
      input.value = '';
      return;
    }
    this.file = file;
  }

  async download(template: boolean, selectedTarget = false) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const generation = this.generation;
    const target = template || selectedTarget ? this.target : this.resource();
    let params = new HttpParams();
    if (!template && !selectedTarget) {
      for (const [key, value] of Object.entries(this.filters())) {
        if (value !== '' && value !== undefined && value !== null) params = params.set(key, String(value));
      }
    }
    try {
      const blob = await firstValueFrom(this.http.get(`${environment.apiUrl}/bulk/${target}/${template ? 'template' : 'export'}`, { params, responseType: 'blob' }));
      if (generation !== this.generation) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${template ? 'plantilla-' : ''}${target}.xlsx`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error: any) {
      if (generation === this.generation) {
        if (error.error instanceof Blob) {
            try { error = new HttpErrorResponse({ error: JSON.parse(await error.error.text()), status: error.status, statusText: error.statusText, url: error.url }); } catch { /* retain HTTP error */ }
        }
        this.error.set(errorMessage(error));
      }
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }

  async preview() { await this.send(false); }
  async confirm() {
    if (!this.report() || this.report()!.errors.length || this.report()!.imported) return;
    await this.send(true);
  }

  private async send(confirm: boolean) {
    if (!this.file || this.busy() || !this.canWrite()) return;
    const generation = this.generation;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    const body = new FormData();
    body.append('file', this.file);
    body.append('mode', this.mode);
    if (confirm) {
      body.append('confirm', 'true');
      body.append('preview_digest', this.report()!.digest);
    }
    try {
      const result = await firstValueFrom(this.http.post<ApiResponse<ImportReport>>(`${environment.apiUrl}/bulk/${this.target}/${confirm ? 'import' : 'preview'}`, body));
      if (generation !== this.generation) return;
      this.report.set(result.data);
      if (result.data.imported) {
        this.notice.set(`${result.data.imported} registros importados correctamente.`);
        this.imported.emit();
      }
    } catch (error) {
      if (generation === this.generation) { this.error.set(errorMessage(error)); this.report.set(null); }
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
}
