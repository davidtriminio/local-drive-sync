import type { FileDiff, FileStatus } from '../../shared/ipc-contract';
import type { ScannedFile } from './scanner';

export interface IndexEntry {
  size: number;
  mtimeMs: number;
}

/** Tolerancia de fecha (ms) para tratar dos archivos como iguales en tiempo. */
const MTIME_TOLERANCE = 2000;

function makeDiff(
  relPath: string,
  status: FileStatus,
  local: ScannedFile | null,
  drive: ScannedFile | null,
  conflict: boolean,
): FileDiff {
  return {
    relPath,
    status,
    localSize: local ? local.size : null,
    driveSize: drive ? drive.size : null,
    localMtime: local ? local.mtimeMs : null,
    driveMtime: drive ? drive.mtimeMs : null,
    conflict,
  };
}

function changedVsIndex(file: ScannedFile, idx: IndexEntry): boolean {
  return (
    file.size !== idx.size ||
    Math.abs(file.mtimeMs - idx.mtimeMs) > MTIME_TOLERANCE
  );
}

/**
 * Compara el lado local con el de Drive usando tamaño + fecha (ruta rápida).
 * El índice previo permite marcar conflictos (cambió en ambos lados).
 */
export class Comparator {
  compare(
    local: ScannedFile[],
    drive: ScannedFile[],
    index: Record<string, IndexEntry>,
  ): FileDiff[] {
    const driveMap = new Map(drive.map((f) => [f.relPath, f]));
    const localMap = new Map(local.map((f) => [f.relPath, f]));
    const diffs: FileDiff[] = [];

    for (const lf of local) {
      const df = driveMap.get(lf.relPath);
      if (!df) {
        diffs.push(makeDiff(lf.relPath, 'NEW', lf, null, false));
        continue;
      }
      const sameSize = lf.size === df.size;
      const sameTime = Math.abs(lf.mtimeMs - df.mtimeMs) <= MTIME_TOLERANCE;
      if (sameSize && sameTime) {
        diffs.push(makeDiff(lf.relPath, 'EQUAL', lf, df, false));
      } else {
        const idx = index[lf.relPath];
        const conflict = idx
          ? changedVsIndex(lf, idx) && changedVsIndex(df, idx)
          : false;
        diffs.push(makeDiff(lf.relPath, 'MODIFIED', lf, df, conflict));
      }
    }

    for (const df of drive) {
      if (!localMap.has(df.relPath)) {
        diffs.push(makeDiff(df.relPath, 'ONLY_DRIVE', null, df, false));
      }
    }

    diffs.sort((a, b) => a.relPath.localeCompare(b.relPath));
    return diffs;
  }
}
