import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BADGE_COLORS } from './colors';

/**
 * Fila de muestras de color seleccionables. Emite el hex elegido.
 * Uso: `<app-color-picker [value]="color" (valueChange)="color = $event" />`.
 */
@Component({
  selector: 'app-color-picker',
  standalone: true,
  template: `
    <div class="flex flex-wrap gap-2">
      @for (c of colors; track c) {
        <button
          type="button"
          (click)="valueChange.emit(c)"
          [title]="c"
          class="h-6 w-6 rounded-full transition-transform hover:scale-110"
          [style.background]="c"
          [class.ring-2]="value === c"
          [class.ring-white]="value === c"
          [class.ring-offset-2]="value === c"
          [style.--tw-ring-offset-color]="'#0f172a'"
        ></button>
      }
    </div>
  `,
})
export class ColorPickerComponent {
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  protected readonly colors = BADGE_COLORS;
}
