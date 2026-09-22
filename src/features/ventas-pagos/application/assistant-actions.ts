import { assistantIntent } from './assistant-intent';

/**
 * Registro central y tipado de las acciones que el asistente puede realizar.
 *
 * El asistente NUNCA invoca endpoints de forma libre: cada frase se resuelve a
 * una acción declarada aquí (id, módulo, permiso y riesgo) y el widget la
 * ejecuta únicamente a través de los endpoints existentes ya autorizados por
 * el backend (RBAC + bitácora). El parseo es determinista y testeable; el
 * backend sigue siendo la autoridad final de permisos, aunque el front filtra
 * antes de abrir formularios, borradores o tarjetas de confirmación.
 */

export type ActionRisk = 'read' | 'draft' | 'confirm' | 'restricted';

export interface ParsedAction {
  id: string;
  data: Record<string, unknown>;
}

export interface AssistantAction {
  id: string;
  module: string;
  /** Permiso RBAC que exige la acción; `null` para flujos de cliente público. */
  permission: string | null;
  risk: ActionRisk;
  examples: string[];
  parse(text: string): ParsedAction | null;
}

/** Normalización ligera para el parseo: minúsculas y sin acentos. */
function norm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Las consultas de "cómo hacer" son chat, no órdenes a ejecutar. */
const QUESTION = /\b(como|donde|cual(es)?|que es|que son|para que|para cuando|que debo)\b/;
function isQuestion(t: string): boolean {
  return QUESTION.test(t);
}

/** Un pedido de descarga/archivo es un reporte, no una bandeja del chat. */
const EXPORT_WORDS = /\b(export\w*|descarg\w*|bajame|enviame|mandame|pasame|excel|xlsx|pdf|csv)\b/;
function wantsFile(t: string): boolean {
  return EXPORT_WORDS.test(t);
}

/** Sujetos de catálogo ("prenda", "producto", prendas concretas…). */
const PRODUCT_WORDS =
  /\b(prenda|producto|ropa|polera|camisa|camiseta|remera|pantalon|campera|chaqueta|vestido|falda|short|buzo|casaca)\b/;

/** Sujetos de usuario ("usuario", "cuenta", roles operativos…). */
const USER_WORDS =
  /\b(usuarios?|cuentas?|empleados?|clientes?|administradores?|vendedores?|repartidores?|personas?)\b/;

function emailOf(t: string): string | null {
  return t.match(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/)?.[0] ?? null;
}

/** Nombre de persona tras el sujeto: "usuario Ana Pérez con correo…". */
function nameOf(t: string): string | null {
  return (
    t.match(
      /(?:usuario|cuenta|empleado|cliente|persona)\s+(?:de\s+|al\s+|a\s+|para\s+)?([a-záéíóúüñ]+(?:\s+[a-záéíóúüñ]+){0,2}?)(?=(?:\s+(?:con|del|de|y)\b|\s+correo|\s+email|$))/,
    )?.[1] ?? null
  );
}

/** Nombre de prenda tras el sustantivo: "campera de cuero negra". */
function productNameOf(t: string): string | null {
  const match = t.match(
    /(?:prenda|producto|ropa|polera|camisa|camiseta|remera|pantalon|campera|chaqueta|vestido|falda|short|buzo|casaca)\s+(?:de\s+)?([a-záéíóúüñ][a-záéíóúüñ \d]*?)(?=\s+(?:por|de\b.*\ben|para|a\s)|$)/,
  );
  if (!match) return null;
  const name = match[1]?.trim();
  return name ? name.replace(/\s{2,}/g, ' ') : null;
}

