// ============================================================
// NEUROTEK AI — AI Settings & Local Model Manager
// ============================================================
// Lets users switch between cloud (Claude) and local (Ollama) AI,
// download models, view GPU/RAM info, and monitor pull progress.
// ============================================================
import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

// ── Types ──────────────────────────────────────────────────────

interface ModelInfo {
  id: string;
  name: string;
  family: string;
  sizeGb: number;
  ramGb: number;
  contextLength: number;
  quantization: string;
  tags: string[];
  ollamaId: string;
  description: string;
}

interface InstalledModel {
  name: string;
  sizeGb: number;
  modifiedAt: string;
  catalogueInfo: ModelInfo | null;
}

interface GPUInfo {
  available: boolean;
  name?: string;
  vramMb?: number;
  backend?: 'cuda' | 'metal' | 'vulkan' | 'none';
}

interface LocalAIStatus {
  available: boolean;
  backend: 'ollama' | 'llamacpp' | 'none';
  ollamaVersion?: string;
  loadedModels: InstalledModel[];
  gpuInfo: GPUInfo;
  routing: {
    cloudAvailable: boolean;
    localAvailable: boolean;
    recommendedBackend: 'cloud' | 'local' | 'auto';
  };
}

interface PullProgress {
  status: 'downloading' | 'verifying' | 'complete' | 'error';
  model: string;
  percent?: number;
  error?: string;
  completedBytes?: number;
  totalBytes?: number;
}

// ── API helpers ────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('nt_token') ?? sessionStorage.getItem('nt_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string): Promise<T> {
  const { data } = await axios.get(`${BASE_URL}${path}`, { headers: authHeaders() });
  return data.data as T;
}

// ── Sub-components ─────────────────────────────────────────────

function BackendBadge({ backend }: { backend: string }) {
  const color =
    backend === 'cloud' ? '#60a5fa' :
    backend === 'local' ? '#34d399' :
    '#f87171';
  const label = backend === 'cloud' ? 'Cloud (Claude)' : backend === 'local' ? 'Local (Ollama)' : 'Demo';
  return (
    <span style={{
      background: `${color}22`, color, border: `1px solid ${color}44`,
      borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700,
    }}>
      {label}
    </span>
  );
}

function GPUCard({ gpu }: { gpu: GPUInfo }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 10, padding: '14px 18px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>🎮</span>
        <span style={{ fontWeight: 700, color: '#e2e8f0' }}>GPU</span>
        <BackendBadge backend={gpu.available ? (gpu.backend ?? 'none') : 'none'} />
      </div>
      {gpu.available ? (
        <div style={{ color: '#94a3b8', fontSize: 13 }}>
          {gpu.name && <div>Name: <b style={{ color: '#e2e8f0' }}>{gpu.name}</b></div>}
          {gpu.vramMb && <div>VRAM: <b style={{ color: '#e2e8f0' }}>{Math.round(gpu.vramMb / 1024 * 10) / 10} GB</b></div>}
          <div>Backend: <b style={{ color: '#e2e8f0' }}>{gpu.backend}</b></div>
        </div>
      ) : (
        <div style={{ color: '#64748b', fontSize: 13 }}>No GPU detected — CPU inference only</div>
      )}
    </div>
  );
}

function PullProgressBar({ progress }: { progress: PullProgress }) {
  const pct = progress.percent ?? 0;
  const isError = progress.status === 'error';
  const isDone = progress.status === 'complete';
  const barColor = isError ? '#ef4444' : isDone ? '#34d399' : '#8b5cf6';

  return (
    <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px', marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
        <span style={{ color: '#94a3b8' }}>
          {isDone ? 'Complete' : isError ? `Error: ${progress.error}` : `${progress.status}…`}
        </span>
        <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ background: '#1e293b', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: barColor,
          borderRadius: 4, transition: 'width 0.3s ease',
        }} />
      </div>
      {progress.completedBytes != null && progress.totalBytes != null && (
        <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>
          {(progress.completedBytes / 1e9).toFixed(2)} / {(progress.totalBytes / 1e9).toFixed(2)} GB
        </div>
      )}
    </div>
  );
}

// ── Model card ─────────────────────────────────────────────────

