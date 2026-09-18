/**
 * Coordenadas: validación, formato y lectura de resultados de búsqueda.
 *
 * Vive aparte del mapa a propósito. Todo lo que puede estar mal —una latitud
 * imposible, una coma en vez de punto, una respuesta de búsqueda con campos
 * faltantes— se decide con funciones puras que se prueban sin navegador ni
 * mapa. El componente solo dibuja.
 */

export interface Punto {
  lat: number;
  lng: number;
}

/** Centro por defecto: Santa Cruz de la Sierra, donde opera la tienda. */
export const CENTRO_POR_DEFECTO: Punto = { lat: -17.7833, lng: -63.1821 };

/** Cuántos decimales se guardan. Siete son ~1 cm: más es ruido. */
export const DECIMALES = 7;

export function latitudValida(valor: unknown): boolean {
  const n = Number(valor);
  return Number.isFinite(n) && n >= -90 && n <= 90;
}

export function longitudValida(valor: unknown): boolean {
  const n = Number(valor);
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

/**
 * Convierte lo que haya en el formulario a un punto usable.
 *
 * Devuelve `null` en vez de un punto a medias: una sucursal con latitud y sin
 * longitud no está en ningún lado, y dibujar el marcador en el meridiano cero
 * sería peor que no dibujarlo.
 */
export function leerPunto(lat: unknown, lng: unknown): Punto | null {
  if (lat === null || lat === undefined || lat === '') return null;
  if (lng === null || lng === undefined || lng === '') return null;
  if (!latitudValida(lat) || !longitudValida(lng)) return null;
  return { lat: Number(lat), lng: Number(lng) };
}

/** Recorta a los decimales que se guardan y deja un número, no un texto. */
export function redondear(punto: Punto): Punto {
  return {
    lat: Number(punto.lat.toFixed(DECIMALES)),
    lng: Number(punto.lng.toFixed(DECIMALES)),
  };
}

/**
 * Normaliza una longitud que se fue de rango.
 *
 * Arrastrar el mapa hacia el costado repite el mundo, y Leaflet devuelve
 * longitudes como 187 o -195. Guardar eso haría fallar la validación del
 * servidor con un número que en el mapa se veía bien.
 */
export function normalizarLongitud(lng: number): number {
  let valor = ((lng + 180) % 360 + 360) % 360 - 180;
  // -180 y 180 son el mismo meridiano; se elige el positivo por convención.
  if (valor === -180) valor = 180;
  return valor;
}

export function normalizar(punto: Punto): Punto {
  return redondear({
    lat: Math.max(-90, Math.min(90, punto.lat)),
    lng: normalizarLongitud(punto.lng),
  });
}

/** Texto corto para mostrar debajo del mapa. */
export function formatear(punto: Punto | null): string {
  if (!punto) return 'Sin ubicación marcada';
  return `${punto.lat.toFixed(5)}, ${punto.lng.toFixed(5)}`;
}

export interface Sugerencia {
  nombre: string;
  punto: Punto;
}

/**
 * Lee la respuesta del buscador de direcciones (Nominatim de OpenStreetMap).
 *
 * La respuesta es de un servicio externo: se valida cada fila y se descarta la
 * que no traiga coordenadas usables, en vez de confiar en su forma.
 */
export function leerSugerencias(respuesta: unknown, tope = 5): Sugerencia[] {
  if (!Array.isArray(respuesta)) return [];
  const salida: Sugerencia[] = [];
  for (const fila of respuesta) {
    if (!fila || typeof fila !== 'object') continue;
    const dato = fila as Record<string, unknown>;
    const punto = leerPunto(dato['lat'], dato['lon']);
    const nombre = typeof dato['display_name'] === 'string' ? dato['display_name'].trim() : '';
    if (!punto || !nombre) continue;
    salida.push({ nombre, punto: redondear(punto) });
    if (salida.length >= tope) break;
  }
  return salida;
}

/** Enlace para abrir la ubicación en un mapa externo y confirmarla. */
export function enlaceExterno(punto: Punto): string {
  return `https://www.openstreetmap.org/?mlat=${punto.lat}&mlon=${punto.lng}#map=18/${punto.lat}/${punto.lng}`;
}
