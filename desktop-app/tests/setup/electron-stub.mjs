// Module resolution hook that:
// 1. Replaces `import 'electron'` with an in-memory stub
// 2. Resolves extensionless TypeScript imports (e.g. './Foo' → './Foo.ts')
//    so that source files compiled without .ts suffixes work under node:test

import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve as pathResolve, dirname } from 'node:path'

const STUB = `
  import { tmpdir } from 'node:os'
  import { join } from 'node:path'
  import { mkdirSync } from 'node:fs'
  const userData = join(tmpdir(), 'neurotek-test-' + process.pid)
  mkdirSync(userData, { recursive: true })
  export const app = {
    getPath: (k) => k === 'userData' ? userData : userData,
    getVersion: () => '0.0.0-test',
    isPackaged: false,
  }
  export const ipcMain = {
    handle: () => {},
    on: () => {},
    removeHandler: () => {},
  }
  export class BrowserWindow {}
  export default { app, ipcMain, BrowserWindow }
`

const dataUrl = 'data:text/javascript,' + encodeURIComponent(STUB)

export function resolve(spec, ctx, next) {
  if (spec === 'electron') {
    return { url: dataUrl, shortCircuit: true, format: 'module' }
  }

  // For relative imports without a known extension, try .ts then .tsx
  if ((spec.startsWith('./') || spec.startsWith('../')) && !/\.[a-z]+$/i.test(spec)) {
    const parentDir = ctx.parentURL ? dirname(fileURLToPath(ctx.parentURL)) : process.cwd()
    for (const ext of ['.ts', '.tsx']) {
      const candidate = pathResolve(parentDir, spec + ext)
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true }
      }
    }
  }

  return next(spec, ctx)
}
