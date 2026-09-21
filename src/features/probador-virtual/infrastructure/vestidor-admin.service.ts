import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { PreparacionMasivaResult, RecursoTryOn } from '../domain/vestidor-admin.models';

@Injectable({ providedIn: 'root' })
export class VestidorAdminService {
  private api = inject(ApiService);

  /** Recursos del probador, con filtro por estado (por ejemplo `review` para la
   * cola de recursos que esperan aprobación) o por prenda. */
  list(status = '', product_id = ''): Promise<RecursoTryOn[]> {
    return firstValueFrom(
      this.api.get<RecursoTryOn[]>('/vestidor/admin/assets', { status, product_id }),
    );
  }

  /** Dispara la preparación automática de un recurso desde la foto del catálogo. */
  prepare(product_id: string, color_id: string): Promise<RecursoTryOn> {
    return firstValueFrom(
      this.api.write<RecursoTryOn>('POST', `/vestidor/admin/products/${product_id}/assets`, {
        color_id,
      }),
    ).then((r) => r.data);
  }

  /** Vuelve a analizar la foto: corrige un fallo transitorio sin borrar nada. */
  retry(asset_id: string): Promise<RecursoTryOn> {
    return firstValueFrom(
      this.api.write<RecursoTryOn>('POST', `/vestidor/admin/assets/${asset_id}/retry`),
    ).then((r) => r.data);
  }

  /** Aprueba o descarta un recurso que el análisis dejó en revisión. Aprobar lo
   * publica; descartar lo marca como fallido con la nota del administrador. */
  review(asset_id: string, approve: boolean, note = ''): Promise<RecursoTryOn> {
    return firstValueFrom(
      this.api.write<RecursoTryOn>('POST', `/vestidor/admin/assets/${asset_id}/review`, {
        approve,
        note: note || null,
      }),
    ).then((r) => r.data);
  }

  /** Corrección manual de lo que propuso el análisis automático. */
  adjust(asset_id: string, body: Record<string, unknown>): Promise<RecursoTryOn> {
    return firstValueFrom(
      this.api.write<RecursoTryOn>('PATCH', `/vestidor/admin/assets/${asset_id}`, body),
    ).then((r) => r.data);
  }

  /** Prepara en lote los recursos pendientes de todos los productos. */
  bulk(only_pending = true): Promise<PreparacionMasivaResult> {
    return firstValueFrom(
      this.api.write<PreparacionMasivaResult>('POST', '/vestidor/admin/bulk-prepare', {
        only_pending,
      }),
    ).then((r) => r.data);
  }

  /** La imagen que mejor representa el estado del recurso para la bandeja. */
  vistaDe(recurso: RecursoTryOn): string {
    return recurso.preview_url || recurso.transparent_url || recurso.source_image_url;
  }
}