import * as fs from 'node:fs';
import * as path from 'node:path';
import { MonthNormalizer } from './month-normalizer';
import {
  DEFAULT_SUBFOLDERS,
  type CreateProjectRequest,
  type CreateProjectResult,
  type MonthFormat,
  type PlatformFormatSelection,
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

function sanitizeKey(name: string): string {
  return sanitizeName(name)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Si la ruta no usa `{mes}` pero contiene una carpeta con nombre de mes
 * (p. ej. "...\Septiembre-2026", típico al elegirla con el selector), la
 * última de esas carpetas se sustituye por `{mes}` para que rote sola.
 */
export function toMonthTemplate(basePath: string): string {
  if (!basePath || /\{mes\}/i.test(basePath)) {
    return basePath;
  }
  const normalizer = new MonthNormalizer();
  const parts = basePath.split(/([\\/]+)/); // conserva los separadores
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (parts[i] && !/^[\\/]+$/.test(parts[i]) && normalizer.toKey(parts[i])) {
      parts[i] = '{mes}';
      return parts.join('');
    }
  }
  return basePath;
}

/**
 * Formato de mes (el de la carpeta que `toMonthTemplate` sustituiría) para que
 * las carpetas nuevas conserven el mismo estilo de nombre; null si no hay.
 */
export function detectMonthFormat(basePath: string): MonthFormat | null {
  if (!basePath || /\{mes\}/i.test(basePath)) {
    return null;
  }
  const normalizer = new MonthNormalizer();
  const parts = basePath.split(/[\\/]+/);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (parts[i] && normalizer.toKey(parts[i])) {
      if (/[a-z]/i.test(parts[i])) {
        return 'Mes-Año';
      }
      return /^\d{4}/.test(parts[i].trim()) ? 'AAAA-MM' : 'MM-AAAA';
    }
  }
  return null;
}

/**
 * Resuelve el token `{mes}` de una ruta al mes actual (formato "Mes-Año",
 * p. ej. "Septiembre-2026"). Si no hay token, devuelve la ruta sin cambios.
 */
export function resolveMonthToken(basePath: string, date?: string): string {
  basePath = toMonthTemplate(basePath);
  if (!/\{mes\}/i.test(basePath)) {
    return basePath;
  }
  // Deriva la clave de mes de la fecha dada (AAAA-MM-DD) o del mes actual.
  const key =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date.slice(0, 7)
      : (() => {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        })();
  const month = new MonthNormalizer().render(key, 'Mes-Año');
  return basePath.replace(/\{mes\}/gi, month);
}

/** Valida una fecha AAAA-MM-DD; si no es válida, devuelve la de hoy. */
function resolveDate(date?: string): string {
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today();
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

function psdTemplateForFormat(selection: PlatformFormatSelection): string {
  const platform = sanitizeKey(selection.platform);
  const format = sanitizeKey(selection.format);
  if (!format || ['feed', 'feed_square', 'publicacion_normal'].includes(format)) {
    return `base-${platform}.psd`;
  }
  return `base-${platform}-${format}.psd`;
}

function psdOutputName(folderName: string, name: string, total: number): string {
  return total > 1
    ? `${folderName}_${sanitizeKey(name)}.psd`
    : `${folderName}.psd`;
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
    const date = resolveDate(req.date);
    const month = date.slice(0, 7); // YYYY-MM

    // Resuelve {mes} según la fecha dada y asegura que la carpeta base exista.
    const basePath = resolveMonthToken(req.basePath, date);
    fs.mkdirSync(basePath, { recursive: true });

    // Aviso de duplicado: misma carpeta cliente_proyecto en el mismo mes.
    const duplicate = this.findMonthDuplicate(
      basePath,
      clientClean,
      projectClean,
      month,
    );
    if (duplicate && !req.confirmDuplicate) {
      return { status: 'duplicate', existingFolder: duplicate };
    }

    const folderName = this.resolveFolderName(
      basePath,
      `${clientClean}_${projectClean}_${date}`,
    );
    const projectPath = path.join(basePath, folderName);
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

    // Si solo se genera un tipo de archivo, va directo a 04_workfiles/ (sin
    // subcarpeta psd|ai); con varios tipos, cada uno en su subcarpeta.
    const singleType = req.fileTypes.length === 1;
    const workfiles = path.join(projectPath, '04_workfiles');

    // Copia de plantillas PSD por plataforma seleccionada.
    if (req.fileTypes.includes('psd')) {
      const psdDir = singleType ? workfiles : path.join(workfiles, 'psd');
      fs.mkdirSync(psdDir, { recursive: true });
      const rel = singleType ? '04_workfiles/' : '04_workfiles/psd/';
      const selections = this.psdSelections(req);
      for (const selection of selections) {
        const templateName = selection.format
          ? psdTemplateForFormat(selection)
          : psdTemplateFor(selection.platform);
        const src = path.join(this.templatesDir, templateName);
        const outputName = psdOutputName(
          folderName,
          selection.format || selection.platform,
          selections.length,
        );
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(psdDir, outputName));
          log.push(`COPIED: ${templateName} -> ${rel}${outputName}`);
        } else {
          log.push(`MISSING TEMPLATE: ${templateName}`);
        }
      }
    }

    // Copia de plantilla AI.
    if (req.fileTypes.includes('ai')) {
      const aiDir = singleType ? workfiles : path.join(workfiles, 'ai');
      fs.mkdirSync(aiDir, { recursive: true });
      const rel = singleType ? '04_workfiles/' : '04_workfiles/ai/';
      const src = path.join(this.templatesDir, 'base.ai');
      if (fs.existsSync(src)) {
        const outputName = `${folderName}.ai`;
        fs.copyFileSync(src, path.join(aiDir, outputName));
        log.push(`COPIED: base.ai -> ${rel}${outputName}`);
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

  private psdSelections(req: CreateProjectRequest): PlatformFormatSelection[] {
    if (req.formats && req.formats.length > 0) {
      return req.formats;
    }
    return req.platforms.map((platform) => ({ platform, format: '', size: '' }));
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
