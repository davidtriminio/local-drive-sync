import { Component, inject, signal } from '@angular/core';
import { IpcService } from '../services/ipc.service';
import { IconComponent } from '../shared/icon.component';
import { IconPickerComponent } from '../shared/icon-picker.component';
import { ColorPickerComponent } from '../shared/color-picker.component';
import { EventDialogComponent } from '../shared/event-dialog.component';
import { badgeStyle, chipStyle } from '../shared/colors';
import type { Client, EventDraft, EventItem } from '../../../shared/ipc-contract';

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/**
 * Gestión de eventos y feriados: catálogo integrado de Honduras + eventos
 * personalizados. Cada evento puede asociarse a uno o varios clientes; esa
 * asociación alimenta la creación en lote del creador. Los eventos
 * personalizados llevan una fecha completa que el lote usa al nombrar carpetas.
 */
@Component({
  selector: 'app-events',
  standalone: true,
  imports: [
    IconComponent,
    IconPickerComponent,
    ColorPickerComponent,
    EventDialogComponent,
  ],
  template: `
    <section class="mx-auto max-w-3xl p-8">
      <header class="mb-8 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div
            class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 text-white shadow-lg shadow-indigo-500/20"
          >
            <app-icon name="calendar" [size]="24" />
          </div>
          <div>
            <h1 class="page-title">Eventos y feriados</h1>
            <p class="text-sm text-slate-400">
              Asocia clientes a un evento y crea el arte una sola vez.
            </p>
          </div>
        </div>
        <button (click)="openNew()" class="btn-primary shrink-0">
          <app-icon name="plus" [size]="16" /> Evento personalizado
        </button>
      </header>

      <!-- Lista de eventos -->
      <div class="space-y-3">
        @for (e of events(); track e.id) {
          <div class="card p-4">
            <div class="flex items-start gap-3">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                [style]="chip(e.color)"
              >
                <app-icon [name]="e.icon" [size]="18" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-slate-100">{{ e.name }}</span>
                  @if (e.builtin) {
                    <span
                      class="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500"
                    >
                      Honduras
                    </span>
                  }
                </div>
                <p class="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                  <app-icon name="calendar" [size]="13" /> {{ dateLabel(e) }}
                </p>

                <!-- Clientes asociados -->
                <div class="mt-3 flex flex-wrap items-center gap-1.5">
                  @for (c of clients(); track c.name) {
                    <button
                      (click)="toggleClient(e, c.name)"
                      class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-transform hover:scale-[1.03]"
                      [style]="badge(e.color, e.clients.includes(c.name))"
                    >
                      @if (e.clients.includes(c.name)) {
                        <app-icon name="check" [size]="12" />
                      }
                      {{ c.name.replaceAll('_', ' ') }}
                    </button>
                  }
                  @if (clients().length === 0) {
                    <span class="text-xs text-slate-500">
                      No hay clientes registrados todavía.
                    </span>
                  }
                </div>
              </div>

              <div class="flex shrink-0 items-center gap-1">
                <button
                  (click)="toggleAppearance(e.id)"
                  class="icon-btn"
                  title="Icono y color"
                >
                  <app-icon name="pencil" [size]="16" />
                </button>
                @if (!e.builtin) {
                  <button
                    (click)="removeEvent(e)"
                    class="icon-btn hover:text-rose-300"
                    title="Eliminar evento"
                  >
                    <app-icon name="trash" [size]="16" />
                  </button>
                }
              </div>
            </div>

            @if (appearanceId() === e.id) {
              <div class="mt-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
                <app-icon-picker
                  [value]="e.icon"
                  (valueChange)="setIcon(e, $event)"
                />
                <div class="mt-3 border-t border-white/5 pt-3">
                  <app-color-picker
                    [value]="e.color"
                    (valueChange)="setColor(e, $event)"
                  />
                </div>
              </div>
            }
          </div>
        }
      </div>
    </section>

    @if (showNew()) {
      <app-event-dialog
        [clients]="clients()"
        (save)="createEvent($event)"
        (cancel)="closeNew()"
      />
    }
  `,
})
export class EventsComponent {
  private readonly ipc = inject(IpcService);

  protected readonly events = signal<EventItem[]>([]);
  protected readonly clients = signal<Client[]>([]);
  protected readonly appearanceId = signal('');
  protected readonly showNew = signal(false);

  protected readonly badge = badgeStyle;
  protected readonly chip = chipStyle;

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const [events, clients] = await Promise.all([
      this.ipc.listEvents(),
      this.ipc.listClients(),
    ]);
    this.events.set(events);
    this.clients.set(clients);
  }

  protected dateLabel(e: EventItem): string {
    if (e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
      const [y, m, d] = e.date.split('-').map(Number);
      return `${d} de ${MONTHS[m - 1] ?? '—'} de ${y}`;
    }
    if (e.variable) {
      return e.note || 'Fecha variable';
    }
    return `${e.day} de ${MONTHS[e.month - 1] ?? '—'}`;
  }

  protected openNew(): void {
    this.showNew.set(true);
  }

  protected closeNew(): void {
    this.showNew.set(false);
  }

  protected toggleAppearance(id: string): void {
    this.appearanceId.set(this.appearanceId() === id ? '' : id);
  }

  /** Convierte un evento a borrador para reenviarlo con cambios. */
  private toDraft(e: EventItem): EventDraft {
    return {
      id: e.id,
      name: e.name,
      month: e.month,
      day: e.day,
      date: e.date,
      variable: e.variable,
      note: e.note,
      icon: e.icon,
      color: e.color,
      clients: e.clients,
    };
  }

  protected async toggleClient(e: EventItem, name: string): Promise<void> {
    const clients = e.clients.includes(name)
      ? e.clients.filter((c) => c !== name)
      : [...e.clients, name];
    this.events.set(await this.ipc.saveEvent({ ...this.toDraft(e), clients }));
  }

  protected async setIcon(e: EventItem, icon: string): Promise<void> {
    this.events.set(await this.ipc.saveEvent({ ...this.toDraft(e), icon }));
  }

  protected async setColor(e: EventItem, color: string): Promise<void> {
    this.events.set(await this.ipc.saveEvent({ ...this.toDraft(e), color }));
  }

  protected async removeEvent(e: EventItem): Promise<void> {
    this.events.set(await this.ipc.deleteEvent(e.id));
  }

  protected async createEvent(draft: EventDraft): Promise<void> {
    this.events.set(await this.ipc.saveEvent(draft));
    this.showNew.set(false);
  }
}
