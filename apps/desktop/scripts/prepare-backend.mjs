import { spawn } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const workspaceRoot = fileURLToPath(new URL('../../..', import.meta.url))
const outputPath = fileURLToPath(new URL('../dist/backend', import.meta.url))
await rm(outputPath, { force: true, recursive: true })

const args = [
  '--config.inject-workspace-packages=true',
  '--config.node-linker=hoisted',
  '--filter',
  '@deepseek-ai/dsh',
  'deploy',
  '--prod',
  '--ignore-scripts',
  outputPath,
]
const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'pnpm'
const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'pnpm', ...args] : args
const child = spawn(command, commandArgs, {
  cwd: workspaceRoot,
  stdio: 'inherit',
  windowsHide: true,
})

const exitCode = await new Promise((resolveExit, reject) => {
  child.once('error', reject)
  child.once('exit', (code) => resolveExit(code ?? 1))
})
if (exitCode !== 0) throw new Error(`Portable Harness backend deployment failed with exit code ${exitCode}`)
