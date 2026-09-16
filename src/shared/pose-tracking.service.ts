import { Injectable } from '@angular/core';
import { extractPoseResult } from './pose-projection';
import type { Landmark } from './pose-projection';

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

/** Shape mínima del resultado de PoseLandmarker.detectForVideo. La API expone
 * las poses en `landmarks` (NormalizedLandmark[][]): no existe `poseLandmarks`.
 * Se tipa para que un cambio de contrato del CDN falle en compilación. */
export interface PoseLandmarkerResult {
  landmarks?: Landmark[][];
  worldLandmarks?: unknown[];
}

interface MediaPipeGlobal {
  FilesetResolver?: {
    forVisionTasks(wasmUrl: string): Promise<unknown>;
  };
  PoseLandmarker?: {
    createFromOptions(target: unknown, options: unknown): Promise<unknown>;
  };
}

@Injectable({ providedIn: 'root' })
export class PoseTrackingService {
  private landmarker: { detectForVideo(video: HTMLVideoElement, ts: number): PoseLandmarkerResult } | null =
    null;
  private init: Promise<boolean> | null = null;
  private lastRun = 0;

  ready(): boolean {
    return this.landmarker != null;
  }

  /** Prepara el modelo la primera vez. Devuelve false sin tirar errores cuando
   * no se puede (sin red, CDN caído, host no compatible): el vestidor manual
   * sigue disponible. Un fallo de descarga se puede reintentar con otra llamada. */
  ensure(): Promise<boolean> {
    if (this.landmarker) return Promise.resolve(true);
    if (!this.init) this.init = this.load();
    return this.init;
  }

  private async load(): Promise<boolean> {
    try {
      const win = window as unknown as Record<string, unknown>;
      const hasApi =
        typeof win['FilesetResolver'] === 'function' && typeof win['PoseLandmarker'] === 'function';
      if (!hasApi) {
        await this.loadScript(VISION_CDN);
      }
      const g = window as unknown as MediaPipeGlobal;
      if (!g.FilesetResolver || !g.PoseLandmarker) {
        return false;
      }
      const fileset = await g.FilesetResolver.forVisionTasks(WASM_URL);
      const poseLandmarker = await this.createLandmarker(fileset);
      this.landmarker = {
        detectForVideo: (video, ts) =>
          poseLandmarker.detectForVideo(video, ts) as PoseLandmarkerResult,
      };
      return true;
    } catch {
      this.landmarker = null;
      return false;
    } finally {
      // Un carga fallida se puede reintentar manualmente desde el vestidor.
      if (!this.landmarker) this.init = null;
    }
  }

  private async createLandmarker(
    fileset: unknown,
  ): Promise<{ detectForVideo(video: HTMLVideoElement, ts: number): PoseLandmarkerResult }> {
    const win = window as unknown as MediaPipeGlobal;
    const creator = win.PoseLandmarker!;
    const options = {
      baseOptions: {
        modelAssetPath: POSE_MODEL_URL,
        // GPU es más rápido pero puede fallar en equipos sin WebGL; en ese caso
        // se reintenta con CPU, que soporta el detector a esta cadencia.
        delegate: 'GPU' as const,
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };
    try {
      return (await creator.createFromOptions(fileset, options)) as {
        detectForVideo(video: HTMLVideoElement, ts: number): PoseLandmarkerResult;
      };
    } catch {
      return (await creator.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: 'CPU' as const },
      })) as {
        detectForVideo(video: HTMLVideoElement, ts: number): PoseLandmarkerResult;
      };
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = 'mediapipe-tasks-vision';
      // Un <script> que ya falló se descarta y se recrea: si se reutilizara con
      // el mismo src, su load no volvería a dispararse y la espera colgaría.
      const previous = document.getElementById(id);
      if (previous) previous.remove();
      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error('No se pudo descargar MediaPipe (sin conexión o CDN bloqueado).'));
      document.head.appendChild(script);
    });
  }

  /** Detecta la pose en el fotograma actual. Devuelve los landmarks de la pose
   * o null cuando no hay una detección reciente o la persona no está visible.
   * `video` es el elemento <video> con el stream activo. */
  detectTorso(video: HTMLVideoElement): Landmark[] | null {
    if (!this.landmarker || !video?.videoWidth) return null;
    const now = performance.now();
    if (now - this.lastRun < MIN_INTERVAL_MS) return null;
    this.lastRun = now;
    try {
      const result = this.landmarker.detectForVideo(video, now);
      return extractPoseResult(result);
    } catch {
      return null;
    }
  }

  dispose() {
    try {
      (this.landmarker as { close?: () => void } | null)?.close?.();
    } catch {
      /* el landmarker se libera solo */
    }
    this.landmarker = null;
    this.init = null;
  }
}