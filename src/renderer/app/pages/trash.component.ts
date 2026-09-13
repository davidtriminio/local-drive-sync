import { Component, inject, signal } from '@angular/core';
import { IpcService } from '../services/ipc.service';
import { IconComponent } from '../shared/icon.component';
import { formatBytes, formatDateTime } from '../shared/format.util';
import type { TrashEntry } from '../../../shared/ipc-contract';

@Component({
  selector: 'app-trash',
  standalone: true,
  imports: [IconComponent],
  template: `
    <section class="mx-auto max-w-4xl p-8">
      <header class="mb-8 flex items-center gap-3">
        <div
          class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 text-white shadow-lg shadow-slate-500/20"
        >
          <app-icon name="trash" [size]="24" />
        </div>
        <div>
          <h1 class="page-title">Papelera</h1>
          <p class="text-sm text-slate-400">
            Versiones respaldadas antes de sobrescribir en Drive.
          </p>
        </div>
      </header>

      @if (entries().length === 0) {
        <div
          class="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-12 text-center text-slate-400"
        >
          La papelera está vacía.
        </div>
      } @else {
        <ul class="space-y-2">
          @for (e of entries(); track e.id) {
            <li class="card flex items-center justify-between p-3">
              <div class="min-w-0">
                <div class="truncate font-mono text-xs text-slate-300">{{ e.relPath }}</div>
                <div class="text-xs text-slate-500">
                  {{ fmtDate(e.createdAt) }} · {{ fmtBytes(e.size) }}
                </div>
              </div>
              <button (click)="restaurar(e)" class="btn-ghost shrink-0">
                <app-icon name="refresh" [size]="14" /> Restaurar
              </button>
            </li>
          }
        </ul>
      }
      @if (message()) {
        <p class="mt-4 flex items-center gap-2 text-sm text-emerald-300">
          <app-icon name="check" [size]="16" /> {{ message() }}
        </p>
      }
    </section>
  `,
})
export class TrashComponent {
  private readonly ipc = inject(IpcService);
  protected readonly entries = signal<TrashEntry[]>([]);
  protected readonly message = signal('');

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.entries.set(await this.ipc.listTrash());
  }

  protected fmtDate(iso: string): string {
    return formatDateTime(iso);
  }
  protected fmtBytes(bytes: number): string {
    return formatBytes(bytes);
  }

  protected async restaurar(e: TrashEntry): Promise<void> {
    await this.ipc.restoreTrash(e.id);
    this.message.set(`Restaurado: ${e.relPath}`);
  }
}
