import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IpcService } from '../services/ipc.service';
import { IconComponent } from '../shared/icon.component';
import type { Mapping } from '../../../shared/ipc-contract';

/** Pantalla principal: lista de mapeos configurados. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IconComponent],
  template: `
    <section class="mx-auto max-w-4xl p-8">
      <header class="mb-8 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 text-white shadow-lg shadow-indigo-500/20"
          >
            <app-icon name="layers" [size]="24" />
          </div>
          <div>
            <h1 class="text-2xl font-semibold tracking-tight">Mapeos</h1>
            <p class="text-sm text-slate-400">
              Carpeta local &rarr; carpeta de Google Drive.
            </p>
          </div>
        </div>
        <button (click)="nuevo()" class="btn-primary">
          <app-icon name="plus" [size]="18" /> Nuevo mapeo
        </button>
      </header>

      @if (loading()) {
        <p class="text-slate-500">Cargando…</p>
      } @else if (mappings().length === 0) {
        <div
          class="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-12 text-center"
        >
          <div
            class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400"
          >
            <app-icon name="layers" [size]="24" />
          </div>
          <p class="mb-4 text-slate-400">Aún no hay mapeos configurados.</p>
          <button (click)="nuevo()" class="btn-ghost mx-auto">
            <app-icon name="plus" [size]="16" /> Crear el primero
          </button>
        </div>
      } @else {
        <ul class="space-y-3">
          @for (m of mappings(); track m.id) {
            <li
              class="group rounded-2xl border border-white/5 bg-slate-900/40 p-4 transition-colors hover:border-white/10 hover:bg-slate-900/70"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex min-w-0 gap-3">
                  <div
                    class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-emerald-300"
                  >
                    <app-icon [name]="m.icon || 'store'" [size]="20" />
                  </div>
                  <div class="min-w-0">
                  <h2 class="truncate font-medium">{{ m.name }}</h2>
                  <p class="mt-1.5 flex items-center gap-1.5 truncate font-mono text-xs text-sky-300">
                    <app-icon name="folder" [size]="13" /> {{ m.localPattern }}
                  </p>
                  <p class="flex items-center gap-1.5 truncate font-mono text-xs text-amber-300">
                    <app-icon name="chevronRight" [size]="13" /> {{ m.drivePattern }}
                  </p>
                  </div>
                </div>
                <div class="flex shrink-0 gap-1.5">
                  <button (click)="sincronizar(m)" class="btn-primary btn-sm">
                    <app-icon name="refresh" [size]="15" /> Sincronizar
                  </button>
                  <button
                    (click)="editar(m)"
                    class="icon-btn"
                    title="Editar"
                  >
                    <app-icon name="pencil" [size]="16" />
                  </button>
                  <button
                    (click)="eliminar(m)"
                    class="icon-btn hover:bg-rose-500/15 hover:text-rose-300"
                    title="Eliminar"
                  >
                    <app-icon name="trash" [size]="16" />
                  </button>
                </div>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [
    `
      .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        border-radius: 0.75rem;
        padding: 0.625rem 1.25rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: rgb(2 6 23);
        background-image: linear-gradient(
          to bottom right,
          rgb(52 211 153),
          rgb(13 148 136)
        );
        box-shadow: 0 10px 25px -10px rgba(16, 185, 129, 0.6);
        transition: filter 0.15s;
      }
      .btn-primary:hover {
        filter: brightness(1.08);
      }
      .btn-sm {
        padding: 0.4rem 0.75rem;
        font-size: 0.75rem;
      }
      .btn-ghost {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        border-radius: 0.75rem;
        padding: 0.5rem 0.875rem;
        font-size: 0.8125rem;
        color: rgb(203 213 225);
        background: rgba(255, 255, 255, 0.06);
        transition: background 0.15s;
      }
      .btn-ghost:hover {
        background: rgba(255, 255, 255, 0.12);
      }
      .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 2rem;
        width: 2rem;
        border-radius: 0.75rem;
        color: rgb(148 163 184);
        transition: background 0.15s, color 0.15s;
      }
      .icon-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        color: rgb(226 232 240);
      }
    `,
  ],
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
