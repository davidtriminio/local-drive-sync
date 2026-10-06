import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IpcService } from '../services/ipc.service';
import { IconComponent } from '../shared/icon.component';
import { IconPickerComponent } from '../shared/icon-picker.component';
import { ColorPickerComponent } from '../shared/color-picker.component';
import { badgeStyle, chipStyle } from '../shared/colors';
import {
  DEFAULT_SUBFOLDERS,
  type BatchClientResult,
  type Client,
  type EventItem,
  type Mapping,
  type Platform,
  type PlatformFormatSelection,
} from '../../../shared/ipc-contract';

interface Appearance {
  icon: string;
  color: string;
}

/** Creador de proyectos gráficos: cliente + proyecto -> estructura + PSD base. */
@Component({
  selector: 'app-project-creator',
  standalone: true,
  imports: [
    FormsModule,
    IconComponent,
    IconPickerComponent,
    ColorPickerComponent,
  ],
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

      <!-- Evento (opcional): activa el modo lote para varios clientes -->
      @if (events().length > 0) {
        <div class="mb-6">
          <label class="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
            <app-icon name="calendar" [size]="16" /> Evento
            <span class="text-slate-500">(crea el arte para varios clientes)</span>
          </label>
          <select
            [ngModel]="selectedEventId()"
            (ngModelChange)="onEventChange($event)"
            class="field"
          >
            <option value="">Sin evento — proyecto individual</option>
            @for (e of events(); track e.id) {
              <option [value]="e.id">
                {{ e.name }}{{ e.variable ? '' : ' · ' + e.day + '/' + e.month }}
              </option>
            }
          </select>
        </div>
      }

      <!-- Acceso rápido: badges de cliente (solo modo individual) -->
      @if (!eventMode() && clients().length > 0) {
        <div class="mb-6">
          <div class="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <app-icon name="user" [size]="14" /> Clientes
          </div>
          <div class="flex flex-wrap gap-2">
            @for (c of clients(); track c.name) {
              <button
                (click)="selectClient(c)"
                class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-transform hover:scale-[1.03]"
                [style]="badge(eff(c).color, isActive(c.name))"
              >
                <app-icon [name]="eff(c).icon" [size]="14" />
                <span>{{ c.name.replaceAll('_', ' ') }}</span>
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
              (ngModelChange)="persistBasePath()"
              class="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3.5 py-2.5 font-mono text-xs text-slate-200 outline-none transition-colors focus:border-emerald-500/70"
              placeholder="V:\\graphic_design\\projects\\{mes}"
            />
            <button (click)="pickBase()" class="btn-ghost shrink-0">
              <app-icon name="folder" [size]="16" /> Elegir
            </button>
          </div>
          @if (basePath.includes('{mes}')) {
            <p class="mt-1.5 flex items-center gap-1.5 font-mono text-xs text-emerald-300/80">
              <app-icon name="check" [size]="13" /> {{ resolvedBasePath() }}
            </p>
          } @else {
            <p class="mt-1.5 text-xs text-slate-500">
              Usa el token
              <code class="text-emerald-300">&#123;mes&#125;</code>
              para que rote solo cada mes (ej. …\\{{ currentMonth }}).
            </p>
          }
        </div>

        <!-- Clientes del evento (modo lote) -->
        @if (eventMode()) {
          <div>
            <label class="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
              <app-icon name="user" [size]="16" /> Clientes del evento
              <span class="text-slate-500">
                ({{ batchClients().size }} seleccionados)
              </span>
            </label>
            @if (clients().length === 0) {
              <p class="text-xs text-slate-500">No hay clientes registrados.</p>
            } @else {
              <div class="flex flex-wrap gap-2">
                @for (c of clients(); track c.name) {
                  <button
                    type="button"
                    (click)="toggleBatchClient(c.name)"
                    class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-transform hover:scale-[1.03]"
                    [style]="badge(eff(c).color, batchClients().has(c.name))"
                  >
                    @if (batchClients().has(c.name)) {
                      <app-icon name="check" [size]="13" />
                    } @else {
                      <app-icon [name]="eff(c).icon" [size]="14" />
                    }
                    <span>{{ c.name.replaceAll('_', ' ') }}</span>
                  </button>
                }
              </div>
            }
          </div>
        }

        <!-- Cliente + proyecto -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          @if (!eventMode()) {
          <div>
            <label class="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
              <app-icon name="user" [size]="16" /> Cliente
            </label>
            <div class="flex gap-2">
              @if (mappingMatch()) {
                <div
                  class="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl"
                  [style]="chip(clientColor)"
                  title="Icono y color heredados del mapeo"
                >
                  <app-icon [name]="clientIcon" [size]="18" />
                </div>
              } @else {
                <button
                  type="button"
                  (click)="showIconPicker.set(!showIconPicker())"
                  title="Icono y color del cliente"
                  class="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl transition-transform hover:scale-105"
                  [style]="chip(clientColor)"
                >
                  <app-icon [name]="clientIcon" [size]="18" />
                </button>
              }
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
            @if (mappingMatch()) {
              <p class="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                <app-icon name="layers" [size]="13" /> Icono y color heredados del
                mapeo.
              </p>
            } @else if (showIconPicker()) {
              <div class="mt-2 space-y-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
                <app-icon-picker
                  [value]="clientIcon"
                  (valueChange)="chooseClientIcon($event)"
                />
                <div class="border-t border-white/5 pt-3">
                  <app-color-picker
                    [value]="clientColor"
                    (valueChange)="chooseClientColor($event)"
                  />
                </div>
              </div>
            }
          </div>
          }
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

        <!-- Mapeo del cliente: pregunta si es la misma empresa o crea uno nuevo -->
        @if (!eventMode() && client.trim() && !mappingMatch()) {
          @if (relatedMappings().length > 0 && sameCompany() === null) {
            <div
              class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100"
            >
              <p class="mb-3 flex items-start gap-2">
                <app-icon name="alert" [size]="18" />
                <span>
                  Ya existe el mapeo <b>{{ relatedNames() }}</b
                  >. ¿«{{ client.trim() }}» es la misma empresa?
                </span>
              </p>
              <div class="flex flex-wrap gap-2 pl-7">
                <button type="button" (click)="sameCompany.set(true)" class="btn-warn">
                  Sí, usar ese mapeo
                </button>
                <button type="button" (click)="sameCompany.set(false)" class="btn-ghost">
                  No, es otra empresa (crear mapeo aparte)
                </button>
              </div>
            </div>
          } @else if (sameCompany() === true) {
            <p class="flex items-center gap-1.5 text-xs text-slate-400">
              <app-icon name="layers" [size]="13" />
              Sus exports se moverán con el mapeo {{ relatedNames() }}.
              <button
                type="button"
                (click)="sameCompany.set(null)"
                class="text-emerald-300 hover:underline"
              >
                Cambiar
              </button>
            </p>
          } @else {
            <div class="space-y-3 rounded-xl border border-white/10 bg-slate-950/30 p-4">
              <label class="flex items-center gap-2 text-sm font-medium text-slate-300">
                <input type="checkbox" [(ngModel)]="createMapping" />
                Crear mapeo para «{{ client.trim() }}»
              </label>
              @if (createMapping) {
                <p class="text-xs text-slate-500">
                  Los exports que empiecen por
                  <code class="text-emerald-300">{{ clientKeyText() }}_</code>
                  se moverán a la carpeta local y se sincronizarán a Drive.
                </p>
                <input
                  [(ngModel)]="mapLocal"
                  class="field font-mono text-xs"
                  placeholder="Carpeta local: V:\\...\\{mes}\\cliente"
                />
                <div class="flex gap-2">
                  <input
                    [(ngModel)]="mapDrive"
                    class="field font-mono text-xs"
                    placeholder="Carpeta Drive: H:\\My Drive\\Cliente\\Artes\\{mes}"
                  />
                  <button type="button" (click)="pickDrive()" class="btn-ghost shrink-0">
                    <app-icon name="folder" [size]="16" /> Elegir
                  </button>
                </div>
              }
            </div>
          }
        }

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
            Formatos
            <span class="text-slate-500">(un PSD base por tamaño)</span>
          </label>
          @if (platforms().length === 0) {
            <p class="text-xs text-slate-500">No hay plataformas configuradas.</p>
          } @else {
            <div class="space-y-3">
              @for (p of platforms(); track p.name) {
                <div>
                  <div class="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {{ p.name }}
                  </div>
                  <div class="flex flex-wrap gap-2">
                    @for (f of formatEntries(p); track f.name) {
                      <button
                        type="button"
                        (click)="toggleFormat(p.name, f.name)"
                        [class]="toggleClass(selectedFormats().has(formatKey(p.name, f.name)))"
                      >
                        <app-icon
                          [name]="selectedFormats().has(formatKey(p.name, f.name)) ? 'check' : 'image'"
                          [size]="16"
                        />
                        <span>{{ f.name }}</span>
                        <span class="text-xs opacity-70">{{ f.size }}</span>
                      </button>
                    }
                  </div>
                </div>
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
            @if (successPath()) {
              <button
                (click)="openFolder(successPath())"
                title="Abrir carpeta del proyecto"
                class="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/25"
              >
                <app-icon name="folderOpen" [size]="15" /> Abrir carpeta
              </button>
            }
          </div>
        }

        <!-- Resultados del lote por cliente -->
        @if (batchResults().length > 0) {
          <div class="space-y-1.5 rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm">
            @for (r of batchResults(); track r.client) {
              <div class="flex items-center gap-2 capitalize">
                @switch (r.status) {
                  @case ('created') {
                    <app-icon name="check" [size]="15" class="text-emerald-400" />
                    <span class="text-emerald-200">
                      {{ r.client.replaceAll('_', ' ') }}
                    </span>
                    <code class="font-mono text-xs text-slate-500 normal-case">
                      {{ r.folderName }}
                    </code>
                    @if (r.projectPath) {
                      <button
                        (click)="openFolder(r.projectPath)"
                        title="Abrir carpeta del proyecto"
                        class="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-emerald-300/80 transition-colors hover:bg-emerald-500/15 hover:text-emerald-200"
                      >
                        <app-icon name="folderOpen" [size]="14" />
                      </button>
                    }
                  }
                  @case ('duplicate') {
                    <app-icon name="alert" [size]="15" class="text-amber-400" />
                    <span class="text-amber-200">
                      {{ r.client.replaceAll('_', ' ') }} — ya existe este mes
                    </span>
                  }
                  @default {
                    <app-icon name="x" [size]="15" class="text-rose-400" />
                    <span class="text-rose-200">
                      {{ r.client.replaceAll('_', ' ') }} — error
                    </span>
                  }
                }
              </div>
            }
            @if (batchHasDuplicates()) {
              <button (click)="createBatch(true)" class="btn-warn mt-2">
                Crear los duplicados de todos modos
              </button>
            }
          </div>
        }

        <div class="pt-1">
          @if (eventMode()) {
            <button
              (click)="createBatch(false)"
              [disabled]="busy() || batchClients().size === 0"
              class="btn-primary"
            >
              <app-icon name="sparkles" [size]="18" />
              {{
                busy()
                  ? 'Creando…'
                  : 'Crear para ' + batchClients().size + ' cliente(s)'
              }}
            </button>
          } @else {
            <button (click)="create(false)" [disabled]="busy()" class="btn-primary">
              <app-icon name="sparkles" [size]="18" />
              {{ busy() ? 'Creando…' : 'Crear proyecto' }}
            </button>
          }
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
  protected readonly selectedFormats = signal<Set<string>>(new Set());
  protected readonly selectedSubfolders = signal<Set<string>>(
    new Set(DEFAULT_SUBFOLDERS),
  );
  protected readonly error = signal('');
  protected readonly success = signal('');
  /** Ruta absoluta del último proyecto creado (para abrir su carpeta). */
  protected readonly successPath = signal('');
  protected readonly duplicateFolder = signal('');
  protected readonly busy = signal(false);
  protected readonly showIconPicker = signal(false);

  // Modo lote por evento.
  protected readonly events = signal<EventItem[]>([]);
  protected readonly selectedEventId = signal('');
  protected readonly batchClients = signal<Set<string>>(new Set());
  protected readonly batchResults = signal<BatchClientResult[]>([]);
  protected readonly eventMode = computed(() => this.selectedEventId() !== '');
  protected readonly batchHasDuplicates = computed(() =>
    this.batchResults().some((r) => r.status === 'duplicate'),
  );

  protected readonly badge = badgeStyle;
  protected readonly chip = chipStyle;
  /** Mes actual en formato "Septiembre-2026". */
  protected readonly currentMonth = this.monthLabel();

  // Mapeo automático del cliente.
  private allMappings: Mapping[] = [];
  protected readonly sameCompany = signal<boolean | null>(null);
  protected createMapping = true;
  protected mapLocal = '';
  protected mapDrive = '';
  private lastMappingKey = '';

  protected basePath = '';
  protected client = '';
  protected clientIcon = 'store';
  protected clientColor = '#34d399';
  protected project = '';
  protected psd = true;
  protected ai = false;

  constructor() {
    void this.load();
  }

  /** Apariencia (icono+color) heredada de un mapeo, por nombre saneado. */
  private mappingStyles = new Map<string, Appearance>();

  private async load(): Promise<void> {
    const [clients, platforms, prefs, mappings, events] = await Promise.all([
      this.ipc.listClients(),
      this.ipc.listPlatforms(),
      this.ipc.getCreatorPrefs(),
      this.ipc.listMappings(),
      this.ipc.listEvents(),
    ]);
    this.clients.set(clients);
    this.platforms.set(platforms);
    this.events.set(events);

    // Los mapeos son la fuente: su icono+color se heredan al cliente/proyecto
    // que tenga el mismo nombre.
    this.allMappings = mappings;
    this.mappingStyles = new Map(
      mappings.map((m: Mapping) => [
        m.name.trim().toLowerCase().replace(/\s+/g, '_'),
        { icon: m.icon || 'store', color: m.color || '#34d399' },
      ]),
    );

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
    this.selectedFormats.set(this.initialFormatSelection(platforms, prefs.formats));
    this.selectedSubfolders.set(
      new Set(
        prefs.subfolders.length > 0 ? prefs.subfolders : DEFAULT_SUBFOLDERS,
      ),
    );
    if (prefs.lastClient) {
      this.client = prefs.lastClient;
      this.syncClientStyle();
    }
  }

  /** Nombre saneado del cliente escrito, para buscarlo en la lista. */
  private clientKey(): string {
    return this.client.trim().toLowerCase().replace(/\s+/g, '_');
  }

  protected isActive(name: string): boolean {
    return this.clientKey() === name;
  }

  /** Apariencia efectiva de un cliente: hereda del mapeo si existe. */
  protected eff(c: Client): Appearance {
    return (
      this.mappingStyles.get(c.name) ?? {
        icon: c.icon || 'user',
        color: c.color || '#34d399',
      }
    );
  }

  /** Apariencia heredada del mapeo para el cliente escrito, o null. */
  protected mappingMatch(): Appearance | null {
    return this.mappingStyles.get(this.clientKey()) ?? null;
  }

  protected selectClient(c: Client): void {
    this.client = c.name;
    const a = this.eff(c);
    this.clientIcon = a.icon;
    this.clientColor = a.color;
    this.showIconPicker.set(false);
    this.sameCompany.set(null);
    this.lastMappingKey = c.name;
  }

  /** Al teclear, sincroniza icono y color (mapeo primero, luego cliente). */
  protected onClientTyped(): void {
    this.syncClientStyle();
    const key = this.clientKey();
    if (key !== this.lastMappingKey) {
      this.lastMappingKey = key;
      this.sameCompany.set(null);
      this.mapLocal = this.guessLocal(key);
    }
  }

  /** Clave comparable: sin tildes, minúsculas y separadores como `_`. */
  private static mapKey(name: string): string {
    return name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '_')
      .replace(/^_+|_+$/g, '');
  }

  protected clientKeyText(): string {
    return ProjectCreatorComponent.mapKey(this.client);
  }

  /** Mapeos cuyo nombre es prefijo (por palabras) del cliente, o al revés. */
  protected relatedMappings(): Mapping[] {
    const key = this.clientKeyText();
    if (!key) {
      return [];
    }
    return this.allMappings.filter((m) => {
      const mk = ProjectCreatorComponent.mapKey(m.name);
      return mk !== key && mk && (key.startsWith(`${mk}_`) || mk.startsWith(`${key}_`));
    });
  }

  protected relatedNames(): string {
    return this.relatedMappings()
      .map((m) => m.name)
      .join(', ');
  }

  /** Propone la carpeta local copiando la de otro mapeo y cambiando el último tramo. */
  private guessLocal(key: string): string {
    const ref = this.allMappings[0]?.localPattern;
    if (!ref || !key) {
      return '';
    }
    const idx = Math.max(ref.lastIndexOf('\\'), ref.lastIndexOf('/'));
    return idx > 0 ? `${ref.slice(0, idx + 1)}${key}` : '';
  }

  protected async pickDrive(): Promise<void> {
    const chosen = await this.ipc.pickFolder();
    if (chosen) {
      this.mapDrive = chosen.replace(/[\\/]$/, '') + '\\{mes}';
    }
  }

  /** ¿Hay que crear un mapeo nuevo para el cliente escrito? */
  private wantsNewMapping(): boolean {
    return (
      !!this.client.trim() &&
      !this.mappingMatch() &&
      this.sameCompany() !== true &&
      this.createMapping
    );
  }

  private syncClientStyle(): void {
    const key = this.clientKey();
    const fromMapping = this.mappingStyles.get(key);
    if (fromMapping) {
      this.clientIcon = fromMapping.icon;
      this.clientColor = fromMapping.color;
      return;
    }
    const found = this.clients().find((c) => c.name === key);
    if (found) {
      this.clientIcon = found.icon || 'store';
      this.clientColor = found.color || '#34d399';
    }
  }

  /** Elige un icono; si el cliente ya existe, lo persiste al momento. */
  protected async chooseClientIcon(icon: string): Promise<void> {
    this.clientIcon = icon;
    const key = this.clientKey();
    if (key && this.clients().some((c) => c.name === key)) {
      this.clients.set(await this.ipc.setClientIcon(key, icon));
    }
  }

  /** Elige un color; si el cliente ya existe, lo persiste al momento. */
  protected async chooseClientColor(color: string): Promise<void> {
    this.clientColor = color;
    const key = this.clientKey();
    if (key && this.clients().some((c) => c.name === key)) {
      this.clients.set(await this.ipc.setClientColor(key, color));
    }
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
      this.persistBasePath();
    }
  }

  /** Guarda la carpeta base al instante (persistencia inmediata). */
  protected persistBasePath(): void {
    void this.ipc.setCreatorBasePath(this.basePath.trim());
  }

  /** Nombre del mes actual, ej. "Septiembre-2026". */
  private monthLabel(): string {
    const meses = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    const now = new Date();
    return `${meses[now.getMonth()]}-${now.getFullYear()}`;
  }

  /** Vista previa de la carpeta base con {mes} ya resuelto. */
  protected resolvedBasePath(): string {
    return this.basePath.replace(/\{mes\}/gi, this.currentMonth);
  }

  protected togglePlatform(name: string): void {
    const next = new Set(this.selectedPlatforms());
    next.has(name) ? next.delete(name) : next.add(name);
    this.selectedPlatforms.set(next);
  }

  protected formatEntries(platform: Platform): { name: string; size: string }[] {
    const entries = Object.entries(platform.formats ?? {});
    return entries.length > 0
      ? entries.map(([name, size]) => ({ name, size }))
      : [{ name: platform.name, size: '' }];
  }

  protected formatKey(platform: string, format: string): string {
    return `${platform}::${format}`;
  }

  protected toggleFormat(platform: string, format: string): void {
    const key = this.formatKey(platform, format);
    const next = new Set(this.selectedFormats());
    next.has(key) ? next.delete(key) : next.add(key);
    this.selectedFormats.set(next);
    this.selectedPlatforms.set(new Set(this.selectedFormatSelections().map((f) => f.platform)));
  }

  protected toggleSubfolder(name: string): void {
    const next = new Set(this.selectedSubfolders());
    next.has(name) ? next.delete(name) : next.add(name);
    this.selectedSubfolders.set(next);
  }

  /** Al elegir un evento: preselecciona sus clientes y el nombre del arte. */
  protected onEventChange(id: string): void {
    this.selectedEventId.set(id);
    this.batchResults.set([]);
    this.error.set('');
    this.success.set('');
    this.duplicateFolder.set('');
    if (!id) {
      return;
    }
    const event = this.events().find((e) => e.id === id);
    if (!event) {
      return;
    }
    if (!this.project.trim()) {
      this.project = event.name;
    }
    // Solo clientes que existen en el registro actual.
    const known = new Set(this.clients().map((c) => c.name));
    this.batchClients.set(new Set(event.clients.filter((c) => known.has(c))));
  }

  /**
   * Fecha (AAAA-MM-DD) que usará el lote para nombrar carpetas: la fecha propia
   * del evento personalizado; si no tiene (feriado recurrente), el día/mes de
   * este año; si es de fecha variable, se deja vacío (el main usa hoy).
   */
  private effectiveEventDate(): string | undefined {
    const event = this.events().find((e) => e.id === this.selectedEventId());
    if (!event) {
      return undefined;
    }
    if (event.date && /^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
      return event.date;
    }
    if (!event.variable) {
      const y = new Date().getFullYear();
      const mm = String(event.month).padStart(2, '0');
      const dd = String(event.day).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
    return undefined;
  }

  protected toggleBatchClient(name: string): void {
    const next = new Set(this.batchClients());
    next.has(name) ? next.delete(name) : next.add(name);
    this.batchClients.set(next);
  }

  /** Crea el mismo proyecto (arte) para todos los clientes seleccionados. */
  protected async createBatch(confirmDuplicate: boolean): Promise<void> {
    this.error.set('');
    if (!this.basePath.trim()) {
      this.error.set('Selecciona una carpeta base.');
      return;
    }
    if (!this.project.trim()) {
      this.error.set('El nombre del arte/proyecto es obligatorio.');
      return;
    }
    if (this.batchClients().size === 0) {
      this.error.set('Selecciona al menos un cliente.');
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
    const formats = this.selectedFormatSelections();
    if (this.psd && formats.length === 0) {
      this.error.set('Selecciona al menos un formato PSD.');
      return;
    }

    this.busy.set(true);
    try {
      const { results } = await this.ipc.createProjectBatch({
        clients: [...this.batchClients()],
        project: this.project.trim(),
        basePath: this.basePath.trim(),
        fileTypes,
        platforms: this.selectedPlatformNames(formats),
        formats,
        subfolders: [...this.selectedSubfolders()],
        eventId: this.selectedEventId(),
        date: this.effectiveEventDate(),
        confirmDuplicate,
      });
      this.batchResults.set(results);
      // Refresca clientes/eventos para reflejar los proyectos registrados.
      const [clients, events] = await Promise.all([
        this.ipc.listClients(),
        this.ipc.listEvents(),
      ]);
      this.clients.set(clients);
      this.events.set(events);
    } catch (e) {
      this.error.set(`No se pudo crear el lote: ${String(e)}`);
    } finally {
      this.busy.set(false);
    }
  }

  /** Abre en el explorador la carpeta de un proyecto recién creado. */
  protected openFolder(fullPath: string | undefined): void {
    if (fullPath) {
      void this.ipc.openPath(fullPath);
    }
  }

  protected async create(confirmDuplicate: boolean): Promise<void> {
    this.error.set('');
    this.success.set('');
    this.successPath.set('');
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
    const formats = this.selectedFormatSelections();
    if (this.psd && formats.length === 0) {
      this.error.set('Selecciona al menos un formato PSD.');
      return;
    }

    if (this.relatedMappings().length > 0 && !this.mappingMatch() && this.sameCompany() === null) {
      this.error.set('Indica si el cliente es la misma empresa que el mapeo existente.');
      return;
    }
    const newMapping = this.wantsNewMapping();
    if (newMapping && (!this.mapLocal.trim() || !this.mapDrive.trim())) {
      this.error.set(
        'Completa la carpeta local y la de Drive del mapeo, o desmarca «Crear mapeo».',
      );
      return;
    }

    this.busy.set(true);
    try {
      const result = await this.ipc.createProject({
        client: this.client.trim(),
        project: this.project.trim(),
        basePath: this.basePath.trim(),
        fileTypes,
        platforms: this.selectedPlatformNames(formats),
        formats,
        subfolders: [...this.selectedSubfolders()],
        clientIcon: this.clientIcon,
        clientColor: this.clientColor,
        confirmDuplicate,
      });

      if (result.status === 'duplicate') {
        this.duplicateFolder.set(result.existingFolder ?? '');
        return;
      }

      if (newMapping) {
        await this.ipc.saveMapping({
          name: this.client.trim(),
          icon: this.clientIcon,
          color: this.clientColor,
          localPattern: this.mapLocal.trim(),
          drivePattern: this.mapDrive.trim(),
          monthFormat: 'Mes-Año',
          createMissing: true,
          exclusions: [],
        });
      }
      this.success.set(result.folderName ?? '');
      this.successPath.set(result.projectPath ?? '');
      this.duplicateFolder.set('');
      this.project = '';
      await this.load();
    } catch (e) {
      this.error.set(`No se pudo crear el proyecto: ${String(e)}`);
    } finally {
      this.busy.set(false);
    }
  }

  private initialFormatSelection(platforms: Platform[], saved: string[]): Set<string> {
    if (saved.length > 0) {
      return new Set(saved);
    }
    const selected = new Set<string>();
    for (const platform of platforms) {
      const first = this.formatEntries(platform)[0];
      if (first) {
        selected.add(this.formatKey(platform.name, first.name));
      }
    }
    return selected;
  }

  private selectedFormatSelections(): PlatformFormatSelection[] {
    return [...this.selectedFormats()].map((key) => {
      const [platform, format] = key.split('::');
      const found = this.platforms().find((p) => p.name === platform);
      return {
        platform,
        format,
        size: found?.formats?.[format] ?? '',
      };
    });
  }

  private selectedPlatformNames(
    formats: PlatformFormatSelection[],
  ): string[] {
    return [...new Set(formats.map((f) => f.platform))];
  }
}
