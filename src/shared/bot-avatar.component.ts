import { Component, input, InputSignal } from '@angular/core';

export type BotState = 'idle' | 'wave' | 'processing' | 'success' | 'error';

/** Robot SVG reutilizable del asistente. Se usa tanto en el boton flotante
 * como en la cabecera del chat. Estados: reposo, llamando atencion,
 * procesando, respuesta lista y error. Respeta prefers-reduced-motion. */
@Component({
  selector: 'fs-bot-avatar',
  host: { '[attr.state]': 'state()' },
  styles: `
    :host { display: inline-flex; }
    :host svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.7;
      stroke-linecap: round; stroke-linejoin: round; overflow: visible; }
    .led { fill: #f3c969; stroke: none; animation: botLed 1.5s ease-in-out infinite; }
    .eye { fill: currentColor; stroke: none; transform-box: fill-box; transform-origin: center;
      animation: botBlink 4s ease-in-out infinite; }
    .mouth { opacity: 0; }
    :host([state="idle"]) .line-mouth { opacity: 1; }
    :host([state="wave"]) .smile { opacity: 1; animation: botWiggle 1.6s ease-in-out infinite; }
    :host([state="processing"]) .led { animation-duration: 0.7s; }
    :host([state="processing"]) .dots { opacity: 1; animation: botPulseDots 1s ease-in-out infinite; }
    :host([state="success"]) .smile { opacity: 1; }
    :host([state="error"]) .frown { opacity: 1; }
    @keyframes botLed { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
    @keyframes botBlink { 0%, 90%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.12); } }
    @keyframes botWiggle { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(-7deg); }
      75% { transform: rotate(7deg); } }
    @keyframes botPulseDots { 0%,100% { opacity: 0.25; } 50% { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      .led,.eye,.smile,.dots { animation: none !important; }
    }
  `,
  template: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <circle class="led" cx="12" cy="2.4" r="1" />
    <line x1="12" y1="3.5" x2="12" y2="5.2" />
    <rect x="5" y="5.2" width="14" height="12" rx="4.5" />
    <circle class="eye" cx="9.3" cy="11" r="1.45" />
    <circle class="eye" cx="14.7" cy="11" r="1.45" />
    <path class="line-mouth mouth" d="M9.4 15.8h5.2" />
    <path class="smile mouth" d="M9.4 15.2q1.3 1.5 2.6 0q1.3 1.5 2.6 0" />
    <path class="frown mouth" d="M9.4 17.2q1.3 -1.5 2.6 0q1.3 -1.5 2.6 0" />
    <path class="dots mouth" d="M9.2 15.7h1.4M11.3 15.7h1.4M13.4 15.7h1.4" />
  </svg>`,
})
export class BotAvatarComponent {
  state: InputSignal<BotState> = input<BotState>('idle');
}