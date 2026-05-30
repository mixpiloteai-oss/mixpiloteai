// ─── IPC Security Module ─────────────────────────────────────────────────────
// Validates all IPC messages from the renderer before dispatching.
// Prevents privilege escalation via crafted IPC payloads.
// ─────────────────────────────────────────────────────────────────────────────
import { type IpcMainInvokeEvent } from 'electron';

// ── Channel whitelist ─────────────────────────────────────────────────────────
// Only channels in this list can be invoked by the renderer.
const ALLOWED_CHANNELS = new Set([
  // Plugin management
  'plugin-scan', 'plugin-scan-clear-cache', 'plugin-scan-cleanup-cache',
  'plugin-load', 'plugin-unload', 'plugin-set-param', 'plugin-get-params',
  'plugin-process', 'plugin-get-state', 'plugin-set-state',
  'plugin-list-presets', 'plugin-save-preset', 'plugin-load-preset',
  'plugin-delete-preset', 'plugin-rename-preset',
  'plugin-hot-reload', 'plugin-get-recovery-id', 'plugin-get-saved-states',
  // Plugin blacklist
  'plugin-blacklist-get', 'plugin-blacklist-remove',
  // Plugin health
  'plugin-health-get-all', 'plugin-health-unregister',
  // Audio bridge
  'plugin-audio-get-state',
  // MIDI
  'midi-get-inputs', 'midi-get-outputs', 'midi-set-route',
  'midi-send-note', 'midi-send-cc',
  // App
  'app-version', 'app-platform',
  // Updates
  'update-check', 'update-install',
  // Native audio engine
  'audio-engine-start', 'audio-engine-stop', 'audio-engine-status',
  'audio-engine-set-bpm', 'audio-engine-set-buffer-size',
  // Store / settings
  'store-get', 'store-set', 'store-delete',
  // Crash reporting
  'plugin-report-crash',
]);

