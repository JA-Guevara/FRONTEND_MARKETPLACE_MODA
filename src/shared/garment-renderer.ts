/**
 * Dibujo vectorial de la prenda sobre el cuerpo detectado.
 *
 * Por qué vectorial y no la fotografía: la foto de catálogo viene con fondo, y
 * recortarlo bien depende de que el fondo sea liso. Dibujar la prenda a partir
 * de los puntos del cuerpo evita el problema por completo —nunca hay fondo que
 * quitar—, funciona con cualquier prenda del catálogo sin preparación previa y
 * se adapta al movimiento, porque cada vértice se recalcula en cada cuadro.
 *
 * La geometría vive en funciones puras que devuelven polígonos; el dibujo en
 * canvas es una capa fina encima. Así se puede verificar la forma sin navegador.
 */

export interface Punto {
  x: number;
  y: number;
}

/** Índices de los 33 puntos de MediaPipe Pose que usamos. */
export const P = {
  NARIZ: 0,
  HOMBRO_IZQ: 11,
  HOMBRO_DER: 12,
  CODO_IZQ: 13,
  CODO_DER: 14,
  MUNECA_IZQ: 15,
  MUNECA_DER: 16,
  CADERA_IZQ: 23,
  CADERA_DER: 24,
  RODILLA_IZQ: 25,
  RODILLA_DER: 26,
  TOBILLO_IZQ: 27,
  TOBILLO_DER: 28,
} as const;

/** Formas que sabe dibujar el probador. */
export type FormaPrenda =
  | 'remera'
  | 'musculosa'
  | 'manga-larga'
  | 'camisa'
  | 'chaqueta'
  | 'pantalon'
  | 'short'
  | 'falda'
  | 'vestido';

const SUPERIORES: FormaPrenda[] = ['remera', 'musculosa', 'manga-larga', 'camisa', 'chaqueta'];
const INFERIORES: FormaPrenda[] = ['pantalon', 'short', 'falda'];

