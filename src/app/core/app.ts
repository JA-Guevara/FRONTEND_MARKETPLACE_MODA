import { Component } from '@angular/core';
import { SiteLayoutComponent } from './layout/site-layout.component';
import { EnvStripComponent } from './layout/env-strip.component';
import { AssistantWidgetComponent } from '../../features/ventas-pagos/presentation/assistant-widget.component';
import { NoticesHostComponent } from '../../shared/ui/notices-host.component';

@Component({
  imports: [SiteLayoutComponent, EnvStripComponent, AssistantWidgetComponent, NoticesHostComponent],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
