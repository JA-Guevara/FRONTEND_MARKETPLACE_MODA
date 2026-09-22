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

describe('Órdenes dictadas por voz', () => {
  // El dictado no puntúa, no acentúa bien y a veces pega las palabras. Lo que
  // llega por micrófono tiene que enrutar igual que lo escrito.
  it.each([
    'exportame un reporte en PDF',
    'exportame un reporte en pdf',
    'Exportame un reporte en PDF.',
    'export;ame un reporte en PDF',
    'necesito un reporte en excel ahora',
    'descargame las ventas del mes en pdf',
    'pasame el reporte de existencias',
  ])('«%s» pide exportar', (frase) => {
    expect(assistantIntent(frase)).toBe('export');
  });

  it('preguntar cómo se exporta sigue siendo conversación, no una exportación', () => {
    // Una pregunta no debe disparar una descarga.
    expect(assistantIntent('como exporto un reporte')).toBe('chat');
    expect(assistantIntent('donde descargo el reporte de ventas')).toBe('chat');
  });

  it('una alucinación del dictado no dispara ninguna acción', () => {
    // El servidor ya la descarta; si algo se filtrara, acá tampoco actúa.
    expect(assistantIntent('Subtítulos realizados por la comunidad de Amara.org')).toBe('chat');
    expect(assistantIntent('¡Gracias por ver el video!')).toBe('chat');
  });

  it('reconoce el reporte nombrado dentro de la orden dictada', () => {
    expect(requestedReports('exportame el reporte de ventas en pdf')).toEqual(['ventas']);
    expect(requestedReports('descargame existencias y pedidos')).toEqual(['pedidos', 'existencias']);
    // Sin nombrar reporte, se deja que la interpretación lo decida.
    expect(requestedReports('exportame un reporte en pdf')).toEqual([]);
  });
});
