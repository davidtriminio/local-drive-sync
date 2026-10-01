import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IpcService } from '../services/ipc.service';
import { IconComponent } from '../shared/icon.component';
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
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <section class="mx-auto max-w-5xl p-8">
      <header class="mb-8 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-500/20"
          >
            <app-icon name="refresh" [size]="24" />
          </div>
          <h1 class="page-title">Sincronizar</h1>
        </div>
        <a routerLink="/" class="btn-ghost">← Volver</a>
      </header>

      @if (error()) {
        <div class="mb-5 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">
          {{ error() }}
        </div>
      }

      <!-- Paso: mes -->
      @if (step() === 'month') {
        <div class="card p-6">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm text-slate-300">Mes detectado</p>
              <p class="mt-1 font-mono text-lg text-emerald-300">{{ monthKey }}</p>
            </div>
            @if (busy()) {
              <span class="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                Preparando…
              </span>
            }
          </div>
          <div class="mt-5 flex flex-wrap gap-3">
            <button
              (click)="sincronizarRapido()"
              [disabled]="busy()"
              class="btn-primary"
            >
              <app-icon name="sparkles" [size]="18" />
              {{ busy() ? 'Preparando…' : 'Sincronizar todo' }}
            </button>
            <button (click)="abrirSelector()" [disabled]="busy()" class="btn-ghost">
              <app-icon name="check" [size]="16" /> Elegir archivos…
            </button>
            <button
              (click)="analizar()"
              [disabled]="busy()"
              class="btn-ghost"
            >
              {{ busy() ? 'Analizando…' : 'Analizar diferencias' }}
            </button>
          </div>
          <p class="mt-3 text-xs text-slate-500">
            La app usa el mes actual automáticamente. Sincronizar todo copia nuevos y actualiza modificados usando Local como fuente; Elegir archivos te deja marcar cuáles sí y cuáles no.
          </p>
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
            <button (click)="seleccionar('NEW', 'copy')" class="btn-ghost btn-sm">
              Marcar nuevos
            </button>
            <button (click)="seleccionar('MODIFIED', 'copy')" class="btn-ghost btn-sm">
              Marcar modificados
            </button>
            <button (click)="limpiar()" class="btn-ghost btn-sm">
              Limpiar selección
            </button>
          </div>

          <div class="max-h-[50vh] overflow-y-auto rounded-xl border border-white/5">
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
              class="btn-primary"
            >
              Vista previa →
            </button>
            <button (click)="step.set('month')" class="btn-ghost">
              ← Cambiar mes
            </button>
          </div>
        </div>
      }

      <!-- Paso: preview -->
      @if (step() === 'preview' && plan(); as p) {
        <div class="space-y-4">
          <div class="card p-5">
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
              class="btn-primary"
            >
              Ejecutar sincronización
            </button>
            <button (click)="step.set('diff')" class="btn-ghost">
              ← Volver a diferencias
            </button>
          </div>
        </div>
      }

      <!-- Paso: run -->
      @if (step() === 'run') {
        <div class="card p-6">
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
        <div class="card p-6">
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
            <a routerLink="/history" class="btn-ghost">
              Ver historial
            </a>
          </div>
        </div>
      }
    </section>

    <!-- Modal: elegir qué archivos sincronizar -->
    @if (showPicker()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        (click)="cerrarSelector()"
      >
        <div
          class="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <h2 class="text-lg font-semibold">Elegir archivos a sincronizar</h2>
          @if (diff(); as d) {
            <p class="mt-1 text-xs text-slate-400">
              {{ d.counts.new }} nuevos · {{ d.counts.modified }} modificados ·
              {{ d.counts.equal }} sin cambios (no se listan)
            </p>
          }

          @if (pickable().length === 0) {
            <p class="mt-6 rounded-lg bg-slate-800/60 p-4 text-sm text-slate-400">
              No hay archivos nuevos ni modificados para sincronizar.
            </p>
          } @else {
            <div class="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <input
                [ngModel]="filtro()"
                (ngModelChange)="filtro.set($event)"
                class="field !w-56 !py-1.5 text-xs"
                placeholder="Filtrar por nombre…"
              />
              <button (click)="marcarVisibles(true)" class="btn-ghost btn-sm">
                Marcar {{ filtro() ? 'visibles' : 'todos' }}
              </button>
              <button (click)="marcarVisibles(false)" class="btn-ghost btn-sm">
                Desmarcar {{ filtro() ? 'visibles' : 'todos' }}
              </button>
            </div>

            <div class="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/5">
              <table class="w-full text-sm">
                <tbody>
                  @for (f of visibles(); track f.relPath) {
                    <tr
                      (click)="toggle(f, decisionOf(f.relPath) !== 'copy')"
                      class="cursor-pointer border-b border-slate-800/60 hover:bg-white/5"
                    >
                      <td class="w-8 px-3 py-2">
                        <input
                          type="checkbox"
                          [checked]="decisionOf(f.relPath) === 'copy'"
                          (click)="$event.stopPropagation()"
                          (change)="toggle(f, $any($event.target).checked)"
                          class="h-4 w-4"
                        />
                      </td>
                      <td class="px-2 py-2">
                        <span class="rounded px-1.5 py-0.5 text-[10px] font-medium" [class]="badge(f.status)">
                          {{ label(f.status) }}
                        </span>
                      </td>
                      <td class="break-all px-2 py-2 font-mono text-xs text-slate-300">
                        {{ f.relPath }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-500">
                        {{ fmt(f.localSize) }}
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td class="p-4 text-center text-xs text-slate-500">
                        Ningún archivo coincide con el filtro.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <div class="mt-4 flex items-center justify-between gap-3">
            <span class="text-xs text-slate-400">
              {{ seleccionados() }} de {{ pickable().length }} seleccionados
            </span>
            <div class="flex gap-2">
              <button (click)="cerrarSelector()" class="btn-ghost">Cancelar</button>
              <button
                (click)="sincronizarSeleccion()"
                [disabled]="busy() || seleccionados() === 0"
                class="btn-primary"
              >
                <app-icon name="refresh" [size]="16" />
                Sincronizar {{ seleccionados() }} archivo(s)
              </button>
            </div>
          </div>
        </div>
      </div>
    }
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
  protected readonly error = signal('');

  protected monthKey = currentMonthKey();
  private readonly decisions = signal<Record<string, FileDecision>>({});

  protected readonly showPicker = signal(false);
  protected readonly filtro = signal('');
  /** Archivos accionables (nuevos y modificados) del último análisis. */
  protected readonly pickable = computed(() =>
    (this.diff()?.files ?? []).filter((f) => f.status === 'NEW' || f.status === 'MODIFIED'),
  );
  protected readonly visibles = computed(() => {
    const q = this.filtro().trim().toLowerCase();
    return q
      ? this.pickable().filter((f) => f.relPath.toLowerCase().includes(q))
      : this.pickable();
  });
  protected readonly seleccionados = computed(
    () => this.pickable().filter((f) => this.decisions()[f.relPath] === 'copy').length,
  );

  private mappingId = '';
  private unsubProgress: (() => void) | null = null;
  private unsubDone: (() => void) | null = null;

  constructor() {
    this.mappingId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.mappingId) {
      void this.router.navigate(['/']);
      return;
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
    this.error.set('');
    try {
      const result = await this.ipc.scanDiff(this.mappingId, this.monthKey);
      this.diff.set(result);
      this.decisions.set(this.defaultDecisions(result));
      this.step.set('diff');
    } catch (e) {
      this.error.set(`No se pudo analizar: ${String(e)}`);
    } finally {
      this.busy.set(false);
    }
  }

  protected async sincronizarRapido(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await this.ipc.scanDiff(this.mappingId, this.monthKey);
      this.diff.set(result);
      this.decisions.set(this.defaultDecisions(result));
      const plan = await this.ipc.previewSync({
        mappingId: this.mappingId,
        monthKey: this.monthKey,
        selections: this.selectedItems(),
      });
      this.plan.set(plan);
      if (plan.summary.copy + plan.summary.update + plan.summary.mkdir === 0) {
        this.step.set('preview');
        return;
      }
      await this.ejecutar(false);
    } catch (e) {
      this.error.set(`No se pudo sincronizar: ${String(e)}`);
    } finally {
      this.busy.set(false);
    }
  }

  /** Analiza el mes y abre el modal para marcar qué archivos sincronizar. */
  protected async abrirSelector(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await this.ipc.scanDiff(this.mappingId, this.monthKey);
      this.diff.set(result);
      this.decisions.set(this.defaultDecisions(result));
      this.filtro.set('');
      this.showPicker.set(true);
    } catch (e) {
      this.error.set(`No se pudo analizar: ${String(e)}`);
    } finally {
      this.busy.set(false);
    }
  }

  protected cerrarSelector(): void {
    this.showPicker.set(false);
  }

  /** Marca o desmarca los archivos visibles (respeta el filtro de texto). */
  protected marcarVisibles(copiar: boolean): void {
    this.decisions.update((cur) => {
      const next = { ...cur };
      for (const f of this.visibles()) {
        next[f.relPath] = copiar ? 'copy' : 'skip';
      }
      return next;
    });
  }

  protected async sincronizarSeleccion(): Promise<void> {
    if (this.busy() || this.seleccionados() === 0) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const plan = await this.ipc.previewSync({
        mappingId: this.mappingId,
        monthKey: this.monthKey,
        selections: this.selectedItems(),
      });
      this.plan.set(plan);
      this.showPicker.set(false);
      await this.ejecutar(false);
    } catch (e) {
      this.error.set(`No se pudo sincronizar: ${String(e)}`);
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
    this.error.set('');
    try {
      const plan = await this.ipc.previewSync({
        mappingId: this.mappingId,
        monthKey: this.monthKey,
        selections: this.selectedItems(),
      });
      this.plan.set(plan);
      this.step.set('preview');
    } catch (e) {
      this.error.set(`No se pudo preparar la vista previa: ${String(e)}`);
    } finally {
      this.busy.set(false);
    }
  }

  protected async ejecutar(manageBusy = true): Promise<void> {
    const plan = this.plan();
    if (!plan) {
      return;
    }
    if (manageBusy) {
      this.busy.set(true);
      this.error.set('');
    }
    this.progress.set(null);
    this.step.set('run');
    this.resetSyncSubscriptions();
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
    try {
      await this.ipc.executeSync(plan);
    } catch (e) {
      this.error.set(`No se pudo ejecutar la sincronización: ${String(e)}`);
    } finally {
      if (manageBusy) {
        this.busy.set(false);
      }
    }
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

  private defaultDecisions(result: DiffResult): Record<string, FileDecision> {
    const initial: Record<string, FileDecision> = {};
    for (const f of result.files) {
      if (f.status === 'NEW' || f.status === 'MODIFIED') {
        initial[f.relPath] = 'copy';
      }
    }
    return initial;
  }

  private selectedItems(): { relPath: string; decision: FileDecision }[] {
    const decisions = this.decisions();
    return Object.keys(decisions).map((relPath) => ({
      relPath,
      decision: decisions[relPath],
    }));
  }

  private resetSyncSubscriptions(): void {
    this.unsubProgress?.();
    this.unsubDone?.();
    this.unsubProgress = null;
    this.unsubDone = null;
  }
}
