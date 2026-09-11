import { Component, EventEmitter, Input, OnDestroy, Output, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { ApiResponse } from './models';
import { errorMessage } from './errors';

@Component({selector:'fs-image-form',imports:[FormsModule],template:`
<form #form="ngForm" (ngSubmit)="submit(form)" class="image-editor">
<div class="tabs" aria-label="Origen de la imagen"><button type="button" [class.selected]="mode==='url'" (click)="mode='url';previewFailed=false">Pegar enlace</button><button type="button" [class.selected]="mode==='file'" (click)="mode='file';previewFailed=false">Subir archivo</button></div>
@if(mode==='url'){<label>URL de la imagen<input type="url" name="image_url" [(ngModel)]="url" (ngModelChange)="previewFailed=false" placeholder="https://…" required pattern="https?://.+"></label>}
@else{<label class="upload-area">Elegí una imagen<input type="file" accept="image/png,image/jpeg,image/webp" (change)="selectFile($event)"><small>JPEG, PNG o WebP. Hasta 5 MB; la vista previa no sube el archivo todavía.</small></label>}
<div class="image-preview">@if(preview() && !previewFailed){<img [src]="preview()" alt="Vista previa de la imagen seleccionada" (error)="previewFailed=true">}@else{<span>{{previewFailed?'No se pudo cargar la vista previa. Revisá el enlace.':'Vista previa de tu imagen'}}</span>}</div>
<label>Descripción de la imagen<input name="alt" [(ngModel)]="alt" maxlength="255" placeholder="Ej.: Camisa beige, vista frontal"></label>
<div class="form-grid"><label>Orden<input type="number" name="sort" [(ngModel)]="sort" min="0" step="1" required></label><label class="check"><input type="checkbox" name="primary" [(ngModel)]="primary">Imagen principal</label></div>
@if(error()){<p class="alert error" role="alert">{{error()}}</p>}
<div class="form-actions"><button class="primary" [disabled]="busy||uploading()">{{uploading()?'Subiendo imagen…':busy?'Guardando…':'Agregar imagen'}}</button><button type="button" [disabled]="busy||uploading()" (click)="cancel.emit()">Cancelar</button></div></form>`,
styles:[`:host{display:block}.image-editor{display:grid;gap:16px}.image-preview{height:180px;background:#eeeae2;border:1px dashed #b7afa0;border-radius:10px;display:grid;place-items:center;color:#706b60;font-size:12px;overflow:hidden}.image-preview img{width:100%;height:100%;object-fit:contain}.upload-area{padding:20px;background:#f0ede6;border-radius:8px}.form-actions{margin-top:0}`]})
export class ImageFormComponent implements OnDestroy {
  @Input() busy=false;@Output() saved=new EventEmitter<Record<string,unknown>>();@Output() cancel=new EventEmitter<void>();
  private http=inject(HttpClient);mode:'url'|'file'='url';url='';alt='';sort=0;primary=false;file:File|null=null;objectUrl='';previewFailed=false;uploading=signal(false);error=signal('');
  preview(){return this.mode==='file'?this.objectUrl:/^https?:\/\//.test(this.url)?this.url:'';}
  selectFile(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];this.error.set('');this.file=null;if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);this.objectUrl='';if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){this.error.set('Elegí un JPEG, PNG o WebP de hasta 5 MB.');input.value='';return;}this.file=file;this.objectUrl=URL.createObjectURL(file);this.previewFailed=false;}
  async submit(form:NgForm){if(this.busy||this.uploading())return;form.control.markAllAsTouched();this.error.set('');if(form.invalid||!Number.isInteger(this.sort)||this.sort<0){this.error.set('Revisá el enlace y el orden de la imagen.');return;}if(this.mode==='file'&&!this.file){this.error.set('Elegí una imagen antes de continuar.');return;}this.uploading.set(true);try{let url=this.url.trim();if(this.mode==='file'){const body=new FormData();body.append('file',this.file!);const response=await firstValueFrom(this.http.post<ApiResponse<{url:string}>>(environment.apiUrl+'/media/images',body));url=response.data.url;this.url=url;this.mode='url';}this.saved.emit({url,alt_text:this.alt.trim()||null,sort_order:this.sort,is_primary:this.primary});}catch(e){this.error.set(errorMessage(e));}finally{this.uploading.set(false);}}
  ngOnDestroy(){if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);}
}
