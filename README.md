# NeuroTek AI

[![License: MIT](https://img.shields.io/badge/License-MIT-a78bfa.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0--beta.1-06b6d4.svg)](https://github.com/mixpiloteai-oss/mixpiloteai/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-7c3aed.svg)](https://github.com/mixpiloteai-oss/mixpiloteai/releases)
[![Issues](https://img.shields.io/github/issues/mixpiloteai-oss/mixpiloteai)](https://github.com/mixpiloteai-oss/mixpiloteai/issues)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2.svg)](https://discord.gg/neurotek)

**The AI-Powered Music Production Studio.**  
Generate beats, melodies, and full arrangements with one click — free to download, no credit card required.

[**Download for Windows →**](https://github.com/mixpiloteai-oss/mixpiloteai/releases/download/v1.0.0-beta.1/NeuroTek-AI-Setup-1.0.0-beta.1.exe) &nbsp;|&nbsp; [Website](https://neurotek.ai) &nbsp;|&nbsp; [Discord](https://discord.gg/neurotek) &nbsp;|&nbsp; [Docs](https://github.com/mixpiloteai-oss/mixpiloteai/wiki)

---

## Screenshots

> Screenshots and demo GIFs will be added here once the first public build is available.

| Main DAW | Piano Roll | AI Generation |
|----------|-----------|---------------|
| *(coming soon)* | *(coming soon)* | *(coming soon)* |

---

## Features

### DAW
- **Piano Roll** — Full MIDI editor with velocity editing, quantize, zoom, multi-select
- **Arrangement Timeline** — Pattern-based sequencer with clip dragging and loop regions
- **Mixer** — Per-track faders, mute/solo, send/return routing, master bus
- **Sample Browser** — Local library browser with drag-to-track and waveform preview
- **Transport** — BPM, time signature, play/pause/stop, loop toggle

### AI
- **Text-to-pattern** — Describe a groove; AI generates a MIDI pattern instantly
- **Chord suggestions** — One-click AI chord progressions tuned to genre and key
- **Genre presets** — Mentalcore, Hardtek, Tribe, Acidcore, Hard Techno, Tekno

### Desktop (Electron)
- Native Windows installer + portable `.exe`
- ASIO / WASAPI audio backend
- VST2 / VST3 plugin scanner
- Auto-update notifications
- System tray integration

---

## Download

| Platform | Status | Link |
|----------|--------|------|
| Windows 10 / 11 (64-bit) | ✅ Available | [Installer](https://github.com/mixpiloteai-oss/mixpiloteai/releases/download/v1.0.0-beta.1/NeuroTek-AI-Setup-1.0.0-beta.1.exe) · [Portable](https://github.com/mixpiloteai-oss/mixpiloteai/releases/download/v1.0.0-beta.1/NeuroTek-AI-Portable-1.0.0-beta.1.exe) |
| macOS (Apple Silicon / Intel) | 🔜 In testing | — |
| Linux (AppImage) | 🔜 Planned 2025 | — |

**Minimum requirements:** Windows 10 64-bit, 4 GB RAM, 2 GHz dual-core, 2 GB disk space

---

## Pricing

| Plan | AI Generations | Projects | Price |
|------|---------------|----------|-------|
| **Free** | 10 / month | 5 | Free forever |
| **Pro** | 200 / month | Unlimited | €14.90/mo |
| **Studio** | Unlimited | Unlimited + Cloud Sync | €39/mo |

---

## Roadmap

- [x] Windows desktop app (Electron)
- [x] Piano Roll + Arrangement Timeline
- [x] AI text-to-pattern generation
- [x] VST2/VST3 plugin scanner
- [x] ASIO audio support
- [ ] macOS build (beta.2)
- [ ] MIDI controller mapping (beta.2)
- [ ] Per-track AI generation (beta.2)
- [ ] On-device AI mode (offline)
- [ ] Linux AppImage
- [ ] VST3 plugin hosting (generate in plugin)
- [ ] Collaboration / cloud projects

---

## Architecture

```
Users (browser / Electron)
        │
        ▼  JWT
┌────────────────────┐
│  Frontend (React)  │  ← Claude API key is NEVER here
└────────────────────┘
        │  Bearer token
        ▼
┌────────────────────┐
│  Backend (Node.js) │  ← CLAUDE_API_KEY in backend/.env only
└────────────────────┘
        │  Internal token
        ▼
┌────────────────────┐
│  AI Service (Py)   │  ← Internal only, never public-facing
└────────────────────┘
        │
        ▼
    Claude API (Anthropic)
```

**Security:** The Claude API key lives only in `backend/.env` and `ai-service/.env`. It is never sent to the browser, never in JS bundles, never in the Electron renderer.

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend DAW | React 18, TypeScript, Vite, TailwindCSS, Framer Motion, Zustand |
| Backend | Node.js, Express, TypeScript, JWT, bcryptjs, Anthropic SDK |
| AI Service | Python, FastAPI, Pydantic, Anthropic SDK |
| Desktop | Electron 28, electron-builder 24 |
| Website | React 18, TypeScript, Vite, HashRouter |

---

## Development Setup

### Prerequisites

- Node.js 18+
- Python 3.10+
- npm 9+

### 1. Clone & install

```bash
git clone https://github.com/mixpiloteai-oss/mixpiloteai.git
cd mixpiloteai
npm install
```

### 2. Configure environment

```bash
# Backend
cp backend/.env.example backend/.env
# Fill in: CLAUDE_API_KEY, JWT_SECRET, JWT_REFRESH_SECRET, INTERNAL_SERVICE_TOKEN

# AI Service
cp ai-service/.env.example ai-service/.env
# Fill in: CLAUDE_API_KEY, INTERNAL_SERVICE_TOKEN (same as backend)

# Frontend
cp frontend/.env.example frontend/.env.local
# Set: VITE_API_URL=http://localhost:4000
```

### 3. Start services

```bash
# Frontend DAW (http://localhost:3000)
cd frontend && npm install && npm run dev

# Backend (http://localhost:4000)
cd backend && npm install && npm run dev

# AI Service (http://localhost:8000)
cd ai-service && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Website (http://localhost:5173)
cd website && npm install && npm run dev
```

### 4. Build Electron app

```bash
cd electron && npm install
npm run build   # builds frontend first, then packages Electron
```

---

## Contributing

Contributions are welcome! Please read the guidelines below.

1. Fork the repo and create a feature branch: `git checkout -b feat/your-feature`
2. Make your changes with clear, focused commits
3. Ensure TypeScript compiles with zero errors: `cd frontend && npx tsc --noEmit`
4. Open a pull request against `main` — describe the change and why

**Bug reports:** [Open an issue](https://github.com/mixpiloteai-oss/mixpiloteai/issues) with steps to reproduce, your Windows version, and any relevant logs (Help → Show Log Folder).

**Security vulnerabilities:** Email security@neurotek.ai — do not open a public issue.

---

## Community

- [Discord Server](https://discord.gg/neurotek) — 3,200+ producers, beat battles, dev Q&A
- [GitHub Discussions](https://github.com/mixpiloteai-oss/mixpiloteai/discussions)
- [Documentation Wiki](https://github.com/mixpiloteai-oss/mixpiloteai/wiki)

---

## License

MIT — see [LICENSE](LICENSE)

Made for the underground tekno scene.
