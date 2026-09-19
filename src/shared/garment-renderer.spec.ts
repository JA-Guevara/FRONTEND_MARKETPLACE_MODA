import {
  P,
  Punto,
  dibujarPrenda,
  ejes,
  esInferior,
  esSuperior,
  estimarOcultos,
  formaDePrenda,
  poligonoFalda,
  poligonoPierna,
  poligonoTorso,
  tono,
} from './garment-renderer';

/** Cuerpo de pie en píxeles, con hombros de 100 px de ancho. */
function cuerpo(): Punto[] {
  const pts: Punto[] = [];
  pts[P.HOMBRO_IZQ] = { x: 350, y: 200 };
  pts[P.HOMBRO_DER] = { x: 250, y: 200 };
  pts[P.CODO_IZQ] = { x: 380, y: 290 };
  pts[P.CODO_DER] = { x: 220, y: 290 };
  pts[P.MUNECA_IZQ] = { x: 395, y: 380 };
  pts[P.MUNECA_DER] = { x: 205, y: 380 };
  pts[P.CADERA_IZQ] = { x: 335, y: 380 };
  pts[P.CADERA_DER] = { x: 265, y: 380 };
  pts[P.RODILLA_IZQ] = { x: 335, y: 520 };
  pts[P.RODILLA_DER] = { x: 265, y: 520 };
  pts[P.TOBILLO_IZQ] = { x: 335, y: 650 };
  pts[P.TOBILLO_DER] = { x: 265, y: 650 };
  return pts;
}

/** Contexto de canvas simulado: registra las operaciones de dibujo. */
function contextoFalso() {
  const registro: string[] = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    globalCompositeOperation: '',
    beginPath: () => registro.push('beginPath'),
    moveTo: () => registro.push('moveTo'),
    lineTo: () => registro.push('lineTo'),
    closePath: () => registro.push('closePath'),
    fill: () => registro.push('fill'),
    stroke: () => registro.push('stroke'),
    arc: () => registro.push('arc'),
    ellipse: () => registro.push('ellipse'),
    save: () => registro.push('save'),
    restore: () => registro.push('restore'),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, registro };
}

describe('Elección de la forma de la prenda', () => {
  it.each([
    ['Camisa de lino', 'camisa'],
    ['Blusa de seda', 'camisa'],
    ['Polera básica', 'remera'],
    ['Musculosa deportiva', 'musculosa'],
    ['Chaqueta de jean', 'chaqueta'],
    ['Pantalón chino', 'pantalon'],
    ['Short de lino', 'short'],
    ['Falda midi plisada', 'falda'],
    ['Vestido largo', 'vestido'],
  ])('«%s» se dibuja como %s', (tipo, esperado) => {
    expect(formaDePrenda(tipo)).toBe(esperado);
  });

  it('sin tipo declarado usa la región del cuerpo', () => {
    expect(formaDePrenda(null, 'lower_body')).toBe('pantalon');
    expect(formaDePrenda(null, 'full_body')).toBe('vestido');
    expect(formaDePrenda(null, 'upper_body')).toBe('remera');
  });

  it('clasifica superiores e inferiores', () => {
    expect(esSuperior('camisa')).toBe(true);
    expect(esInferior('pantalon')).toBe(true);
    expect(esInferior('remera')).toBe(false);
  });
});

describe('Geometría sobre el cuerpo', () => {
  it('toma la escala y los ejes de los hombros y la cadera', () => {
    const e = ejes(cuerpo())!;
    expect(e.ancho).toBeCloseTo(100, 0);
    expect(e.abajo.y).toBeGreaterThan(0.9); // hacia los pies
    expect(e.centroHombros.x).toBeCloseTo(300, 0);
  });

  it('sin hombros no hay nada que vestir', () => {
    const sinHombros = cuerpo();
    delete sinHombros[P.HOMBRO_IZQ];
    expect(ejes(sinHombros)).toBeNull();
    expect(poligonoTorso(sinHombros, 'remera')).toBeNull();
  });

  it('el torso cubre desde los hombros hasta bajo la cadera, más ancho que el cuerpo', () => {
    const pts = cuerpo();
    const torso = poligonoTorso(pts, 'remera')!;
    const xs = torso.map((p) => p.x);
    // Más ancho que la línea de hombros (250..350).
    expect(Math.min(...xs)).toBeLessThan(250);
    expect(Math.max(...xs)).toBeGreaterThan(350);
    // Y baja por debajo de la cadera (y=380).
    expect(Math.max(...torso.map((p) => p.y))).toBeGreaterThan(380);
  });

  it('el vestido llega bastante más abajo que una remera', () => {
    const pts = cuerpo();
    const remera = Math.max(...poligonoTorso(pts, 'remera')!.map((p) => p.y));
    const vestido = Math.max(...poligonoTorso(pts, 'vestido')!.map((p) => p.y));
    expect(vestido).toBeGreaterThan(remera + 80);
  });

  it('el short termina sobre la rodilla y el pantalón en el tobillo', () => {
    const pts = cuerpo();
    const short = Math.max(...poligonoPierna(pts, 'short', 'izq')!.map((p) => p.y));
    const pantalon = Math.max(...poligonoPierna(pts, 'pantalon', 'izq')!.map((p) => p.y));
    expect(short).toBeLessThan(520); // rodilla
    expect(pantalon).toBeGreaterThanOrEqual(640); // tobillo
  });

  it('la falda se acampana por debajo de la cadera', () => {
    const pts = cuerpo();
    const falda = poligonoFalda(pts)!;
    const arriba = falda.filter((p) => p.y < 420);
    const abajo = falda.filter((p) => p.y >= 420);
    const ancho = (grupo: Punto[]) => Math.max(...grupo.map((p) => p.x)) - Math.min(...grupo.map((p) => p.x));
    expect(ancho(abajo)).toBeGreaterThan(ancho(arriba));
  });
});

