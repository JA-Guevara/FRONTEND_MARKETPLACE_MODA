import {DataTableComponent} from './data-table.component';
describe('Explorador de tablas',()=>{
  it('ordena valores numéricos sin mutar el reporte original',()=>{
    const c=new DataTableComponent(); c.rows=[['A',100],['B',9],['C',20]];
    c.sort(1); expect(c.visibleRows().map(r=>r[1])).toEqual([9,20,100]);
    expect(c.rows[0][1]).toBe(100);
    c.sort(1); expect(c.visibleRows().map(r=>r[1])).toEqual([100,20,9]);
  });
  it('busca sin distinguir tildes y limita la página al cambiar los resultados',()=>{
    const c=new DataTableComponent(); c.rows=Array.from({length:26},(_,i)=>['Categoría '+i,i]);
    c.page=2; expect(c.visibleRows()).toHaveLength(6);
    c.search='categoria 25'; expect(c.currentPage()).toBe(0); expect(c.visibleRows()).toEqual([['Categoría 25',25]]);
    c.search='sin coincidencias'; expect(c.visibleRows()).toEqual([]); expect(c.pages()).toBe(1);
  });
  it('cambiar de reporte limpia búsqueda, orden y página',()=>{
    const c=new DataTableComponent(); c.search='abc'; c.page=4;c.sortColumn=2;
    c.ngOnChanges({datasetKey:{currentValue:'stock',previousValue:'daily',firstChange:false,isFirstChange:()=>false}});
    expect(c.search).toBe('');expect(c.page).toBe(0);expect(c.sortColumn).toBe(-1);
  });
});
