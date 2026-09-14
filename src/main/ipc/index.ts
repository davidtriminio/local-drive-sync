import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import {
  IpcChannels,
  type Mapping,
  type MappingDraft,
  type AppSettings,
  type BatchClientResult,
  type CreateBatchRequest,
  type CreateProjectRequest,
  type EventDraft,
  type EventItem,
  type SyncPlan,
  type SyncPreviewRequest,
  type SyncProgress,
} from '../../shared/ipc-contract';
import { Repository } from '../persistence/repository';
import { TrashService } from '../domain/trash-service';
import { SyncService } from '../services/sync-service';
import { ProjectCreator, sanitizeName } from '../domain/project-creator';
import { BUILTIN_EVENT_IDS, mergeHondurasEvents } from '../domain/events';
import { checkNotifications } from '../domain/notifications';
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

  ipcMain.handle(
    IpcChannels.clientsSetColor,
    (_e, name: string, color: string) => {
      repo.setClientColor(sanitizeName(name), color);
      return repo.listClients();
    },
  );

  ipcMain.handle(
    IpcChannels.clientsDelete,
    (_e, name: string, mappingIds: string[]) => {
      // Cascada opcional a los mapeos relacionados que el usuario eligió.
      for (const id of mappingIds ?? []) {
        repo.deleteMapping(id);
      }
      repo.deleteClient(sanitizeName(name));
      return repo.listClients();
    },
  );

  ipcMain.handle(
    IpcChannels.clientsDeleteProject,
    (_e, name: string, project: string) => {
      repo.deleteClientProject(sanitizeName(name), sanitizeName(project));
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
        req.clientColor,
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

  // Crea el mismo proyecto (arte) para varios clientes en una sola acción.
  ipcMain.handle(
    IpcChannels.projectCreateBatch,
    (_e, req: CreateBatchRequest) => {
      const project = sanitizeName(req.project);
      const results: BatchClientResult[] = [];
      for (const rawClient of req.clients) {
        const client = sanitizeName(rawClient);
        if (!client) {
          continue;
        }
        try {
          const result = projectCreator.create({
            client,
            project: req.project,
            basePath: req.basePath,
            fileTypes: req.fileTypes,
            platforms: req.platforms,
            subfolders: req.subfolders,
            date: req.date,
            confirmDuplicate: req.confirmDuplicate,
          });
          if (result.status === 'duplicate') {
            results.push({
              client,
              status: 'duplicate',
              existingFolder: result.existingFolder,
            });
            continue;
          }
          repo.recordProject(client, project, result.folderName ?? '');
          results.push({
            client,
            status: 'created',
            folderName: result.folderName,
          });
        } catch (err) {
          results.push({ client, status: 'error', error: String(err) });
        }
      }
      // Recuerda la configuración para la próxima vez (como en create único).
      const created = results.filter((r) => r.status === 'created');
      if (created.length > 0) {
        repo.setCreatorPrefs({
          basePath: req.basePath,
          fileTypes: req.fileTypes,
          platforms: req.platforms,
          subfolders: req.subfolders ?? [],
          lastClient: created[0].client,
        });
      }
      return { results };
    },
  );

  // --- Eventos y feriados ---
  ipcMain.handle(IpcChannels.eventsList, () =>
    mergeHondurasEvents(repo.listStoredEvents()),
  );

  ipcMain.handle(IpcChannels.eventsSave, (_e, draft: EventDraft) => {
    const id = draft.id ?? randomUUID();
    // Si viene una fecha completa válida, deriva mes/día de ella.
    const hasDate = !!draft.date && /^\d{4}-\d{2}-\d{2}$/.test(draft.date);
    const month = hasDate ? Number(draft.date!.slice(5, 7)) : draft.month;
    const day = hasDate ? Number(draft.date!.slice(8, 10)) : draft.day;
    const event: EventItem = {
      id,
      name: draft.name,
      month,
      day,
      date: hasDate ? draft.date : undefined,
      variable: draft.variable ?? false,
      note: draft.note,
      icon: draft.icon ?? 'calendar',
      color: draft.color ?? '#34d399',
      clients: draft.clients.map((c) => sanitizeName(c)).filter(Boolean),
      builtin: BUILTIN_EVENT_IDS.has(id),
    };
    repo.upsertEvent(event);
    return mergeHondurasEvents(repo.listStoredEvents());
  });

  ipcMain.handle(IpcChannels.eventsDelete, (_e, id: string) => {
    repo.deleteEvent(id);
    return mergeHondurasEvents(repo.listStoredEvents());
  });

  // --- Notificaciones de sincronización ---
  ipcMain.handle(IpcChannels.notificationsCheck, () =>
    checkNotifications(repo, syncService),
  );

  ipcMain.handle(
    IpcChannels.notificationsMarkRead,
    (_e, mappingId: string, signature: string) => {
      repo.setNotifAck(mappingId, signature);
      return checkNotifications(repo, syncService);
    },
  );

  ipcMain.handle(IpcChannels.notificationsMarkAllRead, () => {
    const result = checkNotifications(repo, syncService);
    for (const n of result.notifications) {
      repo.setNotifAck(n.mappingId, n.signature);
    }
    return checkNotifications(repo, syncService);
  });

  ipcMain.handle(IpcChannels.creatorPrefsGet, () => repo.getCreatorPrefs());

  ipcMain.handle(IpcChannels.creatorSetBasePath, (_e, basePath: string) => {
    repo.setCreatorBasePath(basePath);
  });
}
