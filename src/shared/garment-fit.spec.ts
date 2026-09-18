import {
  anclajeDeRegion,
  calcularAjuste,
  evaluarPostura,
  lineaCorporal,
  suavizarAjuste,
  LEFT_SHOULDER,
  RIGHT_SHOULDER,
  LEFT_HIP,
  RIGHT_HIP,
} from './garment-fit';
import { Landmark, VideoBox } from './pose-projection';

/** Escenario cuadrado 1:1 para que los cálculos sean fáciles de seguir. */
const box: VideoBox = {
  videoW: 600,
  videoH: 600,
  containerW: 600,
  containerH: 600,
  mirrored: false,
};

/** Cuerpo de pie, centrado y derecho. */
function cuerpo(overrides: Record<number, Landmark> = {}): Landmark[] {
  const puntos: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  puntos[LEFT_SHOULDER] = { x: 0.4, y: 0.3, visibility: 0.9 };
  puntos[RIGHT_SHOULDER] = { x: 0.6, y: 0.3, visibility: 0.9 };
  puntos[LEFT_HIP] = { x: 0.43, y: 0.6, visibility: 0.9 };
  puntos[RIGHT_HIP] = { x: 0.57, y: 0.6, visibility: 0.9 };
  return Object.assign(puntos, overrides);
}

const anclajesCamiseta = {
  shoulder_left: [0.1, 0.12],
  shoulder_right: [0.9, 0.12],
  hem_left: [0.15, 0.95],
  hem_right: [0.85, 0.95],
};

describe('Ubicación automática de la prenda', () => {
  it('elige el anclaje que corresponde a la región y descarta pares sin ancho', () => {
    expect(anclajeDeRegion(anclajesCamiseta, 'upper_body')).toEqual({
      izquierda: [0.1, 0.12],
      derecha: [0.9, 0.12],
    });
    // Para la parte inferior busca cintura o cadera, que esta prenda no tiene.
    expect(anclajeDeRegion(anclajesCamiseta, 'lower_body')).toBeNull();
    // Un par sin ancho real no sirve para escalar.
    expect(
      anclajeDeRegion({ shoulder_left: [0.5, 0.1], shoulder_right: [0.505, 0.1] }, 'upper_body'),
    ).toBeNull();
  });

  it('mide la línea corporal de cada región', () => {
    const hombros = lineaCorporal(cuerpo(), 'upper_body', box)!;
    expect(hombros.spanPx).toBeCloseTo(120, 0); // 0.2 del ancho de 600 px
    expect(hombros.midX).toBeCloseTo(300, 0);
    expect(hombros.rotation).toBeCloseTo(0, 5);

    // La misma pose, medida en la cadera, da una línea más angosta y más abajo.
    const cadera = lineaCorporal(cuerpo(), 'lower_body', box)!;
    expect(cadera.spanPx).toBeCloseTo(84, 0);
    expect(cadera.midY).toBeGreaterThan(hombros.midY);
  });

  it('coloca el anclaje de la prenda sobre la línea del cuerpo', () => {
    const ajuste = calcularAjuste(
      cuerpo(),
      'upper_body',
      anclajesCamiseta,
      { width: 400, height: 600 },
      box,
    )!;

    // El ancho del anclaje (0.8 de la imagen) debe cubrir los hombros con holgura.
    const anchoPrenda = 400 * ajuste.scale;
    expect(anchoPrenda * 0.8).toBeCloseTo(120 * 1.35, 0);

    // Y el punto medio del anclaje cae justo sobre el medio de los hombros.
    const centroX = box.containerW / 2 + ajuste.offsetX;
    const centroY = box.containerH / 2 + ajuste.offsetY;
    const anclajeY = (0.12 - 0.5) * 600 * ajuste.scale;
    expect(centroX).toBeCloseTo(300, 0);
    expect(centroY + anclajeY).toBeCloseTo(180, 0); // y=0.3 sobre 600 px
  });

  it('acompaña la inclinación de los hombros', () => {
    const inclinado = cuerpo({
      [LEFT_SHOULDER]: { x: 0.4, y: 0.34, visibility: 0.9 },
      [RIGHT_SHOULDER]: { x: 0.6, y: 0.26, visibility: 0.9 },
    });
    const ajuste = calcularAjuste(inclinado, 'upper_body', anclajesCamiseta, { width: 400, height: 600 }, box)!;
    expect(ajuste.rotation).toBeLessThan(0);
    expect(Math.abs(ajuste.rotation)).toBeGreaterThan(0.2);
  });

  it('sin anclajes sigue ubicando la prenda, apenas menos precisa', () => {
    const ajuste = calcularAjuste(cuerpo(), 'upper_body', null, { width: 400, height: 600 }, box);
    expect(ajuste).not.toBeNull();
    expect(ajuste!.scale).toBeGreaterThan(0);
  });

  it('no puede ubicar nada si no ve la parte del cuerpo que corresponde', () => {
    const sinHombros = cuerpo({
      [LEFT_SHOULDER]: { x: 0.4, y: 0.3, visibility: 0.1 },
      [RIGHT_SHOULDER]: { x: 0.6, y: 0.3, visibility: 0.1 },
    });
    expect(calcularAjuste(sinHombros, 'upper_body', anclajesCamiseta, { width: 400, height: 600 }, box)).toBeNull();
  });
});

