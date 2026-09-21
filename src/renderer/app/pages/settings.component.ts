import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IpcService } from '../services/ipc.service';
import { IconComponent } from '../shared/icon.component';
import type { MonthFormat } from '../../../shared/ipc-contract';

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

  protected async pickExportFolder(): Promise<void> {
    const chosen = await this.ipc.pickFolder();
    if (chosen) {
      this.exportWatchFolder = chosen;
    }
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
