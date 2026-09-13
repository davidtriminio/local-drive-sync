/**
 * Contrato IPC compartido entre el proceso main y el preload.
 *
 * Fuente única de verdad para los nombres de canal y los tipos de la API
 * expuesta al renderer. El renderer consume una versión mínima de `Api`
 * a través de `window.api` (ver src/renderer/types/global.d.ts).
 *
 * En esta fase (andamiaje) solo existe `app:getVersion`. Los canales de
 * dominio (scan, sync, history, trash, ...) se irán añadiendo aquí conforme
 * se implementen, manteniendo este archivo como la definición canónica.
 */

export const IpcChannels = {
  appGetVersion: 'app:getVersion',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

/** Superficie que el preload expone al renderer vía contextBridge. */
export interface Api {
  /** Versión de la aplicación (desde package.json, leída en el main). */
  getAppVersion(): Promise<string>;
}