/** Grupo de acciones por módulo, en orden de especificidad descendente. */
export const ASSISTANT_ACTIONS: AssistantAction[] = [
  // ---------------- Usuarios, roles y permisos (PAQ-01) ----------------
  {
    id: 'user.search',
    module: 'usuarios',
    permission: 'users.read',
    risk: 'read',
    examples: ['Buscá al usuario ana@ejemplo.com', 'Buscalo al usuario Ana Pérez'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      if (!/\bbusca\w*|encontrame|buscame\b/.test(t)) return null;
      if (!USER_WORDS.test(t) && !emailOf(t)) return null;
      return { id: 'user.search', data: { email: emailOf(t), name: nameOf(t) } };
    },
  },
  {
    id: 'user.show_inactive',
    module: 'usuarios',
    permission: 'users.read',
    risk: 'read',
    examples: ['Mostrame los usuarios inactivos', 'Listame las cuentas desactivadas'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t) || wantsFile(t)) return null;
      const verb = /\b(mostra\w*|muestra\w*|lista\w*|filtra\w*)\b/.test(t);
      const inactive = /\b(inactiv\w*|desactivad\w*|bloquead\w*)\b/.test(t);
      if (verb && inactive && USER_WORDS.test(t)) return { id: 'user.show_inactive', data: {} };
      return null;
    },
  },
  {
    id: 'user.create',
    module: 'usuarios',
    permission: 'users.write',
    risk: 'draft',
    examples: ['Creá un usuario para Ana Pérez con correo ana@ejemplo.com'],
    parse(text) {
      return assistantIntent(text) === 'user_draft' ? { id: 'user.create', data: {} } : null;
    },
  },
  {
    id: 'user.change_role',
    module: 'usuarios',
    permission: 'users.write',
    risk: 'confirm',
    examples: ['Cambiale el rol de Ana a Vendedora', 'Poné el rol Analista a la cuenta seleccionada'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      if (!/\b(rol|roles|permisos)\b/.test(t) || !/\b(cambi\w*|actualiza\w*|asign\w*|pone\w*|pon\b)\b/.test(t)) return null;
      const explicit = t.match(/rol\s+de\s+([a-záéíóúüñ][a-záéíóúüñ\s]*?)\s+a\s+([a-záéíóúüñ][a-záéíóúüñ\s]*?)$/);
      if (explicit) {
        return {
          id: 'user.change_role',
          data: { target: explicit[1].trim(), role: explicit[2].trim() },
        };
      }
      const role = t.match(/rol\s+(?:nuevo\s+|a\s+)?([a-záéíóúüñ][a-záéíóúüñ\s]*?(?=\s+para\b|\s+de\b|$))/)?.[1]?.trim();
      const target = nameOf(t) ?? emailOf(t);
      if (role && target) return { id: 'user.change_role', data: { target, role } };
      return null;
    },
  },
  {
    id: 'user.unlock',
    module: 'usuarios',
    permission: 'users.write',
    risk: 'confirm',
    examples: ['Desbloqueá al usuario ana@ejemplo.com'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      if (!/\bdesbloque\w*|desbloquea\w*|reactiva\w*\b/.test(t) || (emailOf(t) === null && nameOf(t) === null)) return null;
      return { id: 'user.unlock', data: { email: emailOf(t), target: nameOf(t) } };
    },
  },
  {
    id: 'user.deactivate',
    module: 'usuarios',
    permission: 'users.write',
    risk: 'confirm',
    examples: ['Desactivá al usuario ana@ejemplo.com'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      const verb = /\b(desactiv\w*|dar\s+de\s+baja)\b/.test(t);
      const target = emailOf(t) ?? nameOf(t);
      if (verb && target && USER_WORDS.test(t)) {
        return { id: 'user.deactivate', data: { email: emailOf(t), target: nameOf(t) ?? emailOf(t) } };
      }
      return null;
    },
  },
  {
    id: 'user.activate',
    module: 'usuarios',
    permission: 'users.write',
    risk: 'confirm',
    examples: ['Activá al usuario ana@ejemplo.com'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      const verb = /\bactiv\w*\b/.test(t) && !/\bdesactiv/.test(t);
      if (verb && USER_WORDS.test(t) && (emailOf(t) || nameOf(t))) {
        return { id: 'user.activate', data: { email: emailOf(t), target: nameOf(t) ?? emailOf(t) } };
      }
      return null;
    },
  },
  {
    id: 'user.deleted',
    module: 'usuarios',
    permission: 'users.write',
    risk: 'restricted',
    examples: ['Eliminá al usuario ana@ejemplo.com (operación restringida)'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      const verb = /\b(elimin\w*|borr\w*|suprim\w*)\b/.test(t);
      if (verb && USER_WORDS.test(t) && (emailOf(t) || nameOf(t))) {
        return { id: 'user.deleted', data: { email: emailOf(t), target: nameOf(t) ?? emailOf(t) } };
      }
      return null;
    },
  },

  // ---------------- Catálogo y productos (PAQ-01) ----------------
  {
    id: 'product.create',
    module: 'catalogo',
    permission: 'catalog.write',
    risk: 'draft',
    examples: ['Registrame una campera de cuero negra a 450 Bs'],
    parse(text) {
      return assistantIntent(text) === 'draft' ? { id: 'product.create', data: {} } : null;
    },
  },
  {
    id: 'category.create',
    module: 'catalogo',
    permission: 'catalog.write',
    risk: 'draft',
    examples: ['Creá una categoría llamada Accesorios'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      const creating = /\b(cre\w*|registr\w*|agreg\w*|dar\s+de\s+alta|nueva)\b/.test(t);
      if (!creating || !/\bcategor[íi]a\b/.test(t)) return null;
      const name = t.match(/categor[íi]a\s+(?:llamad\w*\s+|nueva\s+)?([a-záéíóúüñ][a-záéíóúüñ\s\d]*?)(?=\s+para\b|$)/)?.[1]?.trim();
      return { id: 'category.create', data: name ? { name } : {} };
    },
  },
  {
    id: 'product.open',
    module: 'catalogo',
    permission: 'catalog.read',
    risk: 'read',
    examples: ['Abrí la ficha de la campera de cuero negra'],
    parse(text) {
      const t = norm(text);
      if (!/\b(abr\w*|editar\w*|ficha\w*)\b/.test(t) || !PRODUCT_WORDS.test(t)) return null;
      return { id: 'product.open', data: { name: productNameOf(t) } };
    },
  },
  {
    id: 'product.deactivate',
    module: 'catalogo',
    permission: 'catalog.write',
    risk: 'confirm',
    examples: ['Desactivá la campera de cuero negra'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      if (!/\b(desactiv\w*|dar\s+de\s+baja|sacar\s+de\s+venta)\b/.test(t)) return null;
      if (!PRODUCT_WORDS.test(t) && !/\bseleccionad\w*|esta\b/.test(t)) return null;
      return { id: 'product.deactivate', data: { name: productNameOf(t) } };
    },
  },
  {
    id: 'product.bulk',
    module: 'catalogo',
    permission: 'catalog.write',
    risk: 'draft',
    examples: ['Prepará una carga masiva de prendas por Excel'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      const bulk = /\b(carga\s+masiva|carga\s+por\s+(?:excel|lote)|importac\w*\s+(?:masiv\w*|lot\w*)|cargar\s+excel)\b/;
      const file = /\b(excel|xlsx|csv)\b/;
      if ((bulk.test(t) || (file.test(t) && /\b(carga|import|masiv)\w*/i.test(t))) && /\b(prenda|producto|catalogo)\b/.test(t)) {
        return { id: 'product.bulk', data: {} };
      }
      return null;
    },
  },

  // ---------------- Inventario, sucursales y proveedores (PAQ-02) ----------------
  {
    id: 'stock.low',
    module: 'inventario',
    permission: 'dashboard.read',
    risk: 'read',
    examples: ['Prendas con stock menor a 5', 'Existencias con stock bajo'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t) || wantsFile(t)) return null;
      if (!/\b(stock|existencias|inventario)\b/.test(t) && !/\bmenor\s+(?:a\s+)?\d/.test(t)) return null;
      if (!/\b(menor|menos|bajo|debajo|baj[oa]s)\b/.test(t)) return null;
      const max = t.match(/menor\s+(?:a\s+|de\s+|que\s+)?(\d+)/)?.[1]
        ?? t.match(/menos\s+(?:de\s+)?(\d+)/)?.[1]
        ?? t.match(/baj[oa]\s+(?:a\s+|de\s+)?(\d+)/)?.[1];
      return { id: 'stock.low', data: { max: max ? Number(max) : 5 } };
    },
  },
  {
    id: 'stock.receipt',
    module: 'inventario',
    permission: 'stock.write',
    risk: 'confirm',
    examples: ['Registrá una entrada de 20 unidades de la campera', 'Ingresá 30 unidades a existencias'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t) || wantsFile(t)) return null;
      const entrada = /\b(entrada|ingres\w*|recepcion|recibo|stock\b.*entra)\b/.test(t);
      const contexto = /\b(unidades?|uds|items?|piezas?|stock|existencias|mercaderia|variante)\b/.test(t);
      if (!entrada || !contexto) return null;
      const quantity = t.match(/(\d+)\s*(?:unidades?|uds|items?|piezas?)/)?.[1];
      return {
        id: 'stock.receipt',
        data: { quantity: quantity ? Number(quantity) : null, variant: productNameOf(t) },
      };
    },
  },
  {
    id: 'stock.adjustment',
    module: 'inventario',
    permission: 'stock.write',
    risk: 'confirm',
    examples: ['Hacé un ajuste de stock de la campera'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t) || wantsFile(t)) return null;
      if (!/\bajust\w*\s+(?:de\s+)?(stock|existencias|inventario)\b/.test(t)) return null;
      return { id: 'stock.adjustment', data: { variant: productNameOf(t) } };
    },
  },
  {
    id: 'stock.transfer',
    module: 'inventario',
    permission: 'stock.write',
    risk: 'confirm',
    examples: ['Transferí 10 unidades de la Central a la sucursal Norte'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t) || wantsFile(t)) return null;
      if (!/\b(transfer\w*|trasladar|mover|pas[ea]r)\b/.test(t)) return null;
      if (!/\b(unidades|stock|existencias|entre\s+sucursales|sucursal)\b/.test(t)) return null;
      const pier = t.match(/de\s+([a-záéíóúüñ][a-záéíóúüñ\s]*?)\s+a\s+([a-záéíóúüñ][a-záéíóúüñ\s]*?)$/i);
      const quantity = t.match(/(\d+)\s*(?:unidades?|uds)?/)?.[1];
      return {
        id: 'stock.transfer',
        data: {
          quantity: quantity ? Number(quantity) : null,
          from: pier?.[1]?.trim() ?? null,
          to: pier?.[2]?.trim() ?? null,
          variant: productNameOf(t),
        },
      };
    },
  },
  {
    id: 'supplier.create',
    module: 'inventario',
    permission: 'suppliers.write',
    risk: 'draft',
    examples: ['Creá un proveedor llamado Cuero Andino SRL'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      const creating = /\b(cre\w*|registr\w*|agreg\w*|dar\s+de\s+alta|nueva)\b/.test(t);
      if (!creating || !/\bproveedor\b/.test(t)) return null;
      const name = t.match(/proveedor\s+(?:llamad\w*\s+|nuev\w*\s+)?([a-záéíóúüñ][a-záéíóúüñ\s\d]*?)(?=\s+con\b|\s+y\b|$)/)?.[1]?.trim();
      return { id: 'supplier.create', data: name ? { business_name: name } : {} };
    },
  },
  {
    id: 'supplier.inactive',
    module: 'inventario',
    permission: 'suppliers.read',
    risk: 'read',
    examples: ['Mostrame los proveedores inactivos'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t) || wantsFile(t)) return null;
      const show = /\b(mostra\w*|muestra\w*|lista\w*|filtra\w*)\b/.test(t);
      if (show && /\bproveedores?\b/.test(t) && /\b(inactiv\w*|desactivad\w*)\b/.test(t)) {
        return { id: 'supplier.inactive', data: {} };
      }
      return null;
    },
  },
  {
    id: 'branch.create',
    module: 'inventario',
    permission: 'branches.write',
    risk: 'draft',
    examples: ['Creá una sucursal en la zona norte'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      const creating = /\b(cre\w*|registr\w*|agreg\w*|abrir|nueva)\b/.test(t);
      if (!creating || !/\bsucursal\b/.test(t)) return null;
      const name = t.match(/sucursal\s+(?:en\s+|de\s+|llamad\w*\s+|nuev\w*\s+)?([a-záéíóúüñ][a-záéíóúüñ\s\d]*?)(?=\s+con\b|\s+para\b|$)/)?.[1]?.trim();
      return { id: 'branch.create', data: name ? { name } : {} };
    },
  },

  // ---------------- Reservas y vestidor (PAQ-03) ----------------
  {
    id: 'reservation.pending_today',
    module: 'reservas',
    permission: 'reservations.read',
    risk: 'read',
    examples: ['Mostrame las reservas pendientes de hoy'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t) || wantsFile(t)) return null;
      if (!/\breservas?\b/.test(t)) return null;
      if (!/\bpendientes?\b/.test(t) || !/\b(hoy|dia|fecha)\b/.test(t)) return null;
      return { id: 'reservation.pending_today', data: {} };
    },
  },
  {
    id: 'reservation.by_branch',
    module: 'reservas',
    permission: 'reservations.read',
    risk: 'read',
    examples: ['Mostrame las reservas de la sucursal central'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t) || wantsFile(t)) return null;
      if (!/\breservas?\b/.test(t) || !/\bsucursal\b/.test(t)) return null;
      const branch = t.match(/sucursal\s+(?:de\s+|en\s+|del\s+)?([a-záéíóúüñ][a-záéíóúüñ\s]*?$)/)?.[1]?.trim();
      return { id: 'reservation.by_branch', data: branch ? { branch_name: branch } : {} };
    },
  },
  {
    id: 'reservation.create',
    module: 'reservas',
    permission: null,
    risk: 'draft',
    examples: ['Reservá esta prenda para mañana a las 15:00'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      if (!/\b(reserv\w*|agend\w*)\b/.test(t) || !/\b(prenda|producto|ropa|vestido|campera)\b/.test(t)) return null;
      return { id: 'reservation.create', data: {} };
    },
  },
  {
    id: 'reservation.confirm',
    module: 'reservas',
    permission: 'reservations.write',
    risk: 'confirm',
    examples: ['Confirmá la reserva de las 15:00 de hoy'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      if (!/\bconfirm\w*\s+(?:la\s+)?reserva\b|\breserva\b.*\bconfirm\w*\b/.test(t)) return null;
      return { id: 'reservation.confirm', data: {} };
    },
  },
  {
    id: 'reservation.cancel',
    module: 'reservas',
    permission: 'reservations.write',
    risk: 'confirm',
    examples: ['Cancelá la reserva de hoy'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      if (!/\bcancel\w*\s+(?:la\s+)?reserva\b|\breserva\b.*\bcancel\w*\b/.test(t)) return null;
      return { id: 'reservation.cancel', data: {} };
    },
  },
  {
    id: 'reservation.arrived',
    module: 'reservas',
    permission: 'reservations.write',
    risk: 'confirm',
    examples: ['Marcá que llegó el cliente de la reserva'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      if (!/\b(llego\w*|atendid\w*|asistio\w*)\b/.test(t) || !/\breserva\b/.test(t)) return null;
      const verb = /\b(mar\w*|señal\w*|determin\w*|indica\w*)\b/.test(t) || /\bcliente\b/.test(t);
      if (!verb) return null;
      return { id: 'reservation.arrived', data: {} };
    },
  },

  // ---------------- Pedidos, pagos y devoluciones (PAQ-04) ----------------
  {
    id: 'order.pending_payment',
    module: 'pedidos',
    permission: 'commerce.read',
    risk: 'read',
    examples: ['Mostrame los pedidos pendientes de pago'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t) || wantsFile(t)) return null;
      if (!/\bpedidos?\b/.test(t) || !/\bpago\b/.test(t) || !/\bpendientes?/.test(t)) return null;
      return { id: 'order.pending_payment', data: {} };
    },
  },
  {
    id: 'order.delivered',
    module: 'pedidos',
    permission: 'commerce.read',
    risk: 'read',
    examples: ['Mostrame los pedidos entregados'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t) || wantsFile(t)) return null;
      if (/\b(cambi\w*|actualiza\w*)\b/.test(t)) return null;
      if (!/\bpedidos?\b/.test(t) || !/\b(entregad\w*|enviad\w*)\b/.test(t)) return null;
      return { id: 'order.delivered', data: {} };
    },
  },
  {
    id: 'payment.rejected',
    module: 'pedidos',
    permission: 'commerce.read',
    risk: 'read',
    examples: ['Mostrame los pagos rechazados'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t) || wantsFile(t)) return null;
      if (!(/\bpagos?\b/.test(t) && /\b(rechazad\w*|fallid\w*|declinad\w*|expirad\w*|vencid\w*)\b/.test(t))) return null;
      return { id: 'payment.rejected', data: {} };
    },
  },
  {
    id: 'order.change_status',
    module: 'pedidos',
    permission: 'commerce.write',
    risk: 'confirm',
    examples: ['Cambiá el estado del pedido FS-123 a entregado'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      if (!/\b(estado|estatus|cambio\s+de\s+estado)\b/.test(t) || !/\b(cambi\w*|actualiza\w*)\b/.test(t)) return null;
      if (!/\b(pedido|orden)\b/i.test(t) && !/\b\d{3,}\b/.test(t)) return null;
      const number = t.match(/\b(?:fs\s?[- ]?[a-z0-9]{3,}|\d{3,})\b/i)?.[0] ?? null;
      const newStatus = /\benviad\w*\b/.test(t)
        ? 'shipped'
        : /\bentregad\w*\b/.test(t)
          ? 'delivered'
          : /\bprocesand\w*|en\s+proceso\b/.test(t)
            ? 'processing'
            : null;
      if (!newStatus) return null;
      return { id: 'order.change_status', data: { order_number: number, new_status: newStatus } };
    },
  },
  {
    id: 'order.carrier',
    module: 'pedidos',
    permission: 'commerce.write',
    risk: 'confirm',
    examples: ['Asigná el transportista Correos a FS-123 cuando se despache'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      if (!/\b(transportista|carrier|courier|correo\s+privado|entregad\w*)\b/.test(t) || !/\b(pedido|orden|fs\b|\d{3,})/.test(t)) return null;
      const number = t.match(/\b(?:fs\s?[- ]?[a-z0-9]{3,}|\d{3,})\b/i)?.[0] ?? null;
      const carrier = t.match(/(?:a|al|con|el|del)\s+transportista\s+([a-záéíóúüñ][a-záéíóúüñ\s]{2,40}?)(?=\s+para\b|\s+de\b|$)/)?.[1]?.trim()
        ?? t.match(/\btransporte\s+(?:a\s+)?([a-záéíóúüñ]+)/)?.[1] ?? null;
      if (!number && !carrier) return null;
      return { id: 'order.carrier', data: { order_number: number, carrier } };
    },
  },
  {
    id: 'order.register_return',
    module: 'pedidos',
    permission: 'commerce.write',
    risk: 'restricted',
    examples: ['Registrá la devolución del pedido FS-123 (operación restringida)'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      if (!/\bdevolucion\w*|devolv\w*\b/.test(t)) return null;
      if (!/\bpedido\b|\borden\b|\b\d{3,}\b/.test(t)) return null;
      const number = t.match(/\b(?:fs\s?[- ]?[a-z0-9]{3,}|\d{3,})\b/i)?.[0] ?? null;
      return { id: 'order.register_return', data: { order_number: number } };
    },
  },

  // ---------------- Promociones y cupones (PAQ-04) ----------------
  {
    id: 'promotion.create',
    module: 'promociones',
    permission: 'commerce.write',
    risk: 'draft',
    examples: ['Creá un cupón ESTUDIANTE10 de 10% de descuento', 'Prepará una promoción de envío gratis'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      const creating =
        /\b(cre\w*|registr\w*|agreg\w*|prepar\w*|nueva)\b/.test(t) ||
        /\b(quiero|necesito)\b/.test(t);
      if (!creating) return null;
      const target = /\b(cupon|promocion|promo|campa[ñn]a)\b/.test(t);
      if (!target) return null;
      const code = t.match(/\b([a-z0-9][a-z0-9_-]{1,19})\b/)?.[1]?.toUpperCase() ?? null;
      const percent = t.match(/(\d{1,3})\s*%/)?.[1];
      const freeShipping = /\benvio\s*gratis|envio\s*sin\s+cargo\b/.test(t);
      return {
        id: 'promotion.create',
        data: {
          code,
          percent: percent ? Number(percent) : null,
          type: freeShipping ? 'free_shipping' : percent ? 'percent' : 'percent',
        },
      };
    },
  },
  {
    id: 'promotion.expired',
    module: 'promociones',
    permission: 'commerce.read',
    risk: 'read',
    examples: ['Mostrame las promociones vencidas'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t) || wantsFile(t)) return null;
      if (!/\bpromociones?\b/.test(t) && !/\bcupones?\b/.test(t)) return null;
      if (!/\bvencid\w*|expirad\w*|finaliz\w*\b/.test(t)) return null;
      return { id: 'promotion.expired', data: {} };
    },
  },
  {
    id: 'promotion.deactivate',
    module: 'promociones',
    permission: 'commerce.write',
    risk: 'confirm',
    examples: ['Desactivá el cupón ESTUDIANTE10'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      if (!/\b(desactiv\w*|dar\s+de\s+baja|elimin\w*)\b/.test(t)) return null;
      if (!/\b(cupon|promocion|promo|campa[ñn]a)\b/.test(t)) return null;
      const code = t.match(/\b([a-z0-9][a-z0-9_-]{1,19})\b/)?.[1]?.toUpperCase() ?? null;
      return { id: 'promotion.deactivate', data: { code } };
    },
  },

  // ---------------- Vestidor virtual / recursos IA (PAQ-03) ----------------
  {
    id: 'vestidor.pending',
    module: 'vestidor',
    permission: 'catalog.read',
    risk: 'read',
    examples: ['Mostrame los recursos en revisión del vestidor'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t) || wantsFile(t)) return null;
      const vest = /\b(vestidor|probador|recurso|modelo\s+3d)\b/.test(t);
      const estado = /\b(pendientes?|en\s+revision|fallidos?|en\s+espera)\b/.test(t);
      if (vest && estado) return { id: 'vestidor.pending', data: {} };
      return null;
    },
  },
  {
    id: 'vestidor.open',
    module: 'vestidor',
    permission: null,
    risk: 'read',
    examples: ['Abrí el vestidor de la campera de cuero negra'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      if (!/\b(abr\w*|usa\w*|vestime)\b/.test(t) || !/\bvestidor\b/.test(t)) return null;
      return { id: 'vestidor.open', data: { name: productNameOf(t) } };
    },
  },
  {
    id: 'vestidor.retry',
    module: 'vestidor',
    permission: 'catalog.write',
    risk: 'confirm',
    examples: ['Reintentá el recurso que falló del vestidor'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      if (!/\b(reintent\w*|reproces\w*)\b/.test(t) || !/\b(recurso|prenda|vestidor|fall[oó]\w*)\b/.test(t)) return null;
      return { id: 'vestidor.retry', data: { name: productNameOf(t) } };
    },
  },
  {
    id: 'vestidor.review',
    module: 'vestidor',
    permission: 'catalog.write',
    risk: 'draft',
    examples: ['Prepará la revisión humana de los recursos pendientes'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      const review = /\brevision\s+human\w*\b|\brevis\w*\s+antes\s+de\s+aprobar\b|\bcola\s+de\s+revision\b/.test(t);
      if (review) return { id: 'vestidor.review', data: {} };
      return null;
    },
  },

  // ---------------- Reportes y dashboard (PAQ-05 analítico) ----------------
  {
    id: 'report.explain',
    module: 'reportes',
    permission: 'dashboard.read',
    risk: 'read',
    examples: ['Explicame por qué bajaron los pedidos pagados'],
    parse(text) {
      return assistantIntent(text) === 'explain' ? { id: 'report.explain', data: {} } : null;
    },
  },
  {
    id: 'report.export',
    module: 'reportes',
    permission: 'dashboard.read',
    risk: 'read',
    examples: ['Exportame el reporte de ventas de este mes'],
    parse(text) {
      return assistantIntent(text) === 'export' ? { id: 'report.export', data: {} } : null;
    },
  },
  {
    id: 'report.clear_filters',
    module: 'reportes',
    permission: 'dashboard.read',
    risk: 'read',
    examples: ['Quitá todos los filtros del dashboard'],
    parse(text) {
      const t = norm(text);
      if (isQuestion(t)) return null;
      if (!/\b(quita\w*|elimina\w*|limpia\w*|sin)\s+(todos?\s+los\s+)?filtros?\s*$/.test(t)) return null;
      return { id: 'report.clear_filters', data: {} };
    },
  },
  {
    id: 'report.apply',
    module: 'reportes',
    permission: 'dashboard.read',
    risk: 'read',
    examples: ['Mostrame las ventas de la sucursal central'],
    parse(text) {
      const t = norm(text);
      // No convertir "mostrame usuarios/proveedores/stock" en un filtro del
      // dashboard: el registro de cada módulo tiene prioridad semántica.
      const dashboardSubject = /\b(ventas?|ingresos|pedidos?|pagos?|dashboard|reportes?|categorias?|sucursales?)\b/.test(t);
      return assistantIntent(text) === 'apply' && dashboardSubject ? { id: 'report.apply', data: {} } : null;
    },
  },
];

/** Resuelve un comando a la primera acción registrada que lo parsea. */
export function resolveAction(text: string): { action: AssistantAction; parsed: ParsedAction } | null {
  for (const action of ASSISTANT_ACTIONS) {
    const parsed = action.parse(text);
    if (parsed) return { action, parsed };
  }
  return null;
}
