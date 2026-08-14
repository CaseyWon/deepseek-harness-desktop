import { cp, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

await rm(new URL('../dist', import.meta.url), { force: true, recursive: true })

await Promise.all([
  build({
    entryPoints: [fileURLToPath(new URL('../src/main.ts', import.meta.url))],
    outfile: fileURLToPath(new URL('../dist/main.js', import.meta.url)),
    bundle: true,
    external: ['electron'],
    format: 'esm',
    platform: 'node',
    sourcemap: true,
    target: 'node22',
  }),
  build({
    entryPoints: [fileURLToPath(new URL('../src/preload.ts', import.meta.url))],
    outfile: fileURLToPath(new URL('../dist/preload.cjs', import.meta.url)),
    bundle: true,
    external: ['electron'],
    format: 'cjs',
    platform: 'node',
    sourcemap: true,
    target: 'node22',
  }),
])

await cp(new URL('../src/renderer', import.meta.url), new URL('../dist/renderer', import.meta.url), { recursive: true })
