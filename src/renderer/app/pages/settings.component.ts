import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IpcService } from '../services/ipc.service';
import { IconComponent } from '../shared/icon.component';
import type { MigrationPreview, MigrationResult, MonthFormat } from '../../../shared/ipc-contract';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <section class="mx-auto max-w-2xl p-8">
      <header class="mb-8 flex items-center gap-3">
        <div
          class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 text-white shadow-lg shadow-slate-500/20"
        >
          <app-icon name="settings" [size]="24" />
        </div>
        <h1 class="page-title">Ajustes</h1>
      </header>

      <div class="card space-y-5 p-6">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-300">
            Exclusiones globales (una por línea)
          </label>
          <textarea
            [(ngModel)]="exclusionsText"
            rows="4"
            class="field font-mono text-xs"
          ></textarea>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-300">Formato de mes preferido</label>
            <select [(ngModel)]="monthFormat" class="field">
              <option value="Mes-Año">Mes-Año</option>
              <option value="MM-AAAA">MM-AAAA</option>
              <option value="AAAA-MM">AAAA-MM</option>
            </select>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-300">Copias en paralelo</label>
            <input type="number" min="1" max="8" [(ngModel)]="concurrency" class="field" />
          </div>
        </div>

        <!-- Bandeja del sistema -->
        <label
          class="flex cursor-pointer items-start gap-3 rounded-xl border border-white/5 bg-slate-950/30 p-4"
        >
          <input
            type="checkbox"
            [(ngModel)]="minimizeToTray"
            class="mt-0.5 h-4 w-4 accent-emerald-500"
          />
          <span>
            <span class="flex items-center gap-2 text-sm font-medium text-slate-200">
              <app-icon name="minimize" [size]="16" /> Minimizar a la bandeja
            </span>
            <span class="mt-0.5 block text-xs text-slate-500">
              Al cerrar (X), la app se oculta en la bandeja y sigue vigilando la
              carpeta de export. Sal del todo desde el menú del icono.
            </span>
          </span>
        </label>

        <!-- Vigilancia de la carpeta de export -->
        <div class="space-y-3 rounded-xl border border-white/5 bg-slate-950/30 p-4">
          <label class="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              [(ngModel)]="exportWatchEnabled"
              class="mt-0.5 h-4 w-4 accent-emerald-500"
            />
            <span>
              <span class="flex items-center gap-2 text-sm font-medium text-slate-200">
                <app-icon name="folderOpen" [size]="16" /> Vigilar carpeta de export
              </span>
              <span class="mt-0.5 block text-xs text-slate-500">
                Mientras la app está abierta, cada archivo nuevo se mueve a la
                carpeta local del mapeo cuyo nombre coincide con el prefijo del
                archivo (<code class="text-emerald-300">empresa_…</code>), en el
                mes actual.
              </span>
            </span>
          </label>
          @if (exportWatchEnabled) {
            <div class="flex gap-2 pl-7">
              <input
                [(ngModel)]="exportWatchFolder"
                class="field font-mono text-xs"
                placeholder="Carpeta a vigilar (ej. V:\\graphic_design\\_export)"
              />
              <button (click)="pickExportFolder()" class="btn-ghost shrink-0">
                <app-icon name="folder" [size]="16" /> Elegir
              </button>
              @if (exportWatchFolder.trim()) {
                <button (click)="openExportFolder()" class="btn-ghost shrink-0">
                  <app-icon name="folderOpen" [size]="16" /> Abrir
                </button>
              }
            </div>
          }
        </div>

        <div class="flex items-center gap-3 pt-2">
          <button (click)="guardar()" class="btn-primary">
            <app-icon name="check" [size]="16" /> Guardar ajustes
          </button>
          @if (saved()) {
            <span class="flex items-center gap-1.5 text-sm text-emerald-300">
              <app-icon name="check" [size]="16" /> Guardado
            </span>
          }
        </div>
      </div>

      <!-- Migración a otra PC -->
      <div class="card mt-6 space-y-4 p-6">
        <div>
          <h2 class="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <app-icon name="refresh" [size]="16" /> Migrar a otra PC
          </h2>
          <p class="mt-1 text-xs text-slate-500">
            Exporta mapeos, clientes, eventos, ajustes y preferencias del creador
            (sin historial ni papelera). Al importar en la PC nueva eliges dónde
            viven ahora tus carpetas y la app crea el esqueleto del mes actual.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button (click)="exportConfig()" class="btn-ghost">
            <app-icon name="copy" [size]="16" /> Exportar configuración
          </button>
          <button (click)="pickImport()" class="btn-ghost">
            <app-icon name="folderOpen" [size]="16" /> Importar configuración
          </button>
          @if (exportMsg()) {
            <span class="text-xs text-emerald-300">{{ exportMsg() }}</span>
          }
        </div>

        @if (migError()) {
          <p class="text-xs text-amber-300">{{ migError() }}</p>
        }

        @if (preview(); as p) {
          <div class="space-y-4 rounded-xl border border-white/5 bg-slate-950/30 p-4">
            <p class="text-xs text-slate-400">
              <span class="font-mono text-slate-300">{{ p.fileName }}</span>:
              {{ p.counts.mappings }} mapeos, {{ p.counts.clients }} clientes,
              {{ p.counts.events }} eventos.
            </p>

            @if (p.roots.length === 0) {
              <p class="text-xs text-slate-500">No hay rutas que remapear.</p>
            }
            @for (r of p.roots; track r.original; let i = $index) {
              <div class="space-y-1.5">
                <div class="flex items-center gap-2 text-xs text-slate-400">
                  <span class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase">
                    {{ r.kind === 'drive' ? 'Drive' : 'Local' }}
                  </span>
                  <span class="font-mono text-slate-300">{{ r.original }}</span>
                  <span class="text-slate-500">({{ r.usedBy }} rutas)</span>
                </div>
                <div class="flex gap-2">
                  <input
                    [ngModel]="replacements()[i]"
                    (ngModelChange)="setReplacement(i, $event)"
                    class="field font-mono text-xs"
                    placeholder="Carpeta equivalente en esta PC"
                  />
                  <button (click)="pickReplacement(i)" class="btn-ghost shrink-0">
                    <app-icon name="folder" [size]="16" /> Elegir
                  </button>
                </div>
              </div>
            }

            <div class="space-y-1.5 border-t border-white/5 pt-3 text-xs text-slate-300">
              <label class="flex items-center gap-2">
                <input type="checkbox" [(ngModel)]="createLocal" class="accent-emerald-500" />
                Crear carpetas locales del mes actual (y base del creador)
              </label>
              <label class="flex items-center gap-2">
                <input type="checkbox" [(ngModel)]="createDrive" class="accent-emerald-500" />
                Crear carpetas de Drive del mes actual (si Drive está disponible)
              </label>
              <label class="flex items-center gap-2">
                <input type="checkbox" [(ngModel)]="createExport" class="accent-emerald-500" />
                Crear la carpeta de export vigilada
              </label>
            </div>

            <div class="flex gap-2">
              <button (click)="applyImport()" [disabled]="importing()" class="btn-primary">
                <app-icon name="check" [size]="16" /> Importar
              </button>
              <button (click)="cancelImport()" class="btn-ghost">Cancelar</button>
            </div>
          </div>
        }

        @if (result(); as r) {
          <div class="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs">
            <p class="text-emerald-300">
              Importado: {{ r.mappings }} mapeos, {{ r.clients }} clientes,
              {{ r.events }} eventos. Carpetas creadas: {{ r.created.length }}.
            </p>
            @for (w of r.warnings; track w) {
              <p class="text-amber-300">{{ w }}</p>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class SettingsComponent {
  private readonly ipc = inject(IpcService);

  protected exclusionsText = '';
  protected monthFormat: MonthFormat = 'Mes-Año';
  protected concurrency = 3;
  protected minimizeToTray = true;
  protected exportWatchEnabled = false;
  protected exportWatchFolder = '';
  protected readonly saved = signal(false);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const s = await this.ipc.getSettings();
    this.exclusionsText = s.defaultExclusions.join('\n');
    this.monthFormat = s.preferredMonthFormat;
    this.concurrency = s.copyConcurrency;
    this.minimizeToTray = s.minimizeToTray;
    this.exportWatchEnabled = s.exportWatchEnabled;
    this.exportWatchFolder = s.exportWatchFolder;
  }

  protected readonly preview = signal<MigrationPreview | null>(null);
  protected readonly replacements = signal<string[]>([]);
  protected readonly result = signal<MigrationResult | null>(null);
  protected readonly migError = signal('');
  protected readonly exportMsg = signal('');
  protected readonly importing = signal(false);
  protected createLocal = true;
  protected createDrive = true;
  protected createExport = true;

  protected async exportConfig(): Promise<void> {
    this.exportMsg.set('');
    this.migError.set('');
    const r = await this.ipc.exportConfig();
    if (r.ok) {
      this.exportMsg.set(`Guardado en ${r.path}`);
    } else if (!r.canceled) {
      this.migError.set(r.message ?? 'No se pudo exportar.');
    }
  }

  protected async pickImport(): Promise<void> {
    this.migError.set('');
    this.result.set(null);
    try {
      const p = await this.ipc.pickConfigImport();
      if (p) {
        this.preview.set(p);
        this.replacements.set(p.roots.map((r) => r.suggested));
      }
    } catch (e) {
      this.migError.set((e as Error).message);
    }
  }

  protected setReplacement(index: number, value: string): void {
    this.replacements.update((list) => list.map((v, i) => (i === index ? value : v)));
  }

  protected async pickReplacement(index: number): Promise<void> {
    const chosen = await this.ipc.pickFolder();
    if (chosen) {
      this.setReplacement(index, chosen);
    }
  }

  protected cancelImport(): void {
    this.preview.set(null);
  }

  protected async applyImport(): Promise<void> {
    const p = this.preview();
    if (!p) {
      return;
    }
    this.importing.set(true);
    this.migError.set('');
    try {
      const repl = this.replacements();
      this.result.set(
        await this.ipc.applyConfigImport({
          roots: p.roots.map((r, i) => ({ original: r.original, replacement: repl[i] ?? '' })),
          createLocalFolders: this.createLocal,
          createDriveFolders: this.createDrive,
          createExportFolder: this.createExport,
        }),
      );
      this.preview.set(null);
      await this.load();
    } catch (e) {
      this.migError.set((e as Error).message);
    } finally {
      this.importing.set(false);
    }
  }

  protected async pickExportFolder(): Promise<void> {
    const chosen = await this.ipc.pickFolder();
    if (chosen) {
      this.exportWatchFolder = chosen;
    }
  }

  protected openExportFolder(): void {
    void this.ipc.openPath(this.exportWatchFolder.trim());
  }

  protected async guardar(): Promise<void> {
    await this.ipc.setSettings({
      defaultExclusions: this.exclusionsText
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
      preferredMonthFormat: this.monthFormat,
      copyConcurrency: Number(this.concurrency) || 3,
      minimizeToTray: this.minimizeToTray,
      exportWatchEnabled: this.exportWatchEnabled,
      exportWatchFolder: this.exportWatchFolder.trim(),
    });
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
