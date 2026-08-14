import { spawn } from 'node:child_process'
import electronPath from 'electron'

const child = spawn(electronPath, ['.'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, DSH_DESKTOP_DEV: '1' },
  stdio: 'inherit',
})

child.once('exit', code => process.exit(code ?? 1))
