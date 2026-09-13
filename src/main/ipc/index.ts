import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import {
  IpcChannels,
  type Mapping,
  type MappingDraft,
  type AppSettings,
  type CreateProjectRequest,
  type SyncPlan,
  type SyncPreviewRequest,
  type SyncProgress,
} from '../../shared/ipc-contract';
import { Repository } from '../persistence/repository';
import { TrashService } from '../domain/trash-service';
import { SyncService } from '../services/sync-service';
import { ProjectCreator, sanitizeName } from '../domain/project-creator';
import { importLegacyClients } from '../domain/legacy-import';
import { creatorAssetsDir, platformsFile } from '../resources';

/** Historial de clientes del proyecto Python anterior (import de una sola vez). */
const LEGACY_HISTORY_DIR = 'V:/graphic_design/tools/functionalApp/history';

export interface IpcContext {
  getWindow: () => BrowserWindow | null;
  dataDir: string;
}

/** Registra todos los handlers IPC del proceso main. */
export function registerIpcHandlers(ctx: IpcContext): void {
  const repo = new Repository(ctx.dataDir);
  const trashRoot = path.join(ctx.dataDir, 'trash');
  const syncService = new SyncService(repo, trashRoot);
  const trashService = new TrashService(trashRoot, repo);
  const projectCreator = new ProjectCreator(creatorAssetsDir());

  // Import único de clientes heredados si el almacén está vacío.
  if (repo.listClients().length === 0) {
    const legacy = importLegacyClients(LEGACY_HISTORY_DIR);
    if (legacy.length > 0) {
      repo.mergeClients(legacy);
    }
  }

  /** Controladores de cancelación por ejecución en curso. */
  const running = new Map<string, AbortController>();

  const emit = (channel: string, payload: unknown): void => {
    ctx.getWindow()?.webContents.send(channel, payload);
  };

  ipcMain.handle(IpcChannels.appGetVersion, () => app.getVersion());

  ipcMain.handle(IpcChannels.windowToggleFullScreen, () => {
    const win = ctx.getWindow();
    if (!win) {
      return false;
    }
    const next = !win.isFullScreen();
    win.setFullScreen(next);
    return next;
  });

  ipcMain.handle(IpcChannels.dialogPickFolder, async () => {
    const win = ctx.getWindow();
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled || result.filePaths.length === 0
      ? null
      : result.filePaths[0];
  });

  ipcMain.handle(IpcChannels.mappingsList, () => repo.listMappings());

  ipcMain.handle(IpcChannels.mappingsSave, (_e, draft: MappingDraft) => {
    const existing = draft.id ? repo.getMapping(draft.id) : undefined;
    const mapping: Mapping = {
      id: draft.id ?? randomUUID(),
      name: draft.name,
      icon: draft.icon ?? existing?.icon ?? 'store',
      color: draft.color ?? existing?.color ?? '#34d399',
      localPattern: draft.localPattern,
      drivePattern: draft.drivePattern,
      monthFormat: draft.monthFormat,
      createMissing: draft.createMissing,
      exclusions: draft.exclusions,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    return repo.upsertMapping(mapping);
  });

  ipcMain.handle(IpcChannels.mappingsDelete, (_e, id: string) => {
    repo.deleteMapping(id);
  });

  ipcMain.handle(IpcChannels.settingsGet, () => repo.getSettings());
  ipcMain.handle(IpcChannels.settingsSet, (_e, settings: AppSettings) =>
    repo.setSettings(settings),
  );

  ipcMain.handle(IpcChannels.scanDiff, (_e, mappingId: string, monthKey: string) =>
    syncService.scanDiff(mappingId, monthKey),
  );

  ipcMain.handle(IpcChannels.syncPreview, (_e, req: SyncPreviewRequest) =>
    syncService.previewSync(req),
  );

  ipcMain.handle(IpcChannels.syncExecute, async (_e, plan: SyncPlan) => {
    const controller = new AbortController();
    running.set(plan.id, controller);
    try {
      const summary = await syncService.executeSync(
        plan,
        controller.signal,
        (p: SyncProgress) => emit(IpcChannels.syncProgress, p),
      );
      emit(IpcChannels.syncDone, summary);
      return summary;
    } finally {
      running.delete(plan.id);
    }
  });

  ipcMain.handle(IpcChannels.syncCancel, (_e, runId: string) => {
    running.get(runId)?.abort();
  });

  ipcMain.handle(IpcChannels.historyList, () => repo.listRuns());
  ipcMain.handle(IpcChannels.historyDetail, (_e, runId: string) =>
    repo.getRun(runId),
  );

  ipcMain.handle(IpcChannels.trashList, () => repo.listTrash());
  ipcMain.handle(IpcChannels.trashRestore, (_e, trashId: string) =>
    trashService.restore(trashId),
  );

  // --- Creador de proyectos gráficos ---
  ipcMain.handle(IpcChannels.clientsList, () => repo.listClients());

  ipcMain.handle(
    IpcChannels.clientsSetIcon,
    (_e, name: string, icon: string) => {
      repo.setClientIcon(sanitizeName(name), icon);
      return repo.listClients();
    },
  );

  ipcMain.handle(IpcChannels.platformsList, () =>
    ProjectCreator.loadPlatforms(platformsFile()),
  );

  ipcMain.handle(IpcChannels.projectCreate, (_e, req: CreateProjectRequest) => {
    const result = projectCreator.create(req);
    if (result.status === 'created' && result.folderName) {
      repo.recordProject(
        sanitizeName(req.client),
        sanitizeName(req.project),
        result.folderName,
        req.clientIcon,
      );
      // Recuerda la configuración para el próximo proyecto.
      repo.setCreatorPrefs({
        basePath: req.basePath,
        fileTypes: req.fileTypes,
        platforms: req.platforms,
        subfolders: req.subfolders ?? [],
        lastClient: sanitizeName(req.client),
      });
    }
    return result;
  });

  ipcMain.handle(IpcChannels.creatorPrefsGet, () => repo.getCreatorPrefs());
}
