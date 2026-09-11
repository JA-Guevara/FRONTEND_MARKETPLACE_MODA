import { Component, Input } from '@angular/core';
@Component({selector:'fs-icon',template:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path [attr.d]="paths[name] || paths['plus']" /></svg>`,styles:[`:host{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;flex:0 0 20px}svg{width:100%;height:100%}`]})
export class IconComponent {
  @Input() name='plus';
  paths:Record<string,string>={eye:'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0','eye-off':'M3 3l18 18 M10 5c7-1 12 7 12 7s-1 3-4 5 M6 6c-3 2-4 6-4 6s3 7 10 7c2 0 3-.5 4-1 M10 10a3 3 0 0 0 4 4',download:'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',upload:'M12 16V4 m-5 5 5-5 5 5 M4 16v5h16v-5',plus:'M12 5v14 M5 12h14',close:'M6 6l12 12 M18 6 6 18',menu:'M4 6h16 M4 12h16 M4 18h16'};
}
