import { Injectable } from '@angular/core';
import { Landmark, torsoCenter } from './pose-projection';

/** MediaPipe Tasks Vision se descarga desde su CDN en tiempo de ejecución (no
 * se incluye en el bundle de Angular). Si no se puede descargar o el
 * navegador/red no lo permite, el vestidor sigue funcionando con el ajuste
 * manual: el seguimiento es una mejora opcional que nunca interrumpe la cámara. */
const VISION_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.js';
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const MIN_INTERVAL_MS = 130;

@Injectable({ providedIn: 'root' })
export class PoseTrackingService {
  private landmarker: any = null;
  private init: Promise<boolean> | null = null;
  private lastRun = 0;

  ready(): boolean {
    return this.landmarker != null;
  }

  /** Prepara el modelo la primera vez. Devuelve false sin tirar errores cuando
   * no se puede (sin red, CDN caído, host no compatible): el vestidor manual
   * sigue disponible. */
  ensure(): Promise<boolean> {
    if (this.landmarker) return Promise.resolve(true);
    if (!this.init) this.init = this.load();
    return this.init;
  }

  private async load(): Promise<boolean> {
    try {
      await this.loadScript(VISION_CDN);
      const win = window as any;
      if (!win.FilesetResolver || !win.PoseLandmarker) return false;
      const fileset = await win.FilesetResolver.forVisionTasks(WASM_URL);
      this.landmarker = await win.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      return true;
    } catch {
      this.landmarker = null;
      return false;
    } finally {
      // El init fallido se puede reintentar manualmente desde el vestidor.
      if (!this.landmarker) this.init = null;
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = 'mediapipe-tasks-vision';
      const existing = document.getElementById(id) as HTMLScriptElement | null;
      if (existing && existing.dataset['loaded'] === 'true') {
        resolve();
        return;
      }
      const script = existing ?? document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset['loaded'] = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error('No se pudo descargar MediaPipe.'));
      if (!existing) document.head.appendChild(script);
    });
  }

  /** Detecta el torso en el fotograma actual (coordenadas normalizadas [0..1]).
   * Devuelve null mientras no haya una detección fresca o la pose no esté
   * visible. `video` es el elemento <video> con el stream activo. */
  detectTorso(video: HTMLVideoElement): Landmark | null {
    if (!this.landmarker || !video?.videoWidth) return null;
    const now = performance.now();
    if (now - this.lastRun < MIN_INTERVAL_MS) return null;
    this.lastRun = now;
    try {
      const result = this.landmarker.detectForVideo(video, now);
      const pose = result?.poseLandmarks?.[0] as Landmark[] | undefined;
      if (!pose?.length) return null;
      return torsoCenter(pose);
    } catch {
      return null;
    }
  }

  dispose() {
    try {
      this.landmarker?.close?.();
    } catch {
      /* el landmarker se libera solo */
    }
    this.landmarker = null;
    this.init = null;
  }
}