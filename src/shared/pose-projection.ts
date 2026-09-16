/** Proyección de la postura (MediaPipe Pose) al posicionamiento de la prenda
 * en el escenario del vestidor. Funciones PURAS: sin DOM y sin MediaPipe, para
 * poder probarlas aisladas. El seguimiento de la postura solo mueve la prenda
 * (sigue el torso); la escala sigue siendo manual y se explica en pantalla. */

export interface Landmark {
  x: number;
  y: number;
}

export const LEFT_SHOULDER = 11;
export const RIGHT_SHOULDER = 12;
export const LEFT_HIP = 23;
export const RIGHT_HIP = 24;

/** Centro del torso: punto medio de los hombros, bajado ~18% hacia el centro de
 * las caderas para ubicar la prenda sobre el pecho. Devuelve null si hay
 * landmarks no visibles (x o y negativas / fuera de rango). */
export function torsoCenter(landmarks: Landmark[]): Landmark | null {
  const ls = landmarks[LEFT_SHOULDER];
  const rs = landmarks[RIGHT_SHOULDER];
  const lh = landmarks[LEFT_HIP];
  const rh = landmarks[RIGHT_HIP];
  for (const p of [ls, rs, lh, rh]) {
    if (!p || p.x < 0 || p.y < 0 || p.x > 1 || p.y > 1) return null;
  }
  const sx = (ls.x + rs.x) / 2;
  const sy = (ls.y + rs.y) / 2;
  const hy = (lh.y + rh.y) / 2;
  return { x: sx, y: sy + (hy - sy) * 0.18 };
}

/** Convierte el torso (en coordenadas de imagen [0..1]) al desplazamiento de la
 * prenda respecto del centro del escenario (px). La cámara frontal se muestra
 * espejada, por eso se invierte el eje X cuando `mirrored` es true. */
export function poseOffset(torso: Landmark, mirrored: boolean, stageW: number, stageH: number) {
  const nx = mirrored ? 1 - torso.x : torso.x;
  return {
    offsetX: stageW * (nx - 0.5),
    offsetY: stageH * (torso.y - 0.5),
  };
}

/** Suavizado exponencial entre la posición actual y el objetivo de la postura
 * (evita que la prenda "salté" entre frames). */
export function smoothPose(current: { x: number; y: number }, target: { x: number; y: number }, k: number) {
  return {
    x: current.x + (target.x - current.x) * k,
    y: current.y + (target.y - current.y) * k,
  };
}