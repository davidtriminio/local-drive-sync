import * as fs from 'node:fs';
import type {
  MigrationApplyRequest,
  MigrationRoot,
  MigrationRootChoice,
} from '../../shared/ipc-contract';
import type { ConfigData, Repository } from '../persistence/repository';
import type { SyncService } from '../services/sync-service';
import { currentMonthKey } from './notifications';
import { staticPrefix } from './month-rollover';
import { resolveMonthToken } from './project-creator';

export const CONFIG_FORMAT = 'local-drive-sync-config';
export const CONFIG_VERSION = 1;

/** Archivo de configuración portable. */
export interface ConfigBundle extends ConfigData {
  format: typeof CONFIG_FORMAT;
  version: number;
  exportedAt: string;
  appVersion: string;
}

export function buildBundle(repo: Repository, appVersion: string): ConfigBundle {
  return {
    format: CONFIG_FORMAT,
    version: CONFIG_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion,
    ...repo.exportConfig(),
  };
}

/** Valida y completa un JSON leído de disco; lanza si no es un export válido. */
export function parseBundle(raw: string): ConfigBundle {
  const data = JSON.parse(raw) as Partial<ConfigBundle>;
  if (data.format !== CONFIG_FORMAT) {
    throw new Error('El archivo no es una exportación de Local Drive Sync.');
  }
  if (typeof data.version !== 'number' || data.version > CONFIG_VERSION) {
    throw new Error('El archivo viene de una versión más nueva de la app.');
  }
  return {
    format: CONFIG_FORMAT,
    version: data.version,
    exportedAt: data.exportedAt ?? '',
    appVersion: data.appVersion ?? '',
    mappings: Array.isArray(data.mappings) ? data.mappings : [],
    clients: Array.isArray(data.clients) ? data.clients : [],
    events: Array.isArray(data.events) ? data.events : [],
    settings: data.settings ?? ({} as ConfigData['settings']),
    creatorPrefs: data.creatorPrefs ?? ({} as ConfigData['creatorPrefs']),
  };
}

// --- Detección y reescritura de raíces de ruta ---

interface PathSlot {
  kind: 'local' | 'drive';
  /** Parte fija de la ruta (antes de `{mes}`). */
  prefix: string;
}

function segments(p: string): string[] {
  return p.split(/[\\/]+/).filter(Boolean);
}

/** Clave de agrupación: unidad (`V:`), recurso UNC o vacío para rutas relativas. */
function volumeKey(p: string): string {
  const segs = segments(p);
  if (/^[\\/]{2}/.test(p)) {
    return `\\\\${segs.slice(0, 2).join('\\').toLowerCase()}`;
  }
  return /^[A-Za-z]:$/.test(segs[0] ?? '') ? segs[0].toUpperCase() : '';
}

function renderRoot(segs: string[], unc: boolean): string {
  if (unc) {
    return `\\\\${segs.join('\\')}`;
  }
  return segs.length === 1 && /^[A-Za-z]:$/.test(segs[0]) ? `${segs[0]}\\` : segs.join('\\');
}

function collectSlots(data: ConfigData): PathSlot[] {
  const slots: PathSlot[] = [];
  const add = (kind: PathSlot['kind'], pattern: string | undefined): void => {
    const prefix = pattern ? staticPrefix(pattern) : '';
    if (prefix) {
      slots.push({ kind, prefix });
    }
  };
  for (const m of data.mappings) {
    add('local', m.localPattern);
    add('drive', m.drivePattern);
  }
  add('local', data.creatorPrefs.basePath);
  add('local', data.settings.exportWatchFolder);
  return slots;
}

/**
 * Agrupa las rutas por tipo (local/Drive) y unidad, y toma como raíz el prefijo
 * común más largo de cada grupo. Propone reemplazar `C:\Users\<usuario>` por la
 * carpeta de usuario de esta PC.
 */
export function detectRoots(data: ConfigData, homeDir: string): MigrationRoot[] {
  const groups = new Map<string, PathSlot[]>();
  for (const slot of collectSlots(data)) {
    const key = `${slot.kind}|${volumeKey(slot.prefix)}`;
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }
  const roots: MigrationRoot[] = [];
  for (const group of groups.values()) {
    const all = group.map((s) => segments(s.prefix));
    let common = all[0];
    for (const segs of all.slice(1)) {
      let n = 0;
      while (
        n < common.length &&
        n < segs.length &&
        common[n].toLowerCase() === segs[n].toLowerCase()
      ) {
        n += 1;
      }
      common = common.slice(0, n);
    }
    if (common.length === 0) {
      continue;
    }
    const original = renderRoot(common, /^[\\/]{2}/.test(group[0].prefix));
    roots.push({
      original,
      kind: group[0].kind,
      usedBy: group.length,
      suggested: suggestReplacement(common, homeDir) ?? original,
    });
  }
  return roots.sort((a, b) => a.kind.localeCompare(b.kind) || a.original.localeCompare(b.original));
}

