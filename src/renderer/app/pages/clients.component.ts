import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IpcService } from '../services/ipc.service';
import { IconComponent } from '../shared/icon.component';
import { chipStyle } from '../shared/colors';
import type { Client, Mapping } from '../../../shared/ipc-contract';

/** Saneado de nombre igual al del main (minúsculas, guiones bajos). */
function sanitize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Gestión de clientes: ver su historial de proyectos y eliminar de forma
 * sincronizada. Al eliminar un cliente con mapeos del mismo nombre, se avisa y
 * se deja elegir si borrarlos también (en cascada) o conservarlos.
 */
@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <section class="mx-auto max-w-3xl p-8">
      <header class="mb-8 flex items-center gap-3">
        <div
          class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 shadow-lg shadow-emerald-500/20"
        >
          <app-icon name="user" [size]="24" />
        </div>
        <div>
          <h1 class="page-title">Clientes</h1>
          <p class="text-sm text-slate-400">
            Historial de proyectos y eliminación sincronizada.
          </p>
        </div>
        <button (click)="creating.set(!creating())" class="btn-primary ml-auto">
          <app-icon name="plus" [size]="18" /> Nuevo cliente
        </button>
      </header>

      @if (creating()) {
        <div class="card mb-6 flex flex-wrap items-center gap-3 p-4">
          <input
            [(ngModel)]="newName"
            (keyup.enter)="createClient()"
            class="field min-w-0 flex-1"
            placeholder="Nombre del cliente"
          />
          <button (click)="createClient()" class="btn-primary">Crear</button>
          <button (click)="creating.set(false)" class="btn-ghost">Cancelar</button>
          @if (formError()) {
            <p class="w-full text-sm text-rose-400">{{ formError() }}</p>
          }
        </div>
      }

      @if (clients().length === 0) {
        <div
          class="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-12 text-center text-slate-400"
        >
          Aún no hay clientes registrados.
        </div>
      } @else {
        <ul class="space-y-3">
          @for (c of clients(); track c.name) {
            <li class="card p-4">
              <div class="flex items-start justify-between gap-4">
                <button
                  (click)="toggle(c.name)"
                  class="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    [style]="chip(c.color)"
                  >
                    <app-icon [name]="c.icon || 'user'" [size]="20" />
                  </div>
                  <div class="min-w-0">
                    <h2 class="truncate font-medium capitalize">
                      {{ c.name.replaceAll('_', ' ') }}
                    </h2>
                    <p class="text-xs text-slate-500">
                      {{ c.projects.length }} proyecto(s)
                      @if (c.aliases?.length) {
                        · también: {{ c.aliases!.join(', ').replaceAll('_', ' ') }}
                      }
                    </p>
                  </div>
                  <app-icon
                    name="chevronRight"
                    [size]="16"
                    class="ml-1 shrink-0 text-slate-500 transition-transform"
                    [class.rotate-90]="expanded().has(c.name)"
                  />
                </button>
                @if (clients().length > 1) {
                  <button
                    (click)="startMerge(c)"
                    class="icon-btn"
                    title="Fusionar con otro cliente"
                  >
                    <app-icon name="layers" [size]="16" />
                  </button>
                }
                <button
                  (click)="startDelete(c)"
                  class="icon-btn hover:bg-rose-500/15 hover:text-rose-300"
                  title="Eliminar cliente"
                >
                  <app-icon name="trash" [size]="16" />
                </button>
              </div>

              <!-- Fusionar: este cliente pasa a ser el mismo que otro -->
              @if (mergeName() === c.name) {
                <div
                  class="mt-3 space-y-3 rounded-xl border border-sky-500/40 bg-sky-500/10 p-4 text-sm text-sky-100"
                >
                  <p class="flex items-start gap-2">
                    <app-icon name="layers" [size]="18" />
                    <span>
                      Mover «{{ c.name.replaceAll('_', ' ') }}» a otro cliente: sus
                      proyectos y eventos pasan al destino, y el sistema los trata
                      como el mismo (también los exports con el nombre anterior).
                    </span>
                  </p>
                  <select
                    [ngModel]="mergeTarget()"
                    (ngModelChange)="mergeTarget.set($event)"
                    class="field"
                  >
                    <option value="">Elige el cliente destino…</option>
                    @for (o of clients(); track o.name) {
                      @if (o.name !== c.name) {
                        <option [value]="o.name">{{ o.name.replaceAll('_', ' ') }}</option>
                      }
                    }
                  </select>
                  @if (mergeTarget() && related(c).length > 0 && relatedByName(mergeTarget()).length > 0) {
                    <label class="flex items-start gap-2 text-xs">
                      <input type="checkbox" [(ngModel)]="mergeDropMappings" class="mt-0.5" />
                      <span>
                        Eliminar también el mapeo «{{ relatedNames(c) }}» (sus
                        exports irán al mapeo de «{{ mergeTarget().replaceAll('_', ' ') }}»).
                      </span>
                    </label>
                  }
                  <div class="flex gap-2">
                    <button
                      (click)="confirmMerge(c)"
                      [disabled]="!mergeTarget()"
                      class="btn-primary btn-sm"
                    >
                      Fusionar
                    </button>
                    <button (click)="cancelMerge()" class="btn-ghost btn-sm">Cancelar</button>
                  </div>
                </div>
              }

              <!-- Confirmación de borrado con mapeos relacionados -->
              @if (confirmName() === c.name) {
                <div
                  class="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100"
                >
                  @if (related(c).length > 0) {
                    <p class="mb-2 flex items-start gap-2">
                      <app-icon name="alert" [size]="18" />
                      <span>
                        Este cliente tiene {{ related(c).length }} mapeo(s) con su
                        mismo nombre:
                        <b>{{ relatedNames(c) }}</b
                        >. ¿Eliminarlos también (con su historial y papelera) o
                        conservarlos?
                      </span>
                    </p>
                    <div class="flex flex-wrap gap-2 pl-7">
                      <button (click)="confirmDelete(c, true)" class="btn-warn">
                        Eliminar cliente y {{ related(c).length }} mapeo(s)
                      </button>
                      <button (click)="confirmDelete(c, false)" class="btn-ghost">
                        Solo el cliente
                      </button>
                      <button (click)="cancel()" class="btn-ghost">Cancelar</button>
                    </div>
                  } @else {
                    <p class="mb-2 flex items-start gap-2">
                      <app-icon name="alert" [size]="18" />
                      <span>
                        Se eliminará el cliente y su historial de proyectos. No se
                        borran carpetas del disco.
                      </span>
                    </p>
                    <div class="flex gap-2 pl-7">
                      <button (click)="confirmDelete(c, false)" class="btn-warn">
                        Eliminar cliente
                      </button>
                      <button (click)="cancel()" class="btn-ghost">Cancelar</button>
                    </div>
                  }
                </div>
              }

              <!-- Proyectos del cliente -->
              @if (expanded().has(c.name)) {
                <ul class="mt-3 space-y-1.5 border-t border-white/5 pt-3">
                  @for (p of c.projects; track p.name) {
                    <li class="flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <p class="truncate text-sm capitalize text-slate-200">
                          {{ p.name.replaceAll('_', ' ') }}
                        </p>
                        <p class="truncate font-mono text-xs text-slate-500">
                          {{ p.folders.length }} carpeta(s)
                        </p>
                      </div>
                      <button
                        (click)="deleteProject(c, p.name)"
                        class="icon-btn hover:bg-rose-500/15 hover:text-rose-300"
                        title="Eliminar proyecto"
                      >
                        <app-icon name="trash" [size]="15" />
                      </button>
                    </li>
                  }
                  @if (c.projects.length === 0) {
                    <li class="text-xs text-slate-500">Sin proyectos registrados.</li>
                  }
                </ul>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class ClientsComponent {
  private readonly ipc = inject(IpcService);
  private readonly router = inject(Router);
  protected readonly chip = chipStyle;
  protected readonly creating = signal(false);
  protected readonly formError = signal('');
  protected newName = '';

  protected readonly clients = signal<Client[]>([]);
  protected readonly mappings = signal<Mapping[]>([]);
  protected readonly expanded = signal<Set<string>>(new Set());
  protected readonly confirmName = signal('');
  protected readonly mergeName = signal('');
  protected readonly mergeTarget = signal('');
  protected mergeDropMappings = false;

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const [clients, mappings] = await Promise.all([
      this.ipc.listClients(),
      this.ipc.listMappings(),
    ]);
    this.clients.set(clients);
    this.mappings.set(mappings);
  }

  /** Crea el cliente y, si no tiene mapeo, ofrece crearlo también. */
  protected async createClient(): Promise<void> {
    const name = this.newName.trim();
    if (!name) {
      this.formError.set('Escribe el nombre del cliente.');
      return;
    }
    const key = sanitize(name);
    if (this.clients().some((c) => c.name === key)) {
      this.formError.set('Ese cliente ya existe.');
      return;
    }
    this.clients.set(await this.ipc.createClient(name));
    this.newName = '';
    this.formError.set('');
    this.creating.set(false);
    if (this.mappings().some((m) => sanitize(m.name) === key)) {
      return;
    }
    const ok = confirm(
      `Cliente «${name}» creado. ¿Quieres crear también su mapeo (carpeta local → Drive)?`,
    );
    if (ok) {
      void this.router.navigate(['/mapping/new'], { queryParams: { name } });
    }
  }

  protected toggle(name: string): void {
    const next = new Set(this.expanded());
    next.has(name) ? next.delete(name) : next.add(name);
    this.expanded.set(next);
  }

  /** Mapeos relacionados con el cliente por nombre saneado. */
  protected related(c: Client): Mapping[] {
    return this.mappings().filter((m) => sanitize(m.name) === c.name);
  }

  protected relatedNames(c: Client): string {
    return this.related(c)
      .map((m) => m.name)
      .join(', ');
  }

  protected relatedByName(name: string): Mapping[] {
    return this.mappings().filter((m) => sanitize(m.name) === name);
  }

  protected startMerge(c: Client): void {
    this.confirmName.set('');
    this.mergeName.set(c.name);
    this.mergeTarget.set('');
    this.mergeDropMappings = false;
  }

  protected cancelMerge(): void {
    this.mergeName.set('');
  }

  protected async confirmMerge(c: Client): Promise<void> {
    const target = this.mergeTarget();
    if (!target) {
      return;
    }
    const dropIds =
      this.mergeDropMappings && this.relatedByName(target).length > 0
        ? this.related(c).map((m) => m.id)
        : [];
    this.clients.set(await this.ipc.mergeClients(c.name, target, dropIds));
    this.mappings.set(await this.ipc.listMappings());
    this.mergeName.set('');
  }

  protected startDelete(c: Client): void {
    this.mergeName.set('');
    this.confirmName.set(c.name);
  }

  protected cancel(): void {
    this.confirmName.set('');
  }

  protected async confirmDelete(c: Client, alsoMappings: boolean): Promise<void> {
    const mappingIds = alsoMappings ? this.related(c).map((m) => m.id) : [];
    this.clients.set(await this.ipc.deleteClient(c.name, mappingIds));
    this.mappings.set(await this.ipc.listMappings());
    this.confirmName.set('');
  }

  protected async deleteProject(c: Client, project: string): Promise<void> {
    const ok = confirm(
      `¿Eliminar el proyecto "${project.replaceAll('_', ' ')}" de ${c.name.replaceAll('_', ' ')}? No borra carpetas del disco.`,
    );
    if (!ok) {
      return;
    }
    this.clients.set(await this.ipc.deleteClientProject(c.name, project));
  }
}
