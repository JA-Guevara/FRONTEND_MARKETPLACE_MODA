import { describe, expect, it } from 'vitest';
import {
  formatear,
  latitudValida,
  leerPunto,
  leerSugerencias,
  longitudValida,
  normalizar,
  normalizarLongitud,
  redondear,
} from './geo';

describe('Validación de coordenadas', () => {
  it('acepta los límites y rechaza lo que se pasa', () => {
    expect(latitudValida(-90)).toBe(true);
    expect(latitudValida(90)).toBe(true);
    expect(latitudValida(90.1)).toBe(false);
    expect(longitudValida(-180)).toBe(true);
    expect(longitudValida(180.5)).toBe(false);
  });

  it('rechaza lo que no es número', () => {
    expect(latitudValida('abc')).toBe(false);
    expect(latitudValida(NaN)).toBe(false);
    expect(longitudValida(Infinity)).toBe(false);
  });
});

describe('Lectura del formulario', () => {
  it('lee un par completo', () => {
    expect(leerPunto(-17.78, -63.18)).toEqual({ lat: -17.78, lng: -63.18 });
  });

  it('acepta números escritos como texto', () => {
    expect(leerPunto('5.0000000', '7')).toEqual({ lat: 5, lng: 7 });
  });

  it('media coordenada no es una ubicación', () => {
    // Dibujar el marcador con la longitud faltante lo pondría en el meridiano
    // cero, que es peor que no dibujarlo.
    expect(leerPunto(-17.78, null)).toBeNull();
    expect(leerPunto(null, -63.18)).toBeNull();
    expect(leerPunto('', '')).toBeNull();
  });

  it('el cero es una ubicación válida, no un vacío', () => {
    expect(leerPunto(0, 0)).toEqual({ lat: 0, lng: 0 });
  });

  it('un valor fuera de rango no se lee', () => {
    expect(leerPunto(120, 20)).toBeNull();
  });
});

describe('Normalización', () => {
  it('recorta a siete decimales', () => {
    expect(redondear({ lat: -17.123456789, lng: -63.987654321 })).toEqual({
      lat: -17.1234568,
      lng: -63.9876543,
    });
  });

  it('trae de vuelta una longitud que dio la vuelta al mundo', () => {
    // Arrastrar el mapa de costado repite el mundo y Leaflet devuelve 187.
    expect(normalizarLongitud(187)).toBe(-173);
    expect(normalizarLongitud(-195)).toBe(165);
    expect(normalizarLongitud(-63.18)).toBeCloseTo(-63.18, 6);
  });

  it('los dos bordes del mismo meridiano dan el mismo valor', () => {
    expect(normalizarLongitud(180)).toBe(180);
    expect(normalizarLongitud(-180)).toBe(180);
  });

  it('la latitud se recorta a los polos', () => {
    expect(normalizar({ lat: 95, lng: 10 }).lat).toBe(90);
    expect(normalizar({ lat: -95, lng: 10 }).lat).toBe(-90);
  });
});

describe('Texto para la persona', () => {
  it('sin punto lo dice, no muestra ceros', () => {
    expect(formatear(null)).toContain('Sin ubicación');
  });

  it('con punto muestra cinco decimales', () => {
    expect(formatear({ lat: -17.783312, lng: -63.182144 })).toBe('-17.78331, -63.18214');
  });
});

describe('Resultados del buscador de direcciones', () => {
  it('lee las filas usables', () => {
    const filas = leerSugerencias([
      { display_name: 'Plaza 24 de Septiembre, Santa Cruz', lat: '-17.7833', lon: '-63.1821' },
    ]);
    expect(filas).toEqual([
      { nombre: 'Plaza 24 de Septiembre, Santa Cruz', punto: { lat: -17.7833, lng: -63.1821 } },
    ]);
  });

  it('descarta lo que viene incompleto o imposible', () => {
    // La respuesta es de un servicio externo: se valida, no se confía.
    expect(
      leerSugerencias([
        { display_name: 'Sin coordenadas' },
        { lat: '1', lon: '2' },
        { display_name: '   ', lat: '1', lon: '2' },
        { display_name: 'Fuera de rango', lat: '999', lon: '2' },
      ]),
    ).toEqual([]);
  });

  it('una respuesta que no es lista no rompe nada', () => {
    expect(leerSugerencias(null)).toEqual([]);
    expect(leerSugerencias({ error: 'algo' })).toEqual([]);
    expect(leerSugerencias('texto')).toEqual([]);
  });

  it('corta en el tope pedido', () => {
    const muchas = Array.from({ length: 12 }, (_, i) => ({
      display_name: 'Lugar ' + i,
      lat: '-17.7',
      lon: '-63.1',
    }));
    expect(leerSugerencias(muchas).length).toBe(5);
    expect(leerSugerencias(muchas, 2).length).toBe(2);
  });
});
