import { isStale, filtrarCatalogo, FILTROS_VACIOS, DatosLocales } from './offline.models';
const datos: DatosLocales = {
  productos: [
    {
      id: 'p',
      nombre: 'Camisa',
      slug: 'camisa',
      categoria: 'Camisas',
      marca: 'FS',
      precio_base: 100,
      precio_oferta: 70,
      imagen_url: null,
      destacado: false,
      actualizado_en: '',
    },
    {
      id: 'p2',
      nombre: 'Pantalón',
      slug: 'pantalon',
      categoria: 'Pantalones',
      marca: 'FS',
      precio_base: 50,
      precio_oferta: null,
      imagen_url: null,
      destacado: false,
      actualizado_en: '',
    },
  ],
  variantes: [
    {
      id: 'v',
      producto_id: 'p',
      sku: 'CAM-M',
      talla: 'M',
      color: 'Azul',
      color_hex: '#00f',
      precio: null,
      activa: true,
    },
    {
      id: 'v2',
      producto_id: 'p2',
      sku: 'P-L',
      talla: 'L',
      color: 'Negro',
      color_hex: '#000',
      precio: null,
      activa: true,
    },
  ],
  existencias: [
    { variante_id: 'v', sucursal_id: 'b', cantidad: 4 },
    { variante_id: 'v2', sucursal_id: 'b', cantidad: 0 },
  ],
  sucursales: [],
  clientes: [],
};
describe('Catálogo sin conexión', () => {
  it('vigencia 24horas', () => {
    const ahora = new Date('2026-10-23T12:00:00Z');
    expect(isStale('2026-10-22T10:00:00Z', ahora)).toBe(true);
    expect(isStale('2026-10-23T10:00:00Z', ahora)).toBe(false);
    expect(isStale(null, ahora)).toBe(true);
  });
  it('filtra oferta', () =>
    expect(
      filtrarCatalogo(datos, { ...FILTROS_VACIOS, soloOferta: true }).map((p) => p.producto.id),
    ).toEqual(['p']));
  it('filtra talla activa', () =>
    expect(filtrarCatalogo(datos, { ...FILTROS_VACIOS, talla: 'M' })).toHaveLength(1));
  it('excluye stock cero', () =>
    expect(filtrarCatalogo(datos, { ...FILTROS_VACIOS, soloConStock: true })).toHaveLength(1));
  it('usa precio final en rango', () => {
    expect(
      filtrarCatalogo(datos, { ...FILTROS_VACIOS, precioMin: 60, precioMax: 80 })[0].precioFinal,
    ).toBe(70);
    expect(filtrarCatalogo(datos, { ...FILTROS_VACIOS, precioMin: 90 })).toHaveLength(0);
  });
});
