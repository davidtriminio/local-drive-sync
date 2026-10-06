import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IconComponent, SELECTABLE_ICONS } from './icon.component';

/**
 * Rejilla de iconos seleccionables (misma librería Lucide). Emite el nombre
 * elegido. Uso: `<app-icon-picker [value]="icon" (valueChange)="icon = $event" />`.
 */
@Component({
  selector: 'app-icon-picker',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="flex flex-wrap gap-1.5">
      @for (name of icons; track name) {
        <button
          type="button"
          (click)="valueChange.emit(name)"
          [title]="name"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
          [class]="
            value === name
              ? 'bg-emerald-500 text-slate-950'
              : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
          "
        >
          <app-icon [name]="name" [size]="18" />
        </button>
      }
    </div>
  `,
})
export class IconPickerComponent {
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  protected readonly icons = SELECTABLE_ICONS;
}