// --- Vectores -------------------------------------------------------------
export const resta = (a: Punto, b: Punto): Punto => ({ x: a.x - b.x, y: a.y - b.y });
export const suma = (a: Punto, b: Punto): Punto => ({ x: a.x + b.x, y: a.y + b.y });
export const escala = (a: Punto, k: number): Punto => ({ x: a.x * k, y: a.y * k });
export const medio = (a: Punto, b: Punto): Punto => escala(suma(a, b), 0.5);
export const largo = (a: Punto): number => Math.hypot(a.x, a.y);
export const unitario = (a: Punto): Punto => {
  const l = largo(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
export const entre = (a: Punto, b: Punto, t: number): Punto => suma(a, escala(resta(b, a), t));

/** Traduce el tipo de prenda del catálogo a una forma dibujable. */
export function formaDePrenda(tipo?: string | null, region?: string | null): FormaPrenda {
  const t = (tipo || '').toLowerCase();
  if (/(musculosa|tank|bividi|chaleco|crop)/.test(t)) return 'musculosa';
  if (/(camisa|blusa|chomba)/.test(t)) return 'camisa';
  if (/(chaqueta|campera|abrigo|blazer|bomber|parka|cazadora|trench|saco)/.test(t))
    return 'chaqueta';
  // «hoodie» y «canguro» faltaban y caían en remera: la prenda se dibujaba sin
  // mangas largas aunque el catálogo dijera claramente qué era.
  if (/(buzo|sweater|sudadera|manga larga|pullover|hoodie|hoody|canguro|polar|cardigan)/.test(t))
    return 'manga-larga';
  if (/vestido/.test(t)) return 'vestido';
  if (/(short|bermuda)/.test(t)) return 'short';
  if (/falda/.test(t)) return 'falda';
  if (/(pantal|jean|jogger|legging|chupin|cargo)/.test(t)) return 'pantalon';
  if (/(remera|polera|camiseta|polo|top)/.test(t)) return 'remera';
  // Sin tipo declarado, la región del cuerpo alcanza para elegir algo sensato.
  if (region === 'lower_body') return 'pantalon';
  if (region === 'full_body') return 'vestido';
  return 'remera';
}

export function esSuperior(forma: FormaPrenda) {
  return SUPERIORES.includes(forma);
}
export function esInferior(forma: FormaPrenda) {
  return INFERIORES.includes(forma);
}

/**
 * Completa los puntos que la cámara no ve.
 *
 * Es habitual que la persona esté sentada frente al escritorio y la cadera o las
 * piernas queden fuera de cuadro. En vez de no dibujar nada, se estiman a partir
 * de los hombros, que son el único punto realmente obligatorio.
 */
export function estimarOcultos(pts: Punto[], visible: (i: number) => boolean): Punto[] {
  const salida = pts.slice();
  const hi = salida[P.HOMBRO_IZQ];
  const hd = salida[P.HOMBRO_DER];
  if (!hi || !hd) return salida;
  const ancho = largo(resta(hi, hd)) || 1;
  const cruz = unitario(resta(hi, hd));
  // Perpendicular a la línea de hombros: hacia los pies.
  const abajo: Punto = { x: -cruz.y, y: cruz.x };

  if (!visible(P.CADERA_IZQ) || !visible(P.CADERA_DER)) {
    salida[P.CADERA_IZQ] = suma(suma(hi, escala(abajo, ancho * 1.3)), escala(cruz, -ancho * 0.12));
    salida[P.CADERA_DER] = suma(suma(hd, escala(abajo, ancho * 1.3)), escala(cruz, ancho * 0.12));
  }
  for (const [hombro, codo, muneca, lado] of [
    [P.HOMBRO_IZQ, P.CODO_IZQ, P.MUNECA_IZQ, 1],
    [P.HOMBRO_DER, P.CODO_DER, P.MUNECA_DER, -1],
  ] as const) {
    if (!visible(codo))
      salida[codo] = suma(suma(salida[hombro], escala(abajo, ancho * 0.7)), escala(cruz, lado * ancho * 0.15));
    if (!visible(muneca)) salida[muneca] = suma(salida[codo], escala(abajo, ancho * 0.7));
  }
  for (const [cadera, rodilla, tobillo] of [
    [P.CADERA_IZQ, P.RODILLA_IZQ, P.TOBILLO_IZQ],
    [P.CADERA_DER, P.RODILLA_DER, P.TOBILLO_DER],
  ] as const) {
    if (!visible(rodilla)) salida[rodilla] = suma(salida[cadera], escala(abajo, ancho * 1.1));
    if (!visible(tobillo)) salida[tobillo] = suma(salida[rodilla], escala(abajo, ancho * 1.1));
  }
  return salida;
}

/** Ejes del torso: escala, dirección de hombros y dirección hacia los pies. */
export function ejes(pts: Punto[]) {
  const hi = pts[P.HOMBRO_IZQ];
  const hd = pts[P.HOMBRO_DER];
  const ci = pts[P.CADERA_IZQ];
  const cd = pts[P.CADERA_DER];
  if (!hi || !hd || !ci || !cd) return null;
  const ancho = largo(resta(hi, hd));
  if (ancho < 4) return null;
  const centroHombros = medio(hi, hd);
  const centroCaderas = medio(ci, cd);
  return {
    ancho,
    cruz: unitario(resta(hi, hd)),
    abajo: unitario(resta(centroCaderas, centroHombros)),
    centroHombros,
    centroCaderas,
  };
}

/** Cuerpo de una prenda superior: hombros → cadera, algo más ancho que el torso. */
export function poligonoTorso(pts: Punto[], forma: FormaPrenda): Punto[] | null {
  const e = ejes(pts);
  if (!e) return null;
  const holgura = e.ancho * (forma === 'musculosa' ? 0.12 : forma === 'chaqueta' ? 0.26 : 0.22);
  // El vestido llega más abajo; el resto termina bajo la cadera.
  const caida = forma === 'vestido' ? e.ancho * 1.5 : e.ancho * 0.18;
  const bajo = escala(e.abajo, caida);
  const subir = escala(e.abajo, -e.ancho * 0.06);
  const ensanchaBajo = forma === 'vestido' ? 1.7 : 1.15;
  return [
    suma(suma(pts[P.HOMBRO_IZQ], escala(e.cruz, holgura)), subir),
    suma(suma(pts[P.CADERA_IZQ], escala(e.cruz, holgura * ensanchaBajo)), bajo),
    suma(suma(pts[P.CADERA_DER], escala(e.cruz, -holgura * ensanchaBajo)), bajo),
    suma(suma(pts[P.HOMBRO_DER], escala(e.cruz, -holgura)), subir),
  ];
}

/** Una pierna de una prenda inferior, como polígono. */
export function poligonoPierna(
  pts: Punto[],
  forma: FormaPrenda,
  lado: 'izq' | 'der',
): Punto[] | null {
  const e = ejes(pts);
  if (!e) return null;
  const cadera = lado === 'izq' ? pts[P.CADERA_IZQ] : pts[P.CADERA_DER];
  const rodilla = lado === 'izq' ? pts[P.RODILLA_IZQ] : pts[P.RODILLA_DER];
  const tobillo = lado === 'izq' ? pts[P.TOBILLO_IZQ] : pts[P.TOBILLO_DER];
  if (!cadera || !rodilla) return null;
  const signo = lado === 'izq' ? 1 : -1;
  const anchoPierna = e.ancho * 0.19;
  // El short llega arriba de la rodilla; el pantalón, al tobillo.
  const fin = forma === 'short' ? entre(cadera, rodilla, 0.62) : tobillo || rodilla;
  const centroCadera = e.centroCaderas;
  const interiorArriba = entre(cadera, centroCadera, 0.72);
  const interiorAbajo = suma(fin, escala(e.cruz, -signo * anchoPierna * 0.55));
  return [
    suma(cadera, escala(e.cruz, signo * anchoPierna * 0.9)),
    suma(fin, escala(e.cruz, signo * anchoPierna * 0.75)),
    interiorAbajo,
    interiorArriba,
  ];
}

/** Falda: trapecio desde la cadera, acampanado. */
export function poligonoFalda(pts: Punto[]): Punto[] | null {
  const e = ejes(pts);
  if (!e) return null;
  const largoFalda = escala(e.abajo, e.ancho * 1.0);
  const vuelo = e.ancho * 0.62;
  return [
    suma(pts[P.CADERA_IZQ], escala(e.cruz, e.ancho * 0.12)),
    suma(suma(pts[P.CADERA_IZQ], largoFalda), escala(e.cruz, vuelo)),
    suma(suma(pts[P.CADERA_DER], largoFalda), escala(e.cruz, -vuelo)),
    suma(pts[P.CADERA_DER], escala(e.cruz, -e.ancho * 0.12)),
  ];
}

/** Aclara u oscurece un color `#rrggbb`. */
export function tono(hex: string, factor: number): string {
  const limpio = (hex || '#888888').replace('#', '');
  const valor = parseInt(limpio.length === 3 ? limpio.replace(/./g, '$&$&') : limpio, 16);
  if (Number.isNaN(valor)) return '#888888';
  const canal = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v + (factor < 0 ? v : 255 - v) * factor)));
  const r = canal(valor >> 16);
  const g = canal((valor >> 8) & 255);
  const b = canal(valor & 255);
  return `rgb(${r},${g},${b})`;
}

