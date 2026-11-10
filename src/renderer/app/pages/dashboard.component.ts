import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IpcService } from '../services/ipc.service';
import { IconComponent } from '../shared/icon.component';
import { chipStyle } from '../shared/colors';
import { SyncAllService } from '../services/sync-all.service';
import type { Mapping, RotationIssue } from '../../../shared/ipc-contract';

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
        <div class="flex gap-2">
          @if (mappings().length > 0) {
            <button
              (click)="sincronizarTodo()"
              [disabled]="syncAll.running()"
              class="btn-ghost"
            >
              <app-icon name="refresh" [size]="16" />
              {{ syncAll.running() ? syncAll.status() : 'Sincronizar todo' }}
            </button>
          }
          <button (click)="nuevo()" class="btn-primary">
            <app-icon name="plus" [size]="18" /> Nuevo mapeo
          </button>
        </div>
      </header>

      @if (syncAll.result() || folderMessage()) {
        <p class="mb-4 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-2.5 text-sm text-slate-300">
          {{ folderMessage() || syncAll.result() }}
        </p>
      }

      @if (issues().length > 0) {
        <div
          class="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100"
        >
          <p class="mb-3 flex items-start gap-2">
            <app-icon name="alert" [size]="18" />
            <span>
              Estas carpetas tienen un mes fijo y no rotan: el próximo mes
              seguirán apuntando al actual. Se arreglan con
              <code class="text-emerald-300">&#123;mes&#125;</code>.
            </span>
          </p>
          <ul class="mb-3 space-y-3 pl-7">
            @for (i of issues(); track i.mappingId) {
              <li class="rounded-xl bg-black/20 p-3">
                <b>{{ i.name }}</b>
                <span class="ml-2 text-xs text-slate-400">
                  Formato de mes: {{ i.format }} ({{ i.formatSample }})
                </span>
                @if (i.localFixed) {
                  <div class="mt-2">
                    <p class="font-mono text-xs text-sky-300">{{ i.localPattern }}</p>
                    @if (i.proposedLocal) {
                      <p class="font-mono text-xs text-emerald-300">
                        → {{ i.proposedLocal }}
                      </p>
                      <p class="font-mono text-xs text-slate-400">
                        ej. este mes: {{ i.proposedLocalExample }}
                      </p>
                    }
                    <p class="mt-0.5 text-xs text-amber-200/80">{{ i.localNote }}</p>
                    @if (!i.proposedLocal) {
                      <button
                        (click)="pickSide(i, 'local')"
                        class="btn-ghost btn-sm mt-1.5"
                      >
                        <app-icon name="folder" [size]="14" /> Elegir carpeta del mes (local)
                      </button>
                    }
                  </div>
                }
                @if (i.driveFixed) {
                  <div class="mt-2">
                    <p class="font-mono text-xs text-amber-300">{{ i.drivePattern }}</p>
                    @if (i.proposedDrive) {
                      <p class="font-mono text-xs text-emerald-300">
                        → {{ i.proposedDrive }}
                      </p>
                      <p class="font-mono text-xs text-slate-400">
                        ej. este mes: {{ i.proposedDriveExample }}
                      </p>
                    }
                    <p class="mt-0.5 text-xs text-amber-200/80">{{ i.driveNote }}</p>
                    @if (!i.proposedDrive) {
                      <button
                        (click)="pickSide(i, 'drive')"
                        class="btn-ghost btn-sm mt-1.5"
                      >
                        <app-icon name="folder" [size]="14" /> Elegir carpeta del mes (Drive)
                      </button>
                    }
                  </div>
                }
                <button (click)="editar(i.mappingId)" class="mt-2 text-xs text-sky-300 hover:underline">
                  Editar a mano
                </button>
              </li>
            }
          </ul>
          @if (rotationMessage()) {
            <p class="mb-3 pl-7 text-xs text-amber-200">{{ rotationMessage() }}</p>
          }
          @if (fixable().length > 0) {
            <div class="pl-7">
              <button (click)="fixRotation()" class="btn-warn">
                Aplicar {{ fixable().length }} corrección(es) automática(s)
              </button>
            </div>
          }
        </div>
      }

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
                    class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    [style]="chip(m.color)"
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
                    (click)="abrirCarpeta(m, 'local')"
                    class="icon-btn"
                    title="Abrir carpeta local"
                  >
                    <app-icon name="folderOpen" [size]="16" />
                  </button>
                  <button
                    (click)="abrirCarpeta(m, 'drive')"
                    class="icon-btn"
                    title="Abrir carpeta de Drive"
                  >
                    <app-icon name="layers" [size]="16" />
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
})
export class DashboardComponent {
  private readonly ipc = inject(IpcService);
  private readonly router = inject(Router);
  protected readonly syncAll = inject(SyncAllService);
  protected readonly folderMessage = signal('');

  protected readonly mappings = signal<Mapping[]>([]);
  protected readonly loading = signal(true);
  protected readonly issues = signal<RotationIssue[]>([]);
  protected readonly chip = chipStyle;

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.mappings.set(await this.ipc.listMappings());
    this.issues.set(await this.ipc.listRotationIssues());
    this.loading.set(false);
  }

  protected readonly rotationMessage = signal('');

  /** Mapeos con al menos una propuesta que se puede aplicar sola. */
  protected fixable(): RotationIssue[] {
    return this.issues().filter((i) => i.proposedLocal || i.proposedDrive);
  }

  protected async fixRotation(): Promise<void> {
    const ids = this.fixable().map((i) => i.mappingId);
    this.issues.set(await this.ipc.fixRotation(ids));
    this.mappings.set(await this.ipc.listMappings());
    this.rotationMessage.set(
      this.issues().length > 0
        ? 'Aplicado. Lo que queda necesita que elijas la carpeta del mes.'
        : '',
    );
  }

  /** Guía manual: el usuario elige la carpeta del mes y se convierte en {mes}. */
  protected async pickSide(i: RotationIssue, side: 'local' | 'drive'): Promise<void> {
    const folder = await this.ipc.pickFolder();
    if (!folder) {
      return;
    }
    const res = await this.ipc.setRotationSide(i.mappingId, side, folder);
    this.rotationMessage.set(res.message);
    this.issues.set(res.issues);
    if (res.ok) {
      this.mappings.set(await this.ipc.listMappings());
    }
  }

  protected async sincronizarTodo(): Promise<void> {
    this.folderMessage.set('');
    await this.syncAll.run(this.mappings().map((m) => m.id));
  }

  /** Abre la carpeta del mes actual del mapeo (local o Drive) en el explorador. */
  protected async abrirCarpeta(m: Mapping, side: 'local' | 'drive'): Promise<void> {
    const ok = await this.ipc.openMappingFolder(m.id, side);
    this.folderMessage.set(
      ok
        ? ''
        : `La carpeta ${side === 'local' ? 'local' : 'de Drive'} de «${m.name}» no existe todavía este mes.`,
    );
  }

  protected nuevo(): void {
    void this.router.navigate(['/mapping/new']);
  }

  protected editar(target: Mapping | string): void {
    void this.router.navigate(['/mapping', typeof target === 'string' ? target : target.id]);
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
