import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';
import { registerIpcHandlers } from './ipc';
import { IpcChannels } from '../shared/ipc-contract';

/** En desarrollo cargamos el dev-server de Angular; en producción, el build estático. */
const isDev = !app.isPackaged && process.env['NODE_ENV'] === 'development';
const DEV_SERVER_URL = 'http://localhost:4200';

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();
  });

  // F11 alterna pantalla completa.
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      mainWindow?.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  // Notifica al renderer cada cambio de estado (F11, botón o nativo).
  const notifyFullScreen = (value: boolean): void => {
    mainWindow?.webContents.send(IpcChannels.windowFullScreenChanged, value);
  };
  mainWindow.on('enter-full-screen', () => notifyFullScreen(true));
  mainWindow.on('leave-full-screen', () => notifyFullScreen(false));

  if (isDev) {
    await mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(
      path.join(__dirname, '../renderer/browser/index.html'),
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  registerIpcHandlers({
    getWindow: () => mainWindow,
    dataDir: app.getPath('userData'),
  });
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
