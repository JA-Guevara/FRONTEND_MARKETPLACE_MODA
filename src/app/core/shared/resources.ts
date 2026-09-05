import { catalogResources } from '../../../features/usuarios-catalogo/application/resources';
import { organizationResources } from '../../../features/inventario-sucursales/application/resources';
export const resources = [...catalogResources, ...organizationResources];