function ModelCard({
  model,
  installed,
  onPull,
  pulling,
  pullProgress,
  systemRamGb,
}: {
  model: ModelInfo;
  installed: boolean;
  onPull: (m: ModelInfo) => void;
  pulling: boolean;
  pullProgress?: PullProgress;
  systemRamGb: number;
}) {
  const canRun = systemRamGb >= model.ramGb;
  return (
    <div style={{
      background: '#1e293b', borderRadius: 12, padding: '16px 20px', marginBottom: 12,
      border: installed ? '1px solid #34d39944' : '1px solid #334155',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 15 }}>{model.name}</span>
            {model.tags.map(t => (
              <span key={t} style={{
                background: '#334155', color: '#94a3b8', borderRadius: 4,
                padding: '1px 7px', fontSize: 11,
              }}>{t}</span>
            ))}
            {installed && (
              <span style={{ background: '#34d39922', color: '#34d399', border: '1px solid #34d39944', borderRadius: 4, padding: '1px 7px', fontSize: 11 }}>
                installed
              </span>
            )}
          </div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>{model.description}</div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
            <span>💾 {model.sizeGb} GB disk</span>
            <span style={{ color: canRun ? '#64748b' : '#f87171' }}>
              🧠 {model.ramGb} GB RAM {canRun ? '' : '(insufficient)'}
            </span>
            <span>📝 {(model.contextLength / 1000).toFixed(0)}K context</span>
            <span>🔧 {model.quantization}</span>
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          {!installed ? (
            <button
              onClick={() => onPull(model)}
              disabled={pulling || !canRun}
              style={{
                background: pulling ? '#334155' : canRun ? '#8b5cf6' : '#374151',
                color: canRun ? '#fff' : '#6b7280',
                border: 'none', borderRadius: 8, padding: '8px 16px',
                cursor: pulling || !canRun ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13,
              }}
            >
              {pulling ? 'Pulling…' : canRun ? '⬇ Download' : 'RAM too low'}
            </button>
          ) : (
            <div style={{ color: '#34d399', fontWeight: 700, fontSize: 13 }}>✓ Ready</div>
          )}
        </div>
      </div>
      {pulling && pullProgress && <PullProgressBar progress={pullProgress} />}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export default function AISettings() {
  const [status, setStatus] = useState<LocalAIStatus | null>(null);
  const [catalogue, setCatalogue] = useState<ModelInfo[]>([]);
  const [installed, setInstalled] = useState<InstalledModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
  const [preferredBackend, setPreferredBackend] = useState<'auto' | 'cloud' | 'local'>(
    (localStorage.getItem('nt_ai_backend') as 'auto' | 'cloud' | 'local') ?? 'auto'
  );
  const systemRamGb = Math.round((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8);
  const eventSourceRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [st, cat, inst] = await Promise.all([
        apiFetch<LocalAIStatus>('/api/local-ai/status'),
        apiFetch<ModelInfo[]>('/api/local-ai/catalogue'),
        apiFetch<InstalledModel[]>('/api/local-ai/models'),
      ]);
      setStatus(st);
      setCatalogue(cat);
      setInstalled(inst);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleBackendChange(backend: 'auto' | 'cloud' | 'local') {
    setPreferredBackend(backend);
    localStorage.setItem('nt_ai_backend', backend);
  }

  async function pullModel(model: ModelInfo) {
    if (pullingModel) return;
    setPullingModel(model.ollamaId);
    setPullProgress({ status: 'downloading', model: model.ollamaId, percent: 0 });

    const token = localStorage.getItem('nt_token') ?? sessionStorage.getItem('nt_token') ?? '';
    const encodedName = encodeURIComponent(model.ollamaId);
    const url = `${BASE_URL}/api/local-ai/models/${encodedName}/pull`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const progress = JSON.parse(line.slice(6)) as PullProgress;
            setPullProgress(progress);
            if (progress.status === 'complete' || progress.status === 'error') {
              if (progress.status === 'complete') await load();
              break;
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      setPullProgress({ status: 'error', model: model.ollamaId, error: (err as Error).message });
    } finally {
      setPullingModel(null);
    }
  }

  const installedNames = new Set(installed.map(m => m.name));

  if (loading) {
    return (
      <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center' }}>
        Loading AI settings…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#e2e8f0', marginBottom: 4 }}>AI Settings</h2>
      <p style={{ color: '#64748b', marginBottom: 24, fontSize: 14 }}>
        Configure cloud vs. local inference. Local AI runs entirely on your machine — no data leaves.
      </p>

      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {/* Backend selector */}
      <section style={{ background: '#0f172a', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
        <h3 style={{ color: '#e2e8f0', marginBottom: 16, fontSize: 15 }}>Inference Backend</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(['auto', 'cloud', 'local'] as const).map(b => (
            <button
              key={b}
              onClick={() => handleBackendChange(b)}
              style={{
                padding: '8px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, border: 'none',
                cursor: 'pointer',
                background: preferredBackend === b ? '#8b5cf6' : '#1e293b',
                color: preferredBackend === b ? '#fff' : '#94a3b8',
              }}
            >
              {b === 'auto' ? '⚡ Auto' : b === 'cloud' ? '☁️ Cloud (Claude)' : '🖥 Local (Ollama)'}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>
          {preferredBackend === 'auto' && 'Auto: uses cloud if configured, falls back to local.'}
          {preferredBackend === 'cloud' && 'Cloud: always uses Claude API. Falls back to local if API fails.'}
          {preferredBackend === 'local' && 'Local: always uses Ollama. Falls back to cloud if local is unavailable.'}
        </div>
        {status?.routing && (
          <div style={{ marginTop: 10, display: 'flex', gap: 12, fontSize: 12, flexWrap: 'wrap' }}>
            <span>
              ☁️ Cloud: <b style={{ color: status.routing.cloudAvailable ? '#34d399' : '#f87171' }}>
                {status.routing.cloudAvailable ? 'configured' : 'not configured'}
              </b>
            </span>
            <span>
              🖥 Local: <b style={{ color: status.routing.localAvailable ? '#34d399' : '#f87171' }}>
                {status.routing.localAvailable ? 'available' : 'not running'}
              </b>
            </span>
            <span>
              Recommended: <b style={{ color: '#8b5cf6' }}>{status.routing.recommendedBackend}</b>
            </span>
          </div>
        )}
      </section>

      {/* Local AI status */}
      <section style={{ background: '#0f172a', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
        <h3 style={{ color: '#e2e8f0', marginBottom: 12, fontSize: 15 }}>Local AI Runtime</h3>
        {status ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', display: 'inline-block',
                background: status.available ? '#34d399' : '#f87171',
              }} />
              <span style={{ color: '#e2e8f0', fontWeight: 700 }}>
                {status.available
                  ? `${status.backend === 'ollama' ? 'Ollama' : 'llama.cpp'} ${status.ollamaVersion ?? ''}`
                  : 'Not running'}
              </span>
            </div>
            {!status.available && (
              <div style={{ background: '#1e293b', borderRadius: 8, padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>
                <div style={{ marginBottom: 8 }}>Install and start Ollama to use local AI:</div>
                <code style={{ background: '#0f172a', padding: '4px 8px', borderRadius: 4, fontSize: 12, color: '#a78bfa' }}>
                  curl -fsSL https://ollama.ai/install.sh | sh && ollama serve
                </code>
              </div>
            )}
            {status.gpuInfo && <GPUCard gpu={status.gpuInfo} />}
          </div>
        ) : (
          <div style={{ color: '#64748b' }}>Checking local AI status…</div>
        )}
      </section>

      {/* Installed models */}
      {installed.length > 0 && (
        <section style={{ background: '#0f172a', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
          <h3 style={{ color: '#e2e8f0', marginBottom: 12, fontSize: 15 }}>
            Installed Models ({installed.length})
          </h3>
          {installed.map(m => (
            <div key={m.name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#1e293b', borderRadius: 8, padding: '10px 14px', marginBottom: 8,
            }}>
              <div>
                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                <div style={{ color: '#64748b', fontSize: 12 }}>{m.sizeGb} GB • {new Date(m.modifiedAt).toLocaleDateString()}</div>
              </div>
              <span style={{ color: '#34d399', fontSize: 12, fontWeight: 700 }}>✓ Ready</span>
            </div>
          ))}
        </section>
      )}

      {/* Model catalogue */}
      <section>
        <h3 style={{ color: '#e2e8f0', marginBottom: 4, fontSize: 15 }}>Recommended Models</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
          Your system RAM: ~{systemRamGb} GB. Models requiring more RAM are marked.
        </p>
        {catalogue.map(model => (
          <ModelCard
            key={model.id}
            model={model}
            installed={installedNames.has(model.ollamaId)}
            onPull={pullModel}
            pulling={pullingModel === model.ollamaId}
            pullProgress={pullingModel === model.ollamaId ? pullProgress ?? undefined : undefined}
            systemRamGb={systemRamGb}
          />
        ))}
      </section>
    </div>
  );
}
