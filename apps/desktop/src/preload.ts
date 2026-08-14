/**
 * Isolated desktop bridge and native title bar injection.
 * @module @deepseek-ai/dsh-desktop/preload
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { BackendStage } from './backend.ts'

interface DesktopState {
  maximized: boolean
  platform: NodeJS.Platform
  version: string
}

type WindowAction = 'minimize' | 'maximize' | 'close'

const api = {
  getState: async (): Promise<DesktopState> => await ipcRenderer.invoke('desktop:get-state') as DesktopState,
  windowAction: async (action: WindowAction): Promise<boolean> => await ipcRenderer.invoke('desktop:window', action) as boolean,
  restart: async (): Promise<void> => await ipcRenderer.invoke('desktop:restart') as void,
  openLog: async (): Promise<void> => await ipcRenderer.invoke('desktop:open-log') as void,
  openProject: async (): Promise<void> => await ipcRenderer.invoke('desktop:open-project') as void,
  onStage: (listener: (stage: BackendStage) => void): void => {
    const wrapped = (_event: Electron.IpcRendererEvent, stage: BackendStage): void => {
      listener(stage)
    }
    ipcRenderer.on('desktop:stage', wrapped)
  },
  onMaximized: (listener: (maximized: boolean) => void): void => {
    const wrapped = (_event: Electron.IpcRendererEvent, maximized: boolean): void => {
      listener(maximized)
    }
    ipcRenderer.on('desktop:maximized', wrapped)
  },
}

contextBridge.exposeInMainWorld('dshDesktop', api)

function svgIcon(path: string): string {
  return `<svg aria-hidden="true" viewBox="0 0 20 20"><path d="${path}"/></svg>`
}

function injectDesktopChrome(): void {
  if (!['http:', 'https:'].includes(location.protocol)) return
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) return
  const style = document.createElement('style')
  style.textContent = `
    :root { --dsh-desktop-titlebar-height: 44px; }
    html, body { height: 100%; overflow: hidden; }
    body { padding-top: var(--dsh-desktop-titlebar-height) !important; box-sizing: border-box; }
    #root { height: calc(100vh - var(--dsh-desktop-titlebar-height)) !important; min-height: 0 !important; }
    .dsh-desktop-titlebar { position: fixed; inset: 0 0 auto 0; z-index: 2147483647; height: var(--dsh-desktop-titlebar-height); display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; color: rgba(245,247,255,.9); background: color-mix(in srgb, #0c0f16 91%, transparent); border-bottom: 1px solid rgba(255,255,255,.075); backdrop-filter: blur(22px) saturate(150%); -webkit-app-region: drag; font-family: Inter, "SF Pro Display", "Segoe UI", sans-serif; user-select: none; }
    .dsh-desktop-brand { justify-self: start; display: flex; align-items: center; gap: 10px; padding-left: 16px; font-size: 12px; font-weight: 650; letter-spacing: -.01em; }
    .dsh-desktop-brandmark { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; background: linear-gradient(145deg,#6786ff,#4a58e8); box-shadow: 0 0 22px rgba(84,105,255,.32), inset 0 1px rgba(255,255,255,.28); }
    .dsh-desktop-brandmark svg { width: 14px; fill: white; }
    .dsh-desktop-environment { justify-self: center; display: flex; align-items: center; gap: 7px; color: rgba(220,225,240,.58); font: 600 10px/1 "Segoe UI",sans-serif; letter-spacing: .12em; text-transform: uppercase; }
    .dsh-desktop-environment::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #65d9a5; box-shadow: 0 0 10px rgba(101,217,165,.65); }
    .dsh-desktop-controls { justify-self: end; align-self: stretch; display: flex; -webkit-app-region: no-drag; }
    .dsh-desktop-control { width: 46px; border: 0; color: rgba(238,241,250,.72); background: transparent; display: grid; place-items: center; transition: background .16s ease,color .16s ease; }
    .dsh-desktop-control:hover { color: white; background: rgba(255,255,255,.08); }
    .dsh-desktop-control[data-action="close"]:hover { background: #e5484d; }
    .dsh-desktop-control svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.45; }
    @media (prefers-color-scheme: light) {
      .dsh-desktop-titlebar { color: #171a24; background: color-mix(in srgb,#f7f8fc 92%,transparent); border-bottom-color: rgba(16,24,40,.08); }
      .dsh-desktop-environment { color: rgba(36,42,58,.55); }
      .dsh-desktop-control { color: rgba(26,31,45,.68); }
      .dsh-desktop-control:hover { color:#11131a; background:rgba(16,24,40,.07); }
      .dsh-desktop-control[data-action="close"]:hover { color:white; }
    }
  `
  document.head.append(style)

  const titlebar = document.createElement('header')
  titlebar.className = 'dsh-desktop-titlebar'
  titlebar.setAttribute('aria-label', '桌面窗口')
  titlebar.innerHTML = `
    <div class="dsh-desktop-brand">
      <span class="dsh-desktop-brandmark">${svgIcon('M5 4h4.2c3.8 0 6 2.15 6 6s-2.2 6-6 6H5V4Zm3 3v6h1.1c2 0 3.05-1.04 3.05-3S11.1 7 9.1 7H8Z')}</span>
      <span>DeepSeek Harness</span>
    </div>
    <div class="dsh-desktop-environment">Local workspace</div>
    <div class="dsh-desktop-controls">
      <button class="dsh-desktop-control" data-action="minimize" aria-label="最小化"><svg viewBox="0 0 16 16"><path d="M3 8.5h10"/></svg></button>
      <button class="dsh-desktop-control" data-action="maximize" aria-label="最大化"><svg viewBox="0 0 16 16"><rect x="3.5" y="3.5" width="9" height="9" rx=".5"/></svg></button>
      <button class="dsh-desktop-control" data-action="close" aria-label="关闭"><svg viewBox="0 0 16 16"><path d="m4 4 8 8m0-8-8 8"/></svg></button>
    </div>
  `
  titlebar.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', () => void api.windowAction(button.dataset.action as WindowAction))
  })
  document.body.prepend(titlebar)
}

window.addEventListener('DOMContentLoaded', injectDesktopChrome, { once: true })
