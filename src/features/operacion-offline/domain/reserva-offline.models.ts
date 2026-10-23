export type EstadoOperacion =
  'PENDIENTE' | 'ENVIADA' | 'CONFIRMADA' | 'RECHAZADA' | 'CONFLICTO' | 'ANULADA';
export type EstadoReservaLocal =
  'PENDIENTE_CONFIRMACION' | 'ANULADA_LOCAL' | 'CONFIRMADA' | 'RECHAZADA';
export interface ReservaLocal {
  id: string;
  tenant_id: string;
  sucursal_id: string;
  usuario_id: string;
  cliente_id: string | null;
  agendada_para: string;
  notas: string;
  estado: EstadoReservaLocal;
  creada_en: string;
}
export interface ItemReservaLocal {
  reserva_id: string;
  variante_id: string;
  cantidad: number;
}
export interface CrearReservaPayload {
  branch_id: string;
  scheduled_at: string;
  items: { variant_id: string; quantity: number }[];
  notes: string;
  client_key: string;
  origin: 'OFFLINE';
  device_id: string;
  client_created_at: string;
  customer_id?: string;
}
export interface OperacionPendiente {
  id: string;
  tipo: 'RESERVA';
  estado: EstadoOperacion;
  tenant_id: string;
  sucursal_id: string;
  usuario_id: string;
  dispositivo_id: string;
  payload: CrearReservaPayload;
  intentos: number;
  ultimo_error: string | null;
  creada_en: string;
  actualizada_en: string;
}
export interface ReservaLocalVista {
  reserva: ReservaLocal;
  items: ItemReservaLocal[];
  operacion: OperacionPendiente;
}
export const MAX_VARIANTES = 20,
  MAX_UNIDADES = 10;
export function puedeAgregar(
  items: Pick<ItemReservaLocal, 'variante_id' | 'cantidad'>[],
  varianteId: string,
  cantidad: number,
  stockLocal: number,
): string | null {
  const current = items.find((x) => x.variante_id === varianteId)?.cantidad ?? 0;
  if (!Number.isInteger(cantidad) || cantidad < 1)
    return 'La cantidad debe ser un entero positivo.';
  if (current + cantidad > MAX_UNIDADES) return 'Máximo 10 unidades por variante.';
  if (!current && items.length >= MAX_VARIANTES) return 'Máximo 20 variantes por reserva.';
  if (current + cantidad > stockLocal) return 'Sin existencia local suficiente';
  return null;
}
export function validarVisita(fecha: Date, ahora: Date): string | null {
  return !Number.isFinite(fecha.getTime()) || fecha <= ahora
    ? 'La visita debe tener una fecha y hora futura.'
    : null;
}
export function construirPayload(
  r: ReservaLocal,
  items: ItemReservaLocal[],
  device: string,
): CrearReservaPayload {
  return {
    branch_id: r.sucursal_id,
    scheduled_at: new Date(r.agendada_para).toISOString(),
    items: items.map((i) => ({ variant_id: i.variante_id, quantity: i.cantidad })),
    notes: r.notas,
    client_key: r.id,
    origin: 'OFFLINE',
    device_id: device,
    client_created_at: r.creada_en,
    ...(r.cliente_id ? { customer_id: r.cliente_id } : {}),
  };
}
export function puedeCancelarLocal(op: Pick<OperacionPendiente, 'estado'>) {
  return op.estado === 'PENDIENTE';
}
