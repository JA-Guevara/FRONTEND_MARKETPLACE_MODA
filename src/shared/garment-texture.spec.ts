import { describe, expect, it } from 'vitest';
import {
  Punto,
  afinDeTriangulo,
  bandas,
  cajaDe,
  encuadrar,
  expandirTriangulo,
  inclinacion,
  mallaDeTextura,
  puntoEnCuadrilatero,
  texturaUsable,
} from './garment-texture';

const cuadrado: Punto[] = [
  { x: 10, y: 20 },
  { x: 110, y: 20 },
  { x: 110, y: 220 },
  { x: 10, y: 220 },
];

describe('Caja del polígono', () => {
  it('envuelve todos los puntos', () => {
    expect(cajaDe(cuadrado)).toEqual({ x: 10, y: 20, ancho: 100, alto: 200 });
  });

  it('ignora coordenadas inválidas en vez de producir NaN', () => {
    // Un landmark perdido llega como NaN; propagarlo pinta la prenda en ninguna parte.
    const caja = cajaDe([...cuadrado, { x: NaN, y: 5 }, { x: 50, y: Infinity }]);
    expect(caja).toEqual({ x: 10, y: 20, ancho: 100, alto: 200 });
  });

  it('un polígono vacío o degenerado no tiene caja', () => {
    expect(cajaDe([])).toBeNull();
    expect(cajaDe([{ x: 5, y: 5 }])).toBeNull();
    expect(cajaDe([{ x: NaN, y: NaN }])).toBeNull();
  });
});

describe('Inclinación de los hombros', () => {
  it('hombros a la misma altura no inclinan la prenda', () => {
    expect(inclinacion({ x: 0, y: 100 }, { x: 100, y: 100 })).toBe(0);
  });

  it('un hombro más abajo inclina hacia ese lado', () => {
    expect(inclinacion({ x: 0, y: 100 }, { x: 100, y: 200 })).toBeCloseTo(Math.PI / 4, 5);
    expect(inclinacion({ x: 0, y: 200 }, { x: 100, y: 100 })).toBeCloseTo(-Math.PI / 4, 5);
  });
});

describe('Encuadre de la foto sobre el polígono', () => {
  it('la imagen cubre la caja, no cabe dentro', () => {
    // Cubrir y recortar; encajar dentro dejaría huecos en hombros o ruedo.
    const caja = { x: 0, y: 0, ancho: 100, alto: 200 };
    const e = encuadrar(caja, { width: 100, height: 100 })!;
    expect(e.ancho).toBe(200);
    expect(e.alto).toBe(200);
    expect(e.ancho).toBeGreaterThanOrEqual(caja.ancho);
    expect(e.alto).toBeGreaterThanOrEqual(caja.alto);
  });

  it('queda centrada sobre la caja', () => {
    const e = encuadrar({ x: 10, y: 20, ancho: 100, alto: 200 }, { width: 50, height: 100 })!;
    expect(e.centro).toEqual({ x: 60, y: 120 });
  });

  it('la holgura agranda sin descentrar', () => {
    const base = encuadrar({ x: 0, y: 0, ancho: 100, alto: 100 }, { width: 100, height: 100 })!;
    const holgado = encuadrar({ x: 0, y: 0, ancho: 100, alto: 100 }, { width: 100, height: 100 }, 0, 1.2)!;
    expect(holgado.ancho).toBeCloseTo(base.ancho * 1.2, 5);
    expect(holgado.centro).toEqual(base.centro);
  });

  it('conserva el giro que se le pasa', () => {
    const e = encuadrar({ x: 0, y: 0, ancho: 10, alto: 10 }, { width: 10, height: 10 }, 0.5)!;
    expect(e.giro).toBe(0.5);
  });

  it('una imagen sin tamaño no se puede encuadrar', () => {
    expect(encuadrar({ x: 0, y: 0, ancho: 10, alto: 10 }, { width: 0, height: 10 })).toBeNull();
    expect(encuadrar({ x: 0, y: 0, ancho: 0, alto: 10 }, { width: 10, height: 10 })).toBeNull();
  });
});

