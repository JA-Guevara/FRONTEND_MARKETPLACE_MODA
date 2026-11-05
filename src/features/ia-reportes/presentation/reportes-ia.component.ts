import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DictadoService } from '../application/dictado.service';
import {
  chipsDeSpec,
  DefinicionReporte,
  InterpretResult,
  ReportResponse,
  ReportSpec,
} from '../domain/reporte-ia.models';
import { ReportesIaApi } from '../infrastructure/reportes-ia.api';
import { ResultadoReporteComponent } from './resultado-reporte.component';

@Component({
  selector: 'fs-reportes-ia',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ResultadoReporteComponent],
  template: `
    <div class="reportes-ia-page">
      <!-- Encabezado superior -->
      <div class="page-header">
        <div class="header-left">
          <div class="badge-ia">IA GENERATIVA & VOZ</div>
          <h1 class="page-title">Reportes Inteligentes con IA</h1>
          <p class="page-desc">
            Consultá métricas en lenguaje natural escrito o por voz. Las consultas se ejecutan de
            forma segura y aislada en tu empresa.
          </p>
        </div>
        <div class="header-right">
          <div class="usage-pill" *ngIf="uso()">
            <span class="usage-label">Uso mensual:</span>
            <span class="usage-val">{{ uso()?.used || 0 }} / {{ uso()?.limit || 1000 }}</span>
          </div>
          <a routerLink="/admin/reportes-ia/historial" class="btn-historial">
            📜 Historial
          </a>
        </div>
      </div>

      <!-- Barra de consulta y micrófono -->
      <div class="consulta-bar-card">
        <div class="input-row">
          <button
            type="button"
            class="btn-mic"
            [class.btn-mic--recording]="dictado.grabando()"
            (click)="toggleDictado()"
            title="Dictar consulta por voz"
          >
            <span class="mic-icon">{{ dictado.grabando() ? '🔴' : '🎙️' }}</span>
            <span class="mic-timer" *ngIf="dictado.grabando()">{{ dictado.segundos() }}s</span>
          </button>

          <input
            type="text"
            class="input-prompt"
            [(ngModel)]="promptTexto"
            placeholder="Escribe o dicta tu consulta (ej: 'Ventas de septiembre por sucursal')"
            (keyup.enter)="consultar('TEXT')"
            [disabled]="cargando()"
          />

          <button
            type="button"
            class="btn-consultar"
            (click)="consultar('TEXT')"
            [disabled]="cargando() || !promptTexto.trim()"
          >
            <span *ngIf="!cargando()">Generar Reporte</span>
            <span *ngIf="cargando()">Analizando...</span>
          </button>
        </div>

        <div class="error-msg" *ngIf="errorMsg()">
          ⚠️ {{ errorMsg() }}
        </div>

        <!-- Chips de sugerencias rápidas (6 ejemplos de 8.2) -->
        <div class="sugerencias-chips">
          <span class="chips-label">Ejemplos rápidos:</span>
          <button
            type="button"
            class="chip-btn"
            *ngFor="let s of ejemplosSugeridos"
            (click)="usarSugerencia(s)"
            [disabled]="cargando()"
          >
            {{ s }}
          </button>
        </div>
      </div>

      <!-- Panel de Aclaración (5a) -->
      <div class="alerta-card alerta-card--warning" *ngIf="interpretacion()?.status === 'NEEDS_CLARIFICATION'">
        <div class="alerta-header">
          <span class="alerta-icon">❓</span>
          <strong>Consulta ambigua o incompleta</strong>
        </div>
        <div class="alerta-body">
          <p *ngFor="let q of interpretacion()?.questions">{{ q }}</p>
          <div class="alerta-actions">
            <button class="btn-secundario" (click)="usarMesEnCurso()">
              Usar mes en curso
            </button>
          </div>
        </div>
      </div>

      <!-- Panel de No Soportado (5b) -->
      <div class="alerta-card alerta-card--danger" *ngIf="interpretacion()?.status === 'UNSUPPORTED'">
        <div class="alerta-header">
          <span class="alerta-icon">🛑</span>
          <strong>No puedo realizar esa operación</strong>
        </div>
        <div class="alerta-body">
          <p *ngFor="let a of interpretacion()?.assumptions">{{ a }}</p>
          <div class="sugerencias-list" *ngIf="interpretacion()?.suggestions?.length">
            <span>Reportes disponibles relacionados:</span>
            <ul>
              <li *ngFor="let sug of interpretacion()?.suggestions">{{ sug }}</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Barra de especificación activa, vista y exportación -->
      <div class="barra-acciones" *ngIf="reporteActual()">
        <div class="spec-chips">
          <span class="spec-chip" *ngFor="let c of chipsSpecActiva()">
            <strong>{{ c.etiqueta }}:</strong> {{ c.valor }}
          </span>
        </div>

        <div class="acciones-der">
          <!-- Conmutador Gráfico / Tabla -->
          <div class="toggle-vista">
            <button
              class="toggle-btn"
              [class.active]="vista === 'grafico'"
              (click)="vista = 'grafico'"
            >
              📊 Gráfico
            </button>
            <button
              class="toggle-btn"
              [class.active]="vista === 'tabla'"
              (click)="vista = 'tabla'"
            >
              📋 Tabla
            </button>
          </div>

          <!-- Botones de exportación -->
          <div class="export-group">
            <button
              class="btn-export"
              (click)="exportar('xlsx')"
              [disabled]="exportando()"
              title="Descargar en Excel"
            >
              📗 Excel
            </button>
            <button
              class="btn-export"
              (click)="exportar('pdf')"
              [disabled]="exportando()"
              title="Descargar en PDF"
            >
              📕 PDF
            </button>
            <button
              class="btn-export"
              (click)="exportar('csv')"
              [disabled]="exportando()"
              title="Descargar en CSV"
            >
              📄 CSV
            </button>
          </div>
        </div>
      </div>

      <!-- Resultado del reporte -->
      <fs-resultado-reporte
        *ngIf="reporteActual()"
        [report]="reporteActual()"
        [vista]="vista"
      ></fs-resultado-reporte>
    </div>
  `,
  styles: [`
    .reportes-ia-page {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1.5rem;
      flex-wrap: wrap;
    }
    .badge-ia {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 800;
      color: #7c3aed;
      background: #f3e8ff;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      letter-spacing: 0.05em;
      margin-bottom: 0.35rem;
    }
    .page-title {
      font-size: 1.75rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 0.35rem 0;
    }
    .page-desc {
      font-size: 0.95rem;
      color: #64748b;
      margin: 0;
      max-width: 650px;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .usage-pill {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 0.4rem 0.85rem;
      border-radius: 8px;
      font-size: 0.85rem;
    }
    .usage-label {
      color: #64748b;
      margin-right: 0.35rem;
    }
    .usage-val {
      font-weight: 700;
      color: #0f172a;
    }
    .btn-historial {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 0.4rem 0.85rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #334155;
      text-decoration: none;
      transition: background 0.15s;
    }
    .btn-historial:hover {
      background: #f8fafc;
    }
    .consulta-bar-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 1.25rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .input-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .btn-mic {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 0.65rem 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-mic--recording {
      background: #fee2e2;
      border-color: #ef4444;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    .mic-icon {
      font-size: 1.1rem;
    }
    .mic-timer {
      font-size: 0.8rem;
      font-weight: 700;
      color: #dc2626;
    }
    .input-prompt {
      flex: 1;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 0.75rem 1rem;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }
    .input-prompt:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    .btn-consultar {
      background: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 10px;
      padding: 0.75rem 1.35rem;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-consultar:hover:not(:disabled) {
      background: #1d4ed8;
    }
    .btn-consultar:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .error-msg {
      font-size: 0.85rem;
      color: #dc2626;
      background: #fef2f2;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
    }
    .sugerencias-chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
    }
    .chips-label {
      color: #64748b;
      font-weight: 600;
    }
    .chip-btn {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
      color: #334155;
      cursor: pointer;
      transition: all 0.15s;
    }
    .chip-btn:hover {
      background: #e2e8f0;
      color: #0f172a;
    }
    .alerta-card {
      border-radius: 12px;
      padding: 1rem 1.25rem;
    }
    .alerta-card--warning {
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #92400e;
    }
    .alerta-card--danger {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
    }
    .alerta-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.35rem;
    }
    .alerta-actions {
      margin-top: 0.75rem;
    }
    .btn-secundario {
      background: #ffffff;
      border: 1px solid #d97706;
      color: #b45309;
      padding: 0.4rem 0.85rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .barra-acciones {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 0.75rem 1rem;
    }
    .spec-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .spec-chip {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-size: 0.8rem;
      color: #1e293b;
    }
    .acciones-der {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .toggle-vista {
      display: flex;
      background: #f1f5f9;
      padding: 2px;
      border-radius: 8px;
    }
    .toggle-btn {
      background: transparent;
      border: none;
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      border-radius: 6px;
    }
    .toggle-btn.active {
      background: #ffffff;
      color: #0f172a;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    .export-group {
      display: flex;
      gap: 0.35rem;
    }
    .btn-export {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0.35rem 0.65rem;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-export:hover:not(:disabled) {
      background: #e2e8f0;
    }
  `],
})
export class ReportesIaComponent implements OnInit {
  promptTexto = '';
  cargando = signal(false);
  exportando = signal(false);
  errorMsg = signal<string | null>(null);

