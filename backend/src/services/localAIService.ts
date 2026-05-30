// ============================================================
// NEUROTEK AI — Local AI Service
// ============================================================
// Real local inference via Ollama and llama.cpp HTTP APIs.
// No algorithmic generation. No fake responses.
//
// Supported backends:
//   • Ollama  — http://localhost:11434  (OpenAI-compatible + native)
//   • llama.cpp server — http://localhost:8080  (OpenAI-compatible)
//
// Both backends expose streaming completions. We use SSE-style
// fetch with ReadableStream to forward tokens to the client.
// ============================================================
import { SYSTEM_PROMPTS, buildUserPrompt } from '../prompts/systemPrompts';
import type { AIRequest, AIResponse } from './aiGateway';

// ── Configuration ──────────────────────────────────────────────

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const LLAMACPP_URL = process.env.LLAMACPP_URL ?? 'http://localhost:8080';

const LOCAL_AI_TIMEOUT_MS = Number(process.env.LOCAL_AI_TIMEOUT_MS ?? 120_000);
const LOCAL_AI_HEALTH_TIMEOUT_MS = 3_000; // fast check

// ── Model catalogue ───────────────────────────────────────────
// Defines recommended models for music production.
// RAM requirements are conservative estimates for quantized versions.

export interface ModelInfo {
  id: string;
  name: string;
  family: string;
  sizeGb: number;          // disk size (quantized)
  ramGb: number;           // minimum RAM to run
  contextLength: number;   // max context tokens
  quantization: string;
  tags: string[];
  ollamaId: string;        // pull name for Ollama
  description: string;
}

export const RECOMMENDED_MODELS: ModelInfo[] = [
  {
    id: 'mistral-7b-q4',
    name: 'Mistral 7B (Q4)',
    family: 'mistral',
    sizeGb: 4.1,
    ramGb: 6,
    contextLength: 8192,
    quantization: 'Q4_K_M',
    tags: ['fast', 'recommended', 'free'],
    ollamaId: 'mistral:7b-instruct-q4_K_M',
    description: 'Best balance of speed and quality. Runs on 8 GB RAM.',
  },
  {
    id: 'llama3-8b-q4',
    name: 'Llama 3 8B (Q4)',
    family: 'llama3',
    sizeGb: 4.7,
    ramGb: 8,
    contextLength: 8192,
    quantization: 'Q4_K_M',
    tags: ['recommended', 'meta'],
    ollamaId: 'llama3:8b-instruct-q4_K_M',
    description: 'Meta Llama 3. Strong instruction following.',
  },
  {
    id: 'phi3-mini-q4',
    name: 'Phi-3 Mini (Q4)',
    family: 'phi3',
    sizeGb: 2.2,
    ramGb: 4,
    contextLength: 4096,
    quantization: 'Q4_K_M',
    tags: ['tiny', 'fast', 'low-ram'],
    ollamaId: 'phi3:mini-4k-instruct-q4_K_M',
    description: 'Microsoft Phi-3. Runs on 4 GB RAM. Ideal for older hardware.',
  },
  {
    id: 'llama3-70b-q2',
    name: 'Llama 3 70B (Q2)',
    family: 'llama3',
    sizeGb: 26,
    ramGb: 32,
    contextLength: 8192,
    quantization: 'Q2_K',
    tags: ['large', 'powerful'],
    ollamaId: 'llama3:70b-instruct-q2_K',
    description: 'Powerful 70B model. Requires 32+ GB RAM. GPU recommended.',
  },
  {
    id: 'qwen2-7b-q4',
    name: 'Qwen2 7B (Q4)',
    family: 'qwen2',
    sizeGb: 4.4,
    ramGb: 8,
    contextLength: 32768,
    quantization: 'Q4_K_M',
    tags: ['long-context', 'multilingual'],
    ollamaId: 'qwen2:7b-instruct-q4_K_M',
    description: 'Alibaba Qwen2. Long context (32K). Excellent multilingual.',
  },
  {
    id: 'codellama-7b-q4',
    name: 'CodeLlama 7B (Q4)',
    family: 'codellama',
    sizeGb: 3.8,
    ramGb: 6,
    contextLength: 16384,
    quantization: 'Q4_K_M',
    tags: ['code', 'technical'],
    ollamaId: 'codellama:7b-instruct-q4_K_M',
    description: 'Specialized for technical/code tasks. Good for audio DSP questions.',
  },
];

