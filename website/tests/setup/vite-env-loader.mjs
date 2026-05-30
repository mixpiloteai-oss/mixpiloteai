/**
 * Node module loader hook: rewrites `import.meta.env` references to a
 * global shim before the module is executed. This lets us run Vite-flavored
 * source under plain Node (`--experimental-strip-types`) without bundling.
 *
 * `import.meta.env.X ?? fallback` becomes `(globalThis.__VITE_ENV__ ?? {}).X ?? fallback`
 * — with an empty shim, every fallback triggers.
 */

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context)
  if (!url.includes('/src/')) return result
  if (result.source == null) return result

  let source = result.source
  if (typeof source !== 'string') {
    // Buffer / Uint8Array / ArrayBuffer / TypedArray
    source = Buffer.from(source).toString('utf8')
  }

  if (!source.includes('import.meta.env')) return result
  const patched = source.replace(/import\.meta\.env/g, '(globalThis.__VITE_ENV__ ?? {})')
  return { ...result, source: patched }
}
