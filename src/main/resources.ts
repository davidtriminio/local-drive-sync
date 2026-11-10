import * as path from 'node:path';
import { app } from 'electron';

/**
 * Directorio de assets del creador de proyectos (plantillas PSD/AI y
 * platforms.json).
 *
 * - En desarrollo se leen del repositorio: `<repo>/resources/creator`.
 * - Empaquetado, electron-builder los copia vía `extraResources` a
 *   `<resources>/creator`.
 */
export function creatorAssetsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'creator');
  }
  return path.join(app.getAppPath(), 'resources', 'creator');
}

/** Ruta al catálogo de plataformas. */
export function platformsFile(): string {
  return path.join(creatorAssetsDir(), 'platforms.json');
}

/** Icono de la app (ventana y bandeja): `build/icon.png` en dev, `<resources>/icon.png` empaquetado. */
export function appIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(app.getAppPath(), 'build', 'icon.png');
}
