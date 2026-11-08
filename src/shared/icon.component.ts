import { Component, Input } from '@angular/core';

/**
 * Iconos de línea dibujados con un único trazo SVG. Heredan el color del botón
 * que los contiene (`currentColor`), así que no hay que versionarlos por tema.
 * Si el nombre pedido no existe se dibuja `plus`, para no romper el botón.
 */
export const ICON_PATHS: Record<string, string> = {
  plus: 'M12 5v14 M5 12h14',
  close: 'M6 6l12 12 M18 6 6 18',
  check: 'M4 12.5l5 5L20 6.5',
  save: 'M5 4h11l3 3v13H5z M8 4v6h7V4 M8 20v-6h8v6',
  edit: 'M4 20h4l10-10-4-4L4 16z M14 6l4 4',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.6 M20 4v5h-5',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M16 16l4 4',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  'arrow-left': 'M19 12H5 m6-6-6 6 6 6',
  'arrow-right': 'M5 12h14 m-6-6 6 6-6 6',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  'eye-off': 'M3 3l18 18 M10 5c7-1 12 7 12 7s-1 3-4 5 M6 6c-3 2-4 6-4 6s3 7 10 7c2 0 3-.5 4-1 M10 10a3 3 0 0 0 4 4',
  download: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
  upload: 'M12 16V4 m-5 5 5-5 5 5 M4 16v5h16v-5',
  image: 'M4 5h16v14H4z M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3 M4 16l5-5 5 5 M13 14l3-3 4 4',
  tag: 'M3 12V4h8l9 9-8 8z M7.5 7.5h.01',
  heart: 'M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 6l-1.1-1.2a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.4a5.5 5.5 0 0 0-.1-7.8z',
  box: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z M3 7.5 12 12l9-4.5 M12 12v9',
  users: 'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7 M2 20c0-3.3 2.7-5 6-5s6 1.7 6 5 M17 4.5a3.5 3.5 0 0 1 0 7 M18 15.5c2.4.5 4 2 4 4.5',
  lock: 'M6 11h12v9H6z M9 11V7.5a3 3 0 0 1 6 0V11',
  unlock: 'M6 11h12v9H6z M9 11V7.5a3 3 0 0 1 5.8-1',
  cart: 'M3 3h2l3 12h10l3-9H6 M9 19a1 1 0 1 0 0 2 1 1 0 0 0 0-2 M18 19a1 1 0 1 0 0 2 1 1 0 0 0 0-2',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3.5 6h.01 M3.5 12h.01 M3.5 18h.01',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16 M12 8v4.5l3 2',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4z M12 12.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  calendar: 'M4 5h16v15H4z M4 9h16 M8 3v4 M16 3v4',
  chat: 'M4 4h16v12H9l-5 4z M8 9h8 M8 12h5',
  mic: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v3',
  volume: 'M4 10v4h4l5 4V6L8 10z M16 9a4 4 0 0 1 0 6 M18.5 6.5a7 7 0 0 1 0 11',
  'volume-off': 'M4 10v4h4l5 4V6L8 10z M17 10l4 4 M21 10l-4 4',
  maximize: 'M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5',
  reduce: 'M4 9h5V4 M15 4v5h5 M20 15h-5v5 M9 20v-5H4',
  'arrow-down': 'M12 4v16 m-6-6 6 6 6-6',
  chart: 'M18 20V10 M12 20V4 M6 20v-6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
  sparkles: 'M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  home: 'M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5z',
  return: 'M9 14L4 9l5-5 M4 9h11a5 5 0 0 1 5 5v3',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  building: 'M3 21h18 M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16 M9 8h2 M13 8h2 M9 12h2 M13 12h2 M9 16h2 M13 16h2',
  receipt: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z M8 7h8 M8 11h8 M8 15h5',
  truck: 'M1 3h15v13H1z M16 8h4l3 3v5h-7V8z M5.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M18.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  mail: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M3 7l9 6 9-6',
  key: 'M21 2l-2 2m-1.5 1.5L14 9a5 5 0 1 0 3 3l6-6v-4h-4z M7 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
};

@Component({
  selector: 'fs-icon',
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path [attr.d]="path" />
  </svg>`,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.15em;
        height: 1.15em;
        flex: 0 0 auto;
      }
      svg {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class IconComponent {
  @Input() name = 'plus';
  get path() {
    return ICON_PATHS[this.name] || ICON_PATHS['plus'];
  }
}
