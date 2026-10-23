import { openOfflineDb } from './offline-db';
export async function getDeviceId(): Promise<string> {
  const db = await openOfflineDb();
  try {
    const tx = db.transaction('meta', 'readwrite');
    let value = (await tx.store.get('dispositivo_id'))?.valor as string | undefined;
    if (!value) {
      value = 'web-' + crypto.randomUUID();
      await tx.store.put({ clave: 'dispositivo_id', valor: value });
    }
    await tx.done;
    return value;
  } finally {
    db.close();
  }
}
