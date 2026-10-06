/**
 * Clave comparable de un nombre: sin tildes, en minúsculas y con cualquier
 * secuencia de separadores (espacios, guiones, puntos…) como un solo `_`.
 */
export function matchKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
}
