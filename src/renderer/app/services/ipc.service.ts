import { Injectable } from '@angular/core';
import type {
  Api,
  AppSettings,
  Client,
  CreateProjectRequest,
  CreateProjectResult,
  CreatorPrefs,
  DiffResult,
  Mapping,
  MappingDraft,
  Platform,
  RunDetail,
  RunSummary,
  SyncPlan,
  SyncPreviewRequest,
  SyncProgress,
  TrashEntry,
} from '../../../shared/ipc-contract';

/** Fachada tipada sobre window.api (el puente contextBridge del preload). */
@Injectable({ providedIn: 'root' })
export class IpcService {
  private get api(): Api {
    return window.api;
  }

  getAppVersion(): Promise<string> {
    return this.api.getAppVersion();
  }
  toggleFullScreen(): Promise<boolean> {
    return this.api.toggleFullScreen();
  }
  pickFolder(): Promise<string | null> {
    return this.api.pickFolder();
  }
  listMappings(): Promise<Mapping[]> {
    return this.api.listMappings();
  }
  saveMapping(draft: MappingDraft): Promise<Mapping> {
    return this.api.saveMapping(draft);
  }
  deleteMapping(id: string): Promise<void> {
    return this.api.deleteMapping(id);
  }
  getSettings(): Promise<AppSettings> {
    return this.api.getSettings();
  }
  setSettings(settings: AppSettings): Promise<AppSettings> {
    return this.api.setSettings(settings);
  }
  scanDiff(mappingId: string, monthKey: string): Promise<DiffResult> {
    return this.api.scanDiff(mappingId, monthKey);
  }
  previewSync(req: SyncPreviewRequest): Promise<SyncPlan> {
    return this.api.previewSync(req);
  }
  executeSync(plan: SyncPlan): Promise<RunSummary> {
    return this.api.executeSync(plan);
  }
  cancelSync(runId: string): Promise<void> {
    return this.api.cancelSync(runId);
  }
  listHistory(): Promise<RunSummary[]> {
    return this.api.listHistory();
  }
  historyDetail(runId: string): Promise<RunDetail | null> {
    return this.api.historyDetail(runId);
  }
  listTrash(): Promise<TrashEntry[]> {
    return this.api.listTrash();
  }
  restoreTrash(trashId: string): Promise<void> {
    return this.api.restoreTrash(trashId);
  }
  listClients(): Promise<Client[]> {
    return this.api.listClients();
  }
  setClientIcon(name: string, icon: string): Promise<Client[]> {
    return this.api.setClientIcon(name, icon);
  }
  setClientColor(name: string, color: string): Promise<Client[]> {
    return this.api.setClientColor(name, color);
  }
  listPlatforms(): Promise<Platform[]> {
    return this.api.listPlatforms();
  }
  createProject(req: CreateProjectRequest): Promise<CreateProjectResult> {
    return this.api.createProject(req);
  }
  getCreatorPrefs(): Promise<CreatorPrefs> {
    return this.api.getCreatorPrefs();
  }
  setCreatorBasePath(basePath: string): Promise<void> {
    return this.api.setCreatorBasePath(basePath);
  }
  onSyncProgress(cb: (p: SyncProgress) => void): () => void {
    return this.api.onSyncProgress(cb);
  }
  onSyncDone(cb: (s: RunSummary) => void): () => void {
    return this.api.onSyncDone(cb);
  }
  onFullScreenChange(cb: (isFullScreen: boolean) => void): () => void {
    return this.api.onFullScreenChange(cb);
  }
}
