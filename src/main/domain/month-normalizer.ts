import type { MonthFormat } from '../../shared/ipc-contract';

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  set: 9,
  oct: 10,
  nov: 11,
  dic: 12,
};

const MONTH_NAMES = [
  '',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const COMBINING_MARKS = /[\u0300-\u036f]/g;

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '');
}

/**
 * Convierte nombres de carpeta de mes (en español, con variantes de formato)
 * a una clave canónica `AAAA-MM`, y reconstruye el nombre "bonito".
 */
export class MonthNormalizer {
  /** Devuelve 'AAAA-MM' o null si no se reconoce. */
  toKey(folderName: string): string | null {
    const n = stripAccents(folderName.toLowerCase()).trim();

    const yearMatch = n.match(/(19|20)\d{2}/);
    if (!yearMatch) {
      return null;
    }
    const year = yearMatch[0];

    let month: number | null = null;
    for (const [name, value] of Object.entries(MONTHS)) {
      if (new RegExp(`(^|[^a-z])${name}([^a-z]|$)`).test(n)) {
        month = value;
        break;
      }
    }

    if (month === null) {
      const withoutYear = n.replace(year, ' ');
      const numMatch = withoutYear.match(/(?:^|[^0-9])(0?[1-9]|1[0-2])(?:[^0-9]|$)/);
      if (numMatch) {
        month = Number.parseInt(numMatch[1], 10);
      }
    }

    if (month === null) {
      return null;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  /** Reconstruye el nombre de carpeta a partir de la clave y el formato. */
  render(key: string, format: MonthFormat): string {
    const [year, mm] = key.split('-');
    const idx = Number.parseInt(mm, 10);
    switch (format) {
      case 'Mes-Año':
        return `${MONTH_NAMES[idx]}-${year}`;
      case 'MM-AAAA':
        return `${mm}-${year}`;
      case 'AAAA-MM':
      default:
        return `${year}-${mm}`;
    }
  }
}
