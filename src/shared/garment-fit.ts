/**
 * Ubicación automática de la prenda sobre el cuerpo.
 *
 * El recurso preparado trae puntos de anclaje ("esta parte de la imagen es el
 * hombro") y la región del cuerpo que cubre. La detección de pose aporta los
 * puntos corporales. Este módulo empareja unos con otros y calcula posición,
 * escala e inclinación, de modo que el cliente no tenga que acomodar la prenda
 * a mano con controles.
 *
 * Funciones puras: sin DOM, sin cámara y sin MediaPipe, para poder probarlas.
 */
import { Landmark, VideoBox, inRange, videoToDisplay } from './pose-projection';

export type BodyRegion = 'upper_body' | 'lower_body' | 'full_body' | 'feet';

/** Anclajes del recurso: nombre → [x, y] normalizados dentro de la imagen. */
export type GarmentAnchors = Record<string, number[] | undefined>;

export const LEFT_SHOULDER = 11;
export const RIGHT_SHOULDER = 12;
export const LEFT_HIP = 23;
export const RIGHT_HIP = 24;
export const LEFT_ANKLE = 27;
export const RIGHT_ANKLE = 28;

/** Par de landmarks que gobierna cada región y anclaje equivalente en la imagen. */
const REGLA: Record<
  BodyRegion,
  { izquierdo: number; derecho: number; anclajes: string[]; holgura: number; parte: string }
> = {
  // La prenda es más ancha que la línea de esqueleto: la holgura compensa.
  upper_body: { izquierdo: LEFT_SHOULDER, derecho: RIGHT_SHOULDER, anclajes: ['shoulder', 'chest'], holgura: 1.35, parte: 'los hombros' },
  lower_body: { izquierdo: LEFT_HIP, derecho: RIGHT_HIP, anclajes: ['waist', 'hip'], holgura: 1.3, parte: 'la cadera' },
  full_body: { izquierdo: LEFT_SHOULDER, derecho: RIGHT_SHOULDER, anclajes: ['shoulder', 'waist'], holgura: 1.35, parte: 'los hombros' },
  feet: { izquierdo: LEFT_ANKLE, derecho: RIGHT_ANKLE, anclajes: ['top', 'hem'], holgura: 1.6, parte: 'los pies' },
};

/** Proporción del ancho del escenario que debería ocupar la línea corporal.
 * Fuera de este rango se le pide a la persona que se acerque o se aleje. */
const MIN_ENCUADRE = 0.1;
const MAX_ENCUADRE = 0.6;
/** Inclinación (radianes) a partir de la cual conviene pedir que se enderece. */
const MAX_INCLINACION = 0.38;

export type GuidanceCode =
  | 'ok'
  | 'sin-camara'
  | 'sin-persona'
  | 'parcial'
  | 'lejos'
  | 'cerca'
  | 'inclinado';

export interface Guidance {
  code: GuidanceCode;
  message: string;
  /** true cuando la prenda puede mostrarse ubicada. */
  ok: boolean;
}

export interface GarmentFit {
  offsetX: number;
  offsetY: number;
  rotation: number;
  scale: number;
}

export function esRegion(valor: unknown): valor is BodyRegion {
  return valor === 'upper_body' || valor === 'lower_body' || valor === 'full_body' || valor === 'feet';
}

/** Par de anclajes utilizable para la región, en orden de preferencia. */
export function anclajeDeRegion(
  anchors: GarmentAnchors | null | undefined,
  region: BodyRegion,
): { izquierda: number[]; derecha: number[] } | null {
  if (!anchors) return null;
  for (const nombre of REGLA[region].anclajes) {
    const izquierda = anchors[`${nombre}_left`];
    const derecha = anchors[`${nombre}_right`];
    if (izquierda?.length === 2 && derecha?.length === 2 && derecha[0] - izquierda[0] > 0.02)
      return { izquierda, derecha };
  }
  return null;
}

interface LineaCorporal {
  midX: number;
  midY: number;
  spanPx: number;
  rotation: number;
}

/** Línea corporal (en píxeles del escenario) que gobierna la región. */
export function lineaCorporal(
  landmarks: Landmark[],
  region: BodyRegion,
  box: VideoBox,
): LineaCorporal | null {
  const regla = REGLA[region];
  const izquierdo = landmarks[regla.izquierdo];
  const derecho = landmarks[regla.derecho];
  if (!inRange(izquierdo) || !inRange(derecho)) return null;
  const proyectados = [
    videoToDisplay(izquierdo.x, izquierdo.y, box),
    videoToDisplay(derecho.x, derecho.y, box),
  ];
  // Se ordenan por posición en pantalla: con la cámara frontal la imagen va
  // espejada y los puntos se invierten, lo que daba una rotación de 180° y
  // dibujaba la prenda cabeza abajo.
  const [a, b] = proyectados.sort((p1, p2) => p1.px - p2.px);
  const spanPx = Math.hypot(b.px - a.px, b.py - a.py);
  if (spanPx < 1) return null;
  return {
    midX: (a.px + b.px) / 2,
    midY: (a.py + b.py) / 2,
    spanPx,
    rotation: Math.atan2(b.py - a.py, b.px - a.px),
  };
}