describe('Bandas horizontales', () => {
  it('reparte la altura en cortes de 0 a 1', () => {
    expect(bandas(4)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('nunca devuelve menos de una banda', () => {
    expect(bandas(0)).toEqual([0, 1]);
    expect(bandas(-3)).toEqual([0, 1]);
  });
});

describe('Punto dentro del cuadrilátero del torso', () => {
  const si = { x: 0, y: 0 };
  const sd = { x: 100, y: 0 };
  const ii = { x: 20, y: 200 };
  const id = { x: 80, y: 200 };

  it('las cuatro esquinas caen donde corresponde', () => {
    expect(puntoEnCuadrilatero(si, sd, ii, id, 0, 0)).toEqual(si);
    expect(puntoEnCuadrilatero(si, sd, ii, id, 1, 0)).toEqual(sd);
    expect(puntoEnCuadrilatero(si, sd, ii, id, 0, 1)).toEqual(ii);
    expect(puntoEnCuadrilatero(si, sd, ii, id, 1, 1)).toEqual(id);
  });

  it('el centro queda en el medio del cuerpo', () => {
    expect(puntoEnCuadrilatero(si, sd, ii, id, 0.5, 0.5)).toEqual({ x: 50, y: 100 });
  });

  it('un torso que se angosta hacia la cadera angosta también la textura', () => {
    // A media altura el ancho ya es menor que en los hombros: eso es lo que
    // hace que la prenda se adapte en vez de quedar rectangular.
    const izq = puntoEnCuadrilatero(si, sd, ii, id, 0, 0.5);
    const der = puntoEnCuadrilatero(si, sd, ii, id, 1, 0.5);
    // Hombros 0..100 y caderas 20..80: a media altura el torso mide 80.
    expect(izq.x).toBe(10);
    expect(der.x).toBe(90);
    expect(der.x - izq.x).toBe(80);
    expect(der.x - izq.x).toBeLessThan(sd.x - si.x);
  });
});

describe('Cuándo una imagen sirve de textura', () => {
  it('acepta una imagen cargada y con tamaño', () => {
    expect(texturaUsable({ width: 10, height: 10, complete: true })).toBe(true);
    // Un canvas no tiene `complete` y también sirve.
    expect(texturaUsable({ width: 10, height: 10 })).toBe(true);
  });

  it('rechaza lo que dibujaría un hueco', () => {
    expect(texturaUsable(null)).toBe(false);
    expect(texturaUsable({ width: 0, height: 10 })).toBe(false);
    expect(texturaUsable({ width: 10, height: 10, complete: false })).toBe(false);
    expect(texturaUsable({ ancho: 10 })).toBe(false);
  });
});

describe('Deformación por triángulos', () => {
  it('la identidad no mueve nada', () => {
    const t = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
    const a = afinDeTriangulo(t, t)!;
    expect(a.a).toBeCloseTo(1, 9);
    expect(a.d).toBeCloseTo(1, 9);
    expect(a.b).toBeCloseTo(0, 9);
    expect(a.c).toBeCloseTo(0, 9);
    expect(a.e).toBeCloseTo(0, 9);
    expect(a.f).toBeCloseTo(0, 9);
  });

  it('lleva cada vértice de origen a su destino', () => {
    const origen = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 200 }];
    const destino = [{ x: 30, y: 10 }, { x: 80, y: 25 }, { x: 40, y: 190 }];
    const m = afinDeTriangulo(origen, destino)!;
    const aplicar = (p: { x: number; y: number }) => ({
      x: m.a * p.x + m.c * p.y + m.e,
      y: m.b * p.x + m.d * p.y + m.f,
    });
    origen.forEach((o, i) => {
      const r = aplicar(o);
      expect(r.x).toBeCloseTo(destino[i].x, 6);
      expect(r.y).toBeCloseTo(destino[i].y, 6);
    });
  });

  it('un triángulo degenerado no produce una transformación', () => {
    // Tres puntos alineados no definen un estiramiento; forzarlo pinta basura.
    const alineados = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 }];
    expect(afinDeTriangulo(alineados, alineados)).toBeNull();
    expect(afinDeTriangulo([{ x: 0, y: 0 }], [{ x: 0, y: 0 }])).toBeNull();
  });
});

