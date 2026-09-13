import * as fs from 'node:fs';
import * as path from 'node:path';
import { sanitizeName } from './project-creator';
import type { Client } from '../../shared/ipc-contract';

/** Estructura de un fichero history/<cliente>.json del proyecto Python. */
interface LegacyClientFile {
  client: string;
  projects: Record<string, { posts?: number }>;
}

/**
 * Lee los clientes del proyecto Python anterior (un JSON por cliente en
 * `history/`) y los convierte al modelo actual. El contador de "posts" se
 * descarta; solo se conservan cliente y nombres de proyecto.
 *
 * Devuelve `[]` si el directorio no existe o no es legible.
 */
export function importLegacyClients(historyDir: string): Client[] {
  let files: string[];
  try {
    files = fs.readdirSync(historyDir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  const clients: Client[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(historyDir, file), 'utf-8');
      const data = JSON.parse(raw) as LegacyClientFile;
      const name = sanitizeName(data.client ?? path.parse(file).name);
      if (!name) {
        continue;
      }
      const projects = Object.keys(data.projects ?? {}).map((p) => ({
        name: sanitizeName(p),
        folders: [],
      }));
      clients.push({ name, icon: 'user', projects });
    } catch {
      // Ignora ficheros corruptos; el resto se importa igual.
    }
  }
  return clients;
}
