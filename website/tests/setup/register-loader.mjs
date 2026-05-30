/**
 * Preload entry point — registers the vite-env loader before any test file
 * is imported. Used via `node --import ./tests/setup/register-loader.mjs`.
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./vite-env-loader.mjs', import.meta.url)
