/**
 * Local web-host lifecycle used by the desktop process.
 * @module @deepseek-ai/dsh-desktop/backend
 */

import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createWriteStream, type WriteStream } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { app } from 'electron'
import { normalizeBackendUrl } from './backend-url.ts'

/** Backend startup information rendered by the desktop window. */
export interface BackendStage {
  phase: 'preparing' | 'starting' | 'connecting' | 'ready' | 'error'
  title: string
  detail: string
  progress: number
  logPath?: string
}

/** Running backend process and its loopback URL. */
export interface BackendHandle {
  url: string
  logPath: string
  stop(): void
}

interface BackendOptions {
  logPath: string
  workspaceRoot: string
  onStage(stage: BackendStage): void
}

/**
 * Reserve an available loopback port for the Harness web host.
 * @returns A currently available TCP port.
 */
export async function reserveLoopbackPort(): Promise<number> {
  return await new Promise<number>((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        server.close()
        reject(new Error('Desktop backend could not reserve a TCP port'))
        return
      }
      server.close((error) => {
        if (error === undefined) resolvePort(address.port)
        else reject(error)
      })
    })
  })
}

/**
 * Wait until the local web host accepts HTTP requests.
 * @param url - Loopback URL to probe.
 * @param timeoutMs - Maximum startup duration.
 */
export async function waitForBackend(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) })
      if (response.ok) return
      lastError = new Error(`Backend returned HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 240))
  }
  const detail = lastError instanceof Error ? lastError.message : 'unknown error'
  throw new Error(`DeepSeek Harness did not become ready within ${Math.round(timeoutMs / 1_000)} seconds: ${detail}`)
}

async function waitForPluginHostToSettle(): Promise<void> {
  // The HTTP listener becomes available just before Cordis finishes activating
  // the client plugin graph. Keeping the launch surface visible briefly avoids
  // a transient "Failed to load plugins" state on the first cold start.
  await new Promise(resolveDelay => setTimeout(resolveDelay, 1_000))
}

function writeLogHeader(stream: WriteStream): void {
  stream.write(`\n[${new Date().toISOString()}] Starting DeepSeek Harness desktop backend\n`)
}

function resolvePackagedCli(): string {
  return resolve(process.resourcesPath, 'backend', 'lib', 'bin.js')
}

function spawnDevelopmentBackend(workspaceRoot: string, port: number): ChildProcessWithoutNullStreams {
  const args = ['dsh', 'web', '--host', '127.0.0.1', '--port', String(port)]
  if (process.platform !== 'win32') return spawn('pnpm', args, { cwd: workspaceRoot })
  const command = process.env.ComSpec ?? 'cmd.exe'
  return spawn(command, ['/d', '/s', '/c', 'pnpm', ...args], {
    cwd: workspaceRoot,
    windowsHide: true,
  })
}

function spawnPackagedBackend(port: number): ChildProcessWithoutNullStreams {
  return spawn(process.execPath, ['--expose-internals', resolvePackagedCli(), 'web', '--host', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    windowsHide: true,
  })
}

function stopProcess(child: ChildProcessWithoutNullStreams): void {
  if (child.killed || child.pid === undefined) return
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    return
  }
  child.kill('SIGTERM')
}

/**
 * Start or connect to the local Harness web host used by the desktop window.
 * @param options - Startup paths and progress sink.
 * @returns The ready backend handle.
 */
export async function startBackend(options: BackendOptions): Promise<BackendHandle> {
  const override = process.env.DSH_DESKTOP_SERVER_URL
  if (override !== undefined) {
    const url = normalizeBackendUrl(override)
    options.onStage({
      phase: 'connecting',
      title: '正在连接本地服务',
      detail: url,
      progress: 68,
      logPath: options.logPath,
    })
    await waitForBackend(url, 20_000)
    await waitForPluginHostToSettle()
    return { url, logPath: options.logPath, stop: () => {} }
  }

  options.onStage({
    phase: 'preparing',
    title: '正在准备运行环境',
    detail: '检查本地端口与 Harness 组件',
    progress: 18,
    logPath: options.logPath,
  })
  const port = await reserveLoopbackPort()
  const url = `http://127.0.0.1:${port}/`
  const log = createWriteStream(options.logPath, { flags: 'a' })
  writeLogHeader(log)

  options.onStage({
    phase: 'starting',
    title: '正在启动 DeepSeek Harness',
    detail: `本地服务 · 127.0.0.1:${port}`,
    progress: 42,
    logPath: options.logPath,
  })
  const child = app.isPackaged
    ? spawnPackagedBackend(port)
    : spawnDevelopmentBackend(options.workspaceRoot, port)
  child.stdout.pipe(log, { end: false })
  child.stderr.pipe(log, { end: false })

  const exitBeforeReady = new Promise<never>((_, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => {
      reject(new Error(`DeepSeek Harness exited during startup with code ${code ?? 'unknown'}`))
    })
  })

  options.onStage({
    phase: 'connecting',
    title: '正在连接工作台',
    detail: '加载会话、模型与本地工具',
    progress: 72,
    logPath: options.logPath,
  })

  try {
    await Promise.race([waitForBackend(url, 90_000), exitBeforeReady])
    await waitForPluginHostToSettle()
  } catch (error) {
    stopProcess(child)
    log.end()
    throw error
  }

  return {
    url,
    logPath: options.logPath,
    stop: () => {
      stopProcess(child)
      log.end()
    },
  }
}
