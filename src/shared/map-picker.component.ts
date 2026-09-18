import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import {
  CENTRO_POR_DEFECTO,
  Punto,
  Sugerencia,
  enlaceExterno,
  formatear,
  leerPunto,
  leerSugerencias,
  normalizar,
} from './geo';

/**
 * Selector de ubicación sobre un mapa, para no tener que tipear coordenadas.
 *
 * Escribe sobre los campos `latitude` y `longitude` que ya existen en el
 * formulario: el mapa es una forma más cómoda de llenarlos, no un dato nuevo.
 * Quien prefiera tipear los números sigue pudiendo, y el mapa lo sigue.
 *
 * Leaflet se carga **bajo demanda**: son ~150 KB que solo paga quien abre un
 * formulario con mapa, no todas las pantallas de administración.
 *
 * Los mapas y la búsqueda de direcciones son de OpenStreetMap, un servicio
 * externo: si no hay red, el componente lo dice y los campos numéricos siguen
 * funcionando.
 */
@Component({
  selector: 'fs-map-picker',
  imports: [FormsModule, IconComponent],
  template: `<div class="map-picker">
    <div class="map-search">
      <input
        type="search"
        [(ngModel)]="consulta"
        (keydown.enter)="$event.preventDefault(); buscar()"
        [placeholder]="'Buscar una dirección o un lugar'"
        [attr.aria-label]="'Buscar una dirección'"
        name="map-q"
      />
      <button type="button" (click)="buscar()" [disabled]="buscando() || consulta.trim().length < 3">
        <fs-icon name="search" /> Buscar
      </button>
      <button type="button" (click)="usarMiUbicacion()" [disabled]="ubicando()">
        <fs-icon name="selector" /> Mi ubicación
      </button>
    </div>

    @if (sugerencias().length) {
      <ul class="map-results">
        @for (s of sugerencias(); track s.nombre) {
          <li>
            <button type="button" (click)="elegir(s)">{{ s.nombre }}</button>
          </li>
        }
      </ul>
    }

    @if (aviso()) {
      <p class="map-aviso" role="status">{{ aviso() }}</p>
    }

    <div class="map-canvas" #lienzo></div>

    <p class="map-pie">
      <span>{{ etiqueta() }}</span>
      @if (punto(); as p) {
        <a [href]="enlace(p)" target="_blank" rel="noopener noreferrer">Ver en OpenStreetMap</a>
        <button type="button" (click)="limpiar()">Quitar ubicación</button>
      }
    </p>
    <p class="map-ayuda">
      Tocá el mapa o arrastrá el marcador para fijar la sucursal. Los campos de latitud y
      longitud se completan solos, y si los escribís a mano el mapa se mueve.
    </p>
  </div>`,
})
export class MapPickerComponent implements AfterViewInit, OnDestroy {
  /** Formulario que contiene los campos de coordenadas. */
  @Input({ required: true }) grupo!: FormGroup;
  @Input() latKey = 'latitude';
  @Input() lngKey = 'longitude';

  @ViewChild('lienzo') private lienzo!: ElementRef<HTMLElement>;

  consulta = '';
  buscando = signal(false);
  ubicando = signal(false);
  aviso = signal('');
  sugerencias = signal<Sugerencia[]>([]);
  private coordenadas = signal<Punto | null>(null);

  punto = computed(() => this.coordenadas());
  etiqueta = computed(() => formatear(this.coordenadas()));
  enlace = enlaceExterno;

  private mapa: any = null;
  private marcador: any = null;
  private L: any = null;
  private destruido = false;
  private suscripcion: { unsubscribe(): void } | null = null;

  ngAfterViewInit() {
    void this.montar(this.lienzo.nativeElement);
  }

  ngOnDestroy() {
    this.destruido = true;
    this.suscripcion?.unsubscribe();
    // Leaflet deja escuchadores en window si no se lo desmonta.
    this.mapa?.remove?.();
  }

  /** Arranca el mapa una vez que el contenedor existe en el DOM. */
  async montar(contenedor: HTMLElement) {
    this.sincronizarDesdeFormulario();
    // El formulario manda: si alguien escribe las coordenadas a mano, el mapa sigue.
    this.suscripcion = this.grupo.valueChanges.subscribe(() => this.sincronizarDesdeFormulario());
    try {
      const modulo = await import('leaflet');
      if (this.destruido) return;
      this.L = (modulo as any).default || modulo;
      this.dibujar(contenedor);
    } catch {
      this.aviso.set(
        'No se pudo cargar el mapa. Podés escribir la latitud y la longitud a mano.',
      );
    }
  }

