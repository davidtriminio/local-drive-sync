import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IpcService } from '../services/ipc.service';
import type { Mapping } from '../../../shared/ipc-contract';

/** Pantalla principal: lista de mapeos configurados. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <section class="mx-auto max-w-4xl p-8">
      <header class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Mapeos</h1>
          <p class="text-sm text-slate-400">
            Relaciones carpeta local &rarr; carpeta de Google Drive.
          </p>
        </div>
        <button
          (click)="nuevo()"
          class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
        >
          + Nuevo mapeo
        </button>
      </header>

      @if (loading()) {
        <p class="text-slate-500">Cargando…</p>
      } @else if (mappings().length === 0) {
        <div
          class="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-400"
        >
          <p class="mb-3">Aún no hay mapeos configurados.</p>
          <button
            (click)="nuevo()"
            class="rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
          >
            Crear el primero
          </button>
        </div>
      } @else {
        <ul class="space-y-3">
          @for (m of mappings(); track m.id) {
            <li
              class="rounded-xl border border-slate-800 bg-slate-800/40 p-4"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <h2 class="truncate font-medium">{{ m.name }}</h2>
                  <p class="mt-1 truncate font-mono text-xs text-sky-300">
                    {{ m.localPattern }}
                  </p>
                  <p class="truncate font-mono text-xs text-amber-300">
                    &rarr; {{ m.drivePattern }}
                  </p>
                </div>
                <div class="flex shrink-0 gap-2">
                  <button
                    (click)="sincronizar(m)"
                    class="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-emerald-400"
                  >
                    Sincronizar
                  </button>
                  <button
                    (click)="editar(m)"
                    class="rounded-lg bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600"
                  >
                    Editar
                  </button>
                  <button
                    (click)="eliminar(m)"
                    class="rounded-lg px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class DashboardComponent {
  private readonly ipc = inject(IpcService);
  private readonly router = inject(Router);

  protected readonly mappings = signal<Mapping[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.mappings.set(await this.ipc.listMappings());
    this.loading.set(false);
  }

  protected nuevo(): void {
    void this.router.navigate(['/mapping/new']);
  }

  protected editar(m: Mapping): void {
    void this.router.navigate(['/mapping', m.id]);
  }

  protected sincronizar(m: Mapping): void {
    void this.router.navigate(['/sync', m.id]);
  }

  protected async eliminar(m: Mapping): Promise<void> {
    const ok = confirm(`¿Eliminar el mapeo "${m.name}"? No borra archivos.`);
    if (!ok) {
      return;
    }
    await this.ipc.deleteMapping(m.id);
    await this.load();
  }
}
