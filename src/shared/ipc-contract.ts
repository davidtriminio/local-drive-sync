/**
 * Contrato IPC compartido entre el proceso main, el preload y el renderer.
 * Fuente única de verdad para canales y tipos.
 */

export const IpcChannels = {
  appGetVersion: 'app:getVersion',
  windowToggleFullScreen: 'window:toggleFullScreen',
  windowFullScreenChanged: 'window:fullScreenChanged',
  dialogPickFolder: 'dialog:pickFolder',
  mappingsList: 'mappings:list',
  mappingsSave: 'mappings:save',
  mappingsDelete: 'mappings:delete',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  scanDiff: 'scan:diff',
  syncPreview: 'sync:preview',
  syncExecute: 'sync:execute',
  syncCancel: 'sync:cancel',
  syncProgress: 'sync:progress',
  syncDone: 'sync:done',
  historyList: 'history:list',
  historyDetail: 'history:detail',
  trashList: 'trash:list',
  trashRestore: 'trash:restore',
  clientsList: 'clients:list',
  platformsList: 'platforms:list',
  projectCreate: 'project:create',
  creatorPrefsGet: 'creator:prefsGet',
  creatorSetBasePath: 'creator:setBasePath',
  clientsSetIcon: 'clients:setIcon',
  clientsSetColor: 'clients:setColor',
  eventsList: 'events:list',
  eventsSave: 'events:save',
  eventsDelete: 'events:delete',
  projectCreateBatch: 'project:createBatch',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

export type MonthFormat = 'Mes-Año' | 'MM-AAAA' | 'AAAA-MM';

export type FileStatus = 'NEW' | 'MODIFIED' | 'EQUAL' | 'ONLY_DRIVE';

export interface Mapping {
  id: string;
  name: string;
  /** Nombre de icono (de la librería) mostrado en la lista de mapeos. */
  icon: string;
  /** Color de acento (hex) del badge/icono. */
  color: string;
  /** Ruta local, puede contener el token {mes}. Ej: D:\Exports\{mes}\Cliente 1 */
  localPattern: string;
  /** Ruta Drive, puede contener el token {mes}. Ej: G:\...\Cliente 1\artes\{mes} */
  drivePattern: string;
  monthFormat: MonthFormat;
  /** Crear la carpeta destino en Drive si no existe. */
  createMissing: boolean;
  /** Patrones glob a excluir (además de los globales). */
  exclusions: string[];
  createdAt: string;
}

export interface MappingDraft {
  id?: string;
  name: string;
  icon?: string;
  color?: string;
  localPattern: string;
  drivePattern: string;
  monthFormat: MonthFormat;
  createMissing: boolean;
  exclusions: string[];
}

export interface FileDiff {
  relPath: string;
  status: FileStatus;
  localSize: number | null;
  driveSize: number | null;
  localMtime: number | null;
  driveMtime: number | null;
  conflict: boolean;
}

export interface DiffCounts {
  new: number;
  modified: number;
  equal: number;
  onlyDrive: number;
  conflicts: number;
}

export interface DiffResult {
  mappingId: string;
  monthKey: string;
  localPath: string;
  drivePath: string;
  localExists: boolean;
  driveExists: boolean;
  files: FileDiff[];
  counts: DiffCounts;
}

/** copy = usar local (gana local). keepDrive = conservar Drive. skip = no tocar. */
export type FileDecision = 'copy' | 'keepDrive' | 'skip';

export interface SyncSelectionItem {
  relPath: string;
  decision: FileDecision;
}

export interface SyncPreviewRequest {
  mappingId: string;
  monthKey: string;
  selections: SyncSelectionItem[];
}

export type ActionType = 'copy' | 'update' | 'mkdir';

export interface PlannedAction {
  type: ActionType;
  relPath: string;
  willBackup: boolean;
}

export interface SyncPlanSummary {
  copy: number;
  update: number;
  mkdir: number;
  backups: number;
}

export interface SyncPlan {
  id: string;
  mappingId: string;
  monthKey: string;
  localPath: string;
  drivePath: string;
  createDriveRoot: boolean;
  actions: PlannedAction[];
  summary: SyncPlanSummary;
}

export interface SyncProgress {
  runId: string;
  done: number;
  total: number;
  current: string;
  phase: 'starting' | 'copying' | 'finishing';
}

export type RunItemResult = 'ok' | 'error' | 'skipped';

export interface RunItem {
  relPath: string;
  action: ActionType;
  result: RunItemResult;
  errorMsg?: string;
}

export type RunStatus =
  | 'running'
  | 'completed'
  | 'completed_with_errors'
  | 'interrupted';

export interface RunSummary {
  id: string;
  mappingId: string;
  mappingName: string;
  monthKey: string;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  nCopied: number;
  nUpdated: number;
  nCreatedDirs: number;
  nConflicts: number;
  nErrors: number;
}

export interface RunDetail extends RunSummary {
  items: RunItem[];
}

export interface TrashEntry {
  id: string;
  runId: string;
  relPath: string;
  originalDrivePath: string;
  backupPath: string;
  size: number;
  createdAt: string;
}

export interface AppSettings {
  defaultExclusions: string[];
  preferredMonthFormat: MonthFormat;
  copyConcurrency: number;
}

// --- Creador de proyectos gráficos ---

/** Plataforma con su sigla y formatos (dimensiones) disponibles. */
export interface Platform {
  name: string;
  sigla: string;
  formats: Record<string, string>;
}

/** Un proyecto registrado en el historial de un cliente. */
export interface ClientProject {
  /** Nombre saneado del proyecto (minúsculas, guiones bajos). */
  name: string;
  /** Últimas carpetas creadas para este proyecto (nombre de carpeta). */
  folders: string[];
}

/** Cliente persistido y sus proyectos. */
export interface Client {
  /** Nombre saneado del cliente, sirve como identificador. */
  name: string;
  /** Icono (de la librería) mostrado en los badges del creador. */
  icon: string;
  /** Color de acento (hex) del badge del cliente. */
  color: string;
  projects: ClientProject[];
}

/** Última configuración usada en el creador; se restaura al abrirlo. */
export interface CreatorPrefs {
  basePath: string;
  fileTypes: ('psd' | 'ai')[];
  platforms: string[];
  subfolders: string[];
  lastClient: string;
}

/** Petición para crear un proyecto gráfico. */
export interface CreateProjectRequest {
  client: string;
  project: string;
  /** Carpeta base donde crear el proyecto. */
  basePath: string;
  /** Tipos de archivo plantilla a copiar. */
  fileTypes: ('psd' | 'ai')[];
  /** Nombres de plataformas seleccionadas (ej. "Instagram"). */
  platforms: string[];
  /** Subcarpetas a crear; si se omite, se crean todas. */
  subfolders?: string[];
  /** Icono a asignar al cliente (si es nuevo o se quiere actualizar). */
  clientIcon?: string;
  /** Color a asignar al cliente (si es nuevo o se quiere actualizar). */
  clientColor?: string;
  /** Si true, procede aunque exista un duplicado en el mismo mes. */
  confirmDuplicate?: boolean;
}

/** Resultado de crear un proyecto. */
export interface CreateProjectResult {
  status: 'created' | 'duplicate';
  /** Nombre de la carpeta creada (solo si status === 'created'). */
  folderName?: string;
  /** Ruta absoluta creada (solo si status === 'created'). */
  projectPath?: string;
  /** Entradas del log de creación (solo si status === 'created'). */
  log?: string[];
  /** Carpeta previa del mismo mes que dispara el aviso (status === 'duplicate'). */
  existingFolder?: string;
}

// --- Eventos y feriados ---

/**
 * Un evento o feriado al que se pueden asociar artes/proyectos. Los del
 * catálogo integrado (`builtin: true`) son recurrentes por mes/día; los
 * personalizados los crea el usuario. Las asociaciones de clientes de un
 * evento integrado se persisten como override sin duplicar el catálogo.
 */
export interface EventItem {
  /** Identificador estable (slug para integrados, uuid para personalizados). */
  id: string;
  name: string;
  /** Mes (1-12) en que cae el evento; sirve para ordenar. */
  month: number;
  /** Día del mes (1-31); ignorar si `variable` es true. */
  day: number;
  /** true si la fecha exacta varía cada año (p. ej. 2.º domingo de mayo). */
  variable: boolean;
  /** Nota de fecha para eventos variables (p. ej. «2.º domingo de mayo»). */
  note?: string;
  icon: string;
  color: string;
  /** Nombres saneados de clientes asociados. */
  clients: string[];
  /** true si proviene del catálogo integrado (no se puede eliminar). */
  builtin: boolean;
}

/** Borrador para crear/editar un evento personalizado o ajustar uno integrado. */
export interface EventDraft {
  id?: string;
  name: string;
  month: number;
  day: number;
  variable?: boolean;
  note?: string;
  icon?: string;
  color?: string;
  clients: string[];
}

/** Petición para crear el mismo proyecto en lote para varios clientes. */
export interface CreateBatchRequest {
  /** Nombres de clientes (se sanean en el main). */
  clients: string[];
  project: string;
  basePath: string;
  fileTypes: ('psd' | 'ai')[];
  platforms: string[];
  subfolders?: string[];
  /** Evento asociado (solo informativo/preselección). */
  eventId?: string;
  /** Si true, procede aunque existan duplicados del mismo mes. */
  confirmDuplicate?: boolean;
}

/** Resultado de la creación en lote para un cliente concreto. */
export interface BatchClientResult {
  /** Nombre saneado del cliente. */
  client: string;
  status: 'created' | 'duplicate' | 'error';
  folderName?: string;
  existingFolder?: string;
  error?: string;
}

/** Resultado global de una creación en lote. */
export interface CreateBatchResult {
  results: BatchClientResult[];
}

/** Subcarpetas por defecto del árbol de proyecto. */
export const DEFAULT_SUBFOLDERS: readonly string[] = [
  '01_brief',
  '02_references',
  '03_resources/fonts',
  '03_resources/images',
  '03_resources/icons',
  '04_workfiles/psd',
  '04_workfiles/ai',
  '04_workfiles/figma',
  '05_exports/print',
  '05_exports/web',
  '06_archive',
] as const;

/** Superficie expuesta al renderer vía contextBridge (window.api). */
export interface Api {
  getAppVersion(): Promise<string>;
  /** Alterna pantalla completa; devuelve el nuevo estado. */
  toggleFullScreen(): Promise<boolean>;
  pickFolder(): Promise<string | null>;
  listMappings(): Promise<Mapping[]>;
  saveMapping(draft: MappingDraft): Promise<Mapping>;
  deleteMapping(id: string): Promise<void>;
  getSettings(): Promise<AppSettings>;
  setSettings(settings: AppSettings): Promise<AppSettings>;
  scanDiff(mappingId: string, monthKey: string): Promise<DiffResult>;
  previewSync(req: SyncPreviewRequest): Promise<SyncPlan>;
  executeSync(plan: SyncPlan): Promise<RunSummary>;
  cancelSync(runId: string): Promise<void>;
  listHistory(): Promise<RunSummary[]>;
  historyDetail(runId: string): Promise<RunDetail | null>;
  listTrash(): Promise<TrashEntry[]>;
  restoreTrash(trashId: string): Promise<void>;
  /** Clientes registrados con su historial de proyectos. */
  listClients(): Promise<Client[]>;
  /** Asigna un icono a un cliente existente; devuelve la lista actualizada. */
  setClientIcon(name: string, icon: string): Promise<Client[]>;
  /** Asigna un color a un cliente existente; devuelve la lista actualizada. */
  setClientColor(name: string, color: string): Promise<Client[]>;
  /** Catálogo de plataformas y sus formatos. */
  listPlatforms(): Promise<Platform[]>;
  /** Crea un proyecto; puede devolver un aviso de duplicado. */
  createProject(req: CreateProjectRequest): Promise<CreateProjectResult>;
  /** Crea el mismo proyecto en lote para varios clientes (un arte por evento). */
  createProjectBatch(req: CreateBatchRequest): Promise<CreateBatchResult>;
  /** Catálogo de eventos/feriados (integrados + personalizados). */
  listEvents(): Promise<EventItem[]>;
  /** Crea o actualiza un evento; devuelve la lista actualizada. */
  saveEvent(draft: EventDraft): Promise<EventItem[]>;
  /** Elimina un evento personalizado; devuelve la lista actualizada. */
  deleteEvent(id: string): Promise<EventItem[]>;
  /** Última configuración usada en el creador. */
  getCreatorPrefs(): Promise<CreatorPrefs>;
  /** Guarda al instante la carpeta base (admite el token {mes}). */
  setCreatorBasePath(basePath: string): Promise<void>;
  /** Suscripción a progreso; devuelve función para desuscribir. */
  onSyncProgress(cb: (p: SyncProgress) => void): () => void;
  onSyncDone(cb: (s: RunSummary) => void): () => void;
  /** Notifica cambios de pantalla completa (F11, botón o nativo). */
  onFullScreenChange(cb: (isFullScreen: boolean) => void): () => void;
}
