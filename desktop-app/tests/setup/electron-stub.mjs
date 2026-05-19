// Module resolution hook that replaces `import 'electron'` with a tmpdir-backed
// in-memory stub. Allows the main-process modules (which call app.getPath, etc.)
// to be exercised under plain Node without spawning Electron.

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
  return next(spec, ctx)
}
