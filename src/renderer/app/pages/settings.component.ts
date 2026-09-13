import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IpcService } from '../services/ipc.service';
import type { MonthFormat } from '../../../shared/ipc-contract';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="mx-auto max-w-2xl p-8">
      <h1 class="mb-6 text-2xl font-semibold">Ajustes</h1>

      <div class="space-y-5">
        <div>
          <label class="mb-1 block text-sm text-slate-300">
            Exclusiones globales (una por línea)
          </label>
          <textarea
            [(ngModel)]="exclusionsText"
            rows="4"
            class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500"
          ></textarea>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="mb-1 block text-sm text-slate-300">Formato de mes preferido</label>
            <select
              [(ngModel)]="monthFormat"
              class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              <option value="Mes-Año">Mes-Año</option>
              <option value="MM-AAAA">MM-AAAA</option>
              <option value="AAAA-MM">AAAA-MM</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm text-slate-300">Copias en paralelo</label>
            <input
              type="number"
              min="1"
              max="8"
              [(ngModel)]="concurrency"
              class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div class="flex items-center gap-3 pt-2">
          <button
            (click)="guardar()"
            class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
          >
            Guardar ajustes
          </button>
          @if (saved()) {
            <span class="text-sm text-emerald-300">Guardado ✓</span>
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
