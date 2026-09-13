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
  protected readonly saved = signal(false);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const s = await this.ipc.getSettings();
    this.exclusionsText = s.defaultExclusions.join('\n');
    this.monthFormat = s.preferredMonthFormat;
    this.concurrency = s.copyConcurrency;
  }

  protected async guardar(): Promise<void> {
    await this.ipc.setSettings({
      defaultExclusions: this.exclusionsText
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
      preferredMonthFormat: this.monthFormat,
      copyConcurrency: Number(this.concurrency) || 3,
    });
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