  private dibujar(contenedor: HTMLElement) {
    const inicio = this.coordenadas() || CENTRO_POR_DEFECTO;
    this.mapa = this.L.map(contenedor, { attributionControl: true }).setView(
      [inicio.lat, inicio.lng],
      this.coordenadas() ? 16 : 12,
    );
    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      // La licencia de OpenStreetMap exige mostrar la atribución.
      attribution: '&copy; colaboradores de OpenStreetMap',
    }).addTo(this.mapa);

    this.mapa.on('click', (evento: any) => this.fijar(evento.latlng));
    if (this.coordenadas()) this.marcar(this.coordenadas()!);
  }

  private marcar(punto: Punto) {
    if (!this.L || !this.mapa) return;
    if (!this.marcador) {
      // Marcador dibujado con CSS en vez del PNG que trae Leaflet: sus imágenes
      // se referencian por ruta relativa y se rompen al empaquetar.
      const icono = this.L.divIcon({
        className: 'map-marker',
        html: '<span></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
      this.marcador = this.L.marker([punto.lat, punto.lng], { draggable: true, icon: icono }).addTo(
        this.mapa,
      );
      this.marcador.on('dragend', () => this.fijar(this.marcador.getLatLng()));
    } else {
      this.marcador.setLatLng([punto.lat, punto.lng]);
    }
  }

  /** Guarda un punto elegido en el mapa, ya normalizado. */
  private fijar(latlng: { lat: number; lng: number }) {
    const punto = normalizar({ lat: latlng.lat, lng: latlng.lng });
    this.coordenadas.set(punto);
    this.marcar(punto);
    this.grupo.get(this.latKey)?.setValue(punto.lat);
    this.grupo.get(this.lngKey)?.setValue(punto.lng);
    this.grupo.get(this.latKey)?.markAsDirty();
    this.aviso.set('');
  }

  /** Lee lo que hay en el formulario y mueve el marcador si cambió. */
  private sincronizarDesdeFormulario() {
    const punto = leerPunto(this.grupo.get(this.latKey)?.value, this.grupo.get(this.lngKey)?.value);
    const actual = this.coordenadas();
    if (punto && actual && punto.lat === actual.lat && punto.lng === actual.lng) return;
    this.coordenadas.set(punto);
    if (punto) {
      this.marcar(punto);
      this.mapa?.setView?.([punto.lat, punto.lng], Math.max(this.mapa.getZoom?.() || 16, 16));
    }
  }

  limpiar() {
    this.coordenadas.set(null);
    this.grupo.get(this.latKey)?.setValue(null);
    this.grupo.get(this.lngKey)?.setValue(null);
    if (this.marcador) {
      this.mapa?.removeLayer?.(this.marcador);
      this.marcador = null;
    }
  }

  async buscar() {
    const texto = this.consulta.trim();
    if (texto.length < 3 || this.buscando()) return;
    this.buscando.set(true);
    this.aviso.set('');
    this.sugerencias.set([]);
    try {
      // Nominatim, el buscador de OpenStreetMap. Se piden pocos resultados y se
      // limita a Bolivia, que es donde estan las sucursales.
      const url =
        'https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=bo&q=' +
        encodeURIComponent(texto);
      const respuesta = await fetch(url, { headers: { Accept: 'application/json' } });
      const sugerencias = leerSugerencias(await respuesta.json());
      this.sugerencias.set(sugerencias);
      if (!sugerencias.length) this.aviso.set('No encontramos ese lugar. Probá con otra dirección.');
    } catch {
      this.aviso.set('No se pudo buscar la dirección. Marcá el punto en el mapa.');
    } finally {
      this.buscando.set(false);
    }
  }

  elegir(sugerencia: Sugerencia) {
    this.fijar(sugerencia.punto);
    this.sugerencias.set([]);
    this.consulta = sugerencia.nombre;
    this.mapa?.setView?.([sugerencia.punto.lat, sugerencia.punto.lng], 17);
  }

  usarMiUbicacion() {
    if (!navigator.geolocation) {
      this.aviso.set('Este navegador no puede darnos tu ubicación.');
      return;
    }
    this.ubicando.set(true);
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        this.ubicando.set(false);
        this.fijar({ lat: posicion.coords.latitude, lng: posicion.coords.longitude });
        this.mapa?.setView?.([posicion.coords.latitude, posicion.coords.longitude], 17);
      },
      () => {
        this.ubicando.set(false);
        this.aviso.set('No pudimos obtener tu ubicación. Marcá el punto en el mapa.');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }
}
