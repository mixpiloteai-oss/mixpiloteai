import '../setup/env.ts';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ipcSecurityGuard } from '../../../desktop-app/src/main/modules/ipcSecurity.ts';

describe('Electron IPC security — channel whitelist', () => {
  test('allows whitelisted channels', () => {
    assert.equal(ipcSecurityGuard.isAllowed('plugin-scan'), true);
    assert.equal(ipcSecurityGuard.isAllowed('plugin-load'), true);
    assert.equal(ipcSecurityGuard.isAllowed('midi-get-inputs'), true);
    assert.equal(ipcSecurityGuard.isAllowed('store-get'), true);
  });

  test('blocks non-whitelisted channels', () => {
    assert.equal(ipcSecurityGuard.isAllowed('exec'), false);
    assert.equal(ipcSecurityGuard.isAllowed('shell'), false);
    assert.equal(ipcSecurityGuard.isAllowed('fs-read'), false);
    assert.equal(ipcSecurityGuard.isAllowed('require'), false);
    assert.equal(ipcSecurityGuard.isAllowed('eval'), false);
    assert.equal(ipcSecurityGuard.isAllowed('__proto__'), false);
    assert.equal(ipcSecurityGuard.isAllowed('constructor'), false);
  });

  test('validate returns error for non-whitelisted channel', () => {
    const err = ipcSecurityGuard.validate('os.execute', ['rm -rf /']);
    assert.ok(err !== null);
    assert.ok(err!.includes('not allowed'));
  });

  test('validate plugin-load: rejects path traversal', () => {
    const err = ipcSecurityGuard.validate('plugin-load', ['../../../etc/passwd', 'vst3']);
    assert.ok(err !== null, 'Expected validation error for path traversal');
  });

  test('validate plugin-load: rejects null bytes', () => {
    const err = ipcSecurityGuard.validate('plugin-load', ['/plugins/evil\0.vst3', 'vst3']);
    assert.ok(err !== null, 'Expected validation error for null byte');
  });

  test('validate plugin-load: accepts valid path', () => {
    const err = ipcSecurityGuard.validate('plugin-load', ['/home/user/plugins/synth.vst3', 'vst3']);
    assert.equal(err, null);
  });

  test('validate plugin-set-param: rejects non-numeric value', () => {
    const err = ipcSecurityGuard.validate('plugin-set-param', ['inst-1', 'volume', 'evil']);
    assert.ok(err !== null);
  });

  test('validate plugin-set-param: rejects Infinity', () => {
    const err = ipcSecurityGuard.validate('plugin-set-param', ['inst-1', 'volume', Infinity]);
    assert.ok(err !== null);
  });

  test('validate plugin-set-param: accepts valid params', () => {
    const err = ipcSecurityGuard.validate('plugin-set-param', ['inst-1', 'volume', 0.75]);
    assert.equal(err, null);
  });

  test('validate midi-send-note: rejects out-of-range note', () => {
    const err = ipcSecurityGuard.validate('midi-send-note', [0, 200, 127]);
    assert.ok(err !== null);
  });

  test('validate midi-send-note: accepts valid MIDI', () => {
    const err = ipcSecurityGuard.validate('midi-send-note', [0, 60, 100]);
    assert.equal(err, null);
  });

  test('validate audio-engine-set-bpm: rejects invalid BPM', () => {
    const err = ipcSecurityGuard.validate('audio-engine-set-bpm', [5]); // too slow
    assert.ok(err !== null);
  });

  test('validate audio-engine-set-bpm: rejects BPM > 400', () => {
    const err = ipcSecurityGuard.validate('audio-engine-set-bpm', [999]);
    assert.ok(err !== null);
  });

  test('validate audio-engine-set-bpm: accepts valid BPM', () => {
    const err = ipcSecurityGuard.validate('audio-engine-set-bpm', [128]);
    assert.equal(err, null);
  });

  test('validate audio-engine-set-buffer-size: rejects invalid size', () => {
    const err = ipcSecurityGuard.validate('audio-engine-set-buffer-size', [100]);
    assert.ok(err !== null);
  });

  test('validate audio-engine-set-buffer-size: accepts valid size', () => {
    const err = ipcSecurityGuard.validate('audio-engine-set-buffer-size', [512]);
    assert.equal(err, null);
  });

  test('validate store-get: rejects overly long key', () => {
    const err = ipcSecurityGuard.validate('store-get', ['x'.repeat(300)]);
    assert.ok(err !== null);
  });

  test('validate store-set: accepts normal key-value', () => {
    const err = ipcSecurityGuard.validate('store-set', ['theme', 'dark']);
    assert.equal(err, null);
  });

  test('validate plugin-save-preset: rejects name > 100 chars', () => {
    const err = ipcSecurityGuard.validate('plugin-save-preset', ['inst-1', 'x'.repeat(200)]);
    assert.ok(err !== null);
  });

  test('validate plugin-save-preset: accepts normal preset name', () => {
    const err = ipcSecurityGuard.validate('plugin-save-preset', ['inst-1', 'My Best Preset']);
    assert.equal(err, null);
  });
});
