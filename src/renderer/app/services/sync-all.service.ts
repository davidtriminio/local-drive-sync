import { Injectable, inject, signal } from '@angular/core';
import { IpcService } from './ipc.service';
import { NotificationsStore } from './notifications.store';
import { currentMonthKey } from '../shared/format.util';

/**
 * Sincroniza de una vez varios mapeos (mes actual, Local como fuente): copia
 * nuevos y actualiza modificados sin pasar por el asistente. Al terminar
 * refresca las notificaciones.
 */
@Injectable({ providedIn: 'root' })
export class SyncAllService {
  private readonly ipc = inject(IpcService);
  private readonly notifications = inject(NotificationsStore);

  readonly running = signal(false);
  /** Progreso mientras corre («Sincronizando 2/5…»). */
  readonly status = signal('');
  /** Resultado de la última ejecución. */
  readonly result = signal('');

  async run(mappingIds: string[]): Promise<void> {
    if (this.running() || mappingIds.length === 0) {
      return;
    }
    this.running.set(true);
    this.result.set('');
    const monthKey = currentMonthKey();
    let files = 0;
    let mappings = 0;
    let errors = 0;
    try {
      for (let i = 0; i < mappingIds.length; i += 1) {
        this.status.set(`Sincronizando ${i + 1}/${mappingIds.length}…`);
        try {
          const diff = await this.ipc.scanDiff(mappingIds[i], monthKey);
          const selections = diff.files
            .filter((f) => f.status === 'NEW' || f.status === 'MODIFIED')
            .map((f) => ({ relPath: f.relPath, decision: 'copy' as const }));
          if (selections.length === 0) {
            continue;
          }
          const plan = await this.ipc.previewSync({
            mappingId: mappingIds[i],
            monthKey,
            selections,
          });
          if (plan.summary.copy + plan.summary.update + plan.summary.mkdir === 0) {
            continue;
          }
          const s = await this.ipc.executeSync(plan);
          files += s.nCopied + s.nUpdated;
          errors += s.nErrors;
          mappings += 1;
        } catch {
          errors += 1;
        }
      }
    } finally {
      this.running.set(false);
      this.status.set('');
      this.result.set(
        files === 0 && errors === 0
          ? 'Todo estaba al día.'
          : `Sincronizados ${files} archivo(s) en ${mappings} mapeo(s)` +
              (errors > 0 ? ` · ${errors} con error` : '') +
              '.',
      );
      await this.notifications.refresh();
    }
  }
}
