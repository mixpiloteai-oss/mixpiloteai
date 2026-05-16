# NEUROTEK AI — Future Music Production

> AI-powered SaaS production assistant for electronic music producers: mentalcore, hardtek, tribe, acidcore, hard techno

---

## Architecture

```
USERS (browser/Electron)
        │
        ▼  JWT Auth
┌─────────────────────┐
│  Frontend (React)   │  ← NEVER sees Claude API key
│  localhost:3000     │
└─────────────────────┘
        │  Bearer Token
        ▼
┌─────────────────────┐
│  Backend (Node.js)  │  ← Auth + Quota + Rate limiting
│  localhost:4000     │  ← CLAUDE_API_KEY in .env only
└─────────────────────┘
        │  Internal token
        ▼
┌─────────────────────┐
│  AI Service (Python)│  ← Internal only, never public
│  localhost:8000     │  ← Protected by INTERNAL_SERVICE_TOKEN
└─────────────────────┘
        │
        ▼
    Claude API
```

**Security principle:** The Claude API key lives only in `backend/.env` and `ai-service/.env`.
It is never sent to the browser, never in JavaScript bundles, never in the Electron process.

---

## Subscription Plans

| Plan | AI Requests/Day | Price |
|------|----------------|-------|
| **Free** | 20 | Free forever |
| **Pro** | 200 | €14.90/mo |
| **Studio** | Unlimited | €39/mo |

---

## Supported Genres

| Genre | BPM Range | Description |
|-------|-----------|-------------|
| Mentalcore | 190–220 | Ultra-fast psychedelic hardcore, screaming acid lines |
| Hardtek / Technoid | 140–155 | French raw tekno, distorted kicks |
| Tribe | 140–155 | Percussion-heavy organic tekno |
| Acidcore | 160–180 | 303-driven hardcore, breakbeats |
| Hard Techno | 145–165 | Dark industrial techno |
| Tekno | 150–165 | Free tekno, minimalist |

---

## Quick Start

### 1. Environment Setup

```bash
# Backend
cp backend/.env.example backend/.env
# → Fill in: CLAUDE_API_KEY, JWT_SECRET, JWT_REFRESH_SECRET, INTERNAL_SERVICE_TOKEN

# AI Service
cp ai-service/.env.example ai-service/.env
# → Fill in: CLAUDE_API_KEY, INTERNAL_SERVICE_TOKEN (same as backend)

# Frontend
cp frontend/.env.example frontend/.env.local
# → Set VITE_API_URL=http://localhost:4000
```

### 2. Start Services

```bash
# Frontend
cd frontend && npm install && npm run dev    # → http://localhost:3000

# Backend
cd backend && npm install && npm run dev     # → http://localhost:4000

# AI Service
cd ai-service && pip install -r requirements.txt
uvicorn main:app --reload --port 8000        # → http://localhost:8000
```

### 3. Demo Accounts

| Email | Password | Plan |
|-------|----------|------|
| `free@neurotek.ai` | `demo1234` | Free (20 req/day) |
| `pro@neurotek.ai` | `demo1234` | Pro (200 req/day) |
| `studio@neurotek.ai` | `demo1234` | Studio (unlimited) |

---

## Features

| Feature | Free | Pro | Studio |
|---------|------|-----|--------|
| Dashboard & Projects | ✓ | ✓ | ✓ |
| Basic Templates | ✓ | ✓ | ✓ |
| All Genre Templates | — | ✓ | ✓ |
| Mix Assistant | — | ✓ | ✓ |
| Live Mode | — | ✓ | ✓ |
| AI Chat | 20/day | 200/day | Unlimited |
| Kick/Acid Designer | — | ✓ | ✓ |
| Cloud Sync | — | — | ✓ |

---

## Security

- **API key isolation:** `CLAUDE_API_KEY` is server-only, never in frontend bundles
- **JWT auth:** Short-lived access tokens (7d) + rotating refresh tokens (30d)
- **Rate limiting:** Per-plan per-minute limits via `express-rate-limit`
- **Daily quota:** Per-user daily AI request caps enforced server-side
- **Internal service auth:** Backend→AI Service calls require `INTERNAL_SERVICE_TOKEN`
- **Brute force protection:** Auth endpoints rate-limited to 20 req/15min per IP
- **CORS:** Restricted to configured origins only

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, Framer Motion, Zustand, Axios |
| Backend | Node.js, Express, TypeScript, JWT, bcryptjs, Anthropic SDK |
| AI Service | Python, FastAPI, Pydantic, Anthropic SDK, python-dotenv |
| Desktop | Electron (optional wrapper) |

---

MIT — Made for the underground tekno scene.
