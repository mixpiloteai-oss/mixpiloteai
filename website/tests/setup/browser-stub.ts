/**
 * Minimal browser environment polyfill for running website utility modules
 * under plain Node (`node --test --experimental-strip-types`).
 *
 * No jsdom, no new packages. Map-backed localStorage, mockable fetch,
 * and a stub `window` that swallows `window.location.hash = '#/...'`.
 *
 * Import + call `installBrowserStubs()` at the TOP of every test file,
 * BEFORE importing any SUT — several SUTs read `localStorage` at module
 * init time (none currently do, but this is defensive).
 */

type FetchFn = (input: any, init?: any) => Promise<any>

let _store = new Map<string, string>()
let _mockFetch: FetchFn = async () => {
  throw new Error('fetch was not mocked — call setMockFetch(fn) before the SUT calls fetch')
}

const localStorageStub = {
  getItem(k: string): string | null {
    return _store.has(k) ? (_store.get(k) as string) : null
  },
  setItem(k: string, v: string): void {
    _store.set(k, String(v))
  },
  removeItem(k: string): void {
    _store.delete(k)
  },
  clear(): void {
    _store.clear()
  },
  key(i: number): string | null {
    return Array.from(_store.keys())[i] ?? null
  },
  get length(): number {
    return _store.size
  },
}

const locationStub = {
  hash: '',
  href: 'http://localhost/',
  pathname: '/',
  search: '',
  origin: 'http://localhost',
}

const windowStub = {
  location: locationStub,
}

let _installed = false

export function installBrowserStubs(): void {
  if (!_installed) {
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageStub,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, 'window', {
      value: windowStub,
      writable: true,
      configurable: true,
    })
    // Top-level fetch is delegated to the mutable _mockFetch
    Object.defineProperty(globalThis, 'fetch', {
      value: ((input: any, init?: any) => _mockFetch(input, init)) as FetchFn,
      writable: true,
      configurable: true,
    })
    _installed = true
  }
  // Always reset state between installs / between tests
  resetMocks()
}

/** Replace the mocked fetch implementation. */
export function setMockFetch(fn: FetchFn): void {
  _mockFetch = fn
}

/** Reset localStorage, fetch mock, and window.location.hash. */
export function resetMocks(): void {
  _store.clear()
  locationStub.hash = ''
  _mockFetch = async () => {
    throw new Error('fetch was not mocked — call setMockFetch(fn) before the SUT calls fetch')
  }
}

/** Read the current location stub (for assertions). */
export function getLocation(): { hash: string; href: string; pathname: string; search: string; origin: string } {
  return locationStub
}

/** Build a minimal Response-like object for the mock. */
export function makeResponse(opts: {
  status?: number
  ok?: boolean
  json?: any
  statusText?: string
}): any {
  const status = opts.status ?? 200
  const ok = opts.ok ?? (status >= 200 && status < 300)
  const body = opts.json
  return {
    status,
    ok,
    statusText: opts.statusText ?? '',
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }
}

/** Record-and-respond helper: returns [calls, mockFn]. */
export function recordingFetch(
  handler: (input: any, init?: any) => any,
): { calls: Array<{ input: any; init: any }>; fn: FetchFn } {
  const calls: Array<{ input: any; init: any }> = []
  const fn: FetchFn = async (input, init) => {
    calls.push({ input, init })
    const result = handler(input, init)
    return result instanceof Promise ? await result : result
  }
  return { calls, fn }
}

/** Build a JWT-like string (header.payload.signature) with given payload. */
export function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: any) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature-bytes`
}
