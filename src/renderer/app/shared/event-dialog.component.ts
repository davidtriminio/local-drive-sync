import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import { IconPickerComponent } from './icon-picker.component';
import { ColorPickerComponent } from './color-picker.component';
import { badgeStyle, chipStyle, DEFAULT_COLOR } from './colors';
import type { Client, EventDraft } from '../../../shared/ipc-contract';

/** Fecha de hoy en AAAA-MM-DD (valor por defecto del modal). */
function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Modal para crear un evento personalizado con todos sus datos: nombre, fecha,
 * icono, color y clientes asociados. Emite el borrador listo para `saveEvent`;
 * quien lo usa decide cómo persistirlo.
 */
@Component({
  selector: 'app-event-dialog',
  standalone: true,
  imports: [FormsModule, IconComponent, IconPickerComponent, ColorPickerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      (click)="cancel.emit()"
    >
      <div
        class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <div class="mb-4 flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl"
            [style]="chip(color)"
          >
            <app-icon [name]="icon" [size]="20" />
          </div>
          <h2 class="text-lg font-semibold">Evento personalizado</h2>
        </div>

        <div class="space-y-4">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-300">
              Nombre del evento
            </label>
            <input
              [(ngModel)]="name"
              class="field"
              placeholder="Ej. Aniversario del cliente"
              autofocus
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-300">Fecha</label>
            <input type="date" [(ngModel)]="date" class="field" />
            <p class="mt-1.5 text-xs text-slate-500">
              Se usa para nombrar las carpetas y archivos del lote.
            </p>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-300">
              Icono y color
            </label>
            <div class="space-y-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
              <app-icon-picker [value]="icon" (valueChange)="icon = $event" />
              <div class="border-t border-white/5 pt-3">
                <app-color-picker [value]="color" (valueChange)="color = $event" />
              </div>
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-300">
              Clientes
              <span class="text-slate-500">({{ selected().size }} seleccionados)</span>
            </label>
            @if (clients.length === 0) {
              <p class="text-xs text-slate-500">No hay clientes registrados todavía.</p>
            } @else {
              <div class="flex flex-wrap gap-1.5">
                @for (c of clients; track c.name) {
                  <button
                    type="button"
                    (click)="toggleClient(c.name)"
                    class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-transform hover:scale-[1.03]"
                    [style]="badge(color, selected().has(c.name))"
                  >
                    @if (selected().has(c.name)) {
                      <app-icon name="check" [size]="12" />
                    }
                    {{ c.name.replaceAll('_', ' ') }}
                  </button>
                }
              </div>
            }
          </div>

          @if (formError()) {
            <p class="text-sm text-rose-300">{{ formError() }}</p>
          }

          <div class="flex justify-end gap-2 pt-1">
            <button (click)="cancel.emit()" class="btn-ghost">Cancelar</button>
            <button (click)="submit()" class="btn-primary">
              <app-icon name="check" [size]="16" /> Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class EventDialogComponent implements OnInit {
  /** Clientes disponibles para asociar al evento. */
  @Input() clients: Client[] = [];
  /** Clientes preseleccionados al abrir. */
  @Input() initialClients: string[] = [];
  @Output() save = new EventEmitter<EventDraft>();
  @Output() cancel = new EventEmitter<void>();

  protected readonly badge = badgeStyle;
  protected readonly chip = chipStyle;
  protected readonly selected = signal<Set<string>>(new Set());
  protected readonly formError = signal('');

  protected name = '';
  protected date = todayIso();
  protected icon = 'calendar';
  protected color = DEFAULT_COLOR;

  ngOnInit(): void {
    this.selected.set(new Set(this.initialClients));
  }

  protected toggleClient(name: string): void {
    const next = new Set(this.selected());
    next.has(name) ? next.delete(name) : next.add(name);
    this.selected.set(next);
  }

  protected submit(): void {
    const name = this.name.trim();
    if (!name) {
      this.formError.set('El nombre es obligatorio.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.date)) {
      this.formError.set('Elige una fecha válida.');
      return;
    }
    const parts = this.date.split('-').map(Number);
    this.save.emit({
      id: crypto.randomUUID(),
      name,
      month: parts[1],
      day: parts[2],
      date: this.date,
      variable: false,
      icon: this.icon,
      color: this.color,
      clients: [...this.selected()],
    });
  }
}
