import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const [service, routes, pos] = await Promise.all([
  read('src/features/ventas-pagos/infrastructure/commerce.service.ts'),
  read('src/app/core/app.routes.ts'),
  read('src/features/ventas-pagos/presentation/pos-page.component.ts'),
]);
const checks = [
  [service, "'/commerce' + path", 'El servicio de comercio debe mantener su prefijo de API.'],
  [routes, "path: 'caja'", 'La ruta de Caja debe estar registrada.'],
  [routes, "permission: 'commerce.write'", 'Caja debe requerir permiso de escritura comercial.'],
  [pos, "'/admin/pos/sales'", 'Caja debe usar el endpoint de venta presencial.'],
  [pos, 'client_request_id', 'Caja debe enviar una clave idempotente.'],
];
for (const [source, expected, message] of checks) {
  if (!source.includes(expected)) throw new Error(message);
}
console.log(`Contrato web verificado: ${checks.length} garantías.`);
