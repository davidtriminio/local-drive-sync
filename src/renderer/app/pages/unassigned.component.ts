import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IpcService } from '../services/ipc.service';
import { IconComponent } from '../shared/icon.component';
import { formatBytes } from '../shared/format.util';
import type { Mapping, UnassignedFile } from '../../../shared/ipc-contract';

/**
 * Archivos de la carpeta de export que ningún mapeo reconoce (normalmente por
 * no llevar el prefijo de la empresa). Permite elegir a qué mapeo van y los
 * mueve a su carpeta local del mes actual.
 */
@Component({
  selector: 'app-unassigned',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <section class="mx-auto max-w-5xl p-8">
      <header class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-lg shadow-amber-500/20"
          >
            <app-icon name="file" [size]="24" />
          </div>
          <div>
            <h1 class="page-title">Sin asignar</h1>
            <p class="text-xs text-slate-400">
              Archivos de la carpeta de export que ningún mapeo reconoce.
            </p>
          </div>
        </div>
        <div class="flex gap-2">
          @if (folder()) {
            <button (click)="abrirExport()" class="btn-ghost btn-sm">
              <app-icon name="folder" [size]="14" /> Abrir carpeta de export
            </button>
          }
          <button (click)="cargar()" [disabled]="loading()" class="btn-ghost btn-sm">
            <app-icon name="refresh" [size]="14" /> Actualizar
          </button>
        </div>
      </header>

      @if (message()) {
        <div class="mb-4 rounded-lg bg-slate-800/60 p-3 text-sm text-slate-300">
          {{ message() }}
        </div>
      }

      @if (!folder() && !loading()) {
        <div class="card p-6 text-sm text-slate-400">
          No hay una carpeta de export configurada. Configúrala en
          <b>Ajustes</b> para ver aquí los archivos sin asignar.
        </div>
      } @else if (files().length === 0 && !loading()) {
        <div class="card p-6 text-sm text-slate-400">
          No hay archivos pendientes de asignar en
          <code class="text-slate-300">{{ folder() }}</code>.
        </div>
      } @else {
        <div class="card overflow-hidden">
          <table class="w-full text-sm">
            <tbody>
              @for (f of files(); track f.name) {
                <tr class="border-b border-slate-800/60">
                  <td class="px-4 py-3">
                    <div class="break-all font-mono text-xs text-slate-200">{{ f.name }}</div>
                    <div class="mt-0.5 text-[11px] text-slate-500">
                      {{ fmt(f.size) }}
                      @if (f.suggestion) {
                        · ¿Quisiste decir
                        <button
                          (click)="elegir(f.name, f.suggestion)"
                          class="text-amber-300 underline"
                        >
                          {{ f.suggestion }}
                        </button>
                        ?
                      }
                    </div>
                  </td>
                  <td class="w-64 px-2 py-3">
                    <select
                      [ngModel]="destino()[f.name] || ''"
                      (ngModelChange)="setDestino(f.name, $event)"
                      class="field !py-1.5 text-xs"
                    >
                      <option value="">Elegir mapeo…</option>
                      @for (m of mappings(); track m.id) {
                        <option [value]="m.id">{{ m.name }}</option>
                      }
                    </select>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      (click)="asignar(f)"
                      [disabled]="!destino()[f.name] || busy()"
                      class="btn-primary btn-sm"
                    >
                      Mover
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-xs text-slate-500">
          El archivo se mueve a la carpeta local del mapeo (mes actual). Si ya
          existe uno con el mismo nombre, se reemplaza.
        </p>
      }
    </section>
  `,
})
export class UnassignedComponent implements OnInit, OnDestroy {
  private readonly ipc = inject(IpcService);

  protected readonly files = signal<UnassignedFile[]>([]);
  protected readonly mappings = signal<Mapping[]>([]);
  protected readonly folder = signal('');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  /** Mapeo elegido por archivo: nombre de archivo -> id de mapeo. */
  protected readonly destino = signal<Record<string, string>>({});

  private unsubExport: (() => void) | null = null;

  ngOnInit(): void {
    void this.cargar();
    // Si llega o se mueve un archivo con la app abierta, refresca la lista.
    this.unsubExport = this.ipc.onExportActivity(() => void this.cargar());
  }

  ngOnDestroy(): void {
    this.unsubExport?.();
  }

  protected fmt(bytes: number): string {
    return formatBytes(bytes);
  }

  protected async cargar(): Promise<void> {
    this.loading.set(true);
    try {
      const [res, mappings] = await Promise.all([
        this.ipc.listUnassignedExports(),
        this.ipc.listMappings(),
      ]);
      this.folder.set(res.folder);
      this.files.set(res.files);
      this.mappings.set(mappings);
    } catch (e) {
      this.message.set(`No se pudo leer la carpeta de export: ${String(e)}`);
    } finally {
      this.loading.set(false);
    }
  }

  protected setDestino(file: string, mappingId: string): void {
    this.destino.update((d) => ({ ...d, [file]: mappingId }));
  }

  /** Preselecciona el mapeo sugerido (por nombre) para un archivo. */
  protected elegir(file: string, mappingName: string): void {
    const m = this.mappings().find((x) => x.name === mappingName);
    if (m) {
      this.setDestino(file, m.id);
    }
  }

  protected async asignar(f: UnassignedFile): Promise<void> {
    const mappingId = this.destino()[f.name];
    if (!mappingId || this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      const res = await this.ipc.assignExport(f.name, mappingId);
      this.message.set(res.ok ? `${f.name}: ${res.message}` : `No se pudo mover ${f.name}: ${res.message}`);
      await this.cargar();
    } catch (e) {
      this.message.set(`No se pudo mover ${f.name}: ${String(e)}`);
    } finally {
      this.busy.set(false);
    }
  }

  protected abrirExport(): void {
    void this.ipc.openPath(this.folder());
  }
}
