// Used by tests/security/validateEnv.test.ts via child_process.
// Reads env vars from process.env (set by the spawning test) and
// invokes validateEnv(). The process exits with code 1 if env is
// insecure / missing in production mode.
import { validateEnv } from '../../src/utils/validateEnv.ts';
validateEnv();
// Print a sentinel so the parent test can tell we got past the check.
process.stdout.write('VALIDATE_ENV_OK\n');
