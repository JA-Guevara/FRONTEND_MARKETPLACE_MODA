import { ADMIN_NAV } from '../../../app/core/layout/admin-nav';

/** Las rutas y permisos siguen el mismo catálogo que el menú de plataforma. */
const topics = [
  {
    key: 'empresas',
    words: /empresas?|suscripciones?|tiendas?/,
    help: 'En Empresas y suscripciones podés abrir Empresa 360 y gestionar el plan y los datos de cada empresa.',
  },
  {
    key: 'planes',
    words: /planes?|facturacion|billing/,
    help: 'Los planes definen funciones, límites y precio. FashionStore cobra las suscripciones con Stripe Billing; las prendas se cobran con la cuenta Connect de cada empresa.',
  },
  {
    key: 'usuarios',
    words: /usuarios?|clientes?/,
    help: 'Usuarios globales permite localizar cuentas de las distintas empresas. Las operaciones conservan el alcance y los permisos del usuario.',
  },
  {
    key: 'roles',
    words: /roles?|permisos/,
    help: 'Los roles de plataforma y los roles de empresa tienen alcances distintos. No conviertas un rol empresarial en acceso global.',
  },
  {
    key: 'admins',
    words: /superadmin\w*|administradores?/,
    help: 'Superadministradores gestiona el equipo de la plataforma. El administrador de una empresa opera solo dentro de su empresa.',
  },
  {
    key: 'modulos',
    words: /modulos?|funcionalidades/,
    help: 'Módulos organiza las funciones que pueden habilitarse mediante los planes.',
  },
  {
    key: 'modelos-ml',
    words: /\bml\b|machine learning|modelos/,
    help: 'Modelos de ML permite revisar entrenamientos y versiones. No confirma un entrenamiento hasta que termine la ejecución.',
  },
  {
    key: 'soporte',
    words: /soporte|delegad/,
    help: 'Para trabajar dentro de una empresa, iniciá una sesión de soporte autorizada. La sesión conserva su alcance y queda auditada.',
  },
  {
    key: 'auditoria',
    words: /auditoria|bitacora/,
    help: 'Auditoría global permite revisar las operaciones registradas de la plataforma.',
  },
  {
    key: 'continuidad',
    words: /copias?|respaldos?|backups?/,
    help: 'Las copias globales cubren continuidad de infraestructura. Para resguardar una empresa, abrí Empresa 360 y su sección de copias; requieren custodia cifrada y ensayo de restauración.',
  },
  {
    key: 'despliegues',
    words: /despliegues?|migraciones?|diagnostico/,
    help: 'Diagnóstico técnico muestra la configuración y la puerta de publicación. Abrir esta pantalla no ejecuta migraciones ni despliega servicios.',
  },
  {
    key: 'salud',
    words: /salud|seguridad|estado del sistema/,
    help: 'Estado y seguridad muestra controles operativos. El panel ejecutivo reúne las métricas del negocio de FashionStore.',
  },
  {
    key: 'demo',
    words: /sandbox|demo/,
    help: 'La empresa demo sirve para probar funciones; restablecerla requiere una acción explícita en su pantalla.',
  },
  {
    key: 'ejecutivo',
    words: /panel|dashboard|reportes?|graficos?|proyecciones?|ingresos/,
    help: 'El panel ejecutivo muestra cobros de suscripciones, empresas, distribuciones, tendencias y exportaciones. Las estimaciones se distinguen de los cobros registrados.',
  },
];

const items = ADMIN_NAV.filter((section) => section.scope === 'platform').flatMap((section) =>
  section.items.flatMap((item) => (item.children?.length ? item.children : [item])),
);

export function platformAssistantTopic(message: string) {
  const text = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const topic = topics.find((topic) => topic.words.test(text));
  const destination = items.find((item) => item.key === topic?.key);
  return topic && destination ? { ...destination, help: topic.help } : null;
}

export function asksToNavigate(message: string) {
  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /\b(abri\w*|abre\w*|lleva\w*|ir a|ver|mostra\w*|muestra\w*|gestiona\w*)\b/i.test(text);
}
