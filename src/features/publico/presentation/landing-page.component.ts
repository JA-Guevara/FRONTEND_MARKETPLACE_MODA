import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TiendasPublicasApi, TiendaPublica } from '../infrastructure/tiendas-publicas.api';
import { errorMessage } from '../../../shared/errors';

interface FaqItem {
  pregunta: string;
  respuesta: string;
}

@Component({
  selector: 'fs-landing-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
})
export class LandingPageComponent implements OnInit {
  private api = inject(TiendasPublicasApi);
  private destroy = inject(DestroyRef);

  readonly stores = signal<TiendaPublica[]>([]);
  readonly loadingStores = signal(true);
  readonly errorStores = signal('');
  readonly storeSearch = signal('');
  readonly billingPeriod = signal<'mensual' | 'anual'>('mensual');
  readonly openFaqIndex = signal<number | null>(0);

  readonly filteredStores = computed(() => {
    const q = this.storeSearch().trim().toLowerCase();
    const list = this.stores();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.trade_name.toLowerCase().includes(q) ||
        (s.city && s.city.toLowerCase().includes(q)) ||
        (s.slogan && s.slogan.toLowerCase().includes(q)) ||
        s.slug.toLowerCase().includes(q)
    );
  });

  readonly faqs: FaqItem[] = [
    {
      pregunta: '¿Qué sucede si se corta internet en mi tienda física?',
      respuesta:
        'FashionStore cuenta con un motor Offline-First en su caja y catálogo local. Tu equipo de ventas puede seguir cobrando y registrando reservas sin conexión. Cuando internet regresa, el sistema sincroniza automáticamente las ventas y actualiza el inventario sin riesgo de inconsistencias.',
    },
    {
      pregunta: '¿Cómo funciona el Probador Virtual 3D y qué ventajas ofrece?',
      respuesta:
        'El probador permite proyectar prendas sobre siluetas y avatares 3D basados en las medidas de cada cliente. Esto reduce devoluciones, mejora la confianza de compra y permite reservar prendas para probárselas en la sucursal física elegida.',
    },
    {
      pregunta: '¿Necesito tarjeta de crédito para iniciar la prueba gratuita?',
      respuesta:
        'No. Puedes registrar tu tienda y comenzar de inmediato con 14 días de prueba completa del Plan Profesional sin ingresar tarjeta ni ningún método de pago. Al finalizar el período, decides si continuar con Profesional o pasar al Plan Básico.',
    },
    {
      pregunta: '¿Puedo tener múltiples sucursales y personal asignado por caja?',
      respuesta:
        'Sí. Puedes crear múltiples sucursales (Santa Cruz, La Paz, Cochabamba, etc.), definir cajas independientes y asignar usuarios con roles específicos (administrador, cajero, encargado de tienda) autorizados solo en las sucursales que elijas.',
    },
    {
      pregunta: '¿Mis datos están seguros y aislados de otras empresas?',
      respuesta:
        'Absolutamente. FashionStore SaaS aplica un esquema estricto de aislamiento multiempresa por token (RN03). Ninguna empresa puede ver ni consultar datos de otra, y cada empresa cuenta con herramientas para respaldar y exportar sus datos cuando lo desee.',
    },
  ];

  ngOnInit() {
    this.cargarTiendas();
  }

  cargarTiendas() {
    this.loadingStores.set(true);
    this.errorStores.set('');
    this.api
      .listar(1, 48)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (resp) => {
          this.stores.set(resp.items || []);
          this.loadingStores.set(false);
        },
        error: (err) => {
          this.errorStores.set(errorMessage(err));
          this.loadingStores.set(false);
        },
      });
  }

  toggleFaq(index: number) {
    if (this.openFaqIndex() === index) {
      this.openFaqIndex.set(null);
    } else {
      this.openFaqIndex.set(index);
    }
  }

  getInitials(name: string): string {
    if (!name) return 'FS';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
}
