import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IpcService } from '../services/ipc.service';
import { currentMonthKey, formatBytes } from '../shared/format.util';
import type {
  DiffResult,
  FileDecision,
  FileDiff,
  RunSummary,
  SyncPlan,
  SyncProgress,
} from '../../../shared/ipc-contract';

type WizardStep = 'month' | 'diff' | 'preview' | 'run' | 'done';

@Component({
  selector: 'app-sync-wizard',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="mx-auto max-w-5xl p-8">
      <header class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-semibold">Sincronizar</h1>
        <a routerLink="/" class="text-sm text-slate-400 hover:text-slate-200">
          ← Volver
        </a>
      </header>

      <!-- Paso: mes -->
      @if (step() === 'month') {
        <div class="rounded-xl border border-slate-800 bg-slate-800/40 p-6">
          <label class="mb-2 block text-sm text-slate-300">Mes a sincronizar</label>
          <input
            type="month"
            [(ngModel)]="monthKey"
            class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <div class="mt-5">
            <button
              (click)="analizar()"
              [disabled]="busy()"
              class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {{ busy() ? 'Analizando…' : 'Analizar diferencias' }}
            </button>
          </div>
        </div>
      }

      <!-- Paso: diff -->
      @if (step() === 'diff' && diff(); as d) {
        <div class="space-y-4">
          <div class="grid grid-cols-5 gap-2 text-center text-xs">
            <div class="rounded-lg bg-emerald-500/10 p-2 text-emerald-300">
              {{ d.counts.new }} nuevos
            </div>
            <div class="rounded-lg bg-amber-500/10 p-2 text-amber-300">
              {{ d.counts.modified }} modificados
            </div>
            <div class="rounded-lg bg-slate-700/40 p-2 text-slate-400">
              {{ d.counts.equal }} iguales
            </div>
            <div class="rounded-lg bg-sky-500/10 p-2 text-sky-300">
              {{ d.counts.onlyDrive }} solo en Drive
            </div>
            <div class="rounded-lg bg-rose-500/10 p-2 text-rose-300">
              {{ d.counts.conflicts }} conflictos
            </div>
          </div>

          @if (!d.localExists) {
            <p class="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">
              La carpeta local no existe: <code>{{ d.localPath }}</code>
            </p>
          }
          @if (!d.driveExists) {
            <p class="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-300">
              La carpeta de Drive no existe aún: <code>{{ d.drivePath }}</code> —
              se creará al sincronizar.
            </p>
          }

          <div class="flex gap-2 text-xs">
            <button (click)="seleccionar('NEW', 'copy')" class="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600">
              Marcar nuevos
            </button>
            <button (click)="seleccionar('MODIFIED', 'copy')" class="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600">
              Marcar modificados
            </button>
            <button (click)="limpiar()" class="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600">
              Limpiar selección
            </button>
          </div>

          <div class="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-800">
            <table class="w-full text-sm">
              <tbody>
                @for (f of d.files; track f.relPath) {
                  <tr class="border-b border-slate-800/60">
                    <td class="w-8 px-3 py-2">
                      @if (f.status === 'NEW' || f.status === 'MODIFIED') {
                        <input
                          type="checkbox"
                          [checked]="decisionOf(f.relPath) === 'copy'"
                          (change)="toggle(f, $any($event.target).checked)"
                          class="h-4 w-4"
                        />
                      }
                    </td>
                    <td class="px-2 py-2">
                      <span class="rounded px-1.5 py-0.5 text-[10px] font-medium" [class]="badge(f.status)">
                        {{ label(f.status) }}
                      </span>
                      @if (f.conflict) {
                        <span class="ml-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-300">
                          conflicto
                        </span>
                      }
                    </td>
                    <td class="px-2 py-2 font-mono text-xs text-slate-300">{{ f.relPath }}</td>
                    <td class="px-2 py-2 text-right text-xs text-slate-500">
                      {{ fmt(f.localSize) }} → {{ fmt(f.driveSize) }}
                    </td>
                    <td class="px-3 py-2 text-right">
                      @if (f.status === 'MODIFIED') {
                        <select
                          [ngModel]="decisionOf(f.relPath)"
                          (ngModelChange)="setDecision(f.relPath, $any($event))"
                          class="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-xs"
                        >
                          <option value="copy">Usar local</option>
                          <option value="keepDrive">Conservar Drive</option>
                          <option value="skip">Omitir</option>
                        </select>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="flex gap-3">
            <button
              (click)="continuar()"
              [disabled]="busy()"
              class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              Vista previa →
            </button>
            <button (click)="step.set('month')" class="rounded-lg bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600">
              ← Cambiar mes
            </button>
          </div>
        </div>
      }

      <!-- Paso: preview -->
      @if (step() === 'preview' && plan(); as p) {
        <div class="space-y-4">
          <div class="rounded-xl border border-slate-800 bg-slate-800/40 p-5">
            <h2 class="mb-3 font-medium">Se ejecutarán estas acciones:</h2>
            <ul class="space-y-1 text-sm text-slate-300">
              <li>📄 Copiar archivos nuevos: <b>{{ p.summary.copy }}</b></li>
              <li>♻️ Actualizar archivos (con respaldo): <b>{{ p.summary.update }}</b></li>
              <li>📁 Crear carpetas: <b>{{ p.summary.mkdir }}</b></li>
              <li>🗃️ Respaldos a papelera: <b>{{ p.summary.backups }}</b></li>
            </ul>
            @if (p.createDriveRoot) {
              <p class="mt-3 text-xs text-amber-300">
                Se creará la carpeta destino en Drive: <code>{{ p.drivePath }}</code>
              </p>
            }
            @if (p.summary.copy + p.summary.update === 0) {
              <p class="mt-3 text-xs text-slate-400">
                No hay archivos seleccionados para copiar.
              </p>
            }
          </div>

          <div class="flex gap-3">
            <button
              (click)="ejecutar()"
              [disabled]="busy() || p.summary.copy + p.summary.update + p.summary.mkdir === 0"
              class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              Ejecutar sincronización
            </button>
            <button (click)="step.set('diff')" class="rounded-lg bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600">
              ← Volver a diferencias
            </button>
          </div>
        </div>
      }

      <!-- Paso: run -->
      @if (step() === 'run') {
        <div class="rounded-xl border border-slate-800 bg-slate-800/40 p-6">
          <h2 class="mb-4 font-medium">Sincronizando…</h2>
          @if (progress(); as pr) {
            <div class="mb-2 h-3 w-full overflow-hidden rounded-full bg-slate-700">
              <div
                class="h-full bg-emerald-500 transition-all"
                [style.width.%]="pr.total ? (pr.done / pr.total) * 100 : 0"
              ></div>
            </div>
            <p class="truncate text-xs text-slate-400">
              {{ pr.done }}/{{ pr.total }} — {{ pr.current || pr.phase }}
            </p>
          }
          <button (click)="cancelar()" class="mt-4 rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/30">
            Cancelar
          </button>
        </div>
      }

      <!-- Paso: done -->
      @if (step() === 'done' && summary(); as s) {
        <div class="rounded-xl border border-slate-800 bg-slate-800/40 p-6">
          <h2 class="mb-3 text-lg font-semibold text-emerald-300">Sincronización terminada</h2>
          <ul class="space-y-1 text-sm text-slate-300">
            <li>✓ {{ s.nCopied }} copiados</li>
            <li>✓ {{ s.nUpdated }} actualizados</li>
            <li>✓ {{ s.nCreatedDirs }} carpetas creadas</li>
            @if (s.nErrors > 0) {
              <li class="text-rose-300">✕ {{ s.nErrors }} con error</li>
            }
          </ul>
          <p class="mt-4 rounded-lg bg-sky-500/10 p-3 text-xs text-sky-300">
            Copiado a la carpeta de Drive. Google Drive terminará de subir los
            archivos a la nube en segundo plano.
          </p>
          <div class="mt-4 flex gap-3">
            <a routerLink="/" class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400">
              Hecho
            </a>
            <a routerLink="/history" class="rounded-lg bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600">
              Ver historial
            </a>
          </div>
        </div>
      }
    </section>
  `,
})
export class SyncWizardComponent implements OnDestroy {
  private readonly ipc = inject(IpcService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly step = signal<WizardStep>('month');
  protected readonly busy = signal(false);
  protected readonly diff = signal<DiffResult | null>(null);
  protected readonly plan = signal<SyncPlan | null>(null);
  protected readonly progress = signal<SyncProgress | null>(null);
  protected readonly summary = signal<RunSummary | null>(null);

  protected monthKey = currentMonthKey();
  private readonly decisions = signal<Record<string, FileDecision>>({});

  private mappingId = '';
  private unsubProgress: (() => void) | null = null;
  private unsubDone: (() => void) | null = null;

  constructor() {
    this.mappingId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.mappingId) {
      void this.router.navigate(['/']);
    }
  }

  ngOnDestroy(): void {
    this.unsubProgress?.();
    this.unsubDone?.();
  }

  protected fmt(bytes: number | null): string {
    return formatBytes(bytes);
  }

  protected decisionOf(relPath: string): FileDecision {
    return this.decisions()[relPath] ?? 'skip';
  }

  protected async analizar(): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.ipc.scanDiff(this.mappingId, this.monthKey);
      this.diff.set(result);
      const initial: Record<string, FileDecision> = {};
      for (const f of result.files) {
        if (f.status === 'NEW' || f.status === 'MODIFIED') {
          initial[f.relPath] = 'copy';
        }
      }
      this.decisions.set(initial);
      this.step.set('diff');
    } finally {
      this.busy.set(false);
    }
  }

  protected toggle(file: FileDiff, checked: boolean): void {
    this.setDecision(file.relPath, checked ? 'copy' : 'skip');
  }

  protected setDecision(relPath: string, decision: FileDecision): void {
    this.decisions.update((d) => ({ ...d, [relPath]: decision }));
  }

  protected seleccionar(status: 'NEW' | 'MODIFIED', decision: FileDecision): void {
    const d = this.diff();
    if (!d) {
      return;
    }
    this.decisions.update((cur) => {
      const next = { ...cur };
      for (const f of d.files) {
        if (f.status === status) {
          next[f.relPath] = decision;
        }
      }
      return next;
    });
  }

  protected limpiar(): void {
    const d = this.diff();
    if (!d) {
      return;
    }
    const cleared: Record<string, FileDecision> = {};
    for (const f of d.files) {
      cleared[f.relPath] = 'skip';
    }
    this.decisions.set(cleared);
  }

  protected async continuar(): Promise<void> {
    this.busy.set(true);
    try {
      const decisions = this.decisions();
      const selections = Object.keys(decisions).map((relPath) => ({
        relPath,
        decision: decisions[relPath],
      }));
      const plan = await this.ipc.previewSync({
        mappingId: this.mappingId,
        monthKey: this.monthKey,
        selections,
      });
      this.plan.set(plan);
      this.step.set('preview');
    } finally {
      this.busy.set(false);
    }
  }

  protected async ejecutar(): Promise<void> {
    const plan = this.plan();
    if (!plan) {
      return;
    }
    this.progress.set(null);
    this.step.set('run');
    this.unsubProgress = this.ipc.onSyncProgress((p) => {
      if (p.runId === plan.id) {
        this.progress.set(p);
      }
    });
    this.unsubDone = this.ipc.onSyncDone((s) => {
      if (s.id === plan.id) {
        this.summary.set(s);
        this.step.set('done');
      }
    });
    await this.ipc.executeSync(plan);
  }

  protected cancelar(): void {
    const plan = this.plan();
    if (plan) {
      void this.ipc.cancelSync(plan.id);
    }
  }

  protected label(status: string): string {
    return (
      { NEW: 'Nuevo', MODIFIED: 'Modificado', EQUAL: 'Igual', ONLY_DRIVE: 'Solo Drive' }[
        status
      ] ?? status
    );
  }

  protected badge(status: string): string {
    return (
      {
        NEW: 'bg-emerald-500/20 text-emerald-300',
        MODIFIED: 'bg-amber-500/20 text-amber-300',
        EQUAL: 'bg-slate-600/40 text-slate-400',
        ONLY_DRIVE: 'bg-sky-500/20 text-sky-300',
      }[status] ?? 'bg-slate-600/40 text-slate-400'
    );
  }
}
