import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  AppSettings,
  Client,
  CreatorPrefs,
  Mapping,
  RunDetail,
  RunSummary,
  TrashEntry,
} from '../../shared/ipc-contract';
import type { IndexEntry } from '../domain/comparator';

interface Database {
  mappings: Mapping[];
  settings: AppSettings;
  runs: RunDetail[];
  trash: TrashEntry[];
  /** Clientes del creador de proyectos, indexados por nombre saneado. */
  clients: Client[];
  /** Última configuración usada en el creador. */
  creatorPrefs: CreatorPrefs;
  /** index["<mappingId>::<monthKey>"]["<relPath>"] = IndexEntry */
  index: Record<string, Record<string, IndexEntry>>;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultExclusions: ['Thumbs.db', 'desktop.ini', '.DS_Store', '*.tmp', '*.bak'],
  preferredMonthFormat: 'Mes-Año',
  copyConcurrency: 3,
};

const DEFAULT_CREATOR_PREFS: CreatorPrefs = {
  basePath: '',
  fileTypes: ['psd'],
  platforms: [],
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
    creatorPrefs: { ...DEFAULT_CREATOR_PREFS },
    index: {},
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

  deleteMapping(id: string): void {
    this.db.mappings = this.db.mappings.filter((m) => m.id !== id);
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