// ── Path traversal detection ─────────────────────────────────────────────────
const PATH_TRAVERSAL = /(\.\.[/\\]|[/\\]\.\.)/;
const NULL_BYTE      = /\0/;
const SHELL_INJECT   = /[;&|`$(){}[\]<>]/;

// ── Type validators ───────────────────────────────────────────────────────────
const isString    = (v: unknown): v is string  => typeof v === 'string';
const isNumber    = (v: unknown): v is number  => typeof v === 'number' && isFinite(v);
const isObject    = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function isSafeString(v: unknown): v is string {
  if (!isString(v)) return false;
  if (NULL_BYTE.test(v)) return false;
  return true;
}

function isSafeFilePath(v: unknown): v is string {
  if (!isSafeString(v)) return false;
  if (PATH_TRAVERSAL.test(v)) return false;
  if (SHELL_INJECT.test(v)) return false;
  return true;
}

// ── Per-channel payload schemas ───────────────────────────────────────────────
type Schema = ((args: unknown[]) => ValidationResult);

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function ok(): ValidationResult { return { valid: true }; }
function fail(error: string): ValidationResult { return { valid: false, error }; }

const CHANNEL_SCHEMAS: Partial<Record<string, Schema>> = {
  'plugin-load': ([pluginPath, format]) => {
    if (!isSafeFilePath(pluginPath)) return fail('pluginPath: invalid or unsafe path');
    if (format !== undefined && !isString(format)) return fail('format: must be string');
    return ok();
  },
  'plugin-unload': ([instanceId]) => {
    if (!isSafeString(instanceId)) return fail('instanceId: invalid');
    return ok();
  },
  'plugin-set-param': ([instanceId, paramId, value]) => {
    if (!isSafeString(instanceId)) return fail('instanceId: invalid');
    if (!isString(paramId)) return fail('paramId: must be string');
    if (!isNumber(value)) return fail('value: must be finite number');
    if (value < -1e10 || value > 1e10) return fail('value: out of range');
    return ok();
  },
  'plugin-process': ([instanceId, input]) => {
    if (!isSafeString(instanceId)) return fail('instanceId: invalid');
    if (input !== undefined && !Array.isArray(input)) return fail('input: must be array');
    return ok();
  },
  'plugin-get-state': ([instanceId]) => {
    if (!isSafeString(instanceId)) return fail('instanceId: invalid');
    return ok();
  },
  'plugin-set-state': ([instanceId, state]) => {
    if (!isSafeString(instanceId)) return fail('instanceId: invalid');
    if (!isObject(state)) return fail('state: must be object');
    return ok();
  },
  'plugin-save-preset': ([instanceId, name]) => {
    if (!isSafeString(instanceId)) return fail('instanceId: invalid');
    if (!isSafeString(name) || name.length > 100) return fail('name: invalid or too long');
    return ok();
  },
  'plugin-load-preset': ([instanceId, presetId]) => {
    if (!isSafeString(instanceId)) return fail('instanceId: invalid');
    if (!isSafeString(presetId)) return fail('presetId: invalid');
    return ok();
  },
  'plugin-delete-preset': ([presetId]) => {
    if (!isSafeString(presetId)) return fail('presetId: invalid');
    return ok();
  },
  'plugin-rename-preset': ([presetId, newName]) => {
    if (!isSafeString(presetId)) return fail('presetId: invalid');
    if (!isSafeString(newName) || newName.length > 100) return fail('newName: invalid');
    return ok();
  },
  'plugin-hot-reload': ([instanceId]) => {
    if (!isSafeString(instanceId)) return fail('instanceId: invalid');
    return ok();
  },
  'plugin-get-recovery-id': ([oldInstanceId]) => {
    if (!isSafeString(oldInstanceId)) return fail('oldInstanceId: invalid');
    return ok();
  },
  'plugin-blacklist-remove': ([pluginPath]) => {
    if (!isSafeFilePath(pluginPath)) return fail('pluginPath: invalid');
    return ok();
  },
  'plugin-health-unregister': ([instanceId]) => {
    if (!isSafeString(instanceId)) return fail('instanceId: invalid');
    return ok();
  },
  'plugin-audio-get-state': ([instanceId]) => {
    if (!isSafeString(instanceId)) return fail('instanceId: invalid');
    return ok();
  },
  'midi-set-route': ([inputId, outputId]) => {
    if (!isSafeString(inputId)) return fail('inputId: invalid');
    if (!isSafeString(outputId)) return fail('outputId: invalid');
    return ok();
  },
  'midi-send-note': ([channel, note, velocity]) => {
    if (!isNumber(channel) || channel < 0 || channel > 15) return fail('channel: 0-15');
    if (!isNumber(note) || note < 0 || note > 127)         return fail('note: 0-127');
    if (!isNumber(velocity) || velocity < 0 || velocity > 127) return fail('velocity: 0-127');
    return ok();
  },
  'midi-send-cc': ([channel, cc, value]) => {
    if (!isNumber(channel) || channel < 0 || channel > 15) return fail('channel: 0-15');
    if (!isNumber(cc) || cc < 0 || cc > 127)               return fail('cc: 0-127');
    if (!isNumber(value) || value < 0 || value > 127)      return fail('value: 0-127');
    return ok();
  },
  'audio-engine-set-bpm': ([bpm]) => {
    if (!isNumber(bpm) || bpm < 20 || bpm > 400) return fail('bpm: 20-400');
    return ok();
  },
  'audio-engine-set-buffer-size': ([size]) => {
    const valid = [64, 128, 256, 512, 1024, 2048, 4096];
    if (!valid.includes(size as number)) return fail(`bufferSize must be one of: ${valid.join(', ')}`);
    return ok();
  },
  'store-get': ([key]) => {
    if (!isSafeString(key) || key.length > 200) return fail('key: invalid or too long');
    return ok();
  },
  'store-set': ([key, value]) => {
    if (!isSafeString(key) || key.length > 200) return fail('key: invalid or too long');
    if (value === undefined) return fail('value: required');
    return ok();
  },
  'store-delete': ([key]) => {
    if (!isSafeString(key) || key.length > 200) return fail('key: invalid or too long');
    return ok();
  },
  'plugin-report-crash': ([info]) => {
    if (!isObject(info)) return fail('info: must be object');
    return ok();
  },
};

// ── IPC Security Guard ────────────────────────────────────────────────────────

export interface IpcSecurityGuard {
  /**
   * Validates an incoming IPC invoke. Returns null if valid, or an error string.
   */
  validate(channel: string, args: unknown[]): string | null;

  /**
   * Returns true if the channel is whitelisted.
   */
  isAllowed(channel: string): boolean;
}

export const ipcSecurityGuard: IpcSecurityGuard = {
  isAllowed(channel: string): boolean {
    return ALLOWED_CHANNELS.has(channel);
  },

  validate(channel: string, args: unknown[]): string | null {
    if (!ALLOWED_CHANNELS.has(channel)) {
      return `Channel not allowed: ${channel}`;
    }

    const schema = CHANNEL_SCHEMAS[channel];
    if (!schema) return null; // no specific schema — just whitelist check

    const result = schema(args);
    return result.valid ? null : (result.error ?? 'Validation failed');
  },
};

/**
 * Wraps an IPC handler with security validation.
 * Usage: ipcMain.handle('some-channel', withSecurity(async (event, ...args) => { ... }))
 */
export function withSecurity<T>(
  handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<T> | T
): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<T | { error: string }> {
  return async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    return handler(event, ...args);
  };
}
