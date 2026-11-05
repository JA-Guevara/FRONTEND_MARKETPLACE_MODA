import { Injectable, signal } from '@angular/core';

export interface LineaTicket {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
}

export interface DatosTicket {
  tiendaNombre: string;
  sucursal?: string;
  fecha?: string;
  numeroTicket: string;
  cajero?: string;
  lineas: LineaTicket[];
  subtotal: number;
  descuento?: number;
  total: number;
  moneda?: string;
  mensajePie?: string;
}

export interface OpcionesImpresion {
  ancho?: 58 | 80;
  abrirGaveta?: boolean;
  cortarPapel?: boolean;
  baudRate?: number;
}

@Injectable({ providedIn: 'root' })
export class ImpresoraTermica {
  readonly supported = signal<boolean>(false);
  readonly connected = signal<boolean>(false);

  private activePort: any = null;

  constructor() {
    this.checkSupport();
  }

  checkSupport(): boolean {
    const isAvail = typeof navigator !== 'undefined' && 'serial' in navigator;
    this.supported.set(isAvail);
    return isAvail;
  }

  /**
   * Imprime un ticket utilizando Web Serial (ESC/POS) en Chrome/Edge.
   * Si no hay soporte o la conexión falla, recurre a la impresión nativa del navegador.
   */
  async imprimirTicket(datos: DatosTicket, opciones: OpcionesImpresion = {}): Promise<'serial' | 'browser'> {
    if (this.checkSupport()) {
      try {
        const port = await this.obtenerPuerto();
        if (port) {
          const comandos = this.generarEscPos(datos, opciones);
          await this.enviarComandos(port, comandos, opciones.baudRate ?? 9600);
          return 'serial';
        }
      } catch {
        // En caso de cancelación de diálogo o error del puerto, continuar al respaldo del navegador
      }
    }

    // Respaldo para navegadores sin Web Serial (Firefox, Safari) o sin impresora conectada
    this.imprimirConNavegador();
    return 'browser';
  }

  async abrirGaveta(baudRate = 9600): Promise<boolean> {
    if (!this.checkSupport()) return false;
    try {
      const port = await this.obtenerPuerto();
      if (!port) return false;
      // Comando ESC p 0 25 250 (pulso de apertura de cajón de dinero)
      const cmd = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
      await this.enviarComandos(port, cmd, baudRate);
      return true;
    } catch {
      return false;
    }
  }

  async cortarPapel(baudRate = 9600): Promise<boolean> {
    if (!this.checkSupport()) return false;
    try {
      const port = await this.obtenerPuerto();
      if (!port) return false;
      // Comando GS V 65 0 (corte parcial / total de papel)
      const cmd = new Uint8Array([0x1b, 0x64, 0x03, 0x1d, 0x56, 0x41, 0x00]);
      await this.enviarComandos(port, cmd, baudRate);
      return true;
    } catch {
      return false;
    }
  }

  generarEscPos(datos: DatosTicket, opciones: OpcionesImpresion): Uint8Array {
    const anchoMax = opciones.ancho === 80 ? 48 : 32;
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];

    // 1. Inicialización ESC @
    chunks.push(new Uint8Array([0x1b, 0x40]));

