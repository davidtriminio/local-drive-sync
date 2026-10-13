import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  AppSettings,
  Client,
  CreatorPrefs,
  EventItem,
  Mapping,
  RunDetail,
  RunSummary,
  TrashEntry,
} from '../../shared/ipc-contract';
import type { IndexEntry } from '../domain/comparator';
import { detectMonthFormat, toMonthTemplate } from '../domain/project-creator';

interface Database {
  mappings: Mapping[];
  settings: AppSettings;
  runs: RunDetail[];
  trash: TrashEntry[];
  /** Clientes del creador de proyectos, indexados por nombre saneado. */
  clients: Client[];
  /** Eventos personalizados y overrides de los integrados (por id). */
  events: EventItem[];
  /** Última configuración usada en el creador. */
  creatorPrefs: CreatorPrefs;
  /** Firma del conjunto pendiente ya leído, por mappingId. */
  notifAcks: Record<string, string>;
  /** index["<mappingId>::<monthKey>"]["<relPath>"] = IndexEntry */
  index: Record<string, Record<string, IndexEntry>>;
  /** Último mes (AAAA-MM) que la app vio; detecta el cambio de mes. */
  lastMonthSeen: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultExclusions: ['Thumbs.db', 'desktop.ini', '.DS_Store', '*.tmp', '*.bak'],
  preferredMonthFormat: 'Mes-Año',
  copyConcurrency: 3,
  minimizeToTray: true,
  exportWatchEnabled: false,
  exportWatchFolder: '',
};

const DEFAULT_CREATOR_PREFS: CreatorPrefs = {
  basePath: '',
  fileTypes: ['psd'],
  platforms: [],
  formats: [],
  subfolders: [],
  lastClient: '',
};

function emptyDb(): Database {
  return {
    mappings: [],
    settings: { ...DEFAULT_SETTINGS },
    runs: [],
    trash: [],
    clients: [],
    events: [],
    creatorPrefs: { ...DEFAULT_CREATOR_PREFS },
    notifAcks: {},
    index: {},
    lastMonthSeen: '',
  };
}

/**
 * Repositorio de datos basado en un único fichero JSON en userData.
 *
 * Implementa toda la superficie de persistencia de la app. En la fase de
 * endurecimiento se puede sustituir por SQLite (better-sqlite3) manteniendo
 * esta misma API pública, sin tocar el resto del dominio.
 */
