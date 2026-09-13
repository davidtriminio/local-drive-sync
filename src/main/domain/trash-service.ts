import { randomUUID } from 'node:crypto';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type { Repository } from '../persistence/repository';

/**
 * Respaldo local antes de sobrescribir en Drive, y restauración.
 * Los respaldos viven fuera de la unidad de Drive (en userData), para que
 * Google Drive no los vuelva a subir.
 */
export class TrashService {
  constructor(
    private readonly trashRoot: string,
    private readonly repo: Repository,
  ) {}

  /** Copia el archivo de destino (que se va a sobrescribir) a la papelera. */
  async backup(
    originalAbs: string,
    relPath: string,
    runId: string,
  ): Promise<void> {
    const dest = path.join(this.trashRoot, runId, relPath);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.copyFile(originalAbs, dest);
    const st = await fsp.stat(dest);
    this.repo.addTrashEntry({
      id: randomUUID(),
      runId,
      relPath,
      originalDrivePath: originalAbs,
      backupPath: dest,
      size: st.size,
      createdAt: new Date().toISOString(),
    });
  }

  /** Restaura un respaldo a su ubicación original en Drive. */
  async restore(trashId: string): Promise<void> {
    const entry = this.repo.getTrashEntry(trashId);
    if (!entry) {
      throw new Error(`Entrada de papelera no encontrada: ${trashId}`);
    }
    await fsp.mkdir(path.dirname(entry.originalDrivePath), { recursive: true });
    await fsp.copyFile(entry.backupPath, entry.originalDrivePath);
  }
}
