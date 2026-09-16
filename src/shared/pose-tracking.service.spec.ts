import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PoseTrackingService } from './pose-tracking.service';
import { LEFT_SHOULDER, RIGHT_SHOULDER } from './pose-projection';

function videoStub(width = 640, height = 480) {
  const video = document.createElement('video');
  Object.defineProperty(video, 'videoWidth', { configurable: true, value: width });
  Object.defineProperty(video, 'videoHeight', { configurable: true, value: height });
  return video;
}

describe('PoseTrackingService (contrato con PoseLandmarker)', () => {
  let service: PoseTrackingService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PoseTrackingService] });
    service = TestBed.inject(PoseTrackingService);
  });

  it('lee la pose del resultado real: `landmarks` (no `poseLandmarks`)', () => {
    const poseLandmarks = [
      { x: 0.4, y: 0.3, z: 0, visibility: 0.99 },
      { x: 0.6, y: 0.3, z: 0, visibility: 0.99 },
    ];
    poseLandmarks[LEFT_SHOULDER] = { x: 0.45, y: 0.3, z: 0, visibility: 0.99 };
    poseLandmarks[RIGHT_SHOULDER] = { x: 0.55, y: 0.3, z: 0, visibility: 0.99 };
    const detectForVideo = vi.fn().mockReturnValue({
      landmarks: [poseLandmarks],
      worldLandmarks: [],
    });
    (service as unknown as {
      landmarker: { detectForVideo: typeof detectForVideo };
    }).landmarker = { detectForVideo };

    const out = service.detectTorso(videoStub());
    expect(detectForVideo).toHaveBeenCalledOnce();
    expect(out).toBe(poseLandmarks);
  });

  it('no detecta si el resultado solo trae `poseLandmarks` (propiedad inexistente)', () => {
    (service as unknown as {
      landmarker: { detectForVideo: () => unknown };
    }).landmarker = { detectForVideo: () => ({ poseLandmarks: [[]] }) };
    expect(service.detectTorso(videoStub())).toBeNull();
  });

  it('no intenta procesar un resultado sin poses ni un video sin fotograma', () => {
    const detectForVideo = vi.fn().mockReturnValue({ landmarks: [] });
    (service as unknown as {
      landmarker: { detectForVideo: typeof detectForVideo };
    }).landmarker = { detectForVideo };
    expect(service.detectTorso(videoStub())).toBeNull();
    expect(detectForVideo).toHaveBeenCalledOnce();
    // Un video sin stream (videoWidth 0) no se pasa al detector.
    const w0 = videoStub(0, 0);
    expect(service.detectTorso(w0)).toBeNull();
    expect(detectForVideo).toHaveBeenCalledOnce();
  });

  it('dispose libera el detector y permite volver a inicializar', () => {
    const close = vi.fn();
    (service as unknown as { landmarker: { close: typeof close } }).landmarker = { close };
    service.dispose();
    expect(close).toHaveBeenCalledOnce();
    expect(service.ready()).toBe(false);
  });
});