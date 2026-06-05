// Tests for validateEnv() via child process.
// run-validate-env.ts calls validateEnv() and writes VALIDATE_ENV_OK on success.
// In production mode with an insecure JWT_SECRET, validateEnv() must exit(1).
import '../setup/env.ts';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// In CommonJS/ts-node context, __dirname is available directly.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SCRIPT = resolve(__dirname, '../setup/run-validate-env.ts');
const BACKEND_ROOT = resolve(__dirname, '../..');

function run(env: Record<string, string>) {
  return spawnSync(
    'node',
    ['--require', 'ts-node/register', SCRIPT],
    {
      cwd: BACKEND_ROOT,
      env: {
        ...process.env,
        TS_NODE_TRANSPILE_ONLY: 'true',
        TS_NODE_PROJECT: 'tsconfig.test.json',
        ...env,
      },
      encoding: 'utf8',
      timeout: 15_000,
    }
  );
}

describe('validateEnv child process', () => {
  test('production mode with insecure JWT_SECRET → exits non-zero', () => {
    const result = run({
      NODE_ENV: 'production',
      JWT_SECRET: 'dev-secret-change-in-production',
    });
    assert.notEqual(result.status, 0, `Expected non-zero exit, got ${result.status}. stderr: ${result.stderr}`);
  });

  test('production mode with secure JWT_SECRET → exits 0 and prints sentinel', () => {
    const result = run({
      NODE_ENV: 'production',
      JWT_SECRET: 'a-very-long-secure-production-jwt-secret-that-is-totally-unique-and-safe-9999!',
    });
    assert.equal(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes('VALIDATE_ENV_OK'), `Expected sentinel in stdout, got: ${result.stdout}`);
  });
});
