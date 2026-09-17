import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
@Component({
  selector: 'fs-data-table', imports: [FormsModule],
  template: `
    <div class="tools"><label>Buscar en esta tabla<input type="search" [(ngModel)]="search" (ngModelChange)="page=0" placeholder="Nombre, sucursal, fecha…" /></label><label>Filas por página<select [(ngModel)]="pageSize" (ngModelChange)="page=0"><option [ngValue]="10">10</option><option [ngValue]="25">25</option><option [ngValue]="50">50</option></select></label></div>
    <div class="scroll" tabindex="0" role="region" [attr.aria-label]="ariaLabel + ', desplazamiento horizontal'">
      <table><caption>{{ ariaLabel }}</caption><thead><tr>
        @for (h of headers; track $index; let i=$index) { <th scope="col" [attr.aria-sort]="sortColumn===i ? (ascending ? 'ascending' : 'descending') : 'none'"><button type="button" (click)="sort(i)" [attr.aria-label]="'Ordenar por '+h">{{ h }} <span aria-hidden="true">{{ sortColumn===i ? (ascending ? '↑' : '↓') : '↕' }}</span></button></th> }
      </tr></thead><tbody>
        @for (row of visibleRows(); track $index) { <tr>@for (cell of row; track $index) { <td [class.numeric]="isNumber(cell)">{{ display(cell) }}</td> }</tr> }
        @empty { <tr><td [attr.colspan]="headers.length" class="empty">{{ rows.length ? 'No hay coincidencias con la búsqueda.' : emptyText }}</td></tr> }
      </tbody></table>
    </div>
    <div class="pager"><span>{{ filteredRows().length }} filas · página {{ currentPage()+1 }} de {{ pages() }}</span><div><button type="button" (click)="page=currentPage()-1" [disabled]="currentPage()===0">Anterior</button><button type="button" (click)="page=currentPage()+1" [disabled]="currentPage()+1>=pages()">Siguiente</button></div></div>
  `,
  styles: [`
    :host{display:block;min-width:0}.tools,.pager{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:end;margin:16px 0}.tools label{display:grid;gap:6px;font-size:.75rem}.tools label:first-child{flex:1 1 200px}input,select{width:100%;min-width:0;padding:10px;border:1px solid #d8d2cd;border-radius:8px;min-height:42px;background:white}.scroll{max-width:100%;overflow:auto;border:1px solid #e6e1dc;border-radius:12px}.scroll:focus-visible{outline:3px solid #ad748a}table{border-collapse:collapse;width:100%;font-size:.82rem;white-space:nowrap}caption{text-align:left;font-size:.75rem;padding:12px;color:#706b68}th{background:#f4f0ee;text-align:left;font-weight:600}th,td{padding:12px 16px;border-bottom:1px solid #eee8e1}th button{background:transparent;color:#59424c;padding:0;border:0;text-align:left;font:inherit;min-height:32px;cursor:pointer}tbody tr:nth-child(even){background:#fcfbfa}tbody tr:hover{background:#faf3f6}.numeric{text-align:right;font-variant-numeric:tabular-nums}.empty{padding:28px;color:#706b68;white-space:normal}.pager{font-size:.75rem;color:#706b68}.pager div{display:flex;gap:8px}.pager button{min-height:40px;border-radius:8px;padding:8px 12px}button:disabled{opacity:.45}button:focus-visible{outline:3px solid #ad748a}
  `],
})
export class DataTableComponent implements OnChanges {
  @Input() headers: string[]=[];
  @Input() rows: (string|number)[][]=[];
  @Input() datasetKey='';
  @Input() emptyText='Sin datos para este período.';
  @Input() ariaLabel='Tabla de datos';
  search=''; page=0; pageSize=10; sortColumn=-1; ascending=true;
  ngOnChanges(changes: SimpleChanges) { if(changes['datasetKey']) { this.search=''; this.page=0; this.sortColumn=-1; } }
  private normalize(value:unknown) { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
  filteredRows() {
    const query=this.normalize(this.search.trim());
    const rows=this.rows.filter(row=>!query || row.some(cell=>this.normalize(cell).includes(query)));
    if(this.sortColumn>=0) rows.sort((a,b)=>{
      const x=a[this.sortColumn],y=b[this.sortColumn];
      const compared=typeof x==='number' && typeof y==='number' ? x-y : String(x??'').localeCompare(String(y??''),'es',{numeric:true});
      return this.ascending ? compared : -compared;
    });
    return rows;
  }
  pages() { return Math.max(1,Math.ceil(this.filteredRows().length/this.pageSize)); }
  currentPage() { return Math.min(Math.max(0,this.page),this.pages()-1); }
  visibleRows() { return this.filteredRows().slice(this.currentPage()*this.pageSize,(this.currentPage()+1)*this.pageSize); }
  sort(column:number) { this.ascending=this.sortColumn===column ? !this.ascending : true; this.sortColumn=column; this.page=0; }
  isNumber(value:unknown) { return typeof value==='number'; }
  display(value:string|number) { return typeof value==='number' ? value.toLocaleString('es-BO',{maximumFractionDigits:2}) : value; }
}
