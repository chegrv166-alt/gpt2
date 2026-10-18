import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const entry = path.resolve(__dirname, '../dist/index.html');
let window: BrowserWindow | null = null;

function isLocalView(target: string): boolean {
  try {
    const url = new URL(target);
    return url.protocol === 'file:' && path.resolve(fileURLToPath(url)) === entry;
  } catch { return false; }
}

async function createWindow(): Promise<void> {
  window = new BrowserWindow({
    title: 'Ashen Covenant', width: 1440, height: 940, minWidth: 900, minHeight: 640,
    backgroundColor: '#101814', show: false, autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, spellcheck: false, devTools: !app.isPackaged },
  });
  window.setMenu(null);
  window.once('ready-to-show', () => window?.show());
  window.once('closed', () => { window = null; });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, target) => { if (!isLocalView(target)) event.preventDefault(); });
  window.webContents.on('will-redirect', (event, target) => { if (!isLocalView(target)) event.preventDefault(); });
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11' && !input.isAutoRepeat) {
      event.preventDefault();
      if (window) window.setFullScreen(!window.isFullScreen());
    }
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason !== 'clean-exit') dialog.showErrorBox('Ashen Covenant', 'Игровое окно завершилось. Закройте игру и запустите её снова.');
  });
  await window.loadFile(entry, { query: { desktop: '1' } });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore();
    window?.show(); window?.focus();
  });
  app.whenReady().then(createWindow).catch((error: unknown) => {
    dialog.showErrorBox('Не удалось запустить Ashen Covenant', String(error));
    app.exit(1);
  });
  app.on('activate', () => { if (!window) void createWindow(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
