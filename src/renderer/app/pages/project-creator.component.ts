import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IpcService } from '../services/ipc.service';
import { IconComponent } from '../shared/icon.component';
import { IconPickerComponent } from '../shared/icon-picker.component';
import {
  DEFAULT_SUBFOLDERS,
  type Client,
  type Platform,
} from '../../../shared/ipc-contract';

/** Creador de proyectos gráficos: cliente + proyecto -> estructura + PSD base. */
@Component({
  selector: 'app-project-creator',
  standalone: true,
  imports: [FormsModule, IconComponent, IconPickerComponent],
  template: `
    <section class="mx-auto max-w-3xl p-8">
      <header class="mb-8 flex items-center gap-3">
        <div
          class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400 to-purple-600 text-white shadow-lg shadow-purple-500/20"
        >
          <app-icon name="palette" [size]="24" />
        </div>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Nuevo proyecto</h1>
          <p class="text-sm text-slate-400">
            Estructura de carpetas y PSD base para un cliente.
          </p>
        </div>
      </header>

      <!-- Acceso rápido: badges de cliente -->
      @if (clients().length > 0) {
        <div class="mb-6">
          <div class="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <app-icon name="user" [size]="14" /> Clientes
          </div>
          <div class="flex flex-wrap gap-2">
            @for (c of clients(); track c.name) {
              <button
                (click)="selectClient(c)"
                [class]="badgeClass(c.name)"
              >
                <app-icon [name]="c.icon || 'user'" [size]="14" />
                <span class="capitalize">{{ c.name.replaceAll('_', ' ') }}</span>
                <span class="rounded-full bg-black/20 px-1.5 text-[10px] leading-4">
                  {{ c.projects.length }}
                </span>
              </button>
            }
          </div>
        </div>
      }

      <div
        class="space-y-6 rounded-2xl border border-white/5 bg-slate-900/40 p-6 shadow-xl shadow-black/20"
      >
        <!-- Carpeta base -->
        <div>
          <label class="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
            <app-icon name="folderOpen" [size]="16" /> Carpeta base
          </label>
          <div class="flex gap-2">
            <input
              [(ngModel)]="basePath"
              class="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3.5 py-2.5 font-mono text-xs text-slate-200 outline-none transition-colors focus:border-emerald-500/70"
              placeholder="V:\\graphic_design\\projects"
            />
            <button (click)="pickBase()" class="btn-ghost shrink-0">
              <app-icon name="folder" [size]="16" /> Elegir
            </button>
          </div>
        </div>

        <!-- Cliente + proyecto -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
              <app-icon name="user" [size]="16" /> Cliente
            </label>
            <div class="flex gap-2">
              <button
                type="button"
                (click)="showIconPicker.set(!showIconPicker())"
                title="Icono del cliente"
                class="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-white/5 text-emerald-300 transition-colors hover:bg-white/10"
              >
                <app-icon [name]="clientIcon" [size]="18" />
              </button>
              <input
                [(ngModel)]="client"
                (ngModelChange)="onClientTyped()"
                list="clients-list"
                class="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3.5 py-2.5 text-sm text-slate-200 outline-none transition-colors focus:border-emerald-500/70"
                placeholder="cliente"
              />
            </div>
            <datalist id="clients-list">
              @for (c of clients(); track c.name) {
                <option [value]="c.name"></option>
              }
            </datalist>
            @if (showIconPicker()) {
              <div class="mt-2 rounded-xl border border-white/10 bg-slate-950/50 p-2.5">
                <app-icon-picker
                  [value]="clientIcon"
                  (valueChange)="chooseClientIcon($event)"
                />
              </div>
            }
          </div>
          <div>
            <label class="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
              <app-icon name="folder" [size]="16" /> Proyecto
            </label>
            <input
              [(ngModel)]="project"
              class="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3.5 py-2.5 text-sm text-slate-200 outline-none transition-colors focus:border-emerald-500/70"
              placeholder="nombre_proyecto"
            />
          </div>
        </div>

        <!-- Tipos de archivo -->
        <div>
          <label class="mb-2 block text-sm font-medium text-slate-300">
            Tipos de archivo
          </label>
          <div class="flex gap-2">
            <button (click)="psd = !psd" [class]="toggleClass(psd)">
              <app-icon name="image" [size]="16" /> PSD
            </button>
            <button (click)="ai = !ai" [class]="toggleClass(ai)">
              <app-icon name="file" [size]="16" /> AI
            </button>
          </div>
        </div>

        <!-- Plataformas -->
        <div>
          <label class="mb-2 block text-sm font-medium text-slate-300">
            Plataformas
            <span class="text-slate-500">(un PSD base por plataforma)</span>
          </label>
          @if (platforms().length === 0) {
            <p class="text-xs text-slate-500">No hay plataformas configuradas.</p>
          } @else {
            <div class="flex flex-wrap gap-2">
              @for (p of platforms(); track p.name) {
                <button
                  (click)="togglePlatform(p.name)"
                  [class]="toggleClass(selectedPlatforms().has(p.name))"
                >
                  <app-icon
                    [name]="selectedPlatforms().has(p.name) ? 'check' : 'image'"
                    [size]="16"
                  />
                  {{ p.name }}
                </button>
              }
            </div>
          }
        </div>

        <!-- Subcarpetas -->
        <details class="group rounded-xl border border-white/5 bg-slate-950/30 p-4">
          <summary
            class="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-300"
          >
            <span>Subcarpetas</span>
            <span class="flex items-center gap-2 text-xs text-slate-500">
              {{ selectedSubfolders().size }}/{{ subfolders.length }}
              <app-icon name="chevronRight" [size]="16" />
            </span>
          </summary>
          <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            @for (s of subfolders; track s) {
              <button
                (click)="toggleSubfolder(s)"
                class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left font-mono text-xs transition-colors"
                [class]="selectedSubfolders().has(s) ? 'text-emerald-300' : 'text-slate-500'"
              >
                <app-icon
                  [name]="selectedSubfolders().has(s) ? 'check' : 'plus'"
                  [size]="14"
                />
                {{ s }}
              </button>
            }
          </div>
        </details>

        @if (error()) {
          <div
            class="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
          >
            <app-icon name="alert" [size]="18" /> {{ error() }}
          </div>
        }

        @if (duplicateFolder()) {
          <div
            class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200"
          >
            <p class="mb-3 flex items-start gap-2">
              <app-icon name="alert" [size]="18" />
              <span>
                Ya existe un proyecto de este cliente este mes:
                <code class="font-mono">{{ duplicateFolder() }}</code>.
              </span>
            </p>
            <div class="flex gap-2 pl-7">
              <button (click)="create(true)" class="btn-warn">
                Crear de todos modos
              </button>
              <button (click)="duplicateFolder.set('')" class="btn-ghost">
                Cancelar
              </button>
            </div>
          </div>
        }

        @if (success()) {
          <div
            class="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          >
            <app-icon name="check" [size]="18" /> Proyecto creado:
            <code class="font-mono">{{ success() }}</code>
          </div>
        }

        <div class="pt-1">
          <button (click)="create(false)" [disabled]="busy()" class="btn-primary">
            <app-icon name="sparkles" [size]="18" />
            {{ busy() ? 'Creando…' : 'Crear proyecto' }}
          </button>
        </div>
      </div>
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
      .btn-primary:disabled {
        opacity: 0.5;
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
      .btn-warn {
        border-radius: 0.75rem;
        padding: 0.5rem 0.875rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: rgb(2 6 23);
        background: rgb(251 191 36);
      }
      .btn-warn:hover {
        background: rgb(252 211 77);
      }
    `,
  ],
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
  protected readonly showIconPicker = signal(false);

  protected basePath = '';
  protected client = '';
  protected clientIcon = 'store';
  protected project = '';
  protected psd = true;
  protected ai = false;

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const [clients, platforms, prefs] = await Promise.all([
      this.ipc.listClients(),
      this.ipc.listPlatforms(),
      this.ipc.getCreatorPrefs(),
    ]);
    this.clients.set(clients);
    this.platforms.set(platforms);

    // Restaura la última configuración usada; si falta, valores por defecto.
    this.basePath = prefs.basePath;
    if (prefs.fileTypes.length > 0) {
      this.psd = prefs.fileTypes.includes('psd');
      this.ai = prefs.fileTypes.includes('ai');
    }
    this.selectedPlatforms.set(
      new Set(
        prefs.platforms.length > 0
          ? prefs.platforms
          : platforms.map((p) => p.name),
      ),
    );
    this.selectedSubfolders.set(
      new Set(
        prefs.subfolders.length > 0 ? prefs.subfolders : DEFAULT_SUBFOLDERS,
      ),
    );
    if (prefs.lastClient) {
      this.client = prefs.lastClient;
      this.syncClientIcon();
    }
  }

  protected selectClient(c: Client): void {
    this.client = c.name;
    this.clientIcon = c.icon || 'store';
    this.showIconPicker.set(false);
  }

  /** Al teclear, sincroniza el icono si el nombre coincide con un cliente. */
  protected onClientTyped(): void {
    this.syncClientIcon();
  }

  private syncClientIcon(): void {
    const key = this.client.trim().toLowerCase().replace(/\s+/g, '_');
    const found = this.clients().find((c) => c.name === key);
    if (found) {
      this.clientIcon = found.icon || 'store';
    }
  }

  /** Elige un icono; si el cliente ya existe, lo persiste al momento. */
  protected async chooseClientIcon(icon: string): Promise<void> {
    this.clientIcon = icon;
    this.showIconPicker.set(false);
    const key = this.client.trim().toLowerCase().replace(/\s+/g, '_');
    if (key && this.clients().some((c) => c.name === key)) {
      this.clients.set(await this.ipc.setClientIcon(key, icon));
    }
  }

  protected badgeClass(name: string): string {
    const base =
      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors';
    return this.client.trim().toLowerCase() === name
      ? `${base} bg-emerald-500 text-slate-950`
      : `${base} bg-white/5 text-slate-300 hover:bg-white/10`;
  }

  protected toggleClass(active: boolean): string {
    const base =
      'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors';
    return active
      ? `${base} bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40`
      : `${base} bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200`;
  }

  protected async pickBase(): Promise<void> {
    const chosen = await this.ipc.pickFolder();
    if (chosen) {
      this.basePath = chosen;
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
        clientIcon: this.clientIcon,
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
