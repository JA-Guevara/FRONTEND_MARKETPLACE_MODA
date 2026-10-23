import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { User } from '../../../shared/models';
import { openOfflineDb } from './offline-db';
import { authGuard } from '../auth.guard';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
let pendingWrite: Promise<void> = Promise.resolve();
export function saveOfflineProfile(user: User): Promise<void> {
  pendingWrite = pendingWrite.catch(() => {}).then(() => writeOfflineProfile(user));
  return pendingWrite;
}
async function writeOfflineProfile(user: User) {
  const db = await openOfflineDb();
  try {
    const safe: User = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      is_active: user.is_active,
      is_verified: user.is_verified,
      roles: user.roles.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        is_active: r.is_active,
        permissions: r.permissions.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          is_active: p.is_active,
        })),
      })),
      tenant: user.tenant,
      subscription: user.subscription,
    };
    await db.put('meta', { clave: 'usuario_offline', valor: safe });
  } finally {
    db.close();
  }
}
export async function readOfflineProfile(): Promise<User | null> {
  await pendingWrite.catch(() => {});
  const db = await openOfflineDb();
  try {
    return ((await db.get('meta', 'usuario_offline'))?.valor as User | null) ?? null;
  } finally {
    db.close();
  }
}
export function clearOfflineProfile(): Promise<void> {
  pendingWrite = pendingWrite.catch(() => {}).then(() => deleteOfflineProfile());
  return pendingWrite;
}
async function deleteOfflineProfile() {
  const db = await openOfflineDb();
  try {
    await db.delete('meta', 'usuario_offline');
  } finally {
    db.close();
  }
}
export const offlineGuard: CanActivateFn = (route, state) => {
  const session = inject(SessionService),
    router = inject(Router);
  if (navigator.onLine && !session.offlineSession()) return authGuard(route, state);
  return readOfflineProfile().then((user) => {
    if (user?.is_active && user.tenant?.status === 'ACTIVA') {
      session.user.set(user);
      session.offlineSession.set(true);
      return true;
    }
    return router.createUrlTree(['/iniciar-sesion'], { queryParams: { returnUrl: state.url } });
  });
};
