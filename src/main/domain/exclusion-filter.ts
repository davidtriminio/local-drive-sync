/** Convierte un patrón glob simple (*, ?) en expresión regular anclada. */
function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

/** Filtro de exclusiones por nombre de archivo/carpeta. */
export class ExclusionFilter {
  private readonly regexes: RegExp[];

  constructor(patterns: string[]) {
    this.regexes = patterns
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map(globToRegExp);
  }

  /** true si el nombre (base) o la ruta relativa coincide con algún patrón. */
  excludes(relPathOrName: string): boolean {
    const base = relPathOrName.split(/[\\/]/).pop() ?? relPathOrName;
    return this.regexes.some((r) => r.test(base) || r.test(relPathOrName));
  }
}
