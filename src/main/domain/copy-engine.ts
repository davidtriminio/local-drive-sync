import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type { RunItem, SyncPlan } from '../../shared/ipc-contract';
import type { TrashService } from './trash-service';

export interface CopyContext {
  localPath: string;
  drivePath: string;
  concurrency: number;
  runId: string;
  trash: TrashService;
  signal: AbortSignal;
  onProgress: (done: number, total: number, current: string) => void;
}

const RETRYABLE = new Set(['EBUSY', 'EPERM', 'EACCES']);
const MAX_RETRIES = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Copia con reintentos ante bloqueos temporales (p. ej. Drive ocupándolo). */
async function copyWithRetry(src: string, dest: string): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await fsp.copyFile(src, dest);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? '';
      if (RETRYABLE.has(code) && attempt < MAX_RETRIES) {
        await delay(250 * attempt);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Ejecuta un SyncPlan: crea carpetas, respalda y copia/actualiza archivos,
 * con concurrencia limitada, progreso y cancelación.
 */
export class CopyEngine {
  async execute(plan: SyncPlan, ctx: CopyContext): Promise<RunItem[]> {
    const items: RunItem[] = [];
    const total = plan.actions.length;
    let done = 0;

    await fsp.mkdir(ctx.drivePath, { recursive: true });

    const mkdirs = plan.actions.filter((a) => a.type === 'mkdir');
    const copies = plan.actions.filter((a) => a.type !== 'mkdir');

    // 1) Carpetas (secuencial, rápido).
    for (const action of mkdirs) {
      if (ctx.signal.aborted) {
        break;
      }
      try {
        await fsp.mkdir(path.join(ctx.drivePath, action.relPath), {
          recursive: true,
        });
        items.push({ relPath: action.relPath, action: 'mkdir', result: 'ok' });
      } catch (err) {
        items.push({
          relPath: action.relPath,
          action: 'mkdir',
          result: 'error',
          errorMsg: (err as Error).message,
        });
      }
      done += 1;
      ctx.onProgress(done, total, action.relPath);
    }

    // 2) Copias con pool de concurrencia.
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < copies.length) {
        if (ctx.signal.aborted) {
          return;
        }
        const action = copies[cursor];
        cursor += 1;

        const src = path.join(ctx.localPath, action.relPath);
        const dest = path.join(ctx.drivePath, action.relPath);
        try {
          await fsp.mkdir(path.dirname(dest), { recursive: true });
          if (action.willBackup) {
            try {
              await fsp.access(dest);
              await ctx.trash.backup(dest, action.relPath, ctx.runId);
            } catch {
              /* no existía en Drive: nada que respaldar */
            }
          }
          await copyWithRetry(src, dest);
          items.push({ relPath: action.relPath, action: action.type, result: 'ok' });
        } catch (err) {
          items.push({
            relPath: action.relPath,
            action: action.type,
            result: 'error',
            errorMsg: (err as Error).message,
          });
        }
        done += 1;
        ctx.onProgress(done, total, action.relPath);
      }
    };

    const poolSize = Math.max(1, Math.min(8, ctx.concurrency));
    await Promise.all(Array.from({ length: poolSize }, () => worker()));

    return items;
  }
}