describe('Indicaciones a la persona', () => {
  it('pide que se ubique frente a la cámara cuando no detecta a nadie', () => {
    const guia = evaluarPostura(null, 'upper_body', box);
    expect(guia.code).toBe('sin-persona');
    expect(guia.ok).toBe(false);
  });

  it('nombra la parte del cuerpo que falta ver', () => {
    const sinCadera = cuerpo({
      [LEFT_HIP]: { x: 0.43, y: 0.6, visibility: 0.1 },
      [RIGHT_HIP]: { x: 0.57, y: 0.6, visibility: 0.1 },
    });
    const guia = evaluarPostura(sinCadera, 'lower_body', box);
    expect(guia.code).toBe('parcial');
    expect(guia.message).toContain('cadera');
  });

  it('pide acercarse o alejarse según el encuadre', () => {
    const lejos = cuerpo({
      [LEFT_SHOULDER]: { x: 0.48, y: 0.3, visibility: 0.9 },
      [RIGHT_SHOULDER]: { x: 0.52, y: 0.3, visibility: 0.9 },
    });
    expect(evaluarPostura(lejos, 'upper_body', box).code).toBe('lejos');

    const cerca = cuerpo({
      [LEFT_SHOULDER]: { x: 0.05, y: 0.3, visibility: 0.9 },
      [RIGHT_SHOULDER]: { x: 0.95, y: 0.3, visibility: 0.9 },
    });
    expect(evaluarPostura(cerca, 'upper_body', box).code).toBe('cerca');
  });

  it('pide enderezarse cuando está muy inclinado', () => {
    const torcido = cuerpo({
      [LEFT_SHOULDER]: { x: 0.4, y: 0.42, visibility: 0.9 },
      [RIGHT_SHOULDER]: { x: 0.6, y: 0.22, visibility: 0.9 },
    });
    const guia = evaluarPostura(torcido, 'upper_body', box);
    expect(guia.code).toBe('inclinado');
    expect(guia.message).toContain('derecho');
  });

  it('avisa que está todo listo con una postura correcta', () => {
    const guia = evaluarPostura(cuerpo(), 'upper_body', box);
    expect(guia.code).toBe('ok');
    expect(guia.ok).toBe(true);
  });

  it('para cuerpo entero exige ver también la cadera', () => {
    const sinCadera = cuerpo({
      [LEFT_HIP]: { x: 0.43, y: 0.6, visibility: 0.1 },
      [RIGHT_HIP]: { x: 0.57, y: 0.6, visibility: 0.1 },
    });
    expect(evaluarPostura(sinCadera, 'full_body', box).code).toBe('parcial');
  });
});

describe('Suavizado', () => {
  it('acerca el ajuste mostrado al nuevo sin saltos', () => {
    const actual = { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 };
    const objetivo = { offsetX: 100, offsetY: -50, rotation: 0.2, scale: 2 };
    const suave = suavizarAjuste(actual, objetivo, 0.5);
    expect(suave.offsetX).toBe(50);
    expect(suave.offsetY).toBe(-25);
    expect(suave.scale).toBe(1.5);
  });

  it('el primer ajuste se adopta tal cual', () => {
    const objetivo = { offsetX: 10, offsetY: 10, rotation: 0, scale: 1 };
    expect(suavizarAjuste(null, objetivo)).toEqual(objetivo);
  });
});
