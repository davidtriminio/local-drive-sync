import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IpcService } from '../services/ipc.service';
import {
  DEFAULT_SUBFOLDERS,
  type Client,
  type Platform,
} from '../../../shared/ipc-contract';

const BASE_PATH_KEY = 'creator.basePath';

/** Creador de proyectos gráficos: cliente + proyecto -> estructura + PSD base. */
@Component({
  selector: 'app-project-creator',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="mx-auto max-w-2xl p-8">
      <header class="mb-6">
        <h1 class="text-2xl font-semibold">Nuevo proyecto</h1>
        <p class="text-sm text-slate-400">
          Genera la estructura de carpetas y el PSD base para un cliente.
        </p>
      </header>

      <div class="space-y-5">
        <div>
          <label class="mb-1 block text-sm text-slate-300">Carpeta base</label>
          <div class="flex gap-2">
            <input
              [(ngModel)]="basePath"
              (ngModelChange)="persistBase()"
              class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500"
              placeholder="V:\\graphic_design\\projects"
            />
            <button
              (click)="pickBase()"
              class="shrink-0 rounded-lg bg-slate-700 px-3 text-xs hover:bg-slate-600"
            >
              Elegir…
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="mb-1 block text-sm text-slate-300">Cliente</label>
            <input
              [(ngModel)]="client"
              list="clients-list"
              class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="cliente"
            />
            <datalist id="clients-list">
              @for (c of clients(); track c.name) {
                <option [value]="c.name"></option>
              }
            </datalist>
          </div>
          <div>
            <label class="mb-1 block text-sm text-slate-300">Proyecto</label>
            <input
              [(ngModel)]="project"
              class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="nombre_proyecto"
            />
          </div>
        </div>

        <div>
          <label class="mb-2 block text-sm text-slate-300">Plataformas (PSD base)</label>
          @if (platforms().length === 0) {
            <p class="text-xs text-slate-500">No hay plataformas configuradas.</p>
          } @else {
            <div class="flex flex-wrap gap-2">
              @for (p of platforms(); track p.name) {
                <label
                  class="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4"
                    [checked]="selectedPlatforms().has(p.name)"
                    (change)="togglePlatform(p.name)"
                  />
                  {{ p.name }}
                </label>
              }
            </div>
          }
        </div>

        <div class="flex gap-6">
          <label class="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" [(ngModel)]="psd" class="h-4 w-4" /> PSD
          </label>
          <label class="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" [(ngModel)]="ai" class="h-4 w-4" /> AI
          </label>
        </div>

        <details class="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
          <summary class="cursor-pointer text-sm text-slate-300">
            Subcarpetas ({{ selectedSubfolders().size }}/{{ subfolders.length }})
          </summary>
          <div class="mt-3 grid grid-cols-2 gap-2">
            @for (s of subfolders; track s) {
              <label class="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  class="h-3.5 w-3.5"
                  [checked]="selectedSubfolders().has(s)"
                  (change)="toggleSubfolder(s)"
                />
                <span class="font-mono">{{ s }}</span>
              </label>
            }
          </div>
        </details>

        @if (error()) {
          <p class="text-sm text-rose-400">{{ error() }}</p>
        }

        @if (duplicateFolder()) {
          <div
            class="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-200"
          >
            <p class="mb-2">
              Ya existe un proyecto de este cliente este mes:
              <code class="font-mono">{{ duplicateFolder() }}</code>.
            </p>
            <div class="flex gap-2">
              <button
                (click)="create(true)"
                class="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-amber-400"
              >
                Crear de todos modos
              </button>
              <button
                (click)="duplicateFolder.set('')"
                class="rounded-lg bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        }

        @if (success()) {
          <div
            class="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-4 text-sm text-emerald-200"
          >
            Proyecto creado: <code class="font-mono">{{ success() }}</code>
          </div>
        }

        <div class="pt-2">
          <button
            (click)="create(false)"
            [disabled]="busy()"
            class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {{ busy() ? 'Creando…' : 'Crear proyecto' }}
          </button>
        </div>
      </div>
    </section>
  `,
})
export class ProjectCreatorComponent {
  private readonly ipc = inject(IpcService);

  protected readonly subfolders = [...DEFAULT_SUBFOLDERS];
  protected readonly clients = signal<Client[]>([]);
  protected readonly platforms = signal<Platform[]>([]);
  protected readonly selectedPlatforms = signal<Set<string>>(new Set());
  protected readonly selectedSubfolders = signal<Set<string>>(
    new Set(DEFAULT_SUBFOLDERS),
  );
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly duplicateFolder = signal('');
  protected readonly busy = signal(false);

  protected basePath = '';
  protected client = '';
  protected project = '';
  protected psd = true;
  protected ai = false;

  constructor() {
    this.basePath = localStorage.getItem(BASE_PATH_KEY) ?? '';
    void this.load();
  }

  private async load(): Promise<void> {
    const [clients, platforms] = await Promise.all([
      this.ipc.listClients(),
      this.ipc.listPlatforms(),
    ]);
    this.clients.set(clients);
    this.platforms.set(platforms);
    // Por defecto, todas las plataformas seleccionadas.
    this.selectedPlatforms.set(new Set(platforms.map((p) => p.name)));
  }

  protected persistBase(): void {
    localStorage.setItem(BASE_PATH_KEY, this.basePath.trim());
  }

  protected async pickBase(): Promise<void> {
    const chosen = await this.ipc.pickFolder();
    if (chosen) {
      this.basePath = chosen;
      this.persistBase();
    }
  }

  protected togglePlatform(name: string): void {
    const next = new Set(this.selectedPlatforms());
    next.has(name) ? next.delete(name) : next.add(name);
    this.selectedPlatforms.set(next);
  }

  protected toggleSubfolder(name: string): void {
    const next = new Set(this.selectedSubfolders());
    next.has(name) ? next.delete(name) : next.add(name);
    this.selectedSubfolders.set(next);
  }

  protected async create(confirmDuplicate: boolean): Promise<void> {
    this.error.set('');
    this.success.set('');
    if (!confirmDuplicate) {
      this.duplicateFolder.set('');
    }

    if (!this.basePath.trim()) {
      this.error.set('Selecciona una carpeta base.');
      return;
    }
    if (!this.client.trim() || !this.project.trim()) {
      this.error.set('Cliente y proyecto son obligatorios.');
      return;
    }
    const fileTypes: ('psd' | 'ai')[] = [];
    if (this.psd) {
      fileTypes.push('psd');
    }
    if (this.ai) {
      fileTypes.push('ai');
    }
    if (fileTypes.length === 0) {
      this.error.set('Selecciona al menos un tipo de archivo (PSD o AI).');
      return;
    }

    this.busy.set(true);
    try {
      const result = await this.ipc.createProject({
        client: this.client.trim(),
        project: this.project.trim(),
        basePath: this.basePath.trim(),
        fileTypes,
        platforms: [...this.selectedPlatforms()],
        subfolders: [...this.selectedSubfolders()],
        confirmDuplicate,
      });

      if (result.status === 'duplicate') {
        this.duplicateFolder.set(result.existingFolder ?? '');
        return;
      }

      this.success.set(result.folderName ?? '');
      this.duplicateFolder.set('');
      this.project = '';
      await this.load();
    } catch (e) {
      this.error.set(`No se pudo crear el proyecto: ${String(e)}`);
    } finally {
      this.busy.set(false);
    }
  }
}
