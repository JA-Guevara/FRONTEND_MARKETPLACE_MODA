import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, map } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { ApiResponse } from '../../../shared/models';
import { environment } from '../../../environments/environment';
import { TryOnJob } from '../domain/tryon-jobs.models';

@Injectable({ providedIn: 'root' })
export class TryOnAiService {
  private api = inject(ApiService);
  private http = inject(HttpClient);

  /** Pide una foto IA realista. La creación vuelve al instante con el trabajo en
   * `queued`; la generación ocurre al consultar el estado con `one()`. La foto se
   * elimina del servidor al cancelar, expirar o eliminar el trabajo. */
  async create(
    file: File,
    productId: string,
    colorId: string | null,
    consent: boolean,
  ): Promise<TryOnJob> {
    const body = new FormData();
    body.append('file', file);
    body.append('product_id', productId);
    if (colorId) body.append('color_id', colorId);
    body.append('privacy_consent', String(consent));
    return firstValueFrom(
      this.http
        .post<ApiResponse<TryOnJob>>(environment.apiUrl + '/tryon-ai/jobs', body)
        .pipe(map((r) => r.data)),
    );
  }

  /** Historial de fotos IA pedidas por el usuario, de más nuevas a más viejas. */
  mine(): Promise<TryOnJob[]> {
    return firstValueFrom(this.api.get<TryOnJob[]>('/tryon-ai/jobs'));
  }

  /** Estado de un trabajo propio: consultarlo dispara la generación pendiente. */
  one(id: string): Promise<TryOnJob> {
    return firstValueFrom(this.api.get<TryOnJob>('/tryon-ai/jobs/' + id));
  }

  /** Cancela un trabajo en curso; el servidor elimina la foto de la persona. */
  cancel(id: string): Promise<TryOnJob> {
    return firstValueFrom(
      this.api.write<TryOnJob>('PATCH', '/tryon-ai/jobs/' + id + '/cancel'),
    ).then((r) => r.data);
  }

  /** Elimina el trabajo y sus imágenes del servidor. */
  remove(id: string): Promise<void> {
    return firstValueFrom(this.api.write<null>('DELETE', '/tryon-ai/jobs/' + id)).then(
      () => undefined,
    );
  }
}