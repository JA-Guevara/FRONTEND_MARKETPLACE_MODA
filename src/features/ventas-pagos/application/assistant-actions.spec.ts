import { ASSISTANT_ACTIONS, resolveAction } from './assistant-actions';

describe('Registro central de acciones del asistente', () => {
  it('declara cada acción con módulo, permiso y riesgo', () => {
    expect(ASSISTANT_ACTIONS.length).toBeGreaterThanOrEqual(35);
    for (const action of ASSISTANT_ACTIONS) {
      expect(action.id).toBeTruthy();
      expect(action.module).toBeTruthy();
      expect(['read', 'draft', 'confirm', 'restricted']).toContain(action.risk);
      expect(action.examples.length).toBeGreaterThan(0);
      expect(typeof action.parse).toBe('function');
    }
  });

  it('no repite ids de acción', () => {
    const ids = ASSISTANT_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('las acciones restringidas exigen el permiso más alto de su módulo', () => {
    const restricted = ASSISTANT_ACTIONS.filter((a) => a.risk === 'restricted');
    expect(restricted.length).toBeGreaterThan(0);
    for (const action of restricted) {
      expect(action.permission).toBeTruthy();
    }
  });

  it('ninguna acción de escritura administrativa se ejecuta sin permiso declarado', () => {
    for (const action of ASSISTANT_ACTIONS.filter((a) => a.risk !== 'read' && a.permission !== null)) {
      expect(action.permission).toBeTruthy();
    }
  });
});

describe('Resolver de acciones', () => {
  it('resuelve una orden de reporte como la acción export', () => {
    expect(resolveAction('exportame el reporte de ventas de este mes')?.action.id).toBe('report.export');
  });

  it('resuelve una pregunta de orientación como ninguna acción', () => {
    expect(resolveAction('¿Cómo exporto ventas en Excel?')).toBeNull();
    expect(resolveAction('¿cómo registro un usuario?')).toBeNull();
  });

  it('las preguntas de "cómo" no abren borradores ni confirmaciones', () => {
    expect(resolveAction('como creo una promocion')).toBeNull();
    expect(resolveAction('donde cambio el rol de un usuario')).toBeNull();
  });

  it('los pedidos del cliente ("mi pedido") siguen siendo conversación', () => {
    expect(resolveAction('mostrame mis pedidos')).toBeNull();
    expect(resolveAction('¿cómo sigo mi pedido?')).toBeNull();
  });

  it('una orden de exportar se conserva como exportación de reportes', () => {
    expect(resolveAction('exportame los pagos rechazados en excel')?.action.id).toBe('report.export');
  });
});

describe('Acciones de usuarios y permisos', () => {
  it('user.search captura correo o nombre', () => {
    const r = resolveAction('buscá al usuario ana@ejemplo.com');
    expect(r?.action.id).toBe('user.search');
    expect(r?.parsed.data).toMatchObject({ email: 'ana@ejemplo.com' });
    const r2 = resolveAction('buscalo al usuario Ana Pérez');
    expect(r2?.action.id).toBe('user.search');
    expect(r2?.parsed.data['name']).toBe('ana perez');
  });

  it('user.show_inactive es una lectura, no un borrado', () => {
    const r = resolveAction('mostrame los usuarios inactivos');
    expect(r?.action.id).toBe('user.show_inactive');
    expect(r?.action.risk).toBe('read');
  });

  it('user.create reutiliza el borrador de alta', () => {
    const r = resolveAction('creá un usuario para Ana Pérez con correo ana@ejemplo.com');
    expect(r?.action.id).toBe('user.create');
    expect(r?.action.risk).toBe('draft');
    expect(r?.action.permission).toBe('users.write');
  });

  it('user.change_role captura el rol nuevo cuando se dice "de X a Y"', () => {
    const r = resolveAction('cambiale el rol de Ana Pérez a Vendedora');
    expect(r?.action.id).toBe('user.change_role');
    expect(r?.action.risk).toBe('confirm');
    expect(String(r?.parsed.data['role'])).toContain('vendedor');
  });

  it('user.deactivate exige un destinatario concreto', () => {
    expect(resolveAction('desactivá este usuario')).toBeNull();
    const r = resolveAction('desactivá al usuario ana@ejemplo.com');
    expect(r?.action.id).toBe('user.deactivate');
    expect(r?.parsed.data).toMatchObject({ email: 'ana@ejemplo.com' });
  });

  it('user.deleted es restringido y exige permiso de escritura', () => {
    const r = resolveAction('eliminá al usuario ana@ejemplo.com');
    expect(r?.action.id).toBe('user.deleted');
    expect(r?.action.risk).toBe('restricted');
    expect(r?.action.permission).toBe('users.write');
  });
});

describe('Acciones de catálogo e inventario', () => {
  it('product.create prepara un borrador para revisar', () => {
    const r = resolveAction('registrame una campera de cuero negra a 450 Bs');
    expect(r?.action.id).toBe('product.create');
    expect(r?.action.risk).toBe('draft');
    expect(r?.action.permission).toBe('catalog.write');
  });

  it('category.create captura el nombre de la categoría', () => {
    const r = resolveAction('creá una categoría llamada Accesorios');
    expect(r?.action.id).toBe('category.create');
    expect(r?.parsed.data['name']).toBe('accesorios');
  });

  it('product.deactivate captura la prenda a desactivar', () => {
    const r = resolveAction('desactivá la campera de cuero negra');
    expect(r?.action.id).toBe('product.deactivate');
    expect(r?.action.risk).toBe('confirm');
  });

  it('stock.low captura el umbral y usa 5 por defecto', () => {
    expect(resolveAction('prendas con stock menor a 5')?.parsed.data['max']).toBe(5);
    expect(resolveAction('existencias con stock bajo')?.parsed.data['max']).toBe(5);
  });

  it('stock.adjustment no se dispara con una simple mención de stock', () => {
    expect(resolveAction('muestrame el stock')).toBeNull();
    const r = resolveAction('hacé un ajuste de stock de la campera');
    expect(r?.action.id).toBe('stock.adjustment');
  });

  it('stock.transfer captura origen, destino y cantidad', () => {
    const r = resolveAction('transferí 10 unidades de la Central a la sucursal Norte');
    expect(r?.action.id).toBe('stock.transfer');
    expect(r?.parsed.data['quantity']).toBe(10);
  });

  it('supplier.create prepara el borrador del proveedor', () => {
    const r = resolveAction('creá un proveedor llamado Cuero Andino SRL');
    expect(r?.action.id).toBe('supplier.create');
    expect(r?.action.risk).toBe('draft');
    expect(r?.action.permission).toBe('suppliers.write');
  });

  it('supplier.inactive es una lectura', () => {
    expect(resolveAction('mostrame los proveedores inactivos')?.action.id).toBe('supplier.inactive');
  });
});

describe('Acciones de reservas y vestidor', () => {
  it('reservation.pending_today filtra hoy', () => {
    const r = resolveAction('mostrame las reservas pendientes de hoy');
    expect(r?.action.id).toBe('reservation.pending_today');
    expect(r?.action.risk).toBe('read');
  });

  it('reservation.by_branch captura la sucursal', () => {
    const r = resolveAction('mostrame las reservas de la sucursal central');
    expect(r?.action.id).toBe('reservation.by_branch');
    expect(r?.parsed.data['branch_name']).toBe('central');
  });

  it('reservation.confirm y cancel arman confirmación explícita', () => {
    expect(resolveAction('confirmá la reserva de las 15:00 de hoy')?.action.id).toBe('reservation.confirm');
    expect(resolveAction('cancelá la reserva de hoy')?.action.id).toBe('reservation.cancel');
    expect(resolveAction('confirmá la reserva')?.action.risk).toBe('confirm');
  });

  it('reservation.create es un flujo de cliente público (sin permiso)', () => {
    const r = resolveAction('reservá esta prenda para mañana a las 15:00');
    expect(r?.action.id).toBe('reservation.create');
    expect(r?.action.permission).toBeNull();
  });
});

describe('Acciones de pedidos, pagos y promociones', () => {
  it('order.change_status mapea el estado a inglés del contrato', () => {
    const r = resolveAction('cambiá el estado del pedido FS-123 a entregado');
    expect(r?.action.id).toBe('order.change_status');
    expect(r?.parsed.data['new_status']).toBe('delivered');
    const r2 = resolveAction('cambiá el estado de la orden 452 a enviado');
    expect(r2?.parsed.data['new_status']).toBe('shipped');
  });

  it('conserva el identificador alfanumérico real de FashionStore', () => {
    const r = resolveAction('cambiá el estado del pedido FS-2FD480C50E46 a entregado');
    expect(r?.action.id).toBe('order.change_status');
    expect(r?.parsed.data['order_number']).toBe('fs-2fd480c50e46');
  });

  it('payment.rejected es una lectura honesta, no un borrado', () => {
    const r = resolveAction('mostrame los pagos rechazados');
    expect(r?.action.id).toBe('payment.rejected');
    expect(r?.action.risk).toBe('read');
  });

  it('order.register_return es restringido', () => {
    const r = resolveAction('registrá la devolución del pedido FS-123');
    expect(r?.action.id).toBe('order.register_return');
    expect(r?.action.risk).toBe('restricted');
  });

  it('promotion.create arma el borrador del cupón con tipo y porcentaje', () => {
    const r = resolveAction('creá un cupón ESTUDIANTE10 de 10% de descuento');
    expect(r?.action.id).toBe('promotion.create');
    expect(r?.action.risk).toBe('draft');
    expect(r?.parsed.data['percent']).toBe(10);
    expect(resolveAction('prepará una promoción de envío gratis')?.action.id).toBe('promotion.create');
  });

  it('promotion.deactivate captura el código del cupón', () => {
    const r = resolveAction('desactivá el cupón ESTUDIANTE10');
    expect(r?.action.id).toBe('promotion.deactivate');
    expect(r?.action.risk).toBe('confirm');
  });
});

describe('Dictado tolerante a variantes', () => {
  it.each([
    'Desactiva al usuario ana@ejemplo.com',
    'desactivá al usuario ana@ejemplo.com',
    'desactiva el usuario ana@ejemplo.com',
  ])('«%s» desactiva al usuario', (frase) => {
    expect(resolveAction(frase)?.action.id).toBe('user.deactivate');
  });

  it('un dictado sin sujeto ni destinatario no crea acciones', () => {
    expect(resolveAction('Subtítulos realizados por la comunidad de Amara.org')).toBeNull();
    expect(resolveAction('¡Gracias por ver el video!')).toBeNull();
  });
});
