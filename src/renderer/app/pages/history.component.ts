import { Component, inject, signal } from '@angular/core';
import { IpcService } from '../services/ipc.service';
import { IconComponent } from '../shared/icon.component';
import { formatDateTime } from '../shared/format.util';
import type { RunDetail, RunSummary } from '../../../shared/ipc-contract';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [IconComponent],
  template: `
    <section class="mx-auto max-w-4xl p-8">
      <header class="mb-8 flex items-center gap-3">
        <div
          class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-600 text-white shadow-lg shadow-cyan-500/20"
        >
          <app-icon name="clock" [size]="24" />
        </div>
        <div>
          <h1 class="page-title">Historial</h1>
          <p class="text-sm text-slate-400">Sincronizaciones realizadas.</p>
        </div>
      </header>

      @if (runs().length === 0) {
        <p class="text-slate-500">Aún no hay sincronizaciones registradas.</p>
      } @else {
        <ul class="space-y-3">
          @for (r of runs(); track r.id) {
            <li class="card p-4">
              <button class="flex w-full items-center justify-between text-left" (click)="toggle(r)">
                <div>
                  <div class="font-medium">{{ r.mappingName }} · {{ r.monthKey }}</div>
                  <div class="text-xs text-slate-400">{{ fmt(r.startedAt) }}</div>
                </div>
                <div class="text-right text-xs">
                  <span [class]="statusClass(r)">{{ statusLabel(r) }}</span>
                  <div class="mt-1 text-slate-400">
                    {{ r.nCopied }}✓ {{ r.nUpdated }}♻ {{ r.nCreatedDirs }}📁
                    @if (r.nErrors > 0) { <span class="text-rose-300">{{ r.nErrors }}✕</span> }
                  </div>
                </div>
              </button>

              @if (expandedId() === r.id && detail(); as d) {
                <div class="mt-3 max-h-60 overflow-y-auto rounded-lg bg-slate-900/60 p-3 text-xs">
                  @for (it of d.items; track it.relPath + it.action) {
                    <div class="flex justify-between border-b border-slate-800/50 py-1">
                      <span class="font-mono text-slate-300">{{ it.relPath }}</span>
                      <span [class]="it.result === 'error' ? 'text-rose-300' : 'text-slate-500'">
                        {{ it.action }} · {{ it.result }}{{ it.errorMsg ? ' — ' + it.errorMsg : '' }}
                      </span>
                    </div>
                  }
                </div>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class HistoryComponent {
  private readonly ipc = inject(IpcService);
  protected readonly runs = signal<RunSummary[]>([]);
  protected readonly expandedId = signal<string | null>(null);
  protected readonly detail = signal<RunDetail | null>(null);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.runs.set(await this.ipc.listHistory());
  }

  protected fmt(iso: string | null): string {
    return formatDateTime(iso);
  }

  protected async toggle(r: RunSummary): Promise<void> {
    if (this.expandedId() === r.id) {
      this.expandedId.set(null);
      return;
    }
    this.detail.set(await this.ipc.historyDetail(r.id));
    this.expandedId.set(r.id);
  }

  protected statusLabel(r: RunSummary): string {
    return (
      {
        running: 'En curso',
        completed: 'Completada',
        completed_with_errors: 'Con errores',
        interrupted: 'Interrumpida',
      }[r.status] ?? r.status
    );
  }

  protected statusClass(r: RunSummary): string {
    return (
      {
        completed: 'text-emerald-300',
        completed_with_errors: 'text-amber-300',
        interrupted: 'text-rose-300',
        running: 'text-sky-300',
      }[r.status] ?? 'text-slate-400'
    );
  }
}
