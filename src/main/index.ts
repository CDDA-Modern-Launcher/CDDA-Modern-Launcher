import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { appendFileSync, mkdirSync } from 'fs'
import { autoUpdater } from 'electron-updater'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function logUpdater(message: string, data?: unknown): void {
  const text = data === undefined ? message : `${message} ${JSON.stringify(data)}`
  const line = `[${new Date().toISOString()}] ${text}\n`

  console.log(line.trimEnd())

  try {
    const logDir = join(app.getPath('userData'), 'logs')
    mkdirSync(logDir, { recursive: true })
    appendFileSync(join(logDir, 'updater.log'), line, 'utf8')
  } catch (error) {
    console.error('[updater] failed to write log', error)
  }
}

function setupAutoUpdater(): void {
  if (is.dev || !app.isPackaged) {
    logUpdater('[updater] skipped in dev/unpackaged mode')
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    logUpdater('[updater] checking for update')
  })

  autoUpdater.on('update-available', (info) => {
    logUpdater('[updater] update available', { version: info.version })
  })

  autoUpdater.on('update-not-available', (info) => {
    logUpdater('[updater] update not available', { version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    logUpdater('[updater] download progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    logUpdater('[updater] update downloaded', { version: info.version })

    // First-test behavior: install immediately after download.
    // Later this should be replaced with an explicit restart/update dialog.
    autoUpdater.quitAndInstall()
  })

  autoUpdater.on('error', (error) => {
    logUpdater('[updater] error', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })
  })

  autoUpdater.checkForUpdates().catch((error) => {
    logUpdater('[updater] check failed', {
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
  })
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('io.github.relvl.cdda-launcher-electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()
  setupAutoUpdater()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
