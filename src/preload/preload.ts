import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  IpcChannels,
  type Api,
  type AppSettings,
  type CreateProjectRequest,
  type MappingDraft,
  type SyncPlan,
  type SyncPreviewRequest,
  type SyncProgress,
  type RunSummary,
} from '../shared/ipc-contract';

/**
 * Puente seguro main <-> renderer. Con contextIsolation + sandbox, el renderer
 * solo ve `window.api`, esta superficie mínima y explícita.
 */
const api: Api = {
  getAppVersion: () => ipcRenderer.invoke(IpcChannels.appGetVersion),
  toggleFullScreen: () =>
    ipcRenderer.invoke(IpcChannels.windowToggleFullScreen),
  pickFolder: () => ipcRenderer.invoke(IpcChannels.dialogPickFolder),
  listMappings: () => ipcRenderer.invoke(IpcChannels.mappingsList),
  saveMapping: (draft: MappingDraft) =>
    ipcRenderer.invoke(IpcChannels.mappingsSave, draft),
  deleteMapping: (id: string) =>
    ipcRenderer.invoke(IpcChannels.mappingsDelete, id),
  getSettings: () => ipcRenderer.invoke(IpcChannels.settingsGet),
  setSettings: (settings: AppSettings) =>
    ipcRenderer.invoke(IpcChannels.settingsSet, settings),
  scanDiff: (mappingId: string, monthKey: string) =>
    ipcRenderer.invoke(IpcChannels.scanDiff, mappingId, monthKey),
  previewSync: (req: SyncPreviewRequest) =>
    ipcRenderer.invoke(IpcChannels.syncPreview, req),
  executeSync: (plan: SyncPlan) =>
    ipcRenderer.invoke(IpcChannels.syncExecute, plan),
  cancelSync: (runId: string) =>
    ipcRenderer.invoke(IpcChannels.syncCancel, runId),
  listHistory: () => ipcRenderer.invoke(IpcChannels.historyList),
  historyDetail: (runId: string) =>
    ipcRenderer.invoke(IpcChannels.historyDetail, runId),
  listTrash: () => ipcRenderer.invoke(IpcChannels.trashList),
  restoreTrash: (trashId: string) =>
    ipcRenderer.invoke(IpcChannels.trashRestore, trashId),
  listClients: () => ipcRenderer.invoke(IpcChannels.clientsList),
  setClientIcon: (name: string, icon: string) =>
    ipcRenderer.invoke(IpcChannels.clientsSetIcon, name, icon),
  setClientColor: (name: string, color: string) =>
    ipcRenderer.invoke(IpcChannels.clientsSetColor, name, color),
  listPlatforms: () => ipcRenderer.invoke(IpcChannels.platformsList),
  createProject: (req: CreateProjectRequest) =>
    ipcRenderer.invoke(IpcChannels.projectCreate, req),
  getCreatorPrefs: () => ipcRenderer.invoke(IpcChannels.creatorPrefsGet),
  setCreatorBasePath: (basePath: string) =>
    ipcRenderer.invoke(IpcChannels.creatorSetBasePath, basePath),
  onSyncProgress: (cb: (p: SyncProgress) => void) => {
    const listener = (_e: IpcRendererEvent, payload: SyncProgress): void =>
      cb(payload);
    ipcRenderer.on(IpcChannels.syncProgress, listener);
    return () => ipcRenderer.removeListener(IpcChannels.syncProgress, listener);
  },
  onSyncDone: (cb: (s: RunSummary) => void) => {
    const listener = (_e: IpcRendererEvent, payload: RunSummary): void =>
      cb(payload);
    ipcRenderer.on(IpcChannels.syncDone, listener);
    return () => ipcRenderer.removeListener(IpcChannels.syncDone, listener);
  },
  onFullScreenChange: (cb: (isFullScreen: boolean) => void) => {
    const listener = (_e: IpcRendererEvent, payload: boolean): void =>
      cb(payload);
    ipcRenderer.on(IpcChannels.windowFullScreenChanged, listener);
    return () =>
      ipcRenderer.removeListener(IpcChannels.windowFullScreenChanged, listener);
  },
};

contextBridge.exposeInMainWorld('api', api);
