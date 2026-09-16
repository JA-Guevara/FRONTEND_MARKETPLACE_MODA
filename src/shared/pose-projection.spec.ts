import { describe, expect, it } from 'vitest';
import {
  torsoCenter,
  poseOffset,
  smoothPose,
  LEFT_SHOULDER,
  RIGHT_SHOULDER,
  LEFT_HIP,
  RIGHT_HIP,
  Landmark,
} from './pose-projection';

const SHOULDERS_Y = 0.3;
const HIPS_Y = 0.6;

function posed(x: number): Landmark[] {
  const l: Landmark[] = [];
  l[LEFT_SHOULDER] = { x: x - 0.1, y: SHOULDERS_Y };
  l[RIGHT_SHOULDER] = { x: x + 0.1, y: SHOULDERS_Y };
  l[LEFT_HIP] = { x: x - 0.12, y: HIPS_Y };
  l[RIGHT_HIP] = { x: x + 0.12, y: HIPS_Y };
  return l;
}

describe('pose-projection (seguimiento corporal del vestidor)', () => {
  it('ubica el centro del torso entre los hombros, ligeramente hacia el pecho', () => {
    const torso = torsoCenter(posed(0.5));
    expect(torso!.x).toBeCloseTo(0.5, 5);
    expect(torso!.y).toBeCloseTo(0.3 + (0.6 - 0.3) * 0.18, 5);
  });

  it('no da objetivo si los hombros/caderas no son visibles', () => {
    const l = posed(0.5);
    l[LEFT_SHOULDER] = { x: -1, y: -1 };
    expect(torsoCenter(l)).toBeNull();
    expect(torsoCenter([])).toBeNull();
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
});