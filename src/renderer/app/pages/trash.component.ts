import { Component, inject, signal } from '@angular/core';
import { IpcService } from '../services/ipc.service';
import { formatBytes, formatDateTime } from '../shared/format.util';
import type { TrashEntry } from '../../../shared/ipc-contract';

@Component({
  selector: 'app-trash',
  standalone: true,
  template: `
    <section class="mx-auto max-w-4xl p-8">
      <h1 class="mb-1 text-2xl font-semibold">Papelera</h1>
      <p class="mb-6 text-sm text-slate-400">
        Versiones previas respaldadas antes de sobrescribir en Drive.
      </p>

      @if (entries().length === 0) {
        <p class="text-slate-500">La papelera está vacía.</p>
      } @else {
        <ul class="space-y-2">
          @for (e of entries(); track e.id) {
            <li class="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 p-3">
              <div class="min-w-0">
                <div class="truncate font-mono text-xs text-slate-300">{{ e.relPath }}</div>
                <div class="text-xs text-slate-500">
                  {{ fmtDate(e.createdAt) }} · {{ fmtBytes(e.size) }}
                </div>
              </div>
              <button
                (click)="restaurar(e)"
                class="shrink-0 rounded-lg bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600"
              >
                Restaurar a Drive
              </button>
            </li>
          }
        </ul>
      }
      @if (message()) {
        <p class="mt-4 text-sm text-emerald-300">{{ message() }}</p>
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
