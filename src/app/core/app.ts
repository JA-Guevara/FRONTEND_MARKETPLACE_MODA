import { Component } from '@angular/core';
import { SiteLayoutComponent } from './layout/site-layout.component';
import { EnvStripComponent } from './layout/env-strip.component';
import { AssistantWidgetComponent } from '../../features/ventas-pagos/presentation/assistant-widget.component';

@Component({
  imports: [SiteLayoutComponent, EnvStripComponent, AssistantWidgetComponent],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