export interface OpcionesDibujo {
  forma: FormaPrenda;
  color: string;
}

type Ctx2D = CanvasRenderingContext2D;

function trazarPoligono(ctx: Ctx2D, puntos: Punto[]) {
  ctx.beginPath();
  ctx.moveTo(puntos[0].x, puntos[0].y);
  for (const p of puntos.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.closePath();
}

/**
 * Dibuja la prenda sobre el contexto. Devuelve false si no hay cuerpo suficiente
 * (sin hombros no hay nada que vestir).
 */
export function dibujarPrenda(ctx: Ctx2D, pts: Punto[], opciones: OpcionesDibujo): boolean {
  const e = ejes(pts);
  if (!e) return false;
  const { forma, color } = opciones;
  const oscuro = tono(color, -0.28);

  if (esInferior(forma)) {
    ctx.fillStyle = color;
    if (forma === 'falda') {
      const falda = poligonoFalda(pts);
      if (!falda) return false;
      trazarPoligono(ctx, falda);
      ctx.fill();
    } else {
      for (const lado of ['izq', 'der'] as const) {
        const pierna = poligonoPierna(pts, forma, lado);
        if (!pierna) continue;
        trazarPoligono(ctx, pierna);
        ctx.fill();
      }
    }
    // Cintura, para que se lea como prenda y no como una mancha.
    ctx.strokeStyle = oscuro;
    ctx.lineWidth = e.ancho * 0.08;
    ctx.beginPath();
    ctx.moveTo(pts[P.CADERA_IZQ].x, pts[P.CADERA_IZQ].y);
    ctx.lineTo(pts[P.CADERA_DER].x, pts[P.CADERA_DER].y);
    ctx.stroke();
    return true;
  }

  // Mangas: trazo grueso hombro → codo → muñeca según el largo.
  if (forma !== 'musculosa') {
    const largoManga = forma === 'manga-larga' || forma === 'chaqueta' || forma === 'camisa';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = e.ancho * 0.34;
    ctx.strokeStyle = color;
    for (const [hombro, codo, muneca] of [
      [P.HOMBRO_IZQ, P.CODO_IZQ, P.MUNECA_IZQ],
      [P.HOMBRO_DER, P.CODO_DER, P.MUNECA_DER],
    ] as const) {
      const inicio = suma(pts[hombro], escala(e.abajo, e.ancho * 0.12));
      ctx.beginPath();
      ctx.moveTo(inicio.x, inicio.y);
      if (largoManga) {
        ctx.lineTo(pts[codo].x, pts[codo].y);
        ctx.lineTo(pts[muneca].x, pts[muneca].y);
      } else {
        const fin = entre(pts[hombro], pts[codo], 0.55);
        ctx.lineTo(fin.x, fin.y);
      }
      ctx.stroke();
    }
  }

  const torso = poligonoTorso(pts, forma);
  if (!torso) return false;
  ctx.fillStyle = color;
  trazarPoligono(ctx, torso);
  ctx.fill();

  // Cuello: se recorta del dibujo para que se vea la piel debajo.
  const cuello = suma(e.centroHombros, escala(e.abajo, e.ancho * 0.05));
  const angulo = Math.atan2(e.cruz.y, e.cruz.x);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.ellipse(cuello.x, cuello.y, e.ancho * 0.18, e.ancho * 0.11, angulo, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = oscuro;
  ctx.lineWidth = e.ancho * 0.03;
  ctx.beginPath();
  ctx.ellipse(cuello.x, cuello.y, e.ancho * 0.18, e.ancho * 0.11, angulo, 0, Math.PI * 2);
  ctx.stroke();

  // Detalles que distinguen una camisa o una chaqueta de una remera.
  if (forma === 'camisa' || forma === 'chaqueta') {
    const desde = suma(e.centroHombros, escala(e.abajo, e.ancho * 0.16));
    const hasta = suma(e.centroCaderas, escala(e.abajo, e.ancho * 0.18));
    ctx.strokeStyle = oscuro;
    ctx.lineWidth = e.ancho * 0.035;
    ctx.beginPath();
    ctx.moveTo(desde.x, desde.y);
    ctx.lineTo(hasta.x, hasta.y);
    ctx.stroke();
    if (forma === 'camisa') {
      ctx.fillStyle = tono(color, 0.35);
      for (let i = 1; i <= 4; i++) {
        const b = entre(desde, hasta, i / 5);
        ctx.beginPath();
        ctx.arc(b.x, b.y, e.ancho * 0.022, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return true;
}
