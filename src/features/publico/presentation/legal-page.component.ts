import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'fs-legal-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="legal-container">
      <header class="legal-header">
        <a class="nav-back" routerLink="/crear-tienda">← Volver a crear mi tienda</a>
        <h1>{{ isPrivacy() ? 'Política de Privacidad y Protección de Datos' : 'Términos y Condiciones del Servicio' }}</h1>
        <div class="meta">
          <span><strong>Versión:</strong> 1.0.0 (2026-11)</span>
          <span><strong>Fecha de vigencia:</strong> 05 de noviembre de 2026</span>
          <span><strong>Plataforma:</strong> FashionStore SaaS Multiempresa</span>
        </div>
      </header>

      <article class="legal-body">
        @if (isPrivacy()) {
          <h2>1. Compromiso de Privacidad y Aislamiento Multitenant</h2>
          <p>
            FashionStore SaaS opera bajo un estricto principio de aislamiento lógico y operativo entre empresas (multitenancy).
            La información cargada por tu empresa (catálogos, precios, inventario, ventas y datos de clientes) es de propiedad exclusiva
            de tu empresa y está aislada mediante identificadores de contexto obligatorios (TenantScope). Ninguna otra empresa suscrita
            puede acceder, consultar ni deducir información de tu negocio.
          </p>

          <h2>2. Datos Recopilados</h2>
          <p>Para la prestación del servicio recopilamos:</p>
          <ul>
            <li><strong>Datos de la empresa:</strong> Razón social, nombre comercial, slug público, ciudad y correo de contacto.</li>
            <li><strong>Datos de acceso y auditoría:</strong> Correo electrónico, nombre de usuarios administradores, direcciones IP y registros de operaciones para seguridad y resolución de conflictos.</li>
            <li><strong>Operaciones comerciales:</strong> Comprobantes, existencias, reservas y movimientos de caja.</li>
          </ul>

          <h2>3. Almacenamiento Local y Operación sin Conexión</h2>
          <p>
            Cuando utilizas la aplicación en modo sin conexión (PWA o app móvil), ciertos datos necesarios para la venta y consulta de catálogo
            se almacenan localmente en la memoria cifrada de tu dispositivo. Al restablecerse la conectividad, las transacciones locales
            se sincronizan de forma segura mediante lotes firmados.
          </p>

          <h2>4. Modelos de Machine Learning e Inteligencia Artificial</h2>
          <p>
            Las funciones analíticas de predicción de demanda, clustering de clientes y generación de reportes con IA procesan exclusivamente
            los datos de tu propio tenant. Tus datos nunca se utilizan para entrenar modelos compartidos ni se exponen a terceros.
          </p>

          <h2>5. Retención y Exportación de Datos</h2>
          <p>
            En caso de cancelación o no renovación de la suscripción, tus datos se conservarán durante un período de gracia y solo lectura de 30 días,
            tiempo durante el cual podrás exportar toda tu información en formatos abiertos (.xlsx, .json). Cumplido el plazo de retención,
            la información podrá ser depurada permanentemente.
          </p>
        } @else {
          <h2>1. Aceptación y Alcance del Servicio</h2>
          <p>
            Al registrarte en FashionStore SaaS, aceptas los presentes Términos y Condiciones. FashionStore proporciona una plataforma
            en la nube para la gestión comercial omnicanal de tiendas de moda y confección, incluyendo punto de venta, inventario multisucursal,
            probador virtual, reservas y tienda pública.
          </p>

          <h2>2. Período de Prueba Gratuita (14 Días)</h2>
          <p>
            Toda nueva empresa registrada mediante alta autoservicio recibe 14 días corridos de prueba gratuita con acceso completo a las funcionalidades
            del plan Profesional. No se requiere tarjeta de crédito ni compromiso de pago para iniciar la prueba. Al finalizar los 14 días,
            puedes contratar un plan de pago o tu cuenta pasará automáticamente al plan Básico para garantizar la continuidad operativa de tus datos.
          </p>

          <h2>3. Ciclo de Vida de la Suscripción</h2>
          <p>
            Las suscripciones se rigen por las siguientes etapas:
          </p>
          <ul>
            <li><strong>Activa:</strong> Operación completa en todos los canales contratados.</li>
            <li><strong>Por vencer:</strong> Notificaciones preventivas a 7, 3 y 1 día antes del término de la vigencia.</li>
            <li><strong>Período de gracia:</strong> 3 días posteriores al vencimiento para regularizar el comprobante sin interrupción.</li>
            <li><strong>Solo lectura:</strong> Si no se registra pago tras el período de gracia, la empresa pasa a modo consulta y exportación, suspendiéndose la creación de nuevas ventas.</li>
            <li><strong>Cancelada:</strong> Tras 30 días en solo lectura, con retención de datos garantizada por 30 días adicionales.</li>
          </ul>

          <h2>4. Responsabilidad y Uso Aceptable</h2>
          <p>
            El usuario administrador es responsable de la confidencialidad de sus credenciales y de la veracidad de los productos publicados
            en su tienda pública. Queda prohibida la carga de contenidos ilegales, malware o el uso de la API para fines contrarios a la ley.
          </p>

          <h2>5. Soporte con Consentimiento de la Empresa</h2>
          <p>
            El personal técnico de la plataforma solo podrá acceder a tu consola o datos bajo una sesión de soporte explícitamente autorizada
            por los administradores de tu empresa con duración acotada, garantizando trazabilidad y auditoría completa.
          </p>
        }
      </article>
    </div>
  `,
  styleUrl: './legal-page.component.scss',
})
export class LegalPageComponent implements OnInit {
  private route = inject(ActivatedRoute);

  isPrivacy = signal(false);

  ngOnInit(): void {
    const docType = this.route.snapshot.data['docType'] || '';
    const url = this.route.snapshot.url.map((u) => u.path).join('/');
    this.isPrivacy.set(docType === 'privacidad' || url.includes('privacidad'));
  }
}
