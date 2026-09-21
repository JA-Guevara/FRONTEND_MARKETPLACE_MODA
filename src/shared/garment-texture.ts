/**
 * Cómo apoyar la foto real de la prenda sobre el polígono que sigue al cuerpo.
 *
 * Hasta ahora había dos caminos incompatibles: o se dibujaba un polígono de
 * color liso —que sí seguía hombros, codos y muñecas—, o se colgaba la foto
 * como una imagen con `transform` CSS, que se mueve, rota y escala pero **no se
 * deforma**. Con cuatro parámetros no hay forma de que una foto se adapte a un
 * cuerpo: por construcción queda plana, y es lo que se veía como calcomanía.
 *
 * Acá se unen los dos: el polígono decide la forma, y la foto es el relleno.
 * La foto se encuadra sobre la caja del polígono y se recorta contra él, así
 * que hereda el seguimiento del cuerpo que el polígono ya tenía.
 *
 * Todo lo que decide dónde va la imagen son funciones puras: se verifican sin
 * cámara y sin canvas, que es donde de verdad se cometen los errores.
 */

export interface Punto {
  x: number;
  y: number;
}

export interface Caja {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Caja que envuelve al polígono. */
export function cajaDe(puntos: Punto[]): Caja | null {
  if (!puntos.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of puntos) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null;
  return { x: minX, y: minY, ancho: maxX - minX, alto: maxY - minY };
}

/** Ángulo de los hombros: la foto se inclina con el cuerpo. */
export function inclinacion(izquierdo: Punto, derecho: Punto): number {
  return Math.atan2(derecho.y - izquierdo.y, derecho.x - izquierdo.x);
}

export interface Encuadre {
  /** Centro del dibujo, en coordenadas del lienzo. */
  centro: Punto;
  /** Tamaño con el que se dibuja la imagen. */
  ancho: number;
  alto: number;
  /** Giro en radianes. */
  giro: number;
}

/**
 * Dónde dibujar la imagen para que cubra el polígono.
 *
 * La imagen **cubre** la caja en vez de caber dentro: si sobra, se recorta
 * contra el polígono, que es justo lo que se quiere. Encajarla dentro dejaría
 * franjas vacías en los hombros o en el ruedo.
 */
export function encuadrar(
  caja: Caja,
  imagen: { width: number; height: number },
  giro = 0,
  holgura = 1,
): Encuadre | null {
  if (!imagen.width || !imagen.height || caja.ancho <= 0 || caja.alto <= 0) return null;
  const escala = Math.max(caja.ancho / imagen.width, caja.alto / imagen.height) * holgura;
  return {
    centro: { x: caja.x + caja.ancho / 2, y: caja.y + caja.alto / 2 },
    ancho: imagen.width * escala,
    alto: imagen.height * escala,
    giro,
  };
}

/**
 * Reparte la altura del polígono en bandas horizontales.
 *
 * Es la base para que la prenda se estire distinto a la altura del pecho que a
 * la de la cadera. Se devuelve la fracción de altura de cada banda, de arriba
 * hacia abajo.
 */
export function bandas(cantidad: number): number[] {
  const n = Math.max(1, Math.floor(cantidad));
  return Array.from({ length: n + 1 }, (_, i) => i / n);
}

/**
 * Punto interpolado dentro del polígono del torso, en coordenadas (u, v).
 *
 * `u` va de 0 (borde izquierdo) a 1 (derecho) y `v` de 0 (hombros) a 1 (ruedo).
 * Se usa para saber a qué parte del cuerpo corresponde cada trozo de la foto.
 */
export function puntoEnCuadrilatero(
  supIzq: Punto,
  supDer: Punto,
  infIzq: Punto,
  infDer: Punto,
  u: number,
  v: number,
): Punto {
  const arriba = { x: supIzq.x + (supDer.x - supIzq.x) * u, y: supIzq.y + (supDer.y - supIzq.y) * u };
  const abajo = { x: infIzq.x + (infDer.x - infIzq.x) * u, y: infIzq.y + (infDer.y - infIzq.y) * u };
  return { x: arriba.x + (abajo.x - arriba.x) * v, y: arriba.y + (abajo.y - arriba.y) * v };
}

/** Una imagen sirve de textura solo si ya se cargó y tiene tamaño. */
export function texturaUsable(imagen: unknown): imagen is CanvasImageSource & {
  width: number;
  height: number;
} {
  if (!imagen || typeof imagen !== 'object') return false;
  const candidata = imagen as { width?: unknown; height?: unknown; complete?: unknown };
  if (typeof candidata.width !== 'number' || typeof candidata.height !== 'number') return false;
  if (candidata.width <= 0 || candidata.height <= 0) return false;
  // Una <img> a medio cargar dibuja un hueco; `complete` lo delata.
  return candidata.complete === undefined || candidata.complete === true;
}

/** Transformación afín de canvas: [a c e ; b d f]. */
export interface Afin {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/**
 * Transformación que lleva un triángulo de la foto a un triángulo del cuerpo.
 *
 * Es la pieza que faltaba para **deformar** en vez de recortar. Recortar la
 * foto contra la silueta la deja intacta: si el cuerpo es más angosto, las
 * mangas se cortan y la prenda queda como una losa. Estirando triángulo a
 * triángulo, la prenda se adapta al cuerpo.
 *
 * Devuelve null si el triángulo de origen es degenerado: no hay estiramiento
 * posible y forzarlo pintaría basura.
 */
export function afinDeTriangulo(origen: Punto[], destino: Punto[]): Afin | null {
  if (origen.length < 3 || destino.length < 3) return null;
  const [o0, o1, o2] = origen;
  const [d0, d1, d2] = destino;
  const det = o0.x * (o1.y - o2.y) + o1.x * (o2.y - o0.y) + o2.x * (o0.y - o1.y);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return null;

  const a = (d0.x * (o1.y - o2.y) + d1.x * (o2.y - o0.y) + d2.x * (o0.y - o1.y)) / det;
  const c = (o0.x * (d1.x - d2.x) + o1.x * (d2.x - d0.x) + o2.x * (d0.x - d1.x)) / det;
  const e =
    (o0.x * (o1.y * d2.x - o2.y * d1.x) +
      o1.x * (o2.y * d0.x - o0.y * d2.x) +
      o2.x * (o0.y * d1.x - o1.y * d0.x)) /
    det;
  const b = (d0.y * (o1.y - o2.y) + d1.y * (o2.y - o0.y) + d2.y * (o0.y - o1.y)) / det;
  const d = (o0.x * (d1.y - d2.y) + o1.x * (d2.y - d0.y) + o2.x * (d0.y - d1.y)) / det;
  const f =
    (o0.x * (o1.y * d2.y - o2.y * d1.y) +
      o1.x * (o2.y * d0.y - o0.y * d2.y) +
      o2.x * (o0.y * d1.y - o1.y * d0.y)) /
    det;
  if (![a, b, c, d, e, f].every(Number.isFinite)) return null;
  return { a, b, c, d, e, f };
}

/** Una celda de la malla: de dónde sale en la foto y a dónde va en el cuerpo. */
export interface Celda {
  origen: [Punto, Punto, Punto, Punto];
  destino: [Punto, Punto, Punto, Punto];
}

/**
 * Reparte la foto en celdas y dice a qué parte del cuerpo va cada una.
 *
 * `esquinas` son las cuatro del cuadrilátero del cuerpo, en el orden
 * superior-izquierda, superior-derecha, inferior-derecha, inferior-izquierda,
 * que es como los devuelven los polígonos del renderizador.
 */
export function mallaDeTextura(
  imagen: { width: number; height: number },
  esquinas: Punto[],
  columnas = 4,
  filas = 6,
): Celda[] {
  if (esquinas.length < 4 || !imagen.width || !imagen.height) return [];
  const [si, sd, id, ii] = esquinas;
  const nc = Math.max(1, Math.floor(columnas));
  const nf = Math.max(1, Math.floor(filas));
  const celdas: Celda[] = [];
  const cuerpo = (u: number, v: number) => puntoEnCuadrilatero(si, sd, ii, id, u, v);
  const foto = (u: number, v: number) => ({ x: u * imagen.width, y: v * imagen.height });

  for (let fila = 0; fila < nf; fila++) {
    for (let col = 0; col < nc; col++) {
      const u0 = col / nc;
      const u1 = (col + 1) / nc;
      const v0 = fila / nf;
      const v1 = (fila + 1) / nf;
      celdas.push({
        origen: [foto(u0, v0), foto(u1, v0), foto(u1, v1), foto(u0, v1)],
        destino: [cuerpo(u0, v0), cuerpo(u1, v0), cuerpo(u1, v1), cuerpo(u0, v1)],
      });
    }
  }
  return celdas;
}

/**
 * Agranda un triángulo desde su centro.
 *
 * Al dibujar una malla, cada triángulo se recorta contra su propio contorno y
 * el suavizado de bordes deja un hilo transparente entre vecinos: la prenda se
 * ve agrietada como un mosaico. Solapando un poco cada pieza, las grietas
 * desaparecen sin que se note el sobredibujo.
 */
export function expandirTriangulo(triangulo: Punto[], pixeles = 0.6): Punto[] {
  if (triangulo.length < 3) return triangulo;
  const cx = (triangulo[0].x + triangulo[1].x + triangulo[2].x) / 3;
  const cy = (triangulo[0].y + triangulo[1].y + triangulo[2].y) / 3;
  return triangulo.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const largo = Math.hypot(dx, dy);
    if (largo < 1e-6) return { x: p.x, y: p.y };
    const k = (largo + pixeles) / largo;
    return { x: cx + dx * k, y: cy + dy * k };
  });
}
