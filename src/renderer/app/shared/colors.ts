/**
 * Paleta curada de colores de acento para badges (clientes y mapeos).
 * Se guarda el hex directamente en el modelo; los estilos se aplican inline
 * para no depender de clases dinámicas de Tailwind (que se purgarían).
 */
export const BADGE_COLORS: readonly string[] = [
  '#34d399', // emerald
  '#2dd4bf', // teal
  '#22d3ee', // cyan
  '#38bdf8', // sky
  '#818cf8', // indigo
  '#a78bfa', // violet
  '#e879f9', // fuchsia
  '#f472b6', // pink
  '#fb7185', // rose
  '#fbbf24', // amber
  '#fb923c', // orange
  '#a3e635', // lime
] as const;

/** Color por defecto cuando un elemento aún no tiene uno asignado. */
export const DEFAULT_COLOR = BADGE_COLORS[0];

/** Estilo de un "chip" de icono tintado con el color (fondo suave + color). */
export function chipStyle(color: string): Record<string, string> {
  const c = color || DEFAULT_COLOR;
  return { background: `${c}22`, color: c };
}

/** Estilo de un badge según si está activo (relleno) o no (tinte suave). */
export function badgeStyle(
  color: string,
  active: boolean,
): Record<string, string> {
  const c = color || DEFAULT_COLOR;
  return active
    ? { background: c, color: '#0b1120', borderColor: c }
    : { background: `${c}1f`, color: c, borderColor: `${c}55` };
}
