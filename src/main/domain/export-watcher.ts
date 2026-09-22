import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ExportActivity, Mapping } from '../../shared/ipc-contract';
import type { Repository } from '../persistence/repository';
import type { SyncService } from '../services/sync-service';
import { sanitizeName } from './project-creator';

/** Espera tras el último evento antes de barrer la carpeta. */
const SETTLE_MS = 1200;
/** Lecturas de tamaño idénticas seguidas para considerar un archivo estable. */
const STABLE_CHECKS = 2;

/**
 * Vigila una carpeta de export mientras la app está abierta. Cuando llega un
 * archivo nuevo y estable (ya terminó de escribirse/copiarse), deduce la
 * empresa por el prefijo del nombre (`empresa_...`), lo compara con el nombre
 * saneado de un mapeo y lo mueve a la carpeta local de ese mapeo resuelta al
 * mes actual. Emite un aviso por cada archivo (movido, sin match o error).
 */
export class ExportWatcher {
  private watcher: fs.FSWatcher | null = null;
  private folder = '';
  private timer: NodeJS.Timeout | null = null;
  private processing = false;
  /** Archivos aún en escritura: nombre -> último tamaño y nº de lecturas iguales. */
  private readonly pending = new Map<string, { size: number; stable: number }>();

  constructor(
    private readonly repo: Repository,
    private readonly sync: SyncService,
    private readonly emit: (activity: ExportActivity) => void,
  ) {}

  /** Arranca o reconfigura la vigilancia según los ajustes actuales. */
  reconfigure(): void {
    const s = this.repo.getSettings();
    const folder = s.exportWatchEnabled ? s.exportWatchFolder.trim() : '';
    if (folder === this.folder) {
      return; // sin cambios relevantes
    }
    this.stop();
    this.folder = folder;
    if (!folder) {
      return;
    }
    try {
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
      }
      this.watcher = fs.watch(folder, { persistent: true }, () =>
        this.schedule(),
      );
      // Procesa también lo que ya estuviera en la carpeta al arrancar.
      this.schedule();
    } catch (err) {
      this.emit({
        kind: 'error',
        file: folder,
        message: `No se pudo vigilar la carpeta: ${String(err)}`,
        at: new Date().toISOString(),
      });
      this.folder = '';
    }
  }

  /** Detiene la vigilancia y limpia el estado. */
  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending.clear();
  }

  private schedule(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      void this.sweep();
    }, SETTLE_MS);
  }

  /** Recorre la carpeta y mueve los archivos que ya están estables. */
  private async sweep(): Promise<void> {
    if (this.processing || !this.folder) {
      return;
    }
    this.processing = true;
    try {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(this.folder, { withFileTypes: true });
      } catch {
        return;
      }
      let anyUnstable = false;
      for (const entry of entries) {
        if (!entry.isFile()) {
          continue;
        }
        const name = entry.name;
        const full = path.join(this.folder, name);
        let size: number;
        try {
          size = fs.statSync(full).size;
        } catch {
          continue; // desapareció entre readdir y stat
        }
        const prev = this.pending.get(name);
        if (!prev || prev.size !== size) {
          this.pending.set(name, { size, stable: 0 });
          anyUnstable = true;
          continue;
        }
        if (prev.stable < STABLE_CHECKS) {
          this.pending.set(name, { size, stable: prev.stable + 1 });
          anyUnstable = true;
          continue;
        }
        // Estable: procesar y sacarlo de la lista de pendientes.
        this.pending.delete(name);
        this.handleFile(name, full);
      }
      if (anyUnstable) {
        this.schedule(); // revisa de nuevo los que aún se escriben
      }
    } finally {
      this.processing = false;
    }
  }

  private handleFile(name: string, full: string): void {
    const mapping = this.matchMapping(name);
    if (!mapping) {
      this.emit({
        kind: 'unmatched',
        file: name,
        message: 'Ningún mapeo coincide con el prefijo del nombre.',
        at: new Date().toISOString(),
      });
      return;
    }
    try {
      const destDir = this.sync.resolveLocalDir(mapping, this.currentMonthKey());
      fs.mkdirSync(destDir, { recursive: true });
      // Reexportar el mismo arte reemplaza la versión previa (no crea copias).
      const dest = path.join(destDir, name);
      this.moveFile(full, dest);
      this.emit({
        kind: 'moved',
        file: name,
        mapping: mapping.name,
        dest,
        at: new Date().toISOString(),
      });
    } catch (err) {
      this.emit({
        kind: 'error',
        file: name,
        message: String(err),
        at: new Date().toISOString(),
      });
    }
  }

  /** Mapeo cuyo nombre saneado es prefijo del archivo (el más largo gana). */
  private matchMapping(fileName: string): Mapping | null {
    const key = sanitizeName(path.parse(fileName).name);
    let best: Mapping | null = null;
    let bestLen = 0;
    for (const m of this.repo.listMappings()) {
      const mk = sanitizeName(m.name);
      if (!mk) {
        continue;
      }
      if ((key === mk || key.startsWith(`${mk}_`)) && mk.length > bestLen) {
        best = m;
        bestLen = mk.length;
      }
    }
    return best;
  }

  /** Clave de mes actual en formato AAAA-MM. */
  private currentMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Mueve `src` a `dest` reemplazando si ya existe. `renameSync` sobrescribe el
   * destino (también en Windows); si cruza volúmenes (EXDEV) copia encima y
   * borra el origen (`copyFileSync` sobrescribe por defecto).
   */
  private moveFile(src: string, dest: string): void {
    try {
      fs.renameSync(src, dest);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
        fs.copyFileSync(src, dest);
        fs.unlinkSync(src);
      } else {
        throw err;
      }
    }
  }
}