function suggestReplacement(segs: string[], homeDir: string): string | null {
  if (/^[A-Za-z]:$/.test(segs[0]) && segs[1]?.toLowerCase() === 'users' && segs.length >= 3) {
    return [homeDir.replace(/[\\/]+$/, ''), ...segs.slice(3)].join('\\');
  }
  return null;
}

/** Reescribe la raíz que corresponda (la más larga que coincida); sin cambios si no hay. */
export function remapPath(
  p: string,
  choices: MigrationRootChoice[],
): string {
  if (!p) {
    return p;
  }
  const segs = segments(p);
  let best: { len: number; replacement: string } | null = null;
  for (const c of choices) {
    const root = segments(c.original);
    const replacement = c.replacement.trim();
    if (
      !replacement ||
      root.length > segs.length ||
      root.some((s, i) => s.toLowerCase() !== segs[i].toLowerCase()) ||
      (best && best.len >= root.length)
    ) {
      continue;
    }
    best = { len: root.length, replacement };
  }
  if (!best) {
    return p;
  }
  const rest = segs.slice(best.len);
  const base = best.replacement.replace(/[\\/]+$/, '');
  return [base, ...rest].join('\\');
}

/** Devuelve una copia de la configuración con todas las rutas remapeadas. */
export function remapConfig(data: ConfigData, choices: MigrationRootChoice[]): ConfigData {
  const copy = structuredClone(data);
  for (const m of copy.mappings) {
    m.localPattern = remapPath(m.localPattern, choices);
    m.drivePattern = remapPath(m.drivePattern, choices);
  }
  copy.creatorPrefs.basePath = remapPath(copy.creatorPrefs.basePath ?? '', choices);
  copy.settings.exportWatchFolder = remapPath(copy.settings.exportWatchFolder ?? '', choices);
  return copy;
}

// --- Esqueleto de carpetas ---

export interface SkeletonResult {
  created: string[];
  warnings: string[];
}

function ensureDir(dir: string, label: string, out: SkeletonResult): void {
  if (fs.existsSync(dir)) {
    return;
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
    out.created.push(dir);
  } catch (e) {
    out.warnings.push(`${label}: no se pudo crear ${dir} (${(e as Error).message})`);
  }
}

/** Primeros dos niveles de una ruta (p. ej. `G:\Mi unidad`): la base de Drive. */
function driveBase(dir: string): string {
  const segs = segments(dir);
  return segs.length >= 2 ? `${segs[0]}\\${segs[1]}` : `${segs[0] ?? ''}\\`;
}

/**
 * Crea las carpetas del mes actual de cada mapeo (local y, si la base de Drive
 * existe en esta PC, Drive), la carpeta base del creador y la de export.
 */
export function createSkeleton(
  repo: Repository,
  sync: SyncService,
  opts: MigrationApplyRequest,
): SkeletonResult {
  const out: SkeletonResult = { created: [], warnings: [] };
  const monthKey = currentMonthKey();
  for (const m of repo.listMappings()) {
    if (opts.createLocalFolders && m.localPattern) {
      ensureDir(sync.resolveLocalDir(m, monthKey), m.name, out);
    }
    if (opts.createDriveFolders && m.drivePattern) {
      const dir = sync.resolveDriveDir(m, monthKey);
      const base = driveBase(dir);
      if (fs.existsSync(base)) {
        ensureDir(dir, m.name, out);
      } else {
        out.warnings.push(
          `${m.name}: Drive no disponible (no existe ${base}). Conéctalo y la app creará la carpeta al abrirse.`,
        );
      }
    }
  }
  if (opts.createLocalFolders) {
    const base = repo.getCreatorPrefs().basePath;
    if (base) {
      ensureDir(resolveMonthToken(base), 'Creador de proyectos', out);
    }
  }
  if (opts.createExportFolder) {
    const folder = repo.getSettings().exportWatchFolder;
    if (folder) {
      ensureDir(folder, 'Carpeta de export', out);
    }
  }
  return out;
}
