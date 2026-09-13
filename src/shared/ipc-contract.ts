/**
 * Contrato IPC compartido entre el proceso main, el preload y el renderer.
 * Fuente única de verdad para canales y tipos.
 */

export const IpcChannels = {
  appGetVersion: 'app:getVersion',
  windowToggleFullScreen: 'window:toggleFullScreen',
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
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

export type MonthFormat = 'Mes-Año' | 'MM-AAAA' | 'AAAA-MM';

export type FileStatus = 'NEW' | 'MODIFIED' | 'EQUAL' | 'ONLY_DRIVE';

export interface Mapping {
  id: string;
  name: string;
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
  /** Suscripción a progreso; devuelve función para desuscribir. */
  onSyncProgress(cb: (p: SyncProgress) => void): () => void;
  onSyncDone(cb: (s: RunSummary) => void): () => void;
}
