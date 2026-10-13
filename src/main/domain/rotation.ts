import * as fs from 'node:fs';
import type { Mapping, RotationIssue } from '../../shared/ipc-contract';
import type { Repository } from '../persistence/repository';
import { matchKey } from './match-key';
import { MonthNormalizer } from './month-normalizer';

const MONTHS =
  'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';

/** Tramo de ruta que parece un mes fijo: Octubre_2026, 2026-10, 10-2026… */
const MONTH_SEGMENT = new RegExp(
  String.raw`^(?:(?:${MONTHS})[\s_-]*\d{4}|\d{4}[\s_-]*(?:\d{1,2}|${MONTHS})|\d{1,2}[\s_-]*\d{4})$`,
  'i',
);

const normalizer = new MonthNormalizer();

export function looksLikeMonth(segment: string): boolean {
  return MONTH_SEGMENT.test(segment.trim());
}

/** Acceso al disco, inyectable para pruebas. */
export interface DirLister {
  /** Nombres de las subcarpetas de `dir` (vacío si no existe). */
  listDirs(dir: string): string[];
}

const diskLister: DirLister = {
  listDirs(dir) {
    try {
      return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      return [];
    }
  },
};

interface Proposal {
  pattern: string;
  /** Explicación breve de cómo se dedujo. */
  note: string;
}

function sepOf(pattern: string): string {
  return pattern.includes('\\') ? '\\' : '/';
}

function trimTrailingSep(pattern: string): string {
  return pattern.replace(/[\\/]+$/, '');
}

/** Padre y último tramo de una ruta (sin separador final). */
function splitLast(pattern: string): { parent: string; last: string } | null {
  const clean = trimTrailingSep(pattern);
  const idx = Math.max(clean.lastIndexOf('\\'), clean.lastIndexOf('/'));
  if (idx <= 0) {
    return null;
  }
  return { parent: clean.slice(0, idx), last: clean.slice(idx + 1) };
}

function isMonthDir(name: string): boolean {
  return normalizer.toKey(name) !== null;
}

/**
 * 1) Hay un tramo de mes fijo en la ruta (Octubre_2026…): se sustituye. En el
 * lado local, si es el último tramo, sigue la convención `{mes}\<cliente>`.
 */
function fromMonthSegment(
  pattern: string,
  side: 'local' | 'drive',
  clientKey: string,
): Proposal | null {
  const parts = pattern.split(/([\\/]+)/); // conserva los separadores
  for (let i = parts.length - 1; i >= 0; i -= 2) {
    if (looksLikeMonth(parts[i])) {
      const original = parts[i];
      const isLast = i === parts.length - 1;
      parts[i] = side === 'local' && isLast ? `{mes}\\${clientKey}` : '{mes}';
      return {
        pattern: parts.join(''),
        note: `El tramo «${original}» es un mes fijo; se cambia por {mes}.`,
      };
    }
  }
  return null;
}

/** 2) Dentro de la carpeta hay subcarpetas de mes: `<ruta>\{mes}`. */
function fromChildMonths(pattern: string, lister: DirLister): Proposal | null {
  const base = trimTrailingSep(pattern);
  const found = lister.listDirs(base).find(isMonthDir);
  if (!found) {
    return null;
  }
  return {
    pattern: `${base}${sepOf(base)}{mes}`,
    note: `Dentro de la carpeta hay meses (p. ej. «${found}»): se añade {mes} al final.`,
  };
}

/** 3) Junto a la carpeta hay meses que contienen una carpeta con su nombre. */
function fromSiblingMonths(pattern: string, lister: DirLister): Proposal | null {
  const split = splitLast(pattern);
  if (!split) {
    return null;
  }
  const key = matchKey(split.last);
  const sep = sepOf(split.parent);
  for (const month of lister.listDirs(split.parent).filter(isMonthDir)) {
    const inside = lister.listDirs(`${split.parent}${sep}${month}`);
    if (inside.some((d) => matchKey(d) === key)) {
      return {
        pattern: `${split.parent}${sep}{mes}${sep}${split.last}`,
        note: `Existe «${month}\\${split.last}» junto a esta carpeta: se usa {mes}\\${split.last}.`,
      };
    }
  }
  return null;
}