// ── Types ──────────────────────────────────────────────────────

export type LocalAIBackend = 'ollama' | 'llamacpp' | 'none';

export interface LocalAIStatus {
  available: boolean;
  backend: LocalAIBackend;
  ollamaVersion?: string;
  llamacppVersion?: string;
  loadedModels: OllamaModel[];
  gpuInfo: GPUInfo;
}

export interface OllamaModel {
  name: string;
  size: number;      // bytes
  sizeGb: number;
  modifiedAt: string;
  digest: string;
  details?: {
    family: string;
    parameterSize: string;
    quantizationLevel: string;
  };
}

export interface GPUInfo {
  available: boolean;
  name?: string;
  vramMb?: number;
  backend?: 'cuda' | 'metal' | 'vulkan' | 'none';
}

export interface PullProgress {
  status: 'downloading' | 'verifying' | 'complete' | 'error';
  model: string;
  totalBytes?: number;
  completedBytes?: number;
  percent?: number;
  error?: string;
}

// ── Health checks ──────────────────────────────────────────────

export async function checkOllama(): Promise<{ available: boolean; version?: string }> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/version`, {
      signal: AbortSignal.timeout(LOCAL_AI_HEALTH_TIMEOUT_MS),
    });
    if (!res.ok) return { available: false };
    const data = await res.json() as { version?: string };
    return { available: true, version: data.version };
  } catch {
    return { available: false };
  }
}

export async function checkLlamaCpp(): Promise<{ available: boolean; version?: string }> {
  try {
    const res = await fetch(`${LLAMACPP_URL}/health`, {
      signal: AbortSignal.timeout(LOCAL_AI_HEALTH_TIMEOUT_MS),
    });
    if (!res.ok) return { available: false };
    return { available: true, version: 'llama.cpp server' };
  } catch {
    return { available: false };
  }
}

export async function getLocalAIStatus(): Promise<LocalAIStatus> {
  const [ollamaCheck, llamaCppCheck] = await Promise.all([
    checkOllama(),
    checkLlamaCpp(),
  ]);

  let loadedModels: OllamaModel[] = [];
  let backend: LocalAIBackend = 'none';

  if (ollamaCheck.available) {
    backend = 'ollama';
    loadedModels = await listOllamaModels();
  } else if (llamaCppCheck.available) {
    backend = 'llamacpp';
  }

  const gpuInfo = await detectGPU();

  return {
    available: ollamaCheck.available || llamaCppCheck.available,
    backend,
    ollamaVersion: ollamaCheck.version,
    llamacppVersion: llamaCppCheck.version,
    loadedModels,
    gpuInfo,
  };
}

// ── Model management ───────────────────────────────────────────

export async function listOllamaModels(): Promise<OllamaModel[]> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(LOCAL_AI_HEALTH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = await res.json() as {
      models?: Array<{
        name: string; size: number; modified_at: string; digest: string;
        details?: { family: string; parameter_size: string; quantization_level: string };
      }>;
    };
    return (data.models ?? []).map(m => ({
      name: m.name,
      size: m.size,
      sizeGb: Math.round(m.size / 1e9 * 10) / 10,
      modifiedAt: m.modified_at,
      digest: m.digest,
      details: m.details ? {
        family: m.details.family,
        parameterSize: m.details.parameter_size,
        quantizationLevel: m.details.quantization_level,
      } : undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Pull (download) a model from Ollama's registry.
 * Yields progress events for streaming to the frontend.
 */
export async function* pullOllamaModel(
  modelName: string
): AsyncGenerator<PullProgress> {
  const res = await fetch(`${OLLAMA_URL}/api/pull`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: modelName, stream: true }),
    signal: AbortSignal.timeout(60 * 60_000), // 1h for large models
  });

  if (!res.ok || !res.body) {
    yield { status: 'error', model: modelName, error: `HTTP ${res.status}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as {
          status?: string; total?: number; completed?: number; error?: string;
        };
        if (event.error) {
          yield { status: 'error', model: modelName, error: event.error };
          return;
        }
        if (event.status === 'success') {
          yield { status: 'complete', model: modelName, percent: 100 };
          return;
        }
        const status = (event.status ?? '').includes('verif') ? 'verifying' : 'downloading';
        const total = event.total ?? 0;
        const completed = event.completed ?? 0;
        const percent = total > 0 ? Math.round((completed / total) * 100) : undefined;
        yield { status, model: modelName, totalBytes: total, completedBytes: completed, percent };
      } catch {
        // malformed JSON line — skip
      }
    }
  }
  yield { status: 'complete', model: modelName, percent: 100 };
}

