import { effect, inject, Injectable, signal } from '@angular/core';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { CommerceService } from '../infrastructure/commerce.service';

/** Estado compartido del contador del carrito para el encabezado del sitio.
 * Se recalcula desde el estado real del servidor al iniciar sesion y despues
 * de agregar/modificar/eliminar/crear un pedido (refresh()).
 */
@Injectable({ providedIn: 'root' })
export class CartStateService {
  private commerce = inject(CommerceService);
  private session = inject(SessionService);
  readonly count = signal(0);

  constructor() {
    effect(() => {
      if (this.session.user()?.tenant) void this.refresh();
      else this.count.set(0);
    });
  }

  async refresh() {
    const user = this.session.user();
    if (!user?.tenant) {
      this.count.set(0);
      return;
    }
    try {
      const cart = await this.commerce.cart();
      if (this.session.user()?.id === user.id && this.session.user()?.tenant?.id === user.tenant.id)
        this.count.set(cart.items.reduce((total, item) => total + item.quantity, 0));
    } catch {
      // Red caida o sesion expirada: el contador no debe romper la navegacion.
    }
  }
}
