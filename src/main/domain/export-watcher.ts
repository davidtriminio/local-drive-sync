import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ExportActivity, Mapping } from '../../shared/ipc-contract';
import type { Repository } from '../persistence/repository';
import type { SyncService } from '../services/sync-service';
import { matchKey } from './match-key';
import { looksLikeMonth } from './rotation';

/** Distancia de edición (Levenshtein) entre dos cadenas cortas. */
function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

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
        suggestion: this.suggestMapping(name),
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

  /**
   * Claves con las que un mapeo puede reconocer archivos: su nombre y el nombre
   * de su carpeta local (ej. mapeo «Pebbles And Stones» con carpeta «Pebbles»).
   */
  private aliasKeys(m: Mapping): string[] {
    const keys = new Set<string>();
    const name = matchKey(m.name);
    if (name) {
      keys.add(name);
      // Clientes fusionados en el de este mapeo: sus exports también le llegan.
      const client = this.repo.listClients().find((c) => matchKey(c.name) === name);
      for (const alias of client?.aliases ?? []) {
        const ak = matchKey(alias);
        if (ak) {
          keys.add(ak);
        }
      }
    }
    const last = m.localPattern.split(/[\\/]+/).filter(Boolean).pop() ?? '';
    if (last && !/\{mes\}/i.test(last) && !looksLikeMonth(last)) {
      const folder = matchKey(last);
      if (folder) {
        keys.add(folder);
      }
    }
    return [...keys];
  }

  /**
   * Mapeo cuyo nombre (o carpeta) es prefijo del archivo, sin importar
   * mayúsculas, tildes ni separadores; el más largo gana. Si no hay ninguno,
   * acepta un único mapeo con una sola letra de diferencia (error de tipeo).
   */
  private matchMapping(fileName: string): Mapping | null {
    const key = matchKey(path.parse(fileName).name);
    const mappings = this.repo.listMappings();
    let best: Mapping | null = null;
    let bestLen = 0;
    for (const m of mappings) {
      for (const mk of this.aliasKeys(m)) {
        if ((key === mk || key.startsWith(`${mk}_`)) && mk.length > bestLen) {
          best = m;
          bestLen = mk.length;
        }
      }
    }
    if (best) {
      return best;
    }
    const close = mappings.filter((m) =>
      this.aliasKeys(m).some(
        (mk) => mk.length >= 6 && editDistance(key.slice(0, mk.length), mk) <= 1,
      ),
    );
    return close.length === 1 ? close[0] : null;
  }

  /**
   * Mapeo con nombre casi idéntico al inicio del archivo (p. ej. "atalier_..."
   * frente a "Atelier"), para avisar de un posible error de escritura.
   */
  private suggestMapping(fileName: string): string | undefined {
    const key = matchKey(path.parse(fileName).name);
    let best: string | undefined;
    let bestDist = Infinity;
    for (const m of this.repo.listMappings()) {
      const mk = matchKey(m.name);
      if (!mk) {
        continue;
      }
      const head = key.slice(0, mk.length);
      const dist = editDistance(head, mk);
      const limit = mk.length <= 4 ? 1 : 2;
      if (dist <= limit && dist < bestDist) {
        best = m.name;
        bestDist = dist;
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
