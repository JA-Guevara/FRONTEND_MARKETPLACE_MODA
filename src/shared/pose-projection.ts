/** Proyección de la postura (MediaPipe Pose) al posicionamiento de la prenda
 * en el escenario del vestidor. Funciones PURAS: sin DOM y sin MediaPipe, para
 * poder probarlas aisladas. El seguimiento mueve la prenda y ajusta escala e
 * inclinación a los hombros; no promete talla, tela ni comportamiento 3D. */

export interface Landmark {
  x: number;
  y: number;
  visibility?: number;
}

export interface VideoBox {
  /** Dimensiones reales del fotograma (video.videoWidth/Height). */
  videoW: number;
  videoH: number;
  /** Dimensiones del contenedor donde se muestra el video (el escenario). */
  containerW: number;
  containerH: number;
  /** Cámara frontal reflejada (facingMode 'user'). */
  mirrored: boolean;
}

export interface TorsoPose {
  /** Desplazamiento del centro del torso respecto del centro del escenario (px). */
  offsetX: number;
  offsetY: number;
  /** Inclinación de los hombros en el espacio de pantalla (radianes). */
  rotation: number;
  /** Ancho de hombros en píxeles de pantalla (para escalar la prenda). */
  shoulderPx: number;
}

export const LEFT_SHOULDER = 11;
export const RIGHT_SHOULDER = 12;
export const LEFT_HIP = 23;
export const RIGHT_HIP = 24;

/** Período sin detección válida tras el cual se considera a la persona fuera
 * del encuadre (en milisegundos). */
export const POSE_LOST_MS = 1200;

/** Un landmark es utilizable si está dentro del rango [0..1] y, cuando MediaPipe
 * informa confianza, tiene visibilidad aceptable. Estar en rango por sí solo no
 * demuestra que la articulación sea visible. */
export function inRange(p: Landmark | undefined): p is Landmark {
  return !!p && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 && (p.visibility ?? 1) >= 0.5;
}

/** Extrae la primera pose del resultado REAL de PoseLandmarker. La API expone
 * los resultados en `result.landmarks` (NormalizedLandmark[][]), no en
 * `poseLandmarks`. Devuelve null para cualquier otra forma del resultado. */
export function extractPoseResult(result: unknown): Landmark[] | null {
  if (!result || typeof result !== 'object') return null;
  const landmarks = (result as { landmarks?: Landmark[][] }).landmarks;
  const pose = Array.isArray(landmarks) && Array.isArray(landmarks[0]) ? landmarks[0] : null;
  return pose && pose.length ? pose : null;
}

/** Centro del torso: punto medio de los hombros, bajado ~18% hacia el centro de
 * las caderas para ubicar la prenda sobre el pecho. Devuelve null si hay
 * landmarks no visibles. */
export function torsoCenter(landmarks: Landmark[]): Landmark | null {
  const ls = landmarks[LEFT_SHOULDER];
  const rs = landmarks[RIGHT_SHOULDER];
  const lh = landmarks[LEFT_HIP];
  const rh = landmarks[RIGHT_HIP];
  if (!inRange(ls) || !inRange(rs) || !inRange(lh) || !inRange(rh)) return null;
  const sx = (ls.x + rs.x) / 2;
  const sy = (ls.y + rs.y) / 2;
  const hy = (lh.y + rh.y) / 2;
  return { x: sx, y: sy + (hy - sy) * 0.18 };
}

/** Escala de "cubrir" (object-fit: cover): cuánto crece el video para llenar el
 * contenedor recortando los bordes, y dónde queda centrado. */
export function coverActive(
  videoW: number,
  videoH: number,
  containerW: number,
  containerH: number,
): { scale: number; offsetX: number; offsetY: number } {
  const scale = Math.max(containerW / videoW, containerH / videoH);
  return {
    scale,
    offsetX: (containerW - videoW * scale) / 2,
    offsetY: (containerH - videoH * scale) / 2,
  };
}

/** Convierte una coordenada normalizada del video [0..1] a píxeles mostrados en
 * pantalla, teniendo en cuenta el recorte por cover, el centrado y el reflejo
 * de la cámara frontal. */
export function videoToDisplay(
  nx: number,
  ny: number,
  box: VideoBox,
): { px: number; py: number } {
  const cover = coverActive(box.videoW, box.videoH, box.containerW, box.containerH);
  const x = box.mirrored ? 1 - nx : nx;
  return {
    px: cover.offsetX + x * box.videoW * cover.scale,
    py: cover.offsetY + ny * box.videoH * cover.scale,
  };
}

/** Postura del torso ya proyectada al escenario (posición, inclinación y ancho
 * de hombros en px de pantalla). No puede calcularse sin ambos hombros. */
export function shoulderPose(landmarks: Landmark[], box: VideoBox): TorsoPose | null {
  const ls = landmarks[LEFT_SHOULDER];
  const rs = landmarks[RIGHT_SHOULDER];
  if (!inRange(ls) || !inRange(rs)) return null;
  const lsd = videoToDisplay(ls.x, ls.y, box);
  const rsd = videoToDisplay(rs.x, rs.y, box);
  const shoulderPx = Math.hypot(rsd.px - lsd.px, rsd.py - lsd.py);
  if (shoulderPx < 1) return null;
  let cy = (lsd.py + rsd.py) / 2;
  const lh = landmarks[LEFT_HIP];
  const rh = landmarks[RIGHT_HIP];
  if (inRange(lh) && inRange(rh)) {
    const lhd = videoToDisplay(lh.x, lh.y, box);
    const rhd = videoToDisplay(rh.x, rh.y, box);
    cy += (((lhd.py + rhd.py) / 2) - cy) * 0.18;
  }
  const cx = (lsd.px + rsd.px) / 2;
  return {
    offsetX: cx - box.containerW / 2,
    offsetY: cy - box.containerH / 2,
    rotation: Math.atan2(rsd.py - lsd.py, rsd.px - lsd.px),
    shoulderPx,
  };
}

/** Escala relativa para que la prenda acompañe el ancho de hombros medido. */
export function scaleFromShoulders(shoulderPx: number, referencePx: number) {
  return referencePx > 0 ? shoulderPx / referencePx : 1;
}

/** (Compatibilidad con proyecciones simples) convierte el torso normalizado al
 * desplazamiento respecto del centro del escenario sin tener en cuenta cover. */
export function poseOffset(torso: Landmark, mirrored: boolean, stageW: number, stageH: number) {
  const nx = mirrored ? 1 - torso.x : torso.x;
  return {
    offsetX: stageW * (nx - 0.5),
    offsetY: stageH * (torso.y - 0.5),
  };
}

/** Suavizado exponencial entre el valor actual y el objetivo (evita "saltos"). */
export function smoothPose<T extends { x: number; y: number }>(
  current: T,
  target: T,
  k: number,
): T {
  return {
    ...current,
    x: current.x + (target.x - current.x) * k,
    y: current.y + (target.y - current.y) * k,
  };
}