  interpretacion = signal<InterpretResult | null>(null);
  reporteActual = signal<ReportResponse | null>(null);
  uso = signal<{ used: number; limit: number } | null>(null);

  vista: 'grafico' | 'tabla' = 'grafico';

  constructor(
    private api: ReportesIaApi,
    public dictado: DictadoService
  ) {}

  ejemplosSugeridos = [
    'Mostrame las ventas de septiembre agrupadas por sucursal',
    '¿Cuáles fueron los diez productos más vendidos este mes?',
    'Generá un gráfico de ventas por semana',
    'Compará las ventas de las sucursales durante los últimos tres meses',
    'Mostrame los productos con menor existencia',
    '¿Qué categorías generaron mayores ingresos durante este período?',
  ];

  async ngOnInit(): Promise<void> {
    try {
      const defs = await this.api.definitions();
      if (defs && defs.length > 0) {
        // Enriquecer ejemplos si están disponibles
        const exList = defs.flatMap((d) => d.examples).filter(Boolean);
        if (exList.length >= 6) {
          this.ejemplosSugeridos = exList.slice(0, 6);
        }
      }
    } catch {}
  }

  usarSugerencia(texto: string): void {
    this.promptTexto = texto;
    this.consultar('TEXT');
  }

  async toggleDictado(): Promise<void> {
    if (this.dictado.grabando()) {
      this.dictado.detener();
    } else {
      try {
        const textoTranscrito = await this.dictado.iniciar();
        if (textoTranscrito) {
          this.promptTexto = textoTranscrito;
          this.consultar('VOICE');
        }
      } catch (err: any) {
        this.errorMsg.set(this.dictado.error() || 'Error al grabar audio.');
      }
    }
  }

