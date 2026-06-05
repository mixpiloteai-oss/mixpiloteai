// ============================================================
// NEUROTEK AI — Prompt Injection Guard
// ============================================================
// Detects and blocks prompt injection attempts in AI requests.
// Applies multiple detection strategies with configurable strictness.
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { logSecurityEvent } from '../utils/securityLog';

// Prompt injection patterns — ordered by severity
const CRITICAL_PATTERNS: RegExp[] = [
  // Direct instruction override
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|context|rules?)/i,
  /ignore\s+all\s+instructions?/i,
  /forget\s+(everything|all|your\s+instructions?|your\s+training)/i,
  /disregard\s+(all|previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  // Role/persona override
  /you\s+are\s+now\s+(a\s+)?(different|unrestricted|evil|jailbroken|dan|devel)/i,
  /pretend\s+(you\s+are|to\s+be)\s+(an?\s+)?(?:unrestricted|evil|jailbroken|different)/i,
  /act\s+as\s+(if\s+you\s+are\s+)?(an?\s+)?(?:unrestricted|evil|jailbroken|different\s+ai)/i,
  // Known jailbreak patterns
  /\bdan\s+mode\b/i,
  /\bjailbreak\b/i,
  /\bdeveloper\s+mode\b/i,
  /\bgpt-?4?\s+jailbreak\b/i,
  // System prompt extraction
  /reveal\s+(your\s+)?(system\s+prompt|instructions?|training|initial\s+prompt)/i,
  /print\s+(your\s+)?(system\s+prompt|instructions?|initial\s+prompt)/i,
  /what\s+(are|were)\s+your\s+(initial|system|original)\s+instructions?/i,
  // Code execution attempts
  /\beval\s*\(/i,
  /\bexec\s*\(/i,
  /\bos\.system\b/i,
  /subprocess\.(?:call|run|Popen)/i,
  // Injection via special tokens
  /<\|im_start\|>|<\|im_end\|>/,
  /\[INST\]|\[\/INST\]/,
  /<<SYS>>|<\/SYS>/,
];

const HIGH_PATTERNS: RegExp[] = [
  /\bsudo\s+/i,
  /you\s+must\s+(obey|follow|comply\s+with|accept)\s+(my|all|every)\s+(command|instruction|order)/i,
  /override\s+(your\s+)?(safety|ethical|moral|content)\s+(filter|guidelines?|rules?|policy|policies)/i,
  /bypass\s+(your\s+)?(safety|ethical|content)\s+(filter|check|guidelines?)/i,
  /\bbase64\b.*\bdecode\b/i,
  /as\s+an?\s+ai\s+without\s+(any\s+)?(restriction|filter|limit|guideline)/i,
];

const MEDIUM_PATTERNS: RegExp[] = [
  /repeat\s+after\s+me\s*:/i,
  /translate\s+the\s+following\s+and\s+then\s+execute/i,
  /\btoken\s+limit\s+bypass\b/i,
  /complete\s+the\s+following\s+without\s+(any\s+)?(filter|check|safety)/i,
];

type InjectionSeverity = 'critical' | 'high' | 'medium';

interface InjectionResult {
  detected: boolean;
  severity?: InjectionSeverity;
  pattern?: string;
}

export function detectPromptInjection(text: string): InjectionResult {
  const cleanText = text.replace(/[​-‏﻿]/g, ''); // strip zero-width chars

  for (const pattern of CRITICAL_PATTERNS) {
    if (pattern.test(cleanText)) {
      return { detected: true, severity: 'critical', pattern: pattern.source.slice(0, 60) };
    }
  }
  for (const pattern of HIGH_PATTERNS) {
    if (pattern.test(cleanText)) {
      return { detected: true, severity: 'high', pattern: pattern.source.slice(0, 60) };
    }
  }
  for (const pattern of MEDIUM_PATTERNS) {
    if (pattern.test(cleanText)) {
      return { detected: true, severity: 'medium', pattern: pattern.source.slice(0, 60) };
    }
  }

  return { detected: false };
}

function extractTextFields(obj: unknown, maxDepth = 4): string[] {
  if (maxDepth <= 0) return [];
  if (typeof obj === 'string') return [obj];
  if (Array.isArray(obj)) {
    return obj.flatMap(item => extractTextFields(item, maxDepth - 1));
  }
  if (typeof obj === 'object' && obj !== null) {
    return Object.values(obj as Record<string, unknown>)
      .flatMap(v => extractTextFields(v, maxDepth - 1));
  }
  return [];
}

/**
 * Middleware that scans AI request bodies for prompt injection.
 * Mount only on /api/ai/* routes.
 */
export function promptInjectionGuard(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body as unknown;
  const texts = extractTextFields(body);
  const combined = texts.join(' ');

  const result = detectPromptInjection(combined);

  if (!result.detected) {
    next();
    return;
  }

  const severity = result.severity ?? 'medium';

  logSecurityEvent({
    type: 'suspicious_payload',
    severity: severity === 'critical' ? 'critical' : 'warn',
    ip: req.ip,
    route: req.path,
    reason: `Prompt injection (${severity}): ${result.pattern ?? 'unknown'}`,
  });

  if (severity === 'medium') {
    // For medium severity, allow through but log
    next();
    return;
  }

  res.status(400).json({
    success: false,
    error: 'Request contains disallowed content',
    code: 'PROMPT_INJECTION_DETECTED',
  });
}
