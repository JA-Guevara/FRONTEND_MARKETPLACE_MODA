import {
  ProductoLocal,
  VarianteLocal,
  ExistenciaLocal,
  SucursalLocal,
  ClienteLocal,
} from '../../../app/core/offline/offline-db';
import { TenantSummary } from '../../../shared/models';
export interface OfflineSnapshot {
  version: string;
  generated_at: string;
  full: boolean;
  tenant: TenantSummary;
  branches: { id: string; code: string; name: string; address: string }[];
  products: {
    id: string;
    name: string;
    slug: string;
    category: string;
    brand: string;
    base_price: number | string;
    offer_price: number | string | null;
    image_url: string | null;
    is_featured: boolean;
  }[];
  variants: {
    id: string;
    product_id: string;
    sku: string;
    size: string;
    color: string;
    color_hex: string;
    price: number | string | null;
    is_active: boolean;
  }[];
  stock: { variant_id: string; branch_id: string; quantity: number }[];
  customers: { id: string; name: string; document_tail: string; phone: string | null }[];
  removed: { products: string[]; variants: string[] };
}
export interface DatosLocales {
  productos: ProductoLocal[];
  variantes: VarianteLocal[];
  existencias: ExistenciaLocal[];
  sucursales: SucursalLocal[];
  clientes: ClienteLocal[];
}
export const DATOS_VACIOS: DatosLocales = {
  productos: [],
  variantes: [],
  existencias: [],
  sucursales: [],
  clientes: [],
};
export interface FiltrosOffline {
  texto: string;
  categoria: string;
  talla: string;
  color: string;
  precioMin: number | null;
  precioMax: number | null;
  soloOferta: boolean;
  soloConStock: boolean;
}
export const FILTROS_VACIOS: FiltrosOffline = {
  texto: '',
  categoria: '',
  talla: '',
  color: '',
  precioMin: null,
  precioMax: null,
  soloOferta: false,
  soloConStock: false,
};
export interface ProductoVista {
  producto: ProductoLocal;
  variantes: VarianteLocal[];
  tallas: string[];
  colores: string[];
  stock: number;
  precioFinal: number;
}
export const VIGENCIA_HORAS = 24;
export function isStale(fecha: string | null, ahora: Date, horas = VIGENCIA_HORAS) {
  return (
    !fecha ||
    !Number.isFinite(Date.parse(fecha)) ||
    ahora.getTime() - Date.parse(fecha) > horas * 3600000
  );
}
export function filtrarCatalogo(datos: DatosLocales, f: FiltrosOffline): ProductoVista[] {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  return datos.productos.flatMap((p) => {
    const variantes = datos.variantes.filter((v) => v.producto_id === p.id && v.activa);
    const matching = variantes.filter(
      (v) => (!f.talla || v.talla === f.talla) && (!f.color || v.color === f.color),
    );
    const stock = datos.existencias
      .filter((x) => matching.some((v) => v.id === x.variante_id))
      .reduce((n, x) => n + x.cantidad, 0);
    const precioFinal = Number(p.precio_oferta ?? p.precio_base);
    if (
      (f.texto && !norm([p.nombre, p.marca, p.categoria].join(' ')).includes(norm(f.texto))) ||
      (f.categoria && p.categoria !== f.categoria) ||
      ((f.talla || f.color) && !matching.length) ||
      (f.soloOferta && p.precio_oferta === null) ||
      (f.soloConStock && stock <= 0) ||
      (f.precioMin !== null && precioFinal < f.precioMin) ||
      (f.precioMax !== null && precioFinal > f.precioMax)
    )
      return [];
    return [
      {
        producto: p,
        variantes: matching,
        tallas: [...new Set(variantes.map((v) => v.talla))],
        colores: [...new Set(variantes.map((v) => v.color))],
        stock,
        precioFinal,
      },
    ];
  });
}
