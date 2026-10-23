import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import {
  saveOfflineProfile,
  readOfflineProfile,
  clearOfflineProfile,
  offlineGuard,
} from './offline-session';
import { OFFLINE_DB, openOfflineDb } from './offline-db';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
import { authGuard } from '../auth.guard';
import { User } from '../../../shared/models';
const user: User = {
  id: 'u',
  email: 'u@example.com',
  first_name: 'Persona',
  last_name: 'Local',
  phone: null,
  is_active: true,
  is_verified: true,
  roles: [],
  tenant: { id: 't', slug: 'moda', trade_name: 'Moda', status: 'ACTIVA' },
};
describe('Perfil desconectado y autenticación remota', () => {
  beforeEach(async () => {
    await clearOfflineProfile();
    await deleteDB(OFFLINE_DB);
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });
  afterEach(async () => {
    await clearOfflineProfile();
    await deleteDB(OFFLINE_DB);
    sessionStorage.clear();
    TestBed.inject(HttpTestingController).verify();
  });
  it('solo persiste campos públicos, nunca tokens ni contraseña', async () => {
    await saveOfflineProfile({
      ...user,
      password: 'secreto',
      access_token: 'bearer',
      refresh_token: 'refresh',
    } as User);
    const db = await openOfflineDb();
    const saved = JSON.stringify(await db.get('meta', 'usuario_offline'));
    db.close();
    expect(saved).not.toContain('bearer');
    expect(saved).not.toContain('refresh');
    expect(saved).not.toContain('secreto');
    expect(await readOfflineProfile()).toMatchObject({ id: 'u' });
  });
  it('cerrar y volver a ingresar serializa perfil para no revivir cuenta anterior', async () => {
    const first = saveOfflineProfile(user);
    const clearing = clearOfflineProfile();
    const next = saveOfflineProfile({ ...user, id: 'otro' });
    await Promise.all([first, clearing, next]);
    expect((await readOfflineProfile())?.id).toBe('otro');
  });
  it('error de red restaura perfil local pero guardia remota exige login', async () => {
    await saveOfflineProfile(user);
    sessionStorage.setItem('fashionstore.refresh', 'refresh-prueba');
    const s = TestBed.inject(SessionService);
    const pending = s.restore();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/refresh')
      .error(new ProgressEvent('error'));
    await pending;
    expect(s.offlineSession()).toBe(true);
    expect(s.accessToken).toBeUndefined();
    const result = TestBed.runInInjectionContext(() =>
      authGuard({ data: {} } as any, { url: '/admin' } as any),
    );
    expect(TestBed.inject(Router).serializeUrl(result as any)).toContain('iniciar-sesion');
    const local = await TestBed.runInInjectionContext(() =>
      offlineGuard({ data: {} } as any, { url: '/sin-conexion' } as any),
    );
    expect(local).toBe(true);
  });
  it('un 401 revocado borra perfil en vez de habilitar modo local', async () => {
    await saveOfflineProfile(user);
    sessionStorage.setItem('fashionstore.refresh', 'revocado');
    const s = TestBed.inject(SessionService);
    const p = s.restore();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/refresh')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await p;
    expect(s.user()).toBeNull();
    expect(await readOfflineProfile()).toBeNull();
  });
});
