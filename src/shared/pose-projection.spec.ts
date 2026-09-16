import { describe, expect, it } from 'vitest';
import {
  torsoCenter,
  poseOffset,
  smoothPose,
  coverActive,
  videoToDisplay,
  shoulderPose,
  scaleFromShoulders,
  extractPoseResult,
  inRange,
  LEFT_SHOULDER,
  RIGHT_SHOULDER,
  LEFT_HIP,
  RIGHT_HIP,
  Landmark,
  VideoBox,
} from './pose-projection';

const SHOULDERS_Y = 0.3;
const HIPS_Y = 0.6;

function posed(x: number): Landmark[] {
  const l: Landmark[] = [];
  l[LEFT_SHOULDER] = { x: x - 0.1, y: SHOULDERS_Y, visibility: 0.99 };
  l[RIGHT_SHOULDER] = { x: x + 0.1, y: SHOULDERS_Y, visibility: 0.99 };
  l[LEFT_HIP] = { x: x - 0.12, y: HIPS_Y, visibility: 0.95 };
  l[RIGHT_HIP] = { x: x + 0.12, y: HIPS_Y, visibility: 0.95 };
  return l;
}

const BOX: VideoBox = { videoW: 640, videoH: 480, containerW: 320, containerH: 360, mirrored: false };

