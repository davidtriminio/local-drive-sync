import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels, type Api } from '../shared/ipc-contract';

/**
 * Puente seguro main <-> renderer.
 *
 * Con contextIsolation + sandbox, el renderer NO tiene acceso a Node ni a
 * Electron: solo ve `window.api`, esta superficie mínima y explícita.
 */
const api: Api = {
  getAppVersion: () => ipcRenderer.invoke(IpcChannels.appGetVersion),
};

contextBridge.exposeInMainWorld('api', api);
