/**
 * Electron main process for the DeepSeek Harness desktop application.
 * @module @deepseek-ai/dsh-desktop/main
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, ipcMain, Menu, screen, shell, type Rectangle } from 'electron'
import { startBackend, type BackendHandle, type BackendStage } from './backend.ts'

const moduleDirectory = fileURLToPath(new URL('.', import.meta.url))
const workspaceRoot = resolve(moduleDirectory, '..', '..', '..')
const rendererPath = resolve(moduleDirectory, 'renderer', 'index.html')
const preloadPath = resolve(moduleDirectory, 'preload.cjs')
const repositoryUrl = 'https://github.com/deepseek-ai/deepseek-harness'

let mainWindow: BrowserWindow | undefined
let backend: BackendHandle | undefined
let startupGeneration = 0
let quitting = false

interface StoredWindowState extends Partial<Rectangle> {
  maximized?: boolean
}

function statePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

function readWindowState(): StoredWindowState {
  const path = statePath()
  if (!existsSync(path)) return {}
  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as StoredWindowState
    const validNumbers = [value.x, value.y, value.width, value.height]
      .every(item => item === undefined || Number.isFinite(item))
    return validNumbers ? value : {}
  } catch (error) {
    console.warn('desktop: ignoring unreadable window state', error)
    return {}
  }
}

function persistWindowState(window: BrowserWindow): void {
  if (window.isDestroyed()) return
  const bounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds()
  writeFileSync(statePath(), JSON.stringify({ ...bounds, maximized: window.isMaximized() }), 'utf8')
}

function restoreBounds(state: StoredWindowState): Partial<Rectangle> {
  if (state.x === undefined || state.y === undefined || state.width === undefined || state.height === undefined) return {}
  const candidate = { x: state.x, y: state.y, width: state.width, height: state.height }
  const display = screen.getDisplayMatching(candidate)
  const visibleWidth = Math.min(candidate.x + candidate.width, display.workArea.x + display.workArea.width)
    - Math.max(candidate.x, display.workArea.x)
  const visibleHeight = Math.min(candidate.y + candidate.height, display.workArea.y + display.workArea.height)
    - Math.max(candidate.y, display.workArea.y)
  return visibleWidth >= 240 && visibleHeight >= 160 ? candidate : {}
}

function sendStage(stage: BackendStage): void {
  if (mainWindow?.isDestroyed() === false) mainWindow.webContents.send('desktop:stage', stage)
}

function configureNavigation(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler((details) => {
    const url = new URL(details.url)
    if (['https:', 'http:'].includes(url.protocol)) void shell.openExternal(details.url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, target) => {
    const url = new URL(target)
    if (url.protocol === 'file:' || ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return
    event.preventDefault()
    if (['https:', 'http:'].includes(url.protocol)) void shell.openExternal(target)
  })
}

function createApplicationMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { role: 'editMenu' },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
        ...(!app.isPackaged ? [{ role: 'toggleDevTools' as const, label: '开发者工具' }] : []),
      ],
    },
    { role: 'windowMenu' },
    {
      label: '帮助',
      submenu: [
        { label: 'DeepSeek Harness GitHub', click: () => void shell.openExternal(repositoryUrl) },
        {
          label: '查看启动日志',
          click: () => {
            if (backend !== undefined) shell.showItemInFolder(backend.logPath)
          },
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function showStartupPage(): Promise<void> {
  if (mainWindow === undefined || mainWindow.isDestroyed()) return
  await mainWindow.loadFile(rendererPath)
}

async function bootBackend(): Promise<void> {
  const generation = ++startupGeneration
  backend?.stop()
  backend = undefined
  await showStartupPage()
  try {
    const handle = await startBackend({
      logPath: join(app.getPath('logs'), 'desktop-backend.log'),
      workspaceRoot,
      onStage: sendStage,
    })
    if (generation !== startupGeneration || quitting) {
      handle.stop()
      return
    }
    backend = handle
    sendStage({
      phase: 'ready',
      title: '工作台已就绪',
      detail: '正在进入 DeepSeek Harness',
      progress: 100,
      logPath: handle.logPath,
    })
    await new Promise(resolveDelay => setTimeout(resolveDelay, 240))
    await mainWindow?.loadURL(handle.url)
  } catch (error) {
    if (generation !== startupGeneration || quitting) return
    const detail = error instanceof Error ? error.message : String(error)
    sendStage({
      phase: 'error',
      title: '本地服务启动失败',
      detail,
      progress: 100,
      logPath: join(app.getPath('logs'), 'desktop-backend.log'),
    })
  }
}

function registerIpc(): void {
  ipcMain.handle('desktop:get-state', () => ({
    maximized: mainWindow?.isMaximized() ?? false,
    platform: process.platform,
    version: app.getVersion(),
  }))
  ipcMain.handle('desktop:window', (_event, action: string) => {
    if (mainWindow === undefined || mainWindow.isDestroyed()) return false
    switch (action) {
      case 'minimize': mainWindow.minimize(); return true
      case 'maximize':
        if (mainWindow.isMaximized()) mainWindow.unmaximize()
        else mainWindow.maximize()
        return true
      case 'close': mainWindow.close(); return true
      default: return false
    }
  })
  ipcMain.handle('desktop:restart', async () => {
    await bootBackend()
  })
  ipcMain.handle('desktop:open-log', () => {
    const path = backend?.logPath ?? join(app.getPath('logs'), 'desktop-backend.log')
    shell.showItemInFolder(path)
  })
  ipcMain.handle('desktop:open-project', () => {
    void shell.openExternal(repositoryUrl)
  })
}

function createWindow(): BrowserWindow {
  const saved = readWindowState()
  const window = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    frame: false,
    roundedCorners: true,
    backgroundColor: '#0b0d12',
    title: 'DeepSeek Harness',
    ...restoreBounds(saved),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: true,
    },
  })
  configureNavigation(window)
  window.once('ready-to-show', () => {
    if (saved.maximized === true) window.maximize()
    window.show()
  })
  window.on('maximize', () => {
    window.webContents.send('desktop:maximized', true)
  })
  window.on('unmaximize', () => {
    window.webContents.send('desktop:maximized', false)
  })
  window.on('close', () => {
    persistWindowState(window)
  })
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined
  })
  if (process.platform !== 'darwin') window.setMenuBarVisibility(false)
  return window
}

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow === undefined) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId('com.deepseek.harness.desktop')
    createApplicationMenu()
    registerIpc()
    mainWindow = createWindow()
    void bootBackend()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length > 0) return
    mainWindow = createWindow()
    void bootBackend()
  })
}

app.on('before-quit', () => {
  quitting = true
  startupGeneration += 1
  backend?.stop()
  backend = undefined
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
