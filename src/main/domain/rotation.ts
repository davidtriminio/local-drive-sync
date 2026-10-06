import type { Mapping, RotationIssue } from '../../shared/ipc-contract';
import { matchKey } from './match-key';

const MONTHS =
  'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';

/** Tramo de ruta que parece un mes fijo: Octubre_2026, 2026-10, 10-2026… */
const MONTH_SEGMENT = new RegExp(
  String.raw`^(?:(?:${MONTHS})[\s_-]*\d{4}|\d{4}[\s_-]*(?:\d{1,2}|${MONTHS})|\d{1,2}[\s_-]*\d{4})$`,
  'i',
);

export function looksLikeMonth(segment: string): boolean {
  return MONTH_SEGMENT.test(segment.trim());
}

/**
 * Propone una ruta con `{mes}` en lugar del tramo de mes fijo. En el lado local,
 * si el mes es el último tramo, sigue la convención `{mes}\<cliente>`.
 * Devuelve null si no se reconoce ningún tramo de mes.
 */
function proposeRotating(
  pattern: string,
  side: 'local' | 'drive',
  clientKey: string,
): string | null {
  const parts = pattern.split(/([\\/]+)/); // conserva los separadores
  for (let i = parts.length - 1; i >= 0; i -= 2) {
    if (looksLikeMonth(parts[i])) {
      const isLast = i === parts.length - 1;
      parts[i] = side === 'local' && isLast ? `{mes}\\${clientKey}` : '{mes}';
      return parts.join('');
    }
  }
  return null;
}

/** Mapeos cuyas rutas no llevan `{mes}` y por tanto no rotan al cambiar de mes. */
export function findRotationIssues(mappings: Mapping[]): RotationIssue[] {
  const issues: RotationIssue[] = [];
  for (const m of mappings) {
    const localFixed = !/\{mes\}/i.test(m.localPattern);
    const driveFixed = !/\{mes\}/i.test(m.drivePattern);
    if (!localFixed && !driveFixed) {
      continue;
    }
    const key = matchKey(m.name);
    issues.push({
      mappingId: m.id,
      name: m.name,
      localFixed,
      driveFixed,
      proposedLocal: localFixed
        ? (proposeRotating(m.localPattern, 'local', key) ?? undefined)
        : undefined,
      proposedDrive: driveFixed
        ? (proposeRotating(m.drivePattern, 'drive', key) ?? undefined)
        : undefined,
    });
  }
  return issues;
}
