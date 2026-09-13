import * as fs from 'node:fs';
import * as path from 'node:path';
import { ExclusionFilter } from './exclusion-filter';

export interface ScannedFile {
  /** Ruta relativa con separador '/' (comparable entre lados). */
  relPath: string;
  size: number;
  mtimeMs: number;
}

/**
 * Recorre recursivamente un directorio devolviendo solo metadatos
 * (ruta, tamaño, fecha). No lee contenido ni calcula hash, por lo que no
 * materializa placeholders de Google Drive (modo Stream).
 */
export class Scanner {
  constructor(private readonly exclusions: ExclusionFilter) {}

  scan(root: string): ScannedFile[] {
    const out: ScannedFile[] = [];
    this.walk(root, '', out);
    return out;
  }

  private walk(dir: string, rel: string, out: ScannedFile[]): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (this.exclusions.excludes(entry.name)) {
        continue;
      }
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this.walk(abs, childRel, out);
      } else if (entry.isFile()) {
        try {
          const st = fs.statSync(abs);
          out.push({ relPath: childRel, size: st.size, mtimeMs: st.mtimeMs });
        } catch {
          /* archivo inaccesible: se omite */
        }
      }
    }
  }
}
