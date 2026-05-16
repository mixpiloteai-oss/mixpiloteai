// ============================================================
// NEUROTEK AI — AI Gateway Service
//
// The Claude API key NEVER leaves the server.
// ============================================================
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPTS, buildUserPrompt } from '../prompts/systemPrompts';

export interface AIRequest {
  userId: string;
  plan: string;
  messageType: string;
  userMessage: string;
  projectContext?: Record<string, unknown>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AIResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

let client: Anthropic | null = null;

export function isConfigured(): boolean {
  const key = process.env.CLAUDE_API_KEY ?? '';
  return key.length > 0 && !key.includes('REPLACE');
}

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return client;
}

const MAX_TOKENS_BY_PLAN: Record<string, number> = {
  free: 512,
  pro: 1024,
  studio: 2048,
};

export async function callClaude(req: AIRequest): Promise<AIResponse> {
  const anthropic = getClient();
  const systemPrompt = SYSTEM_PROMPTS[req.messageType] ?? SYSTEM_PROMPTS.chat;
  const maxTokens = MAX_TOKENS_BY_PLAN[req.plan] ?? 512;

  const messages: Anthropic.MessageParam[] = [
    ...(req.history ?? []).map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user', content: buildUserPrompt(req) },
  ];

  const response = await anthropic.messages.create({
    model: process.env.CLAUDE_MODEL ?? 'claude-opus-4-7',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  const content = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as Anthropic.TextBlock).text)
    .join('');

  return {
    content,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// Demo responses for when no API key is configured
const DEMO_RESPONSES: Record<string, string> = {
  chat: `Welcome to NEUROTEK AI! I'm your production assistant for mentalcore, hardtek, tribe, acidcore, and hard techno.\n\nWhat can I help you with today? Ask me about:\n• Kick drum design and layering techniques\n• Acid 303 programming and automation\n• Mix analysis and frequency conflict resolution\n• FX chain recommendations for any track type\n• Live set structure and scene organisation`,
  template: `**AI Template Generated** ✓\n\nHere is your production template:\n\n**Track Structure:**\n- KICK LAYER 1 (kick) — Transient Shaper + Clipper\n- MENTAL BASS (bass) — OTT + Saturator\n- ACID 303 (acid) — Filter Sweep + 1/8 Delay\n- PSYCH FX (fx) — Reverb send\n- HH ROLLS (percussion) — Gate + EQ\n- MASTER — Multiband + Limiter\n\n**Routing:** Drums Bus → Synth Bus → FX Bus → Master\n\n**Tips:** Use aggressive sidechain from kick to bass (0ms attack, 120ms release).`,
  mix: `**Mix Analysis Complete** ✓\n\nKey issues found:\n\n1. **Sub-bass conflict** (60–80 Hz) — Kick and bass are masking each other\n   → Apply sidechain compression: Threshold -18dB, Ratio 8:1, Attack 0ms, Release 120ms\n\n2. **Mid-range build-up** (800 Hz) — FX layer competing with acid\n   → Cut -3dB @ 800Hz on FX track (Q: 1.5)\n\n3. **Loudness** — Integrated LUFS is -6, too hot for streaming\n   → Back off master limiter ceiling to -0.5dBTP`,
  fx: `**FX Chain Recommendation** ✓\n\nFor your kick track:\n\n1. **Transient Shaper** — Attack: 0ms, Sustain: -8dB\n2. **EQ** — +6dB @ 55Hz, -5dB @ 250Hz, -2dB @ 500Hz\n3. **Saturator** — Drive 80%, Hard Clip mode\n4. **Bus Compressor** — Threshold: -6dB, Ratio: 4:1, Auto-release\n5. **Limiter** — Ceiling: -0.3dBTP`,
  kick: `**Kick Drum Design** ✓\n\n**Layer 1 — Transient (909 clipped):**\n• Transient Shaper: Attack 0ms, Sustain -8dB\n• EQ: +6dB @ 55Hz, -5dB @ 250Hz\n• Clipper: Hard clip ceiling 0.85\n\n**Layer 2 — Sub (sine C1):**\n• Pitch envelope: C1 → G0 over 50ms\n• Limiter: -3dBTP\n\n**Bus processing:**\n• Glue compressor: -6dB threshold, 4:1\n• Final limiter: -0.3dBTP`,
  live: `**Live Set Structure** ✓\n\n**60-minute set — 8 tracks:**\n\n- 00:00 Scene 1: Intro — Kick + Bass only, 160 BPM\n- 08:00 Scene 2: Build — Add acid layer, rise to 180 BPM\n- 16:00 Scene 3: Peak — Full arrangement, 200 BPM\n- 28:00 Scene 4: Breakdown — Drop to percussion + FX\n- 36:00 Scene 5: Re-build — Kick returns, acid sequence\n- 48:00 Scene 6: Climax — All tracks, maximum energy\n- 55:00 Scene 7: Outro — Gradual mute, loop out`,
  acid: `**Acid Pattern Generated** ✓\n\n**303 Settings:**\n• Cutoff: 500 Hz (sweep to 3kHz over 4 bars)\n• Resonance: 85%\n• Env Mod: 75%\n• Decay: 80ms\n• Accent: 60%\n\n**16-step pattern (C minor):**\nC2 C2 G1* C2 F2 C2 Bb1 C2 C2 Eb2 C2 G1* F2 C2 G1 C2\n(* = slide, bold = accent)\n\n**FX:** 1/8 delay (35% feedback) → Plate reverb (20% mix)`,
};

export function getDemoResponse(type: string): string {
  return DEMO_RESPONSES[type] ?? DEMO_RESPONSES.chat;
}
