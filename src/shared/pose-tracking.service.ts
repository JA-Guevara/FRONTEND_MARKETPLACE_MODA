import { Injectable } from '@angular/core';
import { extractPoseResult } from './pose-projection';
import type { Landmark } from './pose-projection';

/** MediaPipe Tasks Vision se descarga desde su CDN en tiempo de ejecución (no
 * se incluye en el bundle de Angular). Si no se puede descargar o el
 * navegador/red no lo permite, el vestidor sigue funcionando con el ajuste
 * manual: el seguimiento es una mejora opcional que nunca interrumpe la cámara. */
const VISION_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
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

interface PoseDetector {
  detectForVideo(video: HTMLVideoElement, ts: number): PoseLandmarkerResult;
  close(): void;
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
  private landmarker: PoseDetector | null = null;
  private generation = 0;
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
    if (!this.init) this.init = this.load(++this.generation);
    return this.init;
  }

  private importModule(url: string): Promise<MediaPipeGlobal> {
    // El paquete 0.10.14 publica un módulo ES .mjs; no publica vision_bundle.js
    // ni expone FilesetResolver/PoseLandmarker como variables de window.
    return import(/* @vite-ignore */ url);
  }

  private async initialize(generation: number): Promise<boolean> {
    const api = await this.importModule(VISION_CDN);
    if (generation !== this.generation) return false;
    if (!api.FilesetResolver || !api.PoseLandmarker) return false;
    const fileset = await api.FilesetResolver.forVisionTasks(WASM_URL);
    if (generation !== this.generation) return false;
    const detector = await this.createLandmarker(fileset, api);
    if (generation !== this.generation) {
      detector.close();
      return false;
    }
    // Conservar el objeto real: el wrapper anterior descartaba close() y
    // dejaba recursos de WASM/GPU abiertos al abandonar el probador.
    this.landmarker = detector;
    return true;
  }

  private async load(generation: number): Promise<boolean> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        this.initialize(generation),
        new Promise<boolean>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Tiempo de carga agotado.')), 20000);
        }),
      ]);
      if (!result && generation === this.generation) this.init = null;
      return result;
    } catch {
      if (generation === this.generation) {
        ++this.generation; // descartar/liberar cualquier detector tardío
        this.landmarker = null;
        this.init = null;
      }
      return false;
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  private async createLandmarker(
    fileset: unknown,
    api: MediaPipeGlobal,
  ): Promise<PoseDetector> {
    const creator = api.PoseLandmarker!;
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
      return (await creator.createFromOptions(fileset, options)) as PoseDetector;
    } catch {
      return (await creator.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: 'CPU' as const },
      })) as PoseDetector;
    }
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
    ++this.generation;
    this.lastRun = 0;
    try {
      (this.landmarker as { close?: () => void } | null)?.close?.();
    } catch {
      /* el landmarker se libera solo */
    }
    this.landmarker = null;
    this.init = null;
  }
}