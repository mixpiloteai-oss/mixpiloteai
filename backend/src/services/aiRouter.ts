// ============================================================
// NEUROTEK AI — Smart AI Router
// ============================================================
// Decides whether to use cloud (Claude API) or local (Ollama/llama.cpp).
// Priority order:
//   1. User preference override (via X-AI-Backend header or body param)
//   2. Local if: local is available AND user plan === 'free' AND cloud not configured
//   3. Cloud if: Claude API key is configured
//   4. Local fallback if cloud fails and local is available
//   5. Demo response if nothing is available
// ============================================================
import { callClaude, isConfigured, getDemoResponse, type AIRequest, type AIResponse } from './aiGateway';
import { callLocalAI, isLocalAIAvailable, getLocalAIStatus } from './localAIService';
import { logger } from '../utils/logger';

export type AIBackendChoice = 'cloud' | 'local' | 'auto';

export interface RoutedAIResponse extends AIResponse {
  backend: 'cloud' | 'local' | 'demo';
  localModel?: string;
  fallback?: boolean;
}

export interface AIRouterOptions {
  /** Force a specific backend. 'auto' lets the router decide. */
  preferredBackend?: AIBackendChoice;
  /** Specific local model override (Ollama model name or catalogue ID). */
  localModel?: string;
}

// ── Routing logic ──────────────────────────────────────────────

export async function routeAI(
  req: AIRequest,
  opts: AIRouterOptions = {}
): Promise<RoutedAIResponse> {
  const { preferredBackend = 'auto', localModel } = opts;

  // Explicit override — respect the caller's choice
  if (preferredBackend === 'local') {
    return await callLocalWithFallback(req, localModel);
  }

  if (preferredBackend === 'cloud') {
    return await callCloudWithFallback(req);
  }

  // Auto-routing
  const cloudConfigured = isConfigured();

  // Free plan with no cloud key → try local
  if (!cloudConfigured) {
    const localAvail = await isLocalAIAvailable();
    if (localAvail) {
      return await callLocalWithFallback(req, localModel);
    }
    // Neither available — return demo
    return toDemoResponse(req);
  }

  // Cloud is configured — use it, fall back to local if it fails
  return await callCloudWithFallback(req, localModel);
}

// ── Internal helpers ───────────────────────────────────────────

async function callCloudWithFallback(
  req: AIRequest,
  localModel?: string
): Promise<RoutedAIResponse> {
  try {
    const result = await callClaude(req);
    return { ...result, backend: 'cloud' };
  } catch (err) {
    logger.warn('[AIRouter] Cloud failed, trying local fallback', {
      error: (err as Error).message,
    });

    const localAvail = await isLocalAIAvailable();
    if (localAvail) {
      try {
        const result = await callLocalAI(req, localModel);
        return { ...result, backend: 'local', fallback: true };
      } catch (localErr) {
        logger.warn('[AIRouter] Local fallback also failed', {
          error: (localErr as Error).message,
        });
      }
    }

    return toDemoResponse(req);
  }
}

async function callLocalWithFallback(
  req: AIRequest,
  localModel?: string
): Promise<RoutedAIResponse> {
  try {
    const result = await callLocalAI(req, localModel);
    return { ...result, backend: 'local', localModel: result.model };
  } catch (err) {
    logger.warn('[AIRouter] Local AI failed, trying cloud fallback', {
      error: (err as Error).message,
    });

    if (isConfigured()) {
      try {
        const result = await callClaude(req);
        return { ...result, backend: 'cloud', fallback: true };
      } catch (cloudErr) {
        logger.warn('[AIRouter] Cloud fallback also failed', {
          error: (cloudErr as Error).message,
        });
      }
    }

    return toDemoResponse(req);
  }
}

function toDemoResponse(req: AIRequest): RoutedAIResponse {
  const content = getDemoResponse(req.messageType);
  return {
    content,
    model: 'demo',
    inputTokens: 0,
    outputTokens: 0,
    backend: 'demo',
  };
}

// ── Status check (for settings UI) ────────────────────────────

export interface AIRoutingStatus {
  cloudAvailable: boolean;
  localAvailable: boolean;
  recommendedBackend: AIBackendChoice;
  localStatus?: Awaited<ReturnType<typeof getLocalAIStatus>>;
}

export async function getRoutingStatus(): Promise<AIRoutingStatus> {
  const cloudAvailable = isConfigured();
  const localStatus = await getLocalAIStatus();

  let recommendedBackend: AIBackendChoice = 'auto';
  if (cloudAvailable && !localStatus.available) recommendedBackend = 'cloud';
  else if (!cloudAvailable && localStatus.available) recommendedBackend = 'local';

  return {
    cloudAvailable,
    localAvailable: localStatus.available,
    recommendedBackend,
    localStatus,
  };
}
