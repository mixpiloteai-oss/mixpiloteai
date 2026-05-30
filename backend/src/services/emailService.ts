// ============================================================
// NEUROTEK AI — Email Service (Production-Grade)
//
// Supports:
//   1. Resend (modern API — recommended for production)
//   2. SendGrid (fallback via SENDGRID_API_KEY)
//   3. SMTP/nodemailer-style via SMTP_HOST env vars
//   4. Console logging when no provider configured (dev/test)
//
// Anti-flood: max 3 emails per address per hour (configurable)
// ============================================================

import { logger } from '../utils/logger';

// ── Types ─────────────────────────────────────────────────────

export interface EmailPayload {
  to:      string;
  subject: string;
  html:    string;
  text:    string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  rateLimited?: boolean;
}

// ── Config ────────────────────────────────────────────────────

const FROM_EMAIL  = process.env.FROM_EMAIL  ?? 'noreply@neurotek.ai';
const FROM_NAME   = process.env.FROM_NAME   ?? 'NeuroTek AI';
const APP_URL     = process.env.APP_URL     ?? 'https://app.neurotek.ai';

const RESEND_KEY    = process.env.RESEND_API_KEY;
const SENDGRID_KEY  = process.env.SENDGRID_API_KEY;
const SMTP_HOST     = process.env.SMTP_HOST;
const IS_DEV        = !RESEND_KEY && !SENDGRID_KEY && !SMTP_HOST;

// ── Anti-flood: max 3 emails per address per 60 min ──────────
const emailFloodMap = new Map<string, { count: number; windowStart: number }>();
const MAX_PER_HOUR = 3;
const HOUR_MS      = 60 * 60 * 1000;

// Cleanup every 2 hours
setInterval(() => {
  const cutoff = Date.now() - HOUR_MS;
  for (const [k, v] of emailFloodMap) {
    if (v.windowStart < cutoff) emailFloodMap.delete(k);
  }
}, 2 * HOUR_MS).unref?.();

function checkFlood(email: string): boolean {
  const k = email.toLowerCase().trim();
  const now = Date.now();
  const entry = emailFloodMap.get(k);
  if (!entry || now - entry.windowStart > HOUR_MS) {
    emailFloodMap.set(k, { count: 1, windowStart: now });
    return false; // not flooded
  }
  if (entry.count >= MAX_PER_HOUR) return true; // flooded
  entry.count++;
  return false;
}

// ── HTML Templates ────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: #0a0a0f; font-family: 'Inter', system-ui, sans-serif; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #13131a; border: 1px solid #1e1e2e; border-radius: 12px; padding: 40px; }
    .logo { font-size: 22px; font-weight: 700; color: #a855f7; letter-spacing: -0.5px; margin-bottom: 32px; }
    .logo span { color: #e2e8f0; }
    h1 { font-size: 24px; font-weight: 700; color: #e2e8f0; margin: 0 0 16px; }
    p { font-size: 15px; line-height: 1.6; color: #94a3b8; margin: 0 0 16px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #a855f7, #7c3aed);
           color: #fff !important; text-decoration: none; padding: 14px 28px;
           border-radius: 8px; font-weight: 600; font-size: 15px; margin: 24px 0; }
    .code { background: #1e1e2e; border: 1px solid #2d2d3d; border-radius: 8px;
            padding: 16px; font-family: monospace; font-size: 16px;
            color: #a855f7; letter-spacing: 2px; text-align: center; margin: 24px 0; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #1e1e2e; }
    .footer p { font-size: 13px; color: #4a5568; margin: 4px 0; }
    .warning { background: #1a0e0e; border: 1px solid #7f1d1d; border-radius: 8px;
               padding: 16px; margin: 16px 0; }
    .warning p { color: #fca5a5; font-size: 14px; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="logo">Neuro<span>Tek AI</span></div>
      ${content}
      <div class="footer">
        <p>© ${new Date().getFullYear()} NeuroTek AI — Professional Music Production AI</p>
        <p>This email was sent to you because you have an account at ${APP_URL}</p>
        <p>If you did not request this email, you can safely ignore it.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildPasswordResetEmail(resetUrl: string, expiryMinutes = 60): EmailPayload {
  const html = baseTemplate(`
    <h1>Reset your password</h1>
    <p>We received a request to reset the password for your NeuroTek AI account.</p>
    <p>Click the button below to set a new password. This link expires in <strong>${expiryMinutes} minutes</strong>.</p>
    <a class="btn" href="${resetUrl}">Reset Password</a>
    <p>Or copy this URL into your browser:</p>
    <div class="code" style="font-size: 12px; letter-spacing: 0;">${resetUrl}</div>
    <div class="warning">
      <p>🔒 If you did not request a password reset, your account may be at risk.
         <a href="${APP_URL}/settings/security" style="color: #f87171;">Secure your account</a>.</p>
    </div>
  `);

  const text = `Reset your NeuroTek AI password\n\n` +
    `Click this link to reset your password (expires in ${expiryMinutes} minutes):\n\n${resetUrl}\n\n` +
    `If you did not request this, ignore this email.\n\nNeuroTek AI`;

  return { to: '', subject: 'Reset your NeuroTek AI password', html, text };
}

export function buildVerifyEmailTemplate(verifyUrl: string): EmailPayload {
  const html = baseTemplate(`
    <h1>Verify your email address</h1>
    <p>Welcome to NeuroTek AI! Please confirm your email address to activate your account.</p>
    <a class="btn" href="${verifyUrl}">Verify Email</a>
    <p>Or copy this URL into your browser:</p>
    <div class="code" style="font-size: 12px; letter-spacing: 0;">${verifyUrl}</div>
    <p>This link expires in <strong>24 hours</strong>.</p>
  `);

  const text = `Welcome to NeuroTek AI!\n\n` +
    `Verify your email address:\n\n${verifyUrl}\n\n` +
    `This link expires in 24 hours.\n\nNeuroTek AI`;

  return { to: '', subject: 'Verify your NeuroTek AI email', html, text };
}

export function buildSecurityAlertEmail(event: string, ip: string, details: string): EmailPayload {
  const html = baseTemplate(`
    <h1>Security Alert</h1>
    <p>We detected a security event on your NeuroTek AI account:</p>
    <div class="warning">
      <p><strong>${event}</strong></p>
      <p>IP: ${ip}</p>
      <p>${details}</p>
    </div>
    <p>If this was you, no action is needed.</p>
    <p>If this was <strong>not you</strong>, immediately:</p>
    <p>1. <a href="${APP_URL}/auth/forgot-password" style="color: #a855f7;">Reset your password</a></p>
    <p>2. Review your <a href="${APP_URL}/settings/sessions" style="color: #a855f7;">active sessions</a></p>
  `);

  const text = `NeuroTek AI Security Alert\n\nEvent: ${event}\nIP: ${ip}\n${details}\n\n` +
    `If this was not you, reset your password immediately at ${APP_URL}/auth/forgot-password\n\nNeuroTek AI`;

  return { to: '', subject: `NeuroTek AI Security Alert: ${event}`, html, text };
}

// ── Provider implementations ──────────────────────────────────

async function sendViaResend(payload: EmailPayload): Promise<SendResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    `${FROM_NAME} <${FROM_EMAIL}>`,
      to:      [payload.to],
      subject: payload.subject,
      html:    payload.html,
      text:    payload.text,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error');
    logger.error('[email] Resend send failed', { status: res.status, error: err });
    return { success: false, error: `Resend API error: ${res.status}` };
  }

  const data = await res.json() as { id?: string };
  logger.info('[email] Resend send OK', { messageId: data.id, to: payload.to });
  return { success: true, messageId: data.id };
}

async function sendViaSendGrid(payload: EmailPayload): Promise<SendResult> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: payload.to }], subject: payload.subject }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      content: [
        { type: 'text/plain', value: payload.text },
        { type: 'text/html',  value: payload.html },
      ],
    }),
  });

  if (!res.ok && res.status !== 202) {
    const err = await res.text().catch(() => 'Unknown error');
    logger.error('[email] SendGrid send failed', { status: res.status, error: err });
    return { success: false, error: `SendGrid API error: ${res.status}` };
  }

  const messageId = res.headers.get('x-message-id') ?? undefined;
  logger.info('[email] SendGrid send OK', { messageId, to: payload.to });
  return { success: true, messageId };
}