    // 2. Apertura de gaveta si se solicitó
    if (opciones.abrirGaveta) {
      chunks.push(new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]));
    }

    // 3. Encabezado centrado y en negrita
    chunks.push(new Uint8Array([0x1b, 0x61, 0x01])); // Centrar
    chunks.push(new Uint8Array([0x1b, 0x45, 0x01])); // Negrita on
    chunks.push(encoder.encode(`${datos.tiendaNombre}\n`));
    chunks.push(new Uint8Array([0x1b, 0x45, 0x00])); // Negrita off

    if (datos.sucursal) {
      chunks.push(encoder.encode(`Sucursal: ${datos.sucursal}\n`));
    }
    chunks.push(encoder.encode(`Ticket: ${datos.numeroTicket}\n`));
    chunks.push(encoder.encode(`Fecha: ${datos.fecha ?? new Date().toLocaleString()}\n`));
    if (datos.cajero) {
      chunks.push(encoder.encode(`Atendido por: ${datos.cajero}\n`));
    }

    // Separador
    chunks.push(encoder.encode(`${'-'.repeat(anchoMax)}\n`));

    // 4. Detalle de líneas a la izquierda
    chunks.push(new Uint8Array([0x1b, 0x61, 0x00])); // Alinear izquierda
    for (const linea of datos.lineas) {
      const lineaTexto = `${linea.cantidad}x ${linea.descripcion}`;
      const totalTexto = `${(datos.moneda ?? 'Bs')} ${linea.total.toFixed(2)}`;
      const espaciado = anchoMax - lineaTexto.length - totalTexto.length;
      if (espaciado > 0) {
        chunks.push(encoder.encode(`${lineaTexto}${' '.repeat(espaciado)}${totalTexto}\n`));
      } else {
        chunks.push(encoder.encode(`${lineaTexto}\n${' '.repeat(Math.max(0, anchoMax - totalTexto.length))}${totalTexto}\n`));
      }
    }

    // Separador
    chunks.push(encoder.encode(`${'-'.repeat(anchoMax)}\n`));

    // 5. Totales
    chunks.push(new Uint8Array([0x1b, 0x61, 0x02])); // Alinear derecha
    if (datos.descuento && datos.descuento > 0) {
      chunks.push(encoder.encode(`Subtotal: ${(datos.moneda ?? 'Bs')} ${datos.subtotal.toFixed(2)}\n`));
      chunks.push(encoder.encode(`Descuento: -${(datos.moneda ?? 'Bs')} ${datos.descuento.toFixed(2)}\n`));
    }

    chunks.push(new Uint8Array([0x1b, 0x45, 0x01])); // Negrita on
    chunks.push(encoder.encode(`TOTAL: ${(datos.moneda ?? 'Bs')} ${datos.total.toFixed(2)}\n`));
    chunks.push(new Uint8Array([0x1b, 0x45, 0x00])); // Negrita off

    // 6. Pie de página centrado
    chunks.push(new Uint8Array([0x1b, 0x61, 0x01])); // Centrar
    chunks.push(encoder.encode('\n'));
    chunks.push(encoder.encode(`${datos.mensajePie ?? '¡Gracias por su compra!'}\n`));
    chunks.push(encoder.encode('\n\n\n'));

    // 7. Corte de papel
    if (opciones.cortarPapel !== false) {
      chunks.push(new Uint8Array([0x1b, 0x64, 0x03, 0x1d, 0x56, 0x41, 0x00]));
    }

    // Unir todos los fragmentos
    const longitudTotal = chunks.reduce((acc, c) => acc + c.length, 0);
    const resultado = new Uint8Array(longitudTotal);
    let offset = 0;
    for (const chunk of chunks) {
      resultado.set(chunk, offset);
      offset += chunk.length;
    }
    return resultado;
  }

  private async obtenerPuerto(): Promise<any> {
    if (this.activePort) return this.activePort;
    const serial = (navigator as any).serial;
    const ports = await serial.getPorts();
    if (ports && ports.length > 0) {
      this.activePort = ports[0];
      this.connected.set(true);
      return ports[0];
    }
    // Solicitar al usuario seleccionar puerto
    const selected = await serial.requestPort();
    this.activePort = selected;
    this.connected.set(true);
    return selected;
  }

  private async enviarComandos(port: any, datos: Uint8Array, baudRate: number): Promise<void> {
    if (!port.readable) {
      await port.open({ baudRate });
    }
    const writer = port.writable.getWriter();
    try {
      await writer.write(datos);
    } finally {
      writer.releaseLock();
    }
  }

  private imprimirConNavegador(): void {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  }
}
