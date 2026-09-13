import { randomUUID } from 'node:crypto';
import type {
  DiffResult,
  PlannedAction,
  SyncPlan,
  SyncSelectionItem,
} from '../../shared/ipc-contract';

/** Añade todas las carpetas ancestro de una ruta relativa al conjunto. */
function collectDirs(relPath: string, dirs: Set<string>): void {
  const parts = relPath.split('/');
  parts.pop();
  let acc = '';
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    dirs.add(acc);
  }
}

/**
 * Transforma un diff + la selección del usuario en un plan inmutable de
 * acciones (crear carpeta / copiar / actualizar-con-respaldo).
 */
export class SyncPlanner {
  plan(
    diff: DiffResult,
    selections: SyncSelectionItem[],
  ): SyncPlan {
    const decisions = new Map(selections.map((s) => [s.relPath, s.decision]));
    const fileActions: PlannedAction[] = [];
    const dirs = new Set<string>();
    let copy = 0;
    let update = 0;
    let backups = 0;

    for (const file of diff.files) {
      const decision = decisions.get(file.relPath);
      if (!decision || decision === 'skip' || decision === 'keepDrive') {
        continue;
      }
      if (file.status === 'NEW' && decision === 'copy') {
        fileActions.push({ type: 'copy', relPath: file.relPath, willBackup: false });
        copy += 1;
        collectDirs(file.relPath, dirs);
      } else if (file.status === 'MODIFIED' && decision === 'copy') {
        fileActions.push({ type: 'update', relPath: file.relPath, willBackup: true });
        update += 1;
        backups += 1;
        collectDirs(file.relPath, dirs);
      }
    }

    const mkdirActions: PlannedAction[] = [...dirs]
      .sort()
      .map((d) => ({ type: 'mkdir' as const, relPath: d, willBackup: false }));

    return {
      id: randomUUID(),
      mappingId: diff.mappingId,
      monthKey: diff.monthKey,
      localPath: diff.localPath,
      drivePath: diff.drivePath,
      createDriveRoot: !diff.driveExists,
      actions: [...mkdirActions, ...fileActions],
      summary: { copy, update, mkdir: mkdirActions.length, backups },
    };
  }
}
