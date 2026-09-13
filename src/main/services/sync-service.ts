import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  DiffResult,
  Mapping,
  RunDetail,
  RunSummary,
  SyncPlan,
  SyncPreviewRequest,
  SyncProgress,
} from '../../shared/ipc-contract';
import { Comparator, type IndexEntry } from '../domain/comparator';
import { CopyEngine } from '../domain/copy-engine';
import { ExclusionFilter } from '../domain/exclusion-filter';
import { MonthNormalizer } from '../domain/month-normalizer';
import { Scanner } from '../domain/scanner';
import { SyncPlanner } from '../domain/sync-planner';
import { TrashService } from '../domain/trash-service';
import type { Repository } from '../persistence/repository';

interface ResolvedSide {
  resolved: string;
  exists: boolean;
}

export class SyncService {
  private readonly normalizer = new MonthNormalizer();
  private readonly comparator = new Comparator();
  private readonly planner = new SyncPlanner();
  private readonly copyEngine = new CopyEngine();

  constructor(
    private readonly repo: Repository,
    private readonly trashRoot: string,
  ) {}

  /** Resuelve {mes} en una ruta; si el nombre exacto no existe, busca un
   *  hermano en el directorio padre cuyo nombre normalice al mismo mes. */
  private resolveSide(
    pattern: string,
    monthKey: string,
    mapping: Mapping,
  ): ResolvedSide {
    const rendered = this.normalizer.render(monthKey, mapping.monthFormat);
    const direct = pattern.replace(/\{mes\}/gi, rendered);
    if (fs.existsSync(direct)) {
      return { resolved: direct, exists: true };
    }
    if (/\{mes\}/i.test(pattern)) {
      const parent = path.dirname(direct);
      try {
        const entries = fs.readdirSync(parent, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && this.normalizer.toKey(entry.name) === monthKey) {
            return { resolved: path.join(parent, entry.name), exists: true };
          }
        }
      } catch {
        /* padre inexistente */
      }
    }
    return { resolved: direct, exists: false };
  }

  private buildScanner(mapping: Mapping): Scanner {
    const settings = this.repo.getSettings();
    const patterns = [...settings.defaultExclusions, ...mapping.exclusions];
    return new Scanner(new ExclusionFilter(patterns));
  }

  scanDiff(mappingId: string, monthKey: string): DiffResult {
    const mapping = this.repo.getMapping(mappingId);
    if (!mapping) {
      throw new Error(`Mapeo no encontrado: ${mappingId}`);
    }
    const local = this.resolveSide(mapping.localPattern, monthKey, mapping);
    const drive = this.resolveSide(mapping.drivePattern, monthKey, mapping);
    const scanner = this.buildScanner(mapping);

    const localFiles = local.exists ? scanner.scan(local.resolved) : [];
    const driveFiles = drive.exists ? scanner.scan(drive.resolved) : [];
    const index = this.repo.getIndex(mappingId, monthKey);

    const files = this.comparator.compare(localFiles, driveFiles, index);
    const counts = {
      new: files.filter((f) => f.status === 'NEW').length,
      modified: files.filter((f) => f.status === 'MODIFIED').length,
      equal: files.filter((f) => f.status === 'EQUAL').length,
      onlyDrive: files.filter((f) => f.status === 'ONLY_DRIVE').length,
      conflicts: files.filter((f) => f.conflict).length,
    };

    return {
      mappingId,
      monthKey,
      localPath: local.resolved,
      drivePath: drive.resolved,
      localExists: local.exists,
      driveExists: drive.exists,
      files,
      counts,
    };
  }

  previewSync(req: SyncPreviewRequest): SyncPlan {
    const diff = this.scanDiff(req.mappingId, req.monthKey);
    return this.planner.plan(diff, req.selections);
  }

  async executeSync(
    plan: SyncPlan,
    signal: AbortSignal,
    emitProgress: (p: SyncProgress) => void,
  ): Promise<RunSummary> {
    const mapping = this.repo.getMapping(plan.mappingId);
    const mappingName = mapping?.name ?? '(desconocido)';
    const runId = plan.id;

    const run: RunDetail = {
      id: runId,
      mappingId: plan.mappingId,
      mappingName,
      monthKey: plan.monthKey,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      status: 'running',
      nCopied: 0,
      nUpdated: 0,
      nCreatedDirs: 0,
      nConflicts: 0,
      nErrors: 0,
      items: [],
    };
    this.repo.createRun(run);

    emitProgress({ runId, done: 0, total: plan.actions.length, current: '', phase: 'starting' });

    const trash = new TrashService(this.trashRoot, this.repo);
    const items = await this.copyEngine.execute(plan, {
      localPath: plan.localPath,
      drivePath: plan.drivePath,
      concurrency: this.repo.getSettings().copyConcurrency,
      runId,
      trash,
      signal,
      onProgress: (done, total, current) =>
        emitProgress({ runId, done, total, current, phase: 'copying' }),
    });

    emitProgress({
      runId,
      done: plan.actions.length,
      total: plan.actions.length,
      current: '',
      phase: 'finishing',
    });

    // Actualizar índice incremental con lo copiado/actualizado correctamente.
    const indexUpdate: Record<string, IndexEntry> = {};
    for (const item of items) {
      if (item.result !== 'ok' || item.action === 'mkdir') {
        continue;
      }
      try {
        const st = fs.statSync(path.join(plan.localPath, item.relPath));
        indexUpdate[item.relPath] = { size: st.size, mtimeMs: st.mtimeMs };
      } catch {
        /* ignorar */
      }
    }
    if (Object.keys(indexUpdate).length > 0) {
      this.repo.setIndexEntries(plan.mappingId, plan.monthKey, indexUpdate);
    }

    const nErrors = items.filter((i) => i.result === 'error').length;
    const summary: RunSummary = {
      ...run,
      finishedAt: new Date().toISOString(),
      status: signal.aborted
        ? 'interrupted'
        : nErrors > 0
          ? 'completed_with_errors'
          : 'completed',
      nCopied: items.filter((i) => i.action === 'copy' && i.result === 'ok').length,
      nUpdated: items.filter((i) => i.action === 'update' && i.result === 'ok').length,
      nCreatedDirs: items.filter((i) => i.action === 'mkdir' && i.result === 'ok').length,
      nConflicts: 0,
      nErrors,
    };
    this.repo.updateRun({ ...summary, items });
    return summary;
  }
}