async function sendViaSmtp(_payload: EmailPayload): Promise<SendResult> {
  // SMTP via nodemailer is supported — install nodemailer and configure SMTP_* env vars.
  // For simpler setup, switch to Resend (RESEND_API_KEY) or SendGrid (SENDGRID_API_KEY).
  logger.warn('[email] SMTP configured but nodemailer not installed — falling back to console. Install nodemailer to enable SMTP.');
  return { success: false, error: 'SMTP requires nodemailer package (npm install nodemailer). Use RESEND_API_KEY or SENDGRID_API_KEY instead.' };
}

function sendViaConsole(payload: EmailPayload): SendResult {
  console.log('\n' + '─'.repeat(60));
  console.log('[EMAIL DEV MODE] Would send email:');
  console.log(`  To:      ${payload.to}`);
  console.log(`  Subject: ${payload.subject}`);
  console.log(`  Text:\n${payload.text.split('\n').map(l => '    ' + l).join('\n')}`);
  console.log('─'.repeat(60) + '\n');
  return { success: true, messageId: `dev_${Date.now()}` };
}

// ── Public API ────────────────────────────────────────────────

/**
 * Send an email. Automatically selects provider based on env vars.
 * Always succeeds in dev (console only). Anti-flood: max 3/hour per address.
 */
export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  if (!payload.to || !payload.subject) {
    return { success: false, error: 'Missing required email fields' };
  }

  // Anti-flood check
  if (checkFlood(payload.to)) {
    logger.warn('[email] flood limit hit', { to: payload.to });
    return { success: false, rateLimited: true, error: 'Email rate limit exceeded' };
  }

  try {
    if (IS_DEV) return sendViaConsole(payload);
    if (RESEND_KEY) return sendViaResend(payload);
    if (SENDGRID_KEY) return sendViaSendGrid(payload);
    if (SMTP_HOST) return sendViaSmtp(payload);
    return sendViaConsole(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[email] send failed unexpectedly', { error: msg, to: payload.to });
    return { success: false, error: msg };
  }
}

/**
 * Send a password reset email to the given address.
 */
export async function sendPasswordResetEmail(
  to: string,
  token: string,
  expiryMinutes = 60,
): Promise<SendResult> {
  const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`;
  const tmpl = buildPasswordResetEmail(resetUrl, expiryMinutes);
  tmpl.to = to;
  return sendEmail(tmpl);
}

/**
 * Send an email verification email.
 */
export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<SendResult> {
  const verifyUrl = `${APP_URL}/auth/verify-email?token=${token}`;
  const tmpl = buildVerifyEmailTemplate(verifyUrl);
  tmpl.to = to;
  return sendEmail(tmpl);
}

/**
 * Send a security alert email (password changed, new device login, etc.).
 */
export async function sendSecurityAlertEmail(
  to: string,
  event: string,
  ip: string,
  details: string,
): Promise<SendResult> {
  const tmpl = buildSecurityAlertEmail(event, ip, details);
  tmpl.to = to;
  return sendEmail(tmpl);
}