export async function deleteOllamaModel(modelName: string): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/delete`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── GPU detection ──────────────────────────────────────────────

export async function detectGPU(): Promise<GPUInfo> {
  // Check Ollama's running process for GPU info
  if ((await checkOllama()).available) {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/ps`, {
        signal: AbortSignal.timeout(LOCAL_AI_HEALTH_TIMEOUT_MS),
      });
      if (res.ok) {
        const data = await res.json() as {
          models?: Array<{ size_vram?: number }>;
        };
        // If any VRAM is reported, GPU is active
        const vramBytes = data.models?.[0]?.size_vram ?? 0;
        if (vramBytes > 0) {
          return {
            available: true,
            vramMb: Math.round(vramBytes / 1024 / 1024),
            backend: process.platform === 'darwin' ? 'metal' : 'cuda',
          };
        }
      }
    } catch { /* ignore */ }
  }

  // Platform hints
  if (process.platform === 'darwin') {
    return { available: true, backend: 'metal', name: 'Apple Silicon GPU' };
  }

  // Check for CUDA via env variable set by nvidia-smi or CUDA toolkit
  if (process.env.CUDA_VISIBLE_DEVICES || process.env.NVIDIA_VISIBLE_DEVICES) {
    return { available: true, backend: 'cuda' };
  }

  return { available: false, backend: 'none' };
}

// ── Inference ─────────────────────────────────────────────────

function buildLocalPrompt(req: AIRequest): { system: string; user: string } {
  const system = SYSTEM_PROMPTS[req.messageType] ?? SYSTEM_PROMPTS['chat'] ?? '';
  const user = buildUserPrompt(req);
  return { system, user };
}

/**
 * Call Ollama's native /api/generate for a single completion.
 * Returns full response (non-streaming).
 */
async function callOllamaNative(
  model: string,
  prompt: string,
  system: string,
  maxTokens: number
): Promise<AIResponse> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      system,
      stream: false,
      options: {
        num_predict: maxTokens,
        temperature: 0.7,
        top_p: 0.9,
        repeat_penalty: 1.1,
      },
    }),
    signal: AbortSignal.timeout(LOCAL_AI_TIMEOUT_MS),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    response: string; model: string;
    prompt_eval_count?: number; eval_count?: number;
  };

  return {
    content: data.response,
    model: `ollama:${data.model}`,
    inputTokens: data.prompt_eval_count ?? 0,
    outputTokens: data.eval_count ?? 0,
  };
}

/**
 * Call Ollama/llama.cpp via OpenAI-compatible /v1/chat/completions.
 * Works with both backends.
 */
