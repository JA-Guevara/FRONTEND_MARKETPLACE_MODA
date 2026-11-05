import { Component } from '@angular/core';
import { SiteLayoutComponent } from './layout/site-layout.component';
import { EnvStripComponent } from './layout/env-strip.component';

@Component({
  imports: [SiteLayoutComponent, EnvStripComponent],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
