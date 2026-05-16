// ============================================================
// NEUROTEK AI — Smart Model Selection & Cost Optimizer
// ============================================================
import { PLANS, type Plan } from '../data/plans';

export type ModelTier = 'haiku' | 'sonnet' | 'opus';

const MODEL_COSTS: Record<ModelTier, { input: number; output: number }> = {
  haiku:  { input: 0.25,  output: 1.25  },
  sonnet: { input: 3.00,  output: 15.00 },
  opus:   { input: 15.00, output: 75.00 },
};

export interface ModelSelection {
  model: string;
  tier: ModelTier;
  maxTokens: number;
  cacheSystemPrompt: boolean;
}

function tierToModelId(tier: ModelTier): string {
  const overrides: Partial<Record<ModelTier, string>> = {
    haiku:  process.env.CLAUDE_MODEL_HAIKU  ?? 'claude-haiku-4-5-20251001',
    sonnet: process.env.CLAUDE_MODEL_SONNET ?? 'claude-sonnet-4-6',
    opus:   process.env.CLAUDE_MODEL_OPUS   ?? process.env.CLAUDE_MODEL ?? 'claude-opus-4-7',
  };
  return overrides[tier] ?? process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
}

export function selectModel(plan: Plan, requestType: string, messageLength: number): ModelSelection {
  const planConfig = PLANS[plan] ?? PLANS.free;
  let tier: ModelTier = planConfig.model;

  if (tier === 'opus' && messageLength < 50 && requestType === 'chat') tier = 'sonnet';
  if (tier === 'sonnet' && messageLength < 30 && !['coach', 'mix'].includes(requestType)) tier = 'haiku';
  if (tier === 'haiku' && ['mix', 'template'].includes(requestType)) tier = 'sonnet';

  const maxTokens = requestType === 'coach' ? 2048 : requestType === 'template' ? 3000 : 1500;

  return { model: tierToModelId(tier), tier, maxTokens, cacheSystemPrompt: true };
}

export function estimateCost(tier: ModelTier, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[tier];
  return ((inputTokens * costs.input) + (outputTokens * costs.output)) / 1_000_000;
}
