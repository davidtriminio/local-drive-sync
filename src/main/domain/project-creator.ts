import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DEFAULT_SUBFOLDERS,
  type CreateProjectRequest,
  type CreateProjectResult,
  type Platform,
} from '../../shared/ipc-contract';

const EXPORT_RULES_TEMPLATE = `
EXPORT NAME FORMAT
------------------
client_project_date_version_format_size_usage.ext

EXAMPLES:
{client}_{project}_{date}_instagram_1080x1080_feed.jpg
`;

/** Convierte a minúsculas y reemplaza espacios por guiones bajos. */
export function sanitizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

/** Fecha local en formato YYYY-MM-DD. */
function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Nombre de plantilla PSD para una plataforma: base-<plataforma>.psd */
function psdTemplateFor(platformName: string): string {
  return `base-${sanitizeName(platformName)}.psd`;
}

/**
 * Crea la estructura de un proyecto gráfico y copia las plantillas base.
 *
 * Espejo de la lógica del proyecto Python (`core/file_generator.py`), adaptada
 * a la arquitectura del proyecto actual. No mantiene contador de "posts": en su
 * lugar avisa si ya existe un proyecto del mismo cliente+proyecto en el mes.
 */
export class ProjectCreator {
  constructor(private readonly templatesDir: string) {}

  /**
   * Crea el proyecto. Si existe un duplicado del mismo mes y no se confirma,
   * devuelve `{ status: 'duplicate' }` sin escribir nada.
   */
  create(req: CreateProjectRequest): CreateProjectResult {
    const clientClean = sanitizeName(req.client);
    const projectClean = sanitizeName(req.project);
    const date = today();
    const month = date.slice(0, 7); // YYYY-MM

    // Aviso de duplicado: misma carpeta cliente_proyecto en el mismo mes.
    const duplicate = this.findMonthDuplicate(
      req.basePath,
      clientClean,
      projectClean,
      month,
    );
    if (duplicate && !req.confirmDuplicate) {
      return { status: 'duplicate', existingFolder: duplicate };
    }

    const folderName = this.resolveFolderName(
      req.basePath,
      `${clientClean}_${projectClean}_${date}`,
    );
    const projectPath = path.join(req.basePath, folderName);
    const log: string[] = [`CREATION LOG - ${new Date().toISOString()}`];
    log.push(`Project folder: ${folderName}`);

    fs.mkdirSync(projectPath, { recursive: true });

    const subfolders =
      req.subfolders && req.subfolders.length > 0
        ? req.subfolders
        : [...DEFAULT_SUBFOLDERS];
    for (const sub of subfolders) {
      fs.mkdirSync(path.join(projectPath, sub), { recursive: true });
      log.push(`CREATED: ${sub}`);
    }

    // Copia de plantillas PSD por plataforma seleccionada.
    if (req.fileTypes.includes('psd')) {
      const psdDir = path.join(projectPath, '04_workfiles', 'psd');
      fs.mkdirSync(psdDir, { recursive: true });
      for (const platform of req.platforms) {
        const templateName = psdTemplateFor(platform);
        const src = path.join(this.templatesDir, templateName);
        if (fs.existsSync(src)) {
          const dest = path.join(psdDir, templateName);
          fs.copyFileSync(src, dest);
          log.push(`COPIED: ${templateName} -> 04_workfiles/psd/`);
        } else {
          log.push(`MISSING TEMPLATE: ${templateName}`);
        }
      }
    }

    // Copia de plantilla AI.
    if (req.fileTypes.includes('ai')) {
      const aiDir = path.join(projectPath, '04_workfiles', 'ai');
      fs.mkdirSync(aiDir, { recursive: true });
      const src = path.join(this.templatesDir, 'base.ai');
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(aiDir, 'base.ai'));
        log.push('COPIED: base.ai -> 04_workfiles/ai/');
      } else {
        log.push('MISSING TEMPLATE: base.ai');
      }
    }

    // Reglas de exportación.
    if (subfolders.some((s) => s.startsWith('05_exports'))) {
      const exportsDir = path.join(projectPath, '05_exports');
      fs.mkdirSync(exportsDir, { recursive: true });
      fs.writeFileSync(
        path.join(exportsDir, 'EXPORT_RULES.txt'),
        EXPORT_RULES_TEMPLATE,
        'utf-8',
      );
      log.push('CREATED: 05_exports/EXPORT_RULES.txt');
    }

    fs.writeFileSync(
      path.join(projectPath, 'creation_log.txt'),
      log.join('\n'),
      'utf-8',
    );

    return { status: 'created', folderName, projectPath, log };
  }

  /** Carga el catálogo de plataformas desde un platforms.json. */
  static loadPlatforms(platformsFile: string): Platform[] {
    try {
      const raw = fs.readFileSync(platformsFile, 'utf-8');
      const parsed = JSON.parse(raw) as Record<
        string,
        { sigla: string; formats: Record<string, string> }
      >;
      return Object.entries(parsed).map(([name, def]) => ({
        name,
        sigla: def.sigla,
        formats: def.formats ?? {},
      }));
    } catch {
      return [];
    }
  }

  /** Busca una carpeta previa del mismo cliente+proyecto creada este mes. */
  private findMonthDuplicate(
    basePath: string,
    clientClean: string,
    projectClean: string,
    month: string,
  ): string | null {
    const prefix = `${clientClean}_${projectClean}_${month}`;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(basePath, { withFileTypes: true });
    } catch {
      return null;
    }
    const match = entries.find(
      (e) => e.isDirectory() && e.name.startsWith(prefix),
    );
    return match ? match.name : null;
  }

  /**
   * Devuelve un nombre de carpeta libre. Sin sufijo de versión; si el nombre
   * exacto ya existe (misma fecha), añade `_2`, `_3`… para no sobrescribir.
   */
  private resolveFolderName(basePath: string, baseName: string): string {
    if (!fs.existsSync(path.join(basePath, baseName))) {
      return baseName;
    }
    let n = 2;
    while (fs.existsSync(path.join(basePath, `${baseName}_${n}`))) {
      n += 1;
    }
    return `${baseName}_${n}`;
  }
}