/** 4) Otro mapeo ya rota con la forma `<raíz>\{mes}\<cliente>` en la misma raíz. */
function fromOtherMapping(
  pattern: string,
  others: Mapping[],
  own: Mapping,
): Proposal | null {
  const split = splitLast(pattern);
  if (!split) {
    return null;
  }
  const parent = split.parent.toLowerCase();
  for (const o of others) {
    if (o.id === own.id) {
      continue;
    }
    const m = /^(.*?)[\\/]+\{mes\}[\\/]+[^\\/]+$/i.exec(trimTrailingSep(o.localPattern));
    if (m && m[1].toLowerCase() === parent) {
      return {
        pattern: `${split.parent}${sepOf(split.parent)}{mes}${sepOf(split.parent)}${split.last}`,
        note: `Igual que el mapeo «${o.name}», que ya rota en la misma carpeta raíz.`,
      };
    }
  }
  return null;
}

function manualNote(side: 'local' | 'drive'): string {
  return side === 'local'
    ? 'No encontré ningún mes junto a esta carpeta. Elige la carpeta del mes actual de la empresa (p. ej. …\\Octubre-2026\\Empresa) y la app la convierte en {mes}.'
    : 'No encontré ningún mes dentro ni junto a esta carpeta. Elige la carpeta del mes actual en Drive (p. ej. …\\artes\\Octubre-2026) y la app la convierte en {mes}.';
}

function propose(
  mapping: Mapping,
  side: 'local' | 'drive',
  all: Mapping[],
  lister: DirLister,
): Proposal | null {
  const pattern = side === 'local' ? mapping.localPattern : mapping.drivePattern;
  return (
    fromMonthSegment(pattern, side, matchKey(mapping.name)) ??
    fromChildMonths(pattern, lister) ??
    fromSiblingMonths(pattern, lister) ??
    (side === 'local' ? fromOtherMapping(pattern, all, mapping) : null)
  );
}

/**
 * Mapeos cuyas rutas no llevan `{mes}` y por tanto no rotan al cambiar de mes.
 * Cada lado trae una propuesta deducida (de la ruta, del disco o de otros
 * mapeos) o, si no se pudo, una nota que guía la corrección manual.
 */
export function findRotationIssues(
  mappings: Mapping[],
  lister: DirLister = diskLister,
): RotationIssue[] {
  const issues: RotationIssue[] = [];
  for (const m of mappings) {
    const localFixed = !/\{mes\}/i.test(m.localPattern);
    const driveFixed = !/\{mes\}/i.test(m.drivePattern);
    if (!localFixed && !driveFixed) {
      continue;
    }
    const local = localFixed ? propose(m, 'local', mappings, lister) : null;
    const drive = driveFixed ? propose(m, 'drive', mappings, lister) : null;
    issues.push({
      mappingId: m.id,
      name: m.name,
      localFixed,
      driveFixed,
      localPattern: m.localPattern,
      drivePattern: m.drivePattern,
      proposedLocal: local?.pattern,
      proposedDrive: drive?.pattern,
      localNote: localFixed ? (local?.note ?? manualNote('local')) : undefined,
      driveNote: driveFixed ? (drive?.note ?? manualNote('drive')) : undefined,
    });
  }
  return issues;
}

/**
 * Aplica las propuestas deducidas (de todos los mapeos o solo de `ids`).
 * Devuelve los nombres de los mapeos modificados.
 */
export function applyRotation(
  repo: Pick<Repository, 'listMappings' | 'getMapping' | 'upsertMapping'>,
  ids?: string[],
  lister: DirLister = diskLister,
): string[] {
  const changed: string[] = [];
  for (const issue of findRotationIssues(repo.listMappings(), lister)) {
    if (ids && !ids.includes(issue.mappingId)) {
      continue;
    }
    if (!issue.proposedLocal && !issue.proposedDrive) {
      continue;
    }
    const m = repo.getMapping(issue.mappingId);
    if (!m) {
      continue;
    }
    repo.upsertMapping({
      ...m,
      localPattern: issue.proposedLocal ?? m.localPattern,
      drivePattern: issue.proposedDrive ?? m.drivePattern,
    });
    changed.push(m.name);
  }
  return changed;
}
