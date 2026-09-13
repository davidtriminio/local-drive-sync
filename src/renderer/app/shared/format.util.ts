/** Utilidades de formato compartidas por la UI. */

export function formatBytes(bytes: number | null): string {
  if (bytes === null) {
    return '—';
  }
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  return d.toLocaleString('es', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Deriva la clave de mes canónica actual (AAAA-MM) para valores por defecto. */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Sustituye el segmento de mes detectado de una ruta por el token {mes}. */
export function templatizeMonth(fullPath: string): string {
  const parts = fullPath.split(/([\\/])/);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (looksLikeMonth(parts[i])) {
      parts[i] = '{mes}';
      return parts.join('');
    }
  }
  return fullPath;
}

function looksLikeMonth(segment: string): boolean {
  const s = segment
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const hasYear = /(19|20)\d{2}/.test(s);
  if (!hasYear) {
    return false;
  }
  const monthNames =
    /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|jun|jul|ago|sep|set|oct|nov|dic)/;
  // Nombre de mes expl\u00edcito => seguro.
  if (monthNames.test(s)) {
    return true;
  }
  // Solo-num\u00e9rico (d\u00edgitos y separadores, sin otras letras) con un mes 1-12.
  const onlyDigitsAndSeparators = /^[0-9\s._-]+$/.test(s);
  const withoutYear = s.replace(/(19|20)\d{2}/, ' ');
  return (
    onlyDigitsAndSeparators &&
    /(?:^|[^0-9])(0?[1-9]|1[0-2])(?:[^0-9]|$)/.test(withoutYear)
  );
}
