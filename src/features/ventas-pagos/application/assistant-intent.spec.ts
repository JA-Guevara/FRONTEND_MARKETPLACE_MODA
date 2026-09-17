import { assistantIntent, requestedReports } from './assistant-intent';

describe('Alcance de las órdenes del asistente', () => {
  it('todo el mes no significa todos los tipos de reporte', () => {
    expect(requestedReports('exportame ventas de todo el mes en Excel')).toEqual(['ventas']);
  });
  it('separa el filtro de sucursal de los reportes solicitados', () => {
    expect(requestedReports('exportame ventas y pagos de la sucursal Centro')).toEqual(['ventas', 'pagos']);
  });
  it('admite una orden de quitar filtros sin habilitar eliminaciones de datos', () => {
    expect(assistantIntent('elimina los filtros de sucursal')).toBe('apply');
    expect(assistantIntent('elimina el pedido')).toBe('chat');
  });
  it('conserva las preguntas de orientación como consultas', () => {
    expect(assistantIntent('¿Cómo exporto ventas en Excel?')).toBe('chat');
    expect(assistantIntent('mostrame mis pedidos')).toBe('chat');
  });
});
