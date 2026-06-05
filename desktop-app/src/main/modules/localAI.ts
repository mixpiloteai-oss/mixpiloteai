// ============================================================
// NEUROTEK AI Desktop — Local AI IPC Module
// ============================================================
// Bridges Electron main process to Ollama daemon.
// Exposes IPC channels for renderer to check/start/stop Ollama
// and manage local models without exposing raw HTTP to renderer.
// ============================================================
import { ipcMain, shell } from 'electron';
import { exec, spawn, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

const execAsync = promisify(exec);

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const HEALTH_TIMEOUT_MS = 3_000;

let ollamaDaemon: ChildProcess | null = null;

// ── Health check ───────────────────────────────────────────────

async function isOllamaRunning(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
    const res = await fetch(`${OLLAMA_URL}/api/version`, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Binary detection ───────────────────────────────────────────

async function findOllamaBinary(): Promise<string | null> {
  // Common install locations
  const candidates: string[] = [];

  if (process.platform === 'darwin') {
    candidates.push(
      '/usr/local/bin/ollama',
      '/opt/homebrew/bin/ollama',
      path.join(os.homedir(), '.ollama/bin/ollama'),
    );
  } else if (process.platform === 'linux') {
    candidates.push(
      '/usr/local/bin/ollama',
      '/usr/bin/ollama',
      path.join(os.homedir(), '.ollama/bin/ollama'),
    );
  } else if (process.platform === 'win32') {
    candidates.push(
      path.join(process.env.LOCALAPPDATA ?? '', 'ollama', 'ollama.exe'),
      'C:\\Program Files\\Ollama\\ollama.exe',
    );
  }

  // Also try PATH
  try {
    const whichCmd = process.platform === 'win32' ? 'where ollama' : 'which ollama';
    const { stdout } = await execAsync(whichCmd);
    const p = stdout.trim().split('\n')[0];
    if (p) candidates.unshift(p);
  } catch { /* not in PATH */ }

  for (const candidate of candidates) {
    try {
      await execAsync(`"${candidate}" --version`);
      return candidate;
    } catch { /* not found here */ }
  }

  return null;
}

// ── Daemon control ─────────────────────────────────────────────

async function startOllama(): Promise<{ started: boolean; error?: string }> {
  if (await isOllamaRunning()) {
    return { started: true };
  }

  const binary = await findOllamaBinary();
  if (!binary) {
    return { started: false, error: 'Ollama not installed. Download from https://ollama.ai' };
  }

  ollamaDaemon = spawn(binary, ['serve'], {
    detached: false,
    stdio: 'ignore',
    env: { ...process.env },
  });

  ollamaDaemon.on('exit', () => { ollamaDaemon = null; });

  // Wait up to 5 seconds for it to come up
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await isOllamaRunning()) return { started: true };
  }

  return { started: false, error: 'Ollama process started but did not respond in time.' };
}

function stopOllama(): void {
  if (ollamaDaemon) {
    ollamaDaemon.kill();
    ollamaDaemon = null;
  }
}

// ── IPC registration ───────────────────────────────────────────

export function registerLocalAIIPC(): void {
  // Check if Ollama is running
  ipcMain.handle('local-ai:status', async () => {
    const running = await isOllamaRunning();
    if (!running) return { available: false };

    try {
      const [versionRes, tagsRes] = await Promise.all([
        fetch(`${OLLAMA_URL}/api/version`),
        fetch(`${OLLAMA_URL}/api/tags`),
      ]);
      const version = versionRes.ok ? ((await versionRes.json()) as { version?: string }).version : undefined;
      const tags = tagsRes.ok ? (await tagsRes.json() as { models?: unknown[] }).models ?? [] : [];

      return { available: true, version, modelCount: tags.length };
    } catch {
      return { available: true };
    }
  });

  // Start Ollama daemon
  ipcMain.handle('local-ai:start', async () => {
    return await startOllama();
  });

  // Stop daemon (only one we spawned)
  ipcMain.handle('local-ai:stop', () => {
    stopOllama();
    return { stopped: true };
  });

  // Open Ollama download page
  ipcMain.handle('local-ai:open-download', () => {
    shell.openExternal('https://ollama.ai');
  });

  // List installed models
  ipcMain.handle('local-ai:list-models', async () => {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/tags`);
      if (!res.ok) return { models: [] };
      return res.json();
    } catch {
      return { models: [] };
    }
  });

  // Check if Ollama binary is installed (not necessarily running)
  ipcMain.handle('local-ai:is-installed', async () => {
    const binary = await findOllamaBinary();
    return { installed: binary !== null, binaryPath: binary };
  });
}

// Clean up on app exit
export function cleanupLocalAI(): void {
  stopOllama();
}
