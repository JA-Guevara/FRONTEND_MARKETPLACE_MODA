import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { throwError, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { errorDeTiempoLimite } from '../../shared/errors';

/** Presupuestos de espera, en milisegundos.
 *
 * Va como token inyectable —y no como constante— para que las pruebas puedan
 * bajarlo a unos pocos milisegundos y medir el corte con temporizadores REALES.
 * Con `vi.useFakeTimers()` el planificador de rxjs deja de avanzar y choca con
 * HttpTestingController, así que se evita por completo. */
export interface LimitesHttp {
  /** Petición normal: si a los 30 s no contestó, algo se colgó del otro lado. */
  normal: number;
  /** Subidas, Excel, IA y descargas: tardan de verdad y cortarlas sería un error. */
  largo: number;
}
export const LIMITES_HTTP = new InjectionToken<LimitesHttp>('LIMITES_HTTP', {
  providedIn: 'root',
  factory: () => ({ normal: 30_000, largo: 180_000 }),
});

/** Rutas con trabajo pesado del lado del servidor que NO se pueden cortar a los
 * 30 s. Las subidas y las descargas se detectan por forma (FormData / blob), así
 * que acá solo quedan las que mandan y reciben JSON: IA, Excel y probador. */
const RUTAS_LARGAS = [
  '/commerce/assistant', // asistente y transcripción de voz (hasta 60 s medidos)
  '/catalog/admin/products', // borrador con IA y edición que dispara avisos a favoritos
  '/analytics/insights',
  '/analytics/assistant',
  '/analytics/reports',
  '/bulk/',
  '/media/images',
  '/tryon-ai/jobs', // consultar el estado dispara la generación de la foto IA
  '/vestidor/admin',
];

function esNuestraApi(url: string) {
  // Mismo filtro que authInterceptor: nunca tocamos peticiones a terceros.
  return url === environment.apiUrl || url.startsWith(environment.apiUrl + '/');
}

function esLarga(request: HttpRequest<unknown>) {
  // Un cuerpo FormData es siempre una subida (imágenes, Excel, foto del
  // probador, audio del asistente) y un `responseType: 'blob'` es siempre una
  // descarga generada al vuelo (reportes, plantillas, PDF del comprobante).
  // Detectarlas por forma evita listar los ~10 llamadores uno por uno.
  if (request.body instanceof FormData) return true;
  if (request.responseType === 'blob') return true;
  const ruta = request.url.slice(environment.apiUrl.length);
  return RUTAS_LARGAS.some((prefijo) => ruta.startsWith(prefijo));
}

/**
 * Corta las peticiones que se quedan colgadas para que el spinner no gire para
 * siempre. Sin esto, un backend congelado dejaba la pantalla esperando sin fin.
 *
 * ORDEN DE REGISTRO: va DESPUÉS de authInterceptor, o sea más adentro de la
 * cadena. authInterceptor llama a `next()` dos veces (la original y el reintento
 * tras renovar el token) y cada llamada vuelve a entrar acá, así que el reintento
 * arranca con el reloj en cero. Si el tiempo límite estuviera por fuera, el
 * presupuesto cubriría original + renovación + reintento y cortaría el reintento
 * a mitad de camino, que es justo lo que hay que evitar.
 */
export const timeoutInterceptor: HttpInterceptorFn = (request, next) => {
  if (!esNuestraApi(request.url)) return next(request);
  const limites = inject(LIMITES_HTTP);
  const ms = esLarga(request) ? limites.largo : limites.normal;
  return next(request).pipe(
    timeout({ each: ms, with: () => throwError(() => errorDeTiempoLimite(request.url)) }),
  );
};
