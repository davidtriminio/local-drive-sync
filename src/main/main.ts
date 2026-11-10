import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron';
import * as path from 'node:path';
import { appIconPath } from './resources';
import { registerIpcHandlers, type IpcHandles } from './ipc';
import { IpcChannels } from '../shared/ipc-contract';

/** En desarrollo cargamos el dev-server de Angular; en producción, el build estático. */
const isDev = !app.isPackaged && process.env['NODE_ENV'] === 'development';
const DEV_SERVER_URL = 'http://localhost:4200';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let handles: IpcHandles | null = null;
/** true cuando se pidió salir de verdad (menú del tray o before-quit). */
let isQuitting = false;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0f172a',
    icon: nativeImage.createFromPath(appIconPath()),
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

  // Cerrar (X): si el ajuste lo pide, oculta a la bandeja en vez de salir.
  mainWindow.on('close', (event) => {
    if (!isQuitting && handles?.shouldMinimizeToTray()) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

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

/** Muestra y enfoca la ventana, recreándola si ya se había destruido. */
function showWindow(): void {
  if (!mainWindow) {
    void createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

/** Crea el icono de bandeja con su menú (Mostrar / Salir). */
function createTray(): void {
  const image = nativeImage
    .createFromPath(appIconPath())
    .resize({ width: 32, height: 32 });
  tray = new Tray(image);
  tray.setToolTip('Local Drive Sync');
  const menu = Menu.buildFromTemplate([
    { label: 'Mostrar', click: () => showWindow() },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => showWindow());
  tray.on('double-click', () => showWindow());
}

app.whenReady().then(async () => {
  handles = registerIpcHandlers({
    getWindow: () => mainWindow,
    dataDir: app.getPath('userData'),
  });
  createTray();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    } else {
      showWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  handles?.stopExportWatcher();
});

app.on('window-all-closed', () => {
  // Con cierre-a-bandeja la ventana no se destruye, así que este evento solo
  // salta cuando el usuario cerró de verdad (ajuste desactivado o salir).
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
