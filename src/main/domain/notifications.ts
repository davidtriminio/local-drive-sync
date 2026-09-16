import type {
  FileDiff,
  NotificationsResult,
  SyncNotification,
} from '../../shared/ipc-contract';
import type { Repository } from '../persistence/repository';
import type { SyncService } from '../services/sync-service';

/** Máximo de rutas de muestra que se adjuntan a una notificación. */
const SAMPLE_LIMIT = 6;

/** Clave de mes canónica actual (AAAA-MM). */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Archivos pendientes de sincronizar: nuevos o modificados en local. */
function pendingFiles(files: FileDiff[]): FileDiff[] {
  return files.filter((f) => f.status === 'NEW' || f.status === 'MODIFIED');
}

/**
 * Firma estable del conjunto pendiente. Cambia si aparece, desaparece o cambia
 * (tamaño/fecha) cualquier archivo pendiente; sirve para distinguir «lo mismo
 * de antes» de «hay algo nuevo». Hash djb2 en base36 (compacto).
 */
export function pendingSignature(files: FileDiff[]): string {
  const parts = pendingFiles(files)
    .map((f) => `${f.status}:${f.relPath}:${f.localSize ?? ''}:${f.localMtime ?? ''}`)
    .sort();
  let hash = 5381;
  const joined = parts.join('|');
  for (let i = 0; i < joined.length; i += 1) {
    hash = (hash * 33) ^ joined.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Revisa todos los mapeos en el mes actual y construye la lista de
 * notificaciones para los que tienen archivos pendientes. Marca como no leída
 * cada una cuya firma difiera de la última que el usuario confirmó.
 */
export function checkNotifications(
  repo: Repository,
  syncService: SyncService,
  monthKey: string = currentMonthKey(),
): NotificationsResult {
  const notifications: SyncNotification[] = [];

  for (const mapping of repo.listMappings()) {
    let diffFiles: FileDiff[];
    try {
      diffFiles = syncService.scanDiff(mapping.id, monthKey).files;
    } catch {
      // Un mapeo con rutas inaccesibles no debe romper el resto.
      continue;
    }
    const pending = pendingFiles(diffFiles);
    if (pending.length === 0) {
      continue;
    }
    const signature = pendingSignature(diffFiles);
    notifications.push({
      mappingId: mapping.id,
      mappingName: mapping.name,
      icon: mapping.icon || 'store',
      color: mapping.color || '#34d399',
      monthKey,
      newCount: pending.filter((f) => f.status === 'NEW').length,
      modifiedCount: pending.filter((f) => f.status === 'MODIFIED').length,
      sampleFiles: pending.slice(0, SAMPLE_LIMIT).map((f) => f.relPath),
      signature,
      unread: repo.getNotifAck(mapping.id) !== signature,
    });
  }

  return {
    notifications,
    unreadCount: notifications.filter((n) => n.unread).length,
  };
}
