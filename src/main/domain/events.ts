import type { EventItem } from '../../shared/ipc-contract';

/**
 * Catálogo integrado de feriados y fechas relevantes de Honduras para un
 * estudio gráfico. Recurrentes por mes/día; las de fecha variable (Semana
 * Santa, Día de la Madre/Padre) se marcan con `variable` y una nota.
 *
 * Es dato de dominio (no una plantilla intercambiable), por eso vive en código
 * y no en `resources/`. El usuario asocia clientes y puede editar icono/color;
 * esos cambios se guardan como override en la persistencia sin duplicar esta
 * lista. Los `clients` aquí siempre van vacíos (se rellenan desde el store).
 */
const CATALOG: readonly Omit<EventItem, 'clients' | 'builtin'>[] = [
  { id: 'hn-ano-nuevo', name: 'Año Nuevo', month: 1, day: 1, variable: false, icon: 'sparkles', color: '#fbbf24' },
  { id: 'hn-san-valentin', name: 'San Valentín (Amor y Amistad)', month: 2, day: 14, variable: false, icon: 'heart', color: '#fb7185' },
  { id: 'hn-semana-santa', name: 'Semana Santa', month: 4, day: 1, variable: true, note: 'Marzo/abril (varía cada año)', icon: 'book', color: '#a78bfa' },
  { id: 'hn-dia-americas', name: 'Día de las Américas', month: 4, day: 14, variable: false, icon: 'globe', color: '#38bdf8' },
  { id: 'hn-dia-trabajo', name: 'Día del Trabajo', month: 5, day: 1, variable: false, icon: 'briefcase', color: '#2dd4bf' },
  { id: 'hn-dia-madre', name: 'Día de la Madre', month: 5, day: 11, variable: true, note: '2.º domingo de mayo', icon: 'heart', color: '#f472b6' },
  { id: 'hn-dia-padre', name: 'Día del Padre', month: 6, day: 15, variable: true, note: '3.er domingo de junio', icon: 'star', color: '#818cf8' },
  { id: 'hn-dia-nino', name: 'Día del Niño', month: 9, day: 10, variable: false, icon: 'gamepad', color: '#22d3ee' },
  { id: 'hn-independencia', name: 'Día de la Independencia', month: 9, day: 15, variable: false, icon: 'flag', color: '#38bdf8' },
  { id: 'hn-dia-maestro', name: 'Día del Maestro', month: 9, day: 17, variable: false, icon: 'book', color: '#fb923c' },
  { id: 'hn-morazan', name: 'Día de Morazán', month: 10, day: 3, variable: false, icon: 'crown', color: '#fbbf24' },
  { id: 'hn-dia-raza', name: 'Día de la Raza', month: 10, day: 12, variable: false, icon: 'globe', color: '#fb923c' },
  { id: 'hn-fuerzas-armadas', name: 'Día de las Fuerzas Armadas', month: 10, day: 21, variable: false, icon: 'flag', color: '#a3e635' },
  { id: 'hn-halloween', name: 'Halloween', month: 10, day: 31, variable: false, icon: 'ghost', color: '#fb923c' },
  { id: 'hn-navidad', name: 'Navidad', month: 12, day: 25, variable: false, icon: 'gift', color: '#fb7185' },
  { id: 'hn-fin-ano', name: 'Fin de Año', month: 12, day: 31, variable: false, icon: 'sparkles', color: '#fbbf24' },
] as const;

/** Ids del catálogo integrado, para distinguirlos de los personalizados. */
export const BUILTIN_EVENT_IDS: ReadonlySet<string> = new Set(
  CATALOG.map((e) => e.id),
);

/** Ordena por mes y día (los variables se ordenan por su día representativo). */
function byDate(a: EventItem, b: EventItem): number {
  return a.month - b.month || a.day - b.day;
}

/**
 * Fusiona el catálogo integrado con los eventos guardados en persistencia.
 *
 * - Para un evento integrado, el store puede aportar override de `clients`,
 *   `icon` y `color`; el resto (nombre, fecha) siempre viene del catálogo.
 * - Los eventos personalizados (id no integrado) se añaden tal cual.
 */
export function mergeHondurasEvents(stored: EventItem[]): EventItem[] {
  const overrides = new Map(stored.map((e) => [e.id, e]));

  const builtin: EventItem[] = CATALOG.map((base) => {
    const ov = overrides.get(base.id);
    return {
      ...base,
      clients: ov?.clients ?? [],
      icon: ov?.icon ?? base.icon,
      color: ov?.color ?? base.color,
      builtin: true,
    };
  });

  const custom: EventItem[] = stored
    .filter((e) => !BUILTIN_EVENT_IDS.has(e.id))
    .map((e) => ({ ...e, builtin: false }));

  return [...builtin, ...custom].sort(byDate);
}
