import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IpcService } from '../services/ipc.service';
import { IconComponent } from '../shared/icon.component';
import { IconPickerComponent } from '../shared/icon-picker.component';
import { ColorPickerComponent } from '../shared/color-picker.component';
import type { MonthFormat } from '../../../shared/ipc-contract';

/** Alta/edición de un mapeo local -> Drive. */
@Component({
  selector: 'app-mapping-editor',
  standalone: true,
  imports: [
    FormsModule,
    IconComponent,
    IconPickerComponent,
    ColorPickerComponent,
  ],
  template: `
    <section class="mx-auto max-w-2xl p-8">
      <header class="mb-8 flex items-center gap-3">
        <div
          class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 text-white shadow-lg shadow-indigo-500/20"
        >
          <app-icon [name]="icon || 'layers'" [size]="24" />
        </div>
        <div>
          <h1 class="page-title">{{ editing() ? 'Editar mapeo' : 'Nuevo mapeo' }}</h1>
          <p class="text-sm text-slate-400">
            Usa el token <code class="text-emerald-300">&#123;mes&#125;</code> donde
            cambie el mes; la app lo resuelve en cada sincronización.
          </p>
        </div>
      </header>

      <div class="card space-y-5 p-6">
        <div>
          <label class="mb-1 block text-sm text-slate-300">Nombre (ej. cliente)</label>
          <input
            [(ngModel)]="name"
            class="field"
            placeholder="Cliente 1"
          />
        </div>

        <div class="space-y-4">
          <div>
            <label class="mb-2 block text-sm text-slate-300">Icono</label>
            <app-icon-picker [value]="icon" (valueChange)="icon = $event" />
          </div>
          <div>
            <label class="mb-2 block text-sm text-slate-300">Color</label>
            <app-color-picker [value]="color" (valueChange)="color = $event" />
          </div>
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
              class="field font-mono text-xs"
              [class.border-slate-700]="conforms(localPattern)"
              [class.border-amber-500]="!conforms(localPattern)"
              placeholder="D:\\Exports\\{mes}\\Cliente 1"
            />
            <button
              (click)="pick('local')"
              class="btn-ghost shrink-0"
            >
              Elegir…
            </button>
          </div>
          @if (conforms(localPattern)) {
            <p class="mt-1 break-all font-mono text-xs text-emerald-300/80">
              Este mes ({{ monthFormat }}): {{ preview(localPattern) }}
            </p>
          }
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
              class="field font-mono text-xs"
              [class.border-slate-700]="conforms(drivePattern)"
              [class.border-amber-500]="!conforms(drivePattern)"
              placeholder="G:\\Mi unidad\\Cliente 1\\artes\\{mes}"
            />
            <button
              (click)="pick('drive')"
              class="btn-ghost shrink-0"
            >
              Elegir…
            </button>
          </div>
          @if (conforms(drivePattern)) {
            <p class="mt-1 break-all font-mono text-xs text-emerald-300/80">
              Este mes ({{ monthFormat }}): {{ preview(drivePattern) }}
            </p>
          }
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
              class="field"
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
            class="field font-mono text-xs"
            placeholder="*.tmp&#10;Thumbs.db"
          ></textarea>
        </div>

        @if (error()) {
          <p class="text-sm text-rose-400">{{ error() }}</p>
        }

        <div class="flex gap-3 pt-2">
          <button
            (click)="guardar()"
            class="btn-primary"
          >
            Guardar
          </button>
          <button
            (click)="cancelar()"
            class="btn-ghost"
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
  protected icon = 'store';
  protected color = '#34d399';
  protected localPattern = '';
  protected drivePattern = '';
  protected monthFormat: MonthFormat = 'Mes-Año';
  protected createMissing = true;
  protected exclusionsText = '';

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      void this.loadExisting(id);
    } else {
      // Viene de crear un cliente: el nombre ya llega relleno.
      this.name = this.route.snapshot.queryParamMap.get('name') ?? '';
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
    this.icon = mapping.icon ?? 'store';
    this.color = mapping.color ?? '#34d399';
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

  /** Ruta con {mes} resuelto al mes actual y al formato elegido. */
  protected preview(pattern: string): string {
    const now = new Date();
    const names = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
      'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const month =
      this.monthFormat === 'MM-AAAA'
        ? `${mm}-${year}`
        : this.monthFormat === 'AAAA-MM'
          ? `${year}-${mm}`
          : `${names[now.getMonth()]}-${year}`;
    return pattern.replace(/\{mes\}/gi, month);
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
    const isNew = !this.editing();
    await this.ipc.saveMapping({
      id: this.id,
      name: this.name.trim(),
      icon: this.icon,
      color: this.color,
      localPattern: this.localPattern.trim(),
      drivePattern: this.drivePattern.trim(),
      monthFormat: this.monthFormat,
      createMissing: this.createMissing,
      exclusions: this.exclusionsText
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    });
    if (isNew) {
      await this.offerClient();
    }
    void this.router.navigate(['/']);
  }

  /** Al crear un mapeo nuevo, ofrece registrar también al cliente si no existe. */
  private async offerClient(): Promise<void> {
    const name = this.name.trim();
    const key = name.toLowerCase().replace(/\s+/g, '_');
    const clients = await this.ipc.listClients();
    if (!key || clients.some((c) => c.name === key)) {
      return;
    }
    const ok = confirm(
      `Creaste el mapeo «${name}». ¿Quieres crear también el cliente «${name}»?
Así aparece en Proyectos y en Clientes con el mismo icono y color.`,
    );
    if (ok) {
      await this.ipc.createClient(name, this.icon, this.color);
    }
  }

  protected cancelar(): void {
    void this.router.navigate(['/']);
  }
}