describe('pose-projection (seguimiento corporal del vestidor)', () => {
  describe('extracción del resultado real de MediaPipe', () => {
    it('lee la pose desde `result.landmarks`, la propiedad documentada', () => {
      const pose = posed(0.5);
      const out = extractPoseResult({ landmarks: [pose], worldLandmarks: [] });
      expect(out).toBe(pose);
    });
    it('no toma `poseLandmarks` (no existe en la API) y devuelve null en formas ajenas', () => {
      expect(extractPoseResult({ poseLandmarks: [posed(0.5)] })).toBeNull();
      expect(extractPoseResult(null)).toBeNull();
      expect(extractPoseResult({})).toBeNull();
      expect(extractPoseResult({ landmarks: [] })).toBeNull();
      expect(extractPoseResult({ landmarks: [[{}], []] })![0]).toEqual({});
    });
  });

  it('ubica el centro del torso entre los hombros, ligeramente hacia el pecho', () => {
    const torso = torsoCenter(posed(0.5));
    expect(torso!.x).toBeCloseTo(0.5, 5);
    expect(torso!.y).toBeCloseTo(0.3 + (0.6 - 0.3) * 0.18, 5);
  });

  it('no da objetivo si los hombros/caderas no son visibles o están fuera de confianza', () => {
    const l = posed(0.5);
    l[LEFT_SHOULDER] = { x: -1, y: -1 };
    expect(torsoCenter(l)).toBeNull();
    expect(torsoCenter([])).toBeNull();
    const low = posed(0.5);
    low[RIGHT_HIP] = { x: 0.5, y: 0.6, visibility: 0.1 };
    expect(torsoCenter(low)).toBeNull();
    expect(inRange({ x: 0.9, y: 0.9, visibility: 0.4 })).toBe(false);
    expect(inRange({ x: 0.9, y: 0.9 })).toBe(true);
  });

  it('convierte el torso a desplazamiento en píxeles del escenario', () => {
    const torso = torsoCenter(posed(0.5))!;
    const out = poseOffset(torso, false, 300, 400);
    expect(out.offsetX).toBeCloseTo(0, 5);
    expect(out.offsetY).toBeCloseTo(400 * (torso.y - 0.5), 5);
  });

  it('invierte el eje X con la cámara frontal (espejada)', () => {
    const torso = { x: 0.75, y: 0.5 };
    const front = poseOffset(torso, true, 300, 400);
    const back = poseOffset(torso, false, 300, 400);
    expect(front.offsetX).toBeCloseTo(-back.offsetX, 5);
  });

  it('suaviza la posición hacia el objetivo sin sobrepasarse', () => {
    const next = smoothPose({ x: 0, y: 0 }, { x: 100, y: 40 }, 0.5);
    expect(next.x).toBe(50);
    expect(next.y).toBe(20);
  });

  describe('object-fit: cover y mapeo contenedor', () => {
    it('calcula el recorte y el centrado del video', () => {
      // Video 4:3 en contenedor 4:3 → sin recorte, escala = contenedor/video.
      expect(coverActive(640, 480, 320, 240)).toEqual({ scale: 0.5, offsetX: 0, offsetY: 0 });
      // Contenedor más alto (4:3 → cubrir vertical): se recorta el ancho del video.
      const cover = coverActive(640, 480, 320, 360);
      expect(cover.scale).toBeCloseTo(0.75, 5);
      expect(cover.offsetX).toBeCloseTo(-80, 5);
      expect(cover.offsetY).toBe(0);
      // Contenedor más ancho: se recorta alto y el video se centra verticalmente.
      const cover2 = coverActive(640, 480, 480, 320);
      expect(cover2.scale).toBeCloseTo(0.75, 5);
      expect(cover2.offsetY).toBeCloseTo(-20, 5);
    });
    it('mapea coordenadas normalizadas a píxeles mostrados respetando cover y centrado', () => {
      const p = videoToDisplay(0.5, 0.5, BOX);
      expect(p.px).toBeCloseTo(160, 5); // centro del contenedor
      expect(p.py).toBeCloseTo(180, 5);
      // El borde derecho del video queda recortado por cover: su píxel de pantalla
      // cae fuera del contenedor.
      const edge = videoToDisplay(1, 1, BOX);
      expect(edge.px).toBeCloseTo(400, 5);
      expect(edge.py).toBeCloseTo(360, 5);
      // El borde visible del contenedor corresponde a nx = (320 + 80) / 480.
      const visible = videoToDisplay(400 / 480, 0, BOX);
      expect(visible.px).toBeCloseTo(320, 5);
    });
    it('refleja la cámara frontal antes de mapear', () => {
      const front = videoToDisplay(0.75, 0.5, { ...BOX, mirrored: true });
      const back = videoToDisplay(0.25, 0.5, BOX);
      expect(front.px).toBeCloseTo(back.px, 5);
      expect(front.py).toBeCloseTo(back.py, 5);
    });
  });

  describe('postura de hombros proyectada', () => {
    it('calcula posición, ancho de hombros e inclinación en pantalla', () => {
      const pose = posed(0.5);
      pose[RIGHT_SHOULDER] = { x: 0.6, y: 0.32, visibility: 0.99 }; // hombro derecho más bajo
      const out = shoulderPose(pose, BOX);
      // Box 640x480 en contenedor 320x360 → cover scale 0.75, offsetX -80, offsetY 0.
      const dxPx = 0.2 * 640 * 0.75;
      const dyPx = 0.02 * 480 * 0.75;
      expect(out!.offsetX).toBeCloseTo(0, 5); // centrado
      expect(out!.shoulderPx).toBeCloseTo(Math.hypot(dxPx, dyPx), 5);
      expect(out!.rotation).toBeCloseTo(Math.atan2(dyPx, dxPx), 5);
      // La prenda sigue el pecho: hombro medio (0.31) bajado 18% hacia las caderas.
      const chestY = 0.31 + (0.6 - 0.31) * 0.18;
      expect(out!.offsetY).toBeCloseTo(chestY * BOX.containerH - BOX.containerH / 2, 5);
    });
    it('requiere ambos hombros visibles', () => {
      const pose = posed(0.5);
      pose[RIGHT_SHOULDER] = { x: -1, y: -1 };
      expect(shoulderPose(pose, BOX)).toBeNull();
    });
    it('conserva la posición al reflejar (el espejo no debe mover el torso)', () => {
      const a = shoulderPose(posed(0.65), BOX);
      const b = shoulderPose(posed(0.35), { ...BOX, mirrored: true });
      expect(a!.offsetX).toBeCloseTo(b!.offsetX, 3);
    });
  });

  it('escala la prenda según el ancho de hombros respecto de una referencia', () => {
    expect(scaleFromShoulders(100, 200)).toBe(0.5);
    expect(scaleFromShoulders(100, 0)).toBe(1);
  });
});