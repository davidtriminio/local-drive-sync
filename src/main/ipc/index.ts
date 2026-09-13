import { app, ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-contract';

/**
 * Registra todos los handlers IPC del proceso main.
 *
 * Cada handler valida sus argumentos y nunca confía en el renderer. En esta
 * fase solo se expone la versión de la app; los handlers de dominio (scan,
 * sync, history, trash...) se añadirán aquí a medida que se implementen.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.appGetVersion, () => app.getVersion());
}
