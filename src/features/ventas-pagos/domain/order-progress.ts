/**
 * Etapas por las que pasa un pedido, para mostrarlas como una línea de tiempo.
 *
 * El backend guarda un estado (`status`) y un historial (`tracking`) con la
 * fecha de cada cambio. Acá se traduce eso a etapas con nombre, para que el
 * cliente vea dónde está su pedido sin tener que interpretar códigos.
 *
 * Funciones puras: se pueden verificar sin componente ni navegador.
 */
import { Order } from './commerce.models';

export type EstadoEtapa = 'hecha' | 'actual' | 'pendiente' | 'cancelada';

export interface EtapaPedido {
  clave: string;
  titulo: string;
  detalle: string;
  icono: string;
  estado: EstadoEtapa;
  /** Fecha en que ocurrió, si ya pasó. */
  fecha?: string;
}

/** Orden en que avanza un pedido normal. */
const SECUENCIA = ['pending_payment', 'paid', 'processing', 'shipped', 'delivered'];

interface Plantilla {
  clave: string;
  titulo: string;
  detalle: string;
  icono: string;
  /** Estados del pedido que implican que esta etapa ya ocurrió. */
  alcanzadaEn: string[];
}

const PLANTILLAS: Plantilla[] = [
  {
    clave: 'pending_payment',
    titulo: 'Pedido realizado',
    detalle: 'Recibimos tu pedido y reservamos las prendas.',
    icono: 'cart',
    alcanzadaEn: SECUENCIA,
  },
  {
    clave: 'paid',
    titulo: 'Pago confirmado',
    detalle: 'El pago quedó acreditado.',
    icono: 'check',
    alcanzadaEn: ['paid', 'processing', 'shipped', 'delivered'],
  },
  {
    clave: 'processing',
    titulo: 'En preparación',
    detalle: 'Estamos armando tu pedido en la tienda.',
    icono: 'box',
    alcanzadaEn: ['processing', 'shipped', 'delivered'],
  },
  {
    clave: 'shipped',
    titulo: 'En camino',
    detalle: 'El pedido salió con el repartidor.',
    icono: 'arrow-right',
    alcanzadaEn: ['shipped', 'delivered'],
  },
  {
    clave: 'delivered',
    titulo: 'Entregado',
    detalle: 'El pedido llegó a destino.',
    icono: 'users',
    alcanzadaEn: ['delivered'],
  },
];

/** Fecha del primer evento del historial con ese estado. */
function fechaDe(order: Order, clave: string): string | undefined {
  const evento = (order.tracking || []).find((t) => t.status === clave);
  if (evento?.date) return evento.date;
  // El pedido siempre empieza por su creación, aunque no haya evento cargado.
  if (clave === 'pending_payment') return order.created_at;
  if (clave === 'paid' && order.payment_status === 'paid') return order.created_at;
  return undefined;
}

/**
 * Etapas del pedido con su estado actual.
 *
 * Un pedido cancelado no sigue avanzando: se conserva lo que alcanzó a pasar y
 * se cierra con la cancelación, en vez de mostrar etapas futuras que ya no van
 * a ocurrir.
 */
export function etapasDelPedido(order: Order): EtapaPedido[] {
  const cancelado = order.status === 'cancelled' || order.status === 'expired';
  const pagado = order.payment_status === 'paid';
  const indiceActual = SECUENCIA.indexOf(order.status);

  const etapas: EtapaPedido[] = PLANTILLAS.map((plantilla, indice) => {
    const alcanzada =
      plantilla.alcanzadaEn.includes(order.status) ||
      // El pago puede estar acreditado aunque el pedido siga en preparación.
      (plantilla.clave === 'paid' && pagado);
    let estado: EstadoEtapa = alcanzada ? 'hecha' : 'pendiente';
    if (alcanzada && indice === Math.max(indiceActual, pagado && indiceActual < 1 ? 1 : indiceActual))
      estado = 'actual';
    if (cancelado && !alcanzada) estado = 'cancelada';
    return {
      clave: plantilla.clave,
      titulo: plantilla.titulo,
      detalle: plantilla.detalle,
      icono: plantilla.icono,
      estado,
      fecha: alcanzada ? fechaDe(order, plantilla.clave) : undefined,
    };
  });

  if (cancelado) {
    const evento = (order.tracking || []).find((t) => t.status === order.status);
    etapas.push({
      clave: order.status,
      titulo: order.status === 'expired' ? 'Pago vencido' : 'Pedido cancelado',
      detalle:
        order.status === 'expired'
          ? 'Venció el plazo de pago y se liberaron las prendas.'
          : 'El pedido fue cancelado y las prendas volvieron al stock.',
      icono: 'close',
      estado: 'actual',
      fecha: evento?.date,
    });
  }
  return etapas;
}

/** Avance del pedido, de 0 a 100, para dibujar la barra de progreso. */
export function progresoPedido(etapas: EtapaPedido[]): number {
  const avanzables = etapas.filter((e) => e.clave !== 'cancelled' && e.clave !== 'expired');
  if (avanzables.length < 2) return 0;
  const hechas = avanzables.filter((e) => e.estado === 'hecha' || e.estado === 'actual').length;
  return Math.round(((hechas - 1) / (avanzables.length - 1)) * 100);
}

/** Dónde está el pedido ahora, en una frase. */
export function resumenPedido(order: Order): string {
  const etapas = etapasDelPedido(order);
  const actual = etapas.find((e) => e.estado === 'actual');
  if (!actual) return 'Sin novedades por ahora.';
  if (actual.clave === 'shipped' && order.tracking_number)
    return `${actual.detalle} Seguimiento ${order.tracking_number}${order.carrier ? ' · ' + order.carrier : ''}.`;
  return actual.detalle;
}