export class Repository {
  private readonly file: string;
  private db: Database;

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'local-drive-sync.json');
    this.db = this.load();
    this.migrateMonthPatterns();
  }

  private load(): Database {
    try {
      const raw = fs.readFileSync(this.file, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<Database>;
      return {
        ...emptyDb(),
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        creatorPrefs: { ...DEFAULT_CREATOR_PREFS, ...parsed.creatorPrefs },
      };
    } catch {
      return emptyDb();
    }
  }

  /**
   * Los mapeos guardados con el mes escrito a mano (p. ej. "...\Septiembre-2026")
   * nunca rotan: se convierten a `{mes}` conservando el estilo del nombre.
   */
  private migrateMonthPatterns(): void {
    let changed = false;
    this.db.mappings = this.db.mappings.map((m) => {
      const localPattern = toMonthTemplate(m.localPattern);
      const drivePattern = toMonthTemplate(m.drivePattern);
      if (localPattern === m.localPattern && drivePattern === m.drivePattern) {
        return m;
      }
      changed = true;
      const monthFormat =
        detectMonthFormat(m.drivePattern) ??
        detectMonthFormat(m.localPattern) ??
        m.monthFormat;
      return { ...m, localPattern, drivePattern, monthFormat };
    });
    if (changed) {
      this.persist();
    }
  }

  getLastMonthSeen(): string {
    return this.db.lastMonthSeen;
  }

  setLastMonthSeen(monthKey: string): void {
    if (this.db.lastMonthSeen !== monthKey) {
      this.db.lastMonthSeen = monthKey;
      this.persist();
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2), 'utf-8');
    fs.renameSync(tmp, this.file);
  }

  // --- Mappings ---
  listMappings(): Mapping[] {
    return [...this.db.mappings].sort((a, b) => a.name.localeCompare(b.name));
  }

  getMapping(id: string): Mapping | undefined {
    return this.db.mappings.find((m) => m.id === id);
  }

  upsertMapping(mapping: Mapping): Mapping {
    const idx = this.db.mappings.findIndex((m) => m.id === mapping.id);
    if (idx >= 0) {
      this.db.mappings[idx] = mapping;
    } else {
      this.db.mappings.push(mapping);
    }
    this.persist();
    return mapping;
  }

  /**
   * Elimina un mapeo y todo lo que dependía de él, evitando registros
   * huérfanos: su historial de ejecuciones, las entradas de papelera de esas
   * ejecuciones, su índice incremental (todos los meses) y su firma de
   * notificación. No toca carpetas del disco.
   */
  deleteMapping(id: string): void {
    this.db.mappings = this.db.mappings.filter((m) => m.id !== id);
    const runIds = new Set(
      this.db.runs.filter((r) => r.mappingId === id).map((r) => r.id),
    );
    this.db.runs = this.db.runs.filter((r) => r.mappingId !== id);
    this.db.trash = this.db.trash.filter((t) => !runIds.has(t.runId));
    for (const key of Object.keys(this.db.index)) {
      if (key.startsWith(`${id}::`)) {
        delete this.db.index[key];
      }
    }
    delete this.db.notifAcks[id];
    this.persist();
  }

  // --- Settings ---
  getSettings(): AppSettings {
    return { ...this.db.settings };
  }

  setSettings(settings: AppSettings): AppSettings {
    this.db.settings = { ...settings };
    this.persist();
    return this.getSettings();
  }

  // --- Index incremental ---
  getIndex(mappingId: string, monthKey: string): Record<string, IndexEntry> {
    return this.db.index[`${mappingId}::${monthKey}`] ?? {};
  }

  setIndexEntries(
    mappingId: string,
    monthKey: string,
    entries: Record<string, IndexEntry>,
  ): void {
    const key = `${mappingId}::${monthKey}`;
    this.db.index[key] = { ...this.getIndex(mappingId, monthKey), ...entries };
    this.persist();
  }

  // --- Runs / historial ---
  createRun(run: RunDetail): void {
    this.db.runs.unshift(run);
    this.persist();
  }

  updateRun(run: RunDetail): void {
    const idx = this.db.runs.findIndex((r) => r.id === run.id);
    if (idx >= 0) {
      this.db.runs[idx] = run;
      this.persist();
    }
  }

  listRuns(): RunSummary[] {
    return this.db.runs.map(({ items, ...summary }) => summary);
  }

  getRun(id: string): RunDetail | null {
    return this.db.runs.find((r) => r.id === id) ?? null;
  }

  // --- Clientes (creador de proyectos) ---
  listClients(): Client[] {
    return [...this.db.clients].sort((a, b) => a.name.localeCompare(b.name));
  }

  getClient(name: string): Client | undefined {
    return this.db.clients.find((c) => c.name === name);
  }

  /** Crea el cliente sin proyectos si no existe; devuelve true si lo creó. */
  ensureClient(name: string, icon?: string, color?: string): boolean {
    if (this.db.clients.some((c) => c.name === name)) {
      return false;
    }
    this.db.clients.push({
      name,
      icon: icon || 'user',
      color: color || '#34d399',
      projects: [],
    });
    this.persist();
    return true;
  }

  /** Registra un proyecto para un cliente, creando el cliente si no existe. */
  recordProject(
    clientName: string,
    projectName: string,
    folder: string,
    icon?: string,
    color?: string,
  ): void {
    let client = this.db.clients.find((c) => c.name === clientName);
    if (!client) {
      client = {
        name: clientName,
        icon: icon || 'user',
        color: color || '#34d399',
        projects: [],
      };
      this.db.clients.push(client);
    } else {
      if (icon) {
        client.icon = icon;
      }
      if (color) {
        client.color = color;
      }
    }
    let project = client.projects.find((p) => p.name === projectName);
    if (!project) {
      project = { name: projectName, folders: [] };
      client.projects.push(project);
    }
    project.folders.push(folder);
    this.persist();
  }

  /**
   * Fusiona clientes (p. ej. importados) con los existentes, por nombre.
   * No duplica proyectos ni carpetas ya registradas.
   */
  mergeClients(incoming: Client[]): void {
    for (const inc of incoming) {
      const existing = this.db.clients.find((c) => c.name === inc.name);
      if (!existing) {
        this.db.clients.push({
          name: inc.name,
          icon: inc.icon || 'user',
          color: inc.color || '#34d399',
          projects: inc.projects.map((p) => ({
            name: p.name,
            folders: [...p.folders],
          })),
        });
        continue;
      }
      for (const p of inc.projects) {
        const ep = existing.projects.find((x) => x.name === p.name);
        if (!ep) {
          existing.projects.push({ name: p.name, folders: [...p.folders] });
        } else {
          for (const f of p.folders) {
            if (!ep.folders.includes(f)) {
              ep.folders.push(f);
            }
          }
        }
      }
    }
    this.persist();
  }

  /** Asigna un icono a un cliente existente. */
  setClientIcon(name: string, icon: string): void {
    const client = this.db.clients.find((c) => c.name === name);
    if (client) {
      client.icon = icon;
      this.persist();
    }
  }

  /** Asigna un color a un cliente existente. */
  setClientColor(name: string, color: string): void {
    const client = this.db.clients.find((c) => c.name === name);
    if (client) {
      client.color = color;
      this.persist();
    }
  }

  /** Elimina un proyecto del historial de un cliente (solo registro). */
  deleteClientProject(clientName: string, projectName: string): void {
    const client = this.db.clients.find((c) => c.name === clientName);
    if (!client) {
      return;
    }
    client.projects = client.projects.filter((p) => p.name !== projectName);
    this.persist();
  }

  /**
   * Elimina un cliente y lo desvincula de lo relacionado: lo quita de los
   * eventos que lo referencian y limpia `lastClient`. La cascada a mapeos (si
   * el usuario la pide) se hace aparte con `deleteMapping`. No toca disco.
   */
  deleteClient(clientName: string): void {
    this.db.clients = this.db.clients.filter((c) => c.name !== clientName);
    for (const e of this.db.events) {
      if (e.clients.includes(clientName)) {
        e.clients = e.clients.filter((c) => c !== clientName);
      }
    }
    if (this.db.creatorPrefs.lastClient === clientName) {
      this.db.creatorPrefs.lastClient = '';
    }
    this.persist();
  }

  // --- Eventos y feriados ---
  /** Eventos guardados en crudo (personalizados + overrides de integrados). */
  listStoredEvents(): EventItem[] {
    return [...this.db.events];
  }

  /** Crea o reemplaza un evento por id. */
  upsertEvent(event: EventItem): void {
    const idx = this.db.events.findIndex((e) => e.id === event.id);
    if (idx >= 0) {
      this.db.events[idx] = event;
    } else {
      this.db.events.push(event);
    }
    this.persist();
  }

  /** Elimina un evento por id (personalizado o el override de uno integrado). */
  deleteEvent(id: string): void {
    this.db.events = this.db.events.filter((e) => e.id !== id);
    this.persist();
  }

  // --- Firmas de notificaciones leídas ---
  /** Firma del último conjunto pendiente marcado como leído para un mapeo. */
  getNotifAck(mappingId: string): string | undefined {
    return this.db.notifAcks[mappingId];
  }

  /** Guarda la firma leída de un mapeo. */
  setNotifAck(mappingId: string, signature: string): void {
    this.db.notifAcks[mappingId] = signature;
    this.persist();
  }

  // --- Preferencias del creador ---
  getCreatorPrefs(): CreatorPrefs {
    return { ...this.db.creatorPrefs };
  }

  setCreatorPrefs(prefs: CreatorPrefs): CreatorPrefs {
    this.db.creatorPrefs = { ...prefs };
    this.persist();
    return this.getCreatorPrefs();
  }

  /** Guarda solo la carpeta base (persistencia inmediata al editarla). */
  setCreatorBasePath(basePath: string): void {
    this.db.creatorPrefs.basePath = basePath;
    this.persist();
  }

  // --- Papelera ---
  addTrashEntry(entry: TrashEntry): void {
    this.db.trash.unshift(entry);
    this.persist();
  }

  getTrashEntry(id: string): TrashEntry | undefined {
    return this.db.trash.find((t) => t.id === id);
  }

  listTrash(): TrashEntry[] {
    return [...this.db.trash];
  }
}
