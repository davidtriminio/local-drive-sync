import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IpcService } from '../services/ipc.service';
import type { MonthFormat } from '../../../shared/ipc-contract';

/** Alta/edición de un mapeo local -> Drive. */
@Component({
  selector: 'app-mapping-editor',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="mx-auto max-w-2xl p-8">
      <h1 class="mb-1 text-2xl font-semibold">
        {{ editing() ? 'Editar mapeo' : 'Nuevo mapeo' }}
      </h1>
      <p class="mb-6 text-sm text-slate-400">
        Usa el token <code class="text-emerald-300">&#123;mes&#125;</code> donde
        cambie el mes; la app lo resuelve en cada sincronización.
      </p>

      <div class="space-y-5">
        <div>
          <label class="mb-1 block text-sm text-slate-300">Nombre (ej. cliente)</label>
          <input
            [(ngModel)]="name"
            class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            placeholder="Cliente 1"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm text-slate-300">
            Carpeta local (origen)
            @if (!conforms(localPattern)) {
              <span class="text-amber-400" title="No incluye {mes}">*</span>
            }
          </label>
          <div class="flex gap-2">
            <input
              [(ngModel)]="localPattern"
              class="w-full rounded-lg border bg-slate-800 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500"
              [class.border-slate-700]="conforms(localPattern)"
              [class.border-amber-500]="!conforms(localPattern)"
              placeholder="D:\\Exports\\{mes}\\Cliente 1"
            />
            <button
              (click)="pick('local')"
              class="shrink-0 rounded-lg bg-slate-700 px-3 text-xs hover:bg-slate-600"
            >
              Elegir…
            </button>
          </div>
          @if (!conforms(localPattern) && localPattern) {
            <p class="mt-1 text-xs text-amber-400">
              * No incluye <code>&#123;mes&#125;</code>: esta ruta no rotará por
              mes automáticamente.
            </p>
          }
        </div>

        <div>
          <label class="mb-1 block text-sm text-slate-300">
            Carpeta Drive (destino)
            @if (!conforms(drivePattern)) {
              <span class="text-amber-400" title="No incluye {mes}">*</span>
            }
          </label>
          <div class="flex gap-2">
            <input
              [(ngModel)]="drivePattern"
              class="w-full rounded-lg border bg-slate-800 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500"
              [class.border-slate-700]="conforms(drivePattern)"
              [class.border-amber-500]="!conforms(drivePattern)"
              placeholder="G:\\Mi unidad\\Cliente 1\\artes\\{mes}"
            />
            <button
              (click)="pick('drive')"
              class="shrink-0 rounded-lg bg-slate-700 px-3 text-xs hover:bg-slate-600"
            >
              Elegir…
            </button>
          </div>
          @if (!conforms(drivePattern) && drivePattern) {
            <p class="mt-1 text-xs text-amber-400">
              * No incluye <code>&#123;mes&#125;</code>: esta ruta no rotará por
              mes automáticamente.
            </p>
          }
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="mb-1 block text-sm text-slate-300">Formato de mes</label>
            <select
              [(ngModel)]="monthFormat"
              class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              <option value="Mes-Año">Mes-Año (Septiembre-2026)</option>
              <option value="MM-AAAA">MM-AAAA (09-2026)</option>
              <option value="AAAA-MM">AAAA-MM (2026-09)</option>
            </select>
          </div>
          <label class="mt-6 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" [(ngModel)]="createMissing" class="h-4 w-4" />
            Crear carpeta en Drive si no existe
          </label>
        </div>

        <div>
          <label class="mb-1 block text-sm text-slate-300">
            Exclusiones (una por línea)
          </label>
          <textarea
            [(ngModel)]="exclusionsText"
            rows="3"
            class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500"
            placeholder="*.tmp&#10;Thumbs.db"
          ></textarea>
        </div>

        @if (error()) {
          <p class="text-sm text-rose-400">{{ error() }}</p>
        }

        <div class="flex gap-3 pt-2">
          <button
            (click)="guardar()"
            class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
          >
            Guardar
          </button>
          <button
            (click)="cancelar()"
            class="rounded-lg bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600"
          >
            Cancelar
          </button>
        </div>
      </div>
    </section>
  `,
})
export class MappingEditorComponent {
  private readonly ipc = inject(IpcService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly editing = signal(false);
  protected readonly error = signal('');

  protected id: string | undefined;
  protected name = '';
  protected localPattern = '';
  protected drivePattern = '';
  protected monthFormat: MonthFormat = 'Mes-Año';
  protected createMissing = true;
  protected exclusionsText = '';

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      void this.loadExisting(id);
    }
  }

  private async loadExisting(id: string): Promise<void> {
    const mapping = (await this.ipc.listMappings()).find((m) => m.id === id);
    if (!mapping) {
      return;
    }
    this.editing.set(true);
    this.id = mapping.id;
    this.name = mapping.name;
    this.localPattern = mapping.localPattern;
    this.drivePattern = mapping.drivePattern;
    this.monthFormat = mapping.monthFormat;
    this.createMissing = mapping.createMissing;
    this.exclusionsText = mapping.exclusions.join('\n');
  }

  /** true si la ruta incluye el token {mes} (rotará por mes automáticamente). */
  protected conforms(pattern: string): boolean {
    return /\{mes\}/i.test(pattern);
  }

  protected async pick(side: 'local' | 'drive'): Promise<void> {
    const chosen = await this.ipc.pickFolder();
    if (!chosen) {
      return;
    }
    // Se inserta la ruta tal cual. Para que rote por mes, el usuario sustituye
    // manualmente el segmento del mes por {mes}; el indicador * avisa si falta.
    if (side === 'local') {
      this.localPattern = chosen;
    } else {
      this.drivePattern = chosen;
    }
  }

  protected async guardar(): Promise<void> {
    if (!this.name.trim() || !this.localPattern.trim() || !this.drivePattern.trim()) {
      this.error.set('Nombre, carpeta local y carpeta Drive son obligatorios.');
      return;
    }
    await this.ipc.saveMapping({
      id: this.id,
      name: this.name.trim(),
      localPattern: this.localPattern.trim(),
      drivePattern: this.drivePattern.trim(),
      monthFormat: this.monthFormat,
      createMissing: this.createMissing,
      exclusions: this.exclusionsText
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    });
    void this.router.navigate(['/']);
  }

  protected cancelar(): void {
    void this.router.navigate(['/']);
  }
}