  async consultar(canal: 'TEXT' | 'VOICE'): Promise<void> {
    const texto = this.promptTexto.trim();
    if (!texto) return;

    this.cargando.set(true);
    this.errorMsg.set(null);

    try {
      // 1. Interpretar
      const inter = await this.api.interpret(texto, canal);
      this.interpretacion.set(inter);

      if (inter.status === 'READY' && inter.spec) {
        // 2. Ejecutar reporte directamente
        const rep = await this.api.run(inter.spec, inter.request_id);
        this.reporteActual.set(rep);
        this.uso.set(rep.usage);
      } else {
        this.reporteActual.set(null);
      }
    } catch (err: any) {
      this.errorMsg.set(err?.error?.detail || err?.message || 'Error al procesar la consulta.');
    } finally {
      this.cargando.set(false);
    }
  }

  usarMesEnCurso(): void {
    this.promptTexto += ' este mes';
    this.consultar('TEXT');
  }

  chipsSpecActiva(): { etiqueta: string; valor: string }[] {
    const spec = this.interpretacion()?.spec;
    return spec ? chipsDeSpec(spec) : [];
  }

  async exportar(formato: 'xlsx' | 'pdf' | 'csv'): Promise<void> {
    const spec = this.interpretacion()?.spec;
    if (!spec) return;

    this.exportando.set(true);
    try {
      const blob = await this.api.exportar(
        spec,
        formato,
        this.interpretacion()?.request_id
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_${spec.definition_code}.${formato}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      this.errorMsg.set('No se pudo exportar el archivo.');
    } finally {
      this.exportando.set(false);
    }
  }
}
