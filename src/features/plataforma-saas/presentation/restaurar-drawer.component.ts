import { AfterViewInit, Component, ElementRef, ViewChild, input, output } from '@angular/core';
import { Respaldo } from '../infrastructure/operacion.api';

@Component({
  selector: 'fs-restaurar-drawer', standalone: true, styleUrl: './restaurar-drawer.component.scss',
  template: `<dialog #dialog aria-labelledby="restore-title" (cancel)="close.emit()">
    <header><h2 id="restore-title">Restaurar una copia</h2><button type="button" (click)="close.emit()">Cerrar</button></header>
    <p>Guía de operación. Esta pantalla no escribe ni restaura bases de datos.</p>
    <p>Copia: {{ copia().storage_ref || 'Sin archivo disponible' }}</p>
    <ol>
      <li>Elegir una copia verificada. Descargar el archivo cifrado y su manifiesto desde GitHub Actions.</li>
      <li>Comprobar SHA-256 y descifrar en una carpeta privada fuera de los repositorios. La clave privada queda bajo custodia del operador.</li>
      <li>Preparar una base local vacía y definir VERIFY_DATABASE_URL en la sesión privada.</li>
      <li>Ejecutar el verificador y revisar todos los checks del reporte; medir el tiempo de recuperación.</li>
      <li>Para producción: obtener confirmación escrita y la segunda aprobación del responsable; activar mantenimiento y seguir el runbook.</li>
    </ol>
    <pre>python -m scripts.respaldo.verificar_restauracion --archivo copia.dump --destino-env VERIFY_DATABASE_URL --reporte verificacion.json</pre>
    <p>Una restauración global sobrescribe datos de todas las empresas. El verificador solo acepta local/CI; no ejecuta la restauración de producción.</p>
  </dialog>`,
})
export class RestaurarDrawerComponent implements AfterViewInit {
  readonly copia = input.required<Respaldo>();
  readonly close = output<void>();
  @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLDialogElement>;
  ngAfterViewInit(): void { this.dialog.nativeElement.showModal(); }
}
