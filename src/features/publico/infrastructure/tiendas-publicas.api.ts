import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../app/core/shared/api.service';
import { Page } from '../../../shared/models';

export interface TiendaPublica {
  slug: string;
  trade_name: string;
  logo_url?: string | null;
  city?: string | null;
  slogan?: string | null;
}

type PaginaTiendas = Omit<Page<TiendaPublica>, 'pages'>;

@Injectable({ providedIn: 'root' })
export class TiendasPublicasApi {
  private readonly api = inject(ApiService);

  listar(page = 1, pageSize = 24) {
    return this.api.get<PaginaTiendas>('/public/stores', { page, page_size: pageSize });
  }

  obtener(slug: string) {
    return this.api.get<TiendaPublica>('/public/stores/' + encodeURIComponent(slug));
  }
}