describe('Malla de la textura', () => {
  const esquinas = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 80, y: 200 },
    { x: 20, y: 200 },
  ];
  const imagen = { width: 200, height: 400 };

  it('reparte la foto en tantas celdas como se pidan', () => {
    expect(mallaDeTextura(imagen, esquinas, 4, 6).length).toBe(24);
    expect(mallaDeTextura(imagen, esquinas, 1, 1).length).toBe(1);
  });

  it('la primera celda sale de la esquina de la foto y va al hombro', () => {
    const [celda] = mallaDeTextura(imagen, esquinas, 2, 2);
    expect(celda.origen[0]).toEqual({ x: 0, y: 0 });
    expect(celda.origen[2]).toEqual({ x: 100, y: 200 });
    expect(celda.destino[0]).toEqual(esquinas[0]);
  });

  it('cubre la foto entera: la última celda llega al borde', () => {
    const celdas = mallaDeTextura(imagen, esquinas, 2, 2);
    const ultima = celdas[celdas.length - 1];
    expect(ultima.origen[2]).toEqual({ x: 200, y: 400 });
    expect(ultima.destino[2]).toEqual(esquinas[2]);
  });

  it('las celdas de abajo son más angostas si el cuerpo se angosta', () => {
    // Es la prueba de que la prenda se ADAPTA: recortar la dejaría igual.
    const celdas = mallaDeTextura(imagen, esquinas, 1, 2);
    const anchoArriba = celdas[0].destino[1].x - celdas[0].destino[0].x;
    const anchoAbajo = celdas[1].destino[2].x - celdas[1].destino[3].x;
    expect(anchoArriba).toBe(100);
    expect(anchoAbajo).toBe(60);
    expect(anchoAbajo).toBeLessThan(anchoArriba);
  });

  it('sin cuatro esquinas o sin imagen no hay malla', () => {
    expect(mallaDeTextura(imagen, esquinas.slice(0, 3))).toEqual([]);
    expect(mallaDeTextura({ width: 0, height: 10 }, esquinas)).toEqual([]);
  });
});

describe('Solape entre triángulos', () => {
  const t = [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 0, y: 30 },
  ];

  it('agranda quedándose prácticamente en el mismo lugar', () => {
    // Cada vértice se aleja una cantidad FIJA en píxeles, no proporcional: así
    // el solape es el mismo en triángulos grandes y chicos, que es lo que tapa
    // la costura. El costo es que el centro se corre una fracción de píxel en
    // triángulos no equiláteros, y eso es irrelevante para el dibujo.
    const g = expandirTriangulo(t, 1);
    const centro = (p: { x: number; y: number }[]) => ({
      x: (p[0].x + p[1].x + p[2].x) / 3,
      y: (p[0].y + p[1].y + p[2].y) / 3,
    });
    expect(Math.abs(centro(g).x - centro(t).x)).toBeLessThan(0.5);
    expect(Math.abs(centro(g).y - centro(t).y)).toBeLessThan(0.5);
  });

  it('cada vértice se aleja del centro exactamente lo pedido', () => {
    const g = expandirTriangulo(t, 2);
    const cx = 10, cy = 10;
    t.forEach((p, i) => {
      const antes = Math.hypot(p.x - cx, p.y - cy);
      const despues = Math.hypot(g[i].x - cx, g[i].y - cy);
      expect(despues - antes).toBeCloseTo(2, 6);
    });
  });

  it('un triángulo degenerado en un punto no revienta', () => {
    const iguales = [{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }];
    expect(expandirTriangulo(iguales, 1)).toEqual(iguales);
  });

  it('con menos de tres puntos devuelve lo que recibió', () => {
    expect(expandirTriangulo([{ x: 1, y: 1 }])).toEqual([{ x: 1, y: 1 }]);
  });
});