describe('Puntos que la cámara no ve', () => {
  it('estima cadera, codos y muñecas cuando no son visibles', () => {
    const pts = cuerpo();
    const soloHombros = (i: number) => i === P.HOMBRO_IZQ || i === P.HOMBRO_DER;
    const completado = estimarOcultos(pts, soloHombros);

    // La cadera estimada queda por debajo de los hombros.
    expect(completado[P.CADERA_IZQ].y).toBeGreaterThan(pts[P.HOMBRO_IZQ].y);
    expect(completado[P.CODO_IZQ].y).toBeGreaterThan(pts[P.HOMBRO_IZQ].y);
    expect(completado[P.MUNECA_IZQ].y).toBeGreaterThan(completado[P.CODO_IZQ].y);
    expect(completado[P.RODILLA_IZQ].y).toBeGreaterThan(completado[P.CADERA_IZQ].y);
    // Y con eso ya se puede dibujar.
    expect(poligonoTorso(completado, 'remera')).not.toBeNull();
  });

  it('respeta los puntos que sí se ven', () => {
    const pts = cuerpo();
    const completado = estimarOcultos(pts, () => true);
    expect(completado[P.CADERA_IZQ]).toEqual(pts[P.CADERA_IZQ]);
  });
});

describe('Dibujo', () => {
  it('dibuja una prenda superior con mangas y cuello', () => {
    const { ctx, registro } = contextoFalso();
    expect(dibujarPrenda(ctx, cuerpo(), { forma: 'remera', color: '#d62828' })).toBe(true);
    expect(registro.filter((r) => r === 'fill').length).toBeGreaterThan(0);
    expect(registro).toContain('stroke'); // mangas
    expect(registro).toContain('ellipse'); // cuello recortado
  });

  it('la musculosa no dibuja mangas', () => {
    const conMangas = contextoFalso();
    dibujarPrenda(conMangas.ctx, cuerpo(), { forma: 'remera', color: '#111111' });
    const sinMangas = contextoFalso();
    dibujarPrenda(sinMangas.ctx, cuerpo(), { forma: 'musculosa', color: '#111111' });
    const trazos = (r: string[]) => r.filter((x) => x === 'stroke').length;
    expect(trazos(sinMangas.registro)).toBeLessThan(trazos(conMangas.registro));
  });

  it('la camisa agrega botones', () => {
    const camisa = contextoFalso();
    dibujarPrenda(camisa.ctx, cuerpo(), { forma: 'camisa', color: '#1d4ed8' });
    expect(camisa.registro.filter((r) => r === 'arc').length).toBeGreaterThanOrEqual(4);
  });

  it('dibuja dos piernas para un pantalón', () => {
    const { ctx, registro } = contextoFalso();
    expect(dibujarPrenda(ctx, cuerpo(), { forma: 'pantalon', color: '#334155' })).toBe(true);
    expect(registro.filter((r) => r === 'fill').length).toBe(2);
  });

  it('sin cuerpo utilizable no dibuja nada', () => {
    const { ctx } = contextoFalso();
    expect(dibujarPrenda(ctx, [], { forma: 'remera', color: '#000000' })).toBe(false);
  });
});

describe('Tono del color', () => {
  it('oscurece y aclara un color del catálogo', () => {
    expect(tono('#808080', -0.5)).toBe('rgb(64,64,64)');
    expect(tono('#808080', 0.5)).toBe('rgb(192,192,192)');
  });

  it('tolera un color inválido sin romper el dibujo', () => {
    expect(tono('no-es-color', -0.2)).toBe('#888888');
  });
});

describe('Vocabulario de prendas', () => {
  it('reconoce un hoodie como prenda de manga larga', () => {
    // Regresión: «hoodie» no estaba en la lista y caía en el caso por defecto,
    // así que un buzo con capucha se dibujaba como una remera.
    expect(formaDePrenda('Hoodie de algodón')).toBe('manga-larga');
    expect(formaDePrenda('Canguro oversize')).toBe('manga-larga');
    expect(formaDePrenda('Buzo con capucha')).toBe('manga-larga');
    expect(formaDePrenda('Cardigan de lana')).toBe('manga-larga');
  });

  it('distingue abrigo de prenda liviana', () => {
    expect(formaDePrenda('Campera de cuero')).toBe('chaqueta');
    expect(formaDePrenda('Trench largo')).toBe('chaqueta');
    expect(formaDePrenda('Saco de vestir')).toBe('chaqueta');
    expect(formaDePrenda('Chaleco puffer')).toBe('musculosa');
  });

  it('sigue reconociendo lo que ya reconocía', () => {
    expect(formaDePrenda('Polera básica de algodón')).toBe('remera');
    expect(formaDePrenda('Camisa de lino')).toBe('camisa');
    expect(formaDePrenda('Vestido midi')).toBe('vestido');
    expect(formaDePrenda('Pantalón cargo')).toBe('pantalon');
    expect(formaDePrenda('Short de jean')).toBe('short');
    expect(formaDePrenda('Falda plisada')).toBe('falda');
  });

  it('sin nombre útil, la región del cuerpo decide', () => {
    expect(formaDePrenda('', 'lower_body')).toBe('pantalon');
    expect(formaDePrenda('', 'full_body')).toBe('vestido');
    expect(formaDePrenda('', 'upper_body')).toBe('remera');
  });
});