async function callOpenAICompat(
  baseUrl: string,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
  history: AIRequest['history']
): Promise<AIResponse> {
  const messages = [
    { role: 'system', content: system },
    ...(history ?? []).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: user },
  ];

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ollama' },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
      top_p: 0.9,
      stream: false,
    }),
    signal: AbortSignal.timeout(LOCAL_AI_TIMEOUT_MS),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Local AI error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    model: string;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  const content = data.choices[0]?.message.content ?? '';

  return {
    content,
    model: `local:${data.model}`,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

/**
 * Stream tokens from Ollama via Server-Sent Events.
 * Yields each token chunk as it arrives.
 */
export async function* streamOllama(
  model: string,
  req: AIRequest,
  maxTokens: number
): AsyncGenerator<{ token: string; done: boolean; inputTokens?: number; outputTokens?: number }> {
  const { system, user } = buildLocalPrompt(req);

  const messages = [
    { role: 'system', content: system },
    ...(req.history ?? []).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: user },
  ];

  const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ollama' },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
      stream: true,
    }),
    signal: AbortSignal.timeout(LOCAL_AI_TIMEOUT_MS),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama stream error ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let totalOutput = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') {
        yield { token: '', done: true, outputTokens: totalOutput };
        return;
      }
      try {
        const chunk = JSON.parse(json) as {
          choices: Array<{ delta: { content?: string }; finish_reason?: string }>;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };
        const token = chunk.choices[0]?.delta.content ?? '';
        const isDone = chunk.choices[0]?.finish_reason === 'stop';
        if (token) {
          totalOutput++;
          yield { token, done: false };
        }
        if (isDone) {
          yield { token: '', done: true, outputTokens: chunk.usage?.completion_tokens ?? totalOutput };
          return;
        }
      } catch {
        // malformed chunk — skip
      }
    }
  }
  yield { token: '', done: true, outputTokens: totalOutput };
}

// ── Main call entry point ──────────────────────────────────────

const MAX_TOKENS_BY_PLAN: Record<string, number> = {
  free: 512,
  pro: 1024,
  studio: 2048,
};

/**
 * Run local AI inference. Tries Ollama first, then llama.cpp.
 * The model parameter can be:
 *   - An Ollama model name:  "mistral:7b-instruct-q4_K_M"
 *   - A shorthand id:        "mistral-7b-q4" (mapped from catalogue)
 *   - "auto":                pick the first available model
 */
export async function callLocalAI(req: AIRequest, modelOverride?: string): Promise<AIResponse> {
  const maxTokens = MAX_TOKENS_BY_PLAN[req.plan] ?? 512;
  const { system, user } = buildLocalPrompt(req);

  // Resolve model name
  let model = modelOverride ?? 'auto';
  if (model === 'auto') {
    const models = await listOllamaModels();
    if (models.length === 0) throw new Error('No local models available. Pull a model first via Ollama.');
    model = models[0]!.name;
  } else {
    // Map catalogue shorthand to Ollama ID
    const catalogue = RECOMMENDED_MODELS.find(m => m.id === model);
    if (catalogue) model = catalogue.ollamaId;
  }

  // Try Ollama (native API — most efficient)
  const ollamaOk = await checkOllama();
  if (ollamaOk.available) {
    try {
      return await callOllamaNative(model, user, system, maxTokens);
    } catch (err) {
      // Fall through to OpenAI-compat or llama.cpp
      const msg = (err as Error).message;
      if (!msg.includes('404')) throw err; // 404 = model not found, fall through to llama.cpp
    }
  }

  // Try Ollama via OpenAI-compatible API
  if (ollamaOk.available) {
    try {
      return await callOpenAICompat(OLLAMA_URL, model, system, user, maxTokens, req.history);
    } catch { /* fall through */ }
  }

  // Try llama.cpp server
  const llamaOk = await checkLlamaCpp();
  if (llamaOk.available) {
    return await callOpenAICompat(LLAMACPP_URL, model, system, user, maxTokens, req.history);
  }

  throw new Error('No local AI backend available. Start Ollama or llama.cpp server.');
}

export function isLocalAIAvailable(): Promise<boolean> {
  return Promise.all([checkOllama(), checkLlamaCpp()])
    .then(([o, l]) => o.available || l.available);
}
