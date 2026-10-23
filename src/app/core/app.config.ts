import {isDevMode} from '@angular/core';
import {provideServiceWorker} from '@angular/service-worker';
import {tenantInterceptor} from './tenant.interceptor';
import {planNoticeInterceptor} from './plan-notice.interceptor';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth.interceptor';
import { timeoutInterceptor } from './timeout.interceptor';
import { SessionService } from '../../features/usuarios-catalogo/application/session.service';

/** Cadena de interceptores, del más EXTERNO al más interno.
 *
 * El tiempo límite va SEGUNDO, o sea por dentro de authInterceptor: este llama
 * a `next()` dos veces (la petición original y el reintento posterior a renovar
 * el token) y cada llamada vuelve a entrar al interceptor de tiempo, así que el
 * reintento estrena su propio reloj. Al revés, el presupuesto cubriría también
 * la renovación y podría cortar el reintento a mitad de camino.
 *
 * Se exporta para que la prueba pueda fijar ese orden: una vez armada la cadena
 * ya no es observable desde fuera. */
export const interceptores = [tenantInterceptor, authInterceptor, planNoticeInterceptor, timeoutInterceptor];

export const appConfig: ApplicationConfig = {
  providers: [
    provideServiceWorker('ngsw-worker.js',{enabled:!isDevMode(),registrationStrategy:'registerWhenStable:30000'}),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors(interceptores)),
    provideAppInitializer(() => inject(SessionService).restore()),
  ],
};