/** Revisa la postura y devuelve qué decirle a la persona. */
export function evaluarPostura(
  landmarks: Landmark[] | null,
  region: BodyRegion,
  box: VideoBox,
): Guidance {
  if (!landmarks || !landmarks.length)
    return { code: 'sin-persona', message: 'Ponete frente a la cámara, de cuerpo entero.', ok: false };

  const linea = lineaCorporal(landmarks, region, box);
  if (!linea)
    return {
      code: 'parcial',
      message: `Acomodate para que se vean ${REGLA[region].parte}.`,
      ok: false,
    };
  // Para una prenda de cuerpo entero hace falta ver también la cadera.
  if (region === 'full_body' && !(inRange(landmarks[LEFT_HIP]) && inRange(landmarks[RIGHT_HIP])))
    return { code: 'parcial', message: 'Alejate un poco: necesito verte de la cabeza a la cadera.', ok: false };

  const proporcion = linea.spanPx / Math.max(1, box.containerW);
  if (proporcion < MIN_ENCUADRE)
    return { code: 'lejos', message: 'Acercate un poco a la cámara.', ok: false };
  if (proporcion > MAX_ENCUADRE)
    return { code: 'cerca', message: 'Alejate un poco para verte completo.', ok: false };
  if (Math.abs(linea.rotation) > MAX_INCLINACION)
    return { code: 'inclinado', message: 'Ponete derecho y de frente.', ok: false };
  return { code: 'ok', message: 'Listo: movete y la prenda te sigue.', ok: true };
}

/**
 * Coloca la prenda sobre el cuerpo.
 *
 * La imagen se dibuja centrada en el escenario, así que se calcula cuánto
 * desplazarla para que su línea de anclaje caiga sobre la línea corporal, con
 * la escala que iguala ambos anchos y la misma inclinación.
 */
export function calcularAjuste(
  landmarks: Landmark[],
  region: BodyRegion,
  anchors: GarmentAnchors | null,
  imagen: { width: number; height: number },
  box: VideoBox,
): GarmentFit | null {
  const linea = lineaCorporal(landmarks, region, box);
  if (!linea || !imagen.width || !imagen.height) return null;

  // Sin anclajes se usa el ancho completo de la imagen a media altura: la
  // ubicación sigue siendo automática, apenas menos precisa.
  const par = anclajeDeRegion(anchors, region);
  const izquierda = par?.izquierda ?? [0, 0.12];
  const derecha = par?.derecha ?? [1, 0.12];

  const anchoAnclaje = Math.max(0.05, derecha[0] - izquierda[0]);
  const anchoDeseado = (linea.spanPx * REGLA[region].holgura) / anchoAnclaje;
  const scale = anchoDeseado / imagen.width;

  // Punto medio del anclaje, en píxeles de la imagen ya escalada, medido desde
  // el centro de la imagen (que es donde la ubica el navegador).
  const anclajeX = (izquierda[0] + derecha[0]) / 2;
  const anclajeY = (izquierda[1] + derecha[1]) / 2;
  const dx = (anclajeX - 0.5) * imagen.width * scale;
  const dy = (anclajeY - 0.5) * imagen.height * scale;

  // La imagen se rota alrededor de su centro: el vector al anclaje rota con ella.
  const cos = Math.cos(linea.rotation);
  const sin = Math.sin(linea.rotation);
  const centroX = linea.midX - (dx * cos - dy * sin);
  const centroY = linea.midY - (dx * sin + dy * cos);

  return {
    offsetX: centroX - box.containerW / 2,
    offsetY: centroY - box.containerH / 2,
    rotation: linea.rotation,
    scale,
  };
}

/** Mezcla exponencial entre el ajuste mostrado y el recién calculado, para que
 * la prenda no tiemble con el ruido de la detección. */
export function suavizarAjuste(actual: GarmentFit | null, objetivo: GarmentFit, k = 0.35): GarmentFit {
  if (!actual) return objetivo;
  const mezcla = (a: number, b: number) => a + (b - a) * k;
  return {
    offsetX: mezcla(actual.offsetX, objetivo.offsetX),
    offsetY: mezcla(actual.offsetY, objetivo.offsetY),
    rotation: mezcla(actual.rotation, objetivo.rotation),
    scale: mezcla(actual.scale, objetivo.scale),
  };
}
