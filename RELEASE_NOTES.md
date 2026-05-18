# Release Notes — v1.0.0-beta.1

**Released:** May 14, 2025  
**Type:** Public Beta  
**Platform:** Windows 10 / 11 (64-bit)

---

## Highlights

This is the first public beta of NeuroTek AI — an AI-powered music production studio built for electronic music producers. It ships a full DAW with AI-assisted generation, a Piano Roll, Arrangement Timeline, Sample Browser, and a Mixer.

---

## What's New

### Core DAW
- **Piano Roll** — Full MIDI editor with velocity editing, quantize, zoom, and multi-note selection
- **Arrangement Timeline** — Pattern-based sequencer with clip dragging, loop regions, and track management
- **Mixer** — Per-track volume/pan faders, mute/solo, send/return routing, and a master bus
- **Sample Browser** — Local library browser with drag-to-track and waveform preview
- **Transport** — Play/pause/stop, BPM control, time signature, and loop toggle

### AI Generation
- **Text-to-pattern** — Describe a groove in plain language; AI generates a MIDI pattern
- **AI chord suggestions** — One-click chord progressions tuned to genre and key
- **Prompt history** — Last 20 prompts saved per session for quick iteration
- **Genre presets** — Mentalcore, Hardtek, Tribe, Acidcore, Hard Techno, Tekno

### Electron Desktop App
- Native Windows installer (NSIS) and portable `.exe`
- System tray integration with minimize-to-tray
- Auto-update checker (notifies when a new release is available)
- ASIO / WASAPI audio backend support
- VST2/VST3 plugin scanner
- Crash log collection (opt-in)

### Account & Sync
- Email / password account creation
- Discord OAuth sign-in
- Free tier: 10 AI generations/month, 5 project slots
- Pro tier: 200 AI generations/month, unlimited projects, stem export
- Studio tier: Unlimited AI, cloud sync, priority support

### Website
- Full marketing site at neurotek.ai
- Download, Pricing, Changelog, Support, Marketplace, Merch pages
- Privacy Policy and Terms of Service
- Open Graph / Twitter Card social previews

---

## Known Issues

| # | Area | Description | Workaround |
|---|------|-------------|------------|
| 1 | Audio | WASAPI exclusive mode conflicts with some system audio setups | Switch to Shared mode in Audio Settings |
| 2 | Piano Roll | Very high note counts (500+) may cause scroll lag | Keep patterns under 256 notes |
| 3 | VST Scanner | Some VST2 plugins with non-standard installers may not be detected | Manually point to plugin folder in Settings |
| 4 | AI | Generation may time out on slow connections (>10s) | Retry — the request is stateless |
| 5 | macOS / Linux | Not yet available | Windows only for beta |

---

## Breaking Changes

None — this is the first public release.

---

## Upgrade Instructions

This is a fresh install. No migration required.

1. Download `NeuroTek-AI-Setup-1.0.0-beta.1.exe` from the [Releases page](https://github.com/mixpiloteai-oss/mixpiloteai/releases)
2. Run the installer — accept the SmartScreen prompt ("More info → Run anyway")
3. Launch NeuroTek AI from the desktop shortcut

---

## SHA-256 Checksums

```
NeuroTek-AI-Setup-1.0.0-beta.1.exe      (verify after download via certutil -hashfile <file> SHA256)
NeuroTek-AI-Portable-1.0.0-beta.1.exe   (verify after download via certutil -hashfile <file> SHA256)
```

Checksums will be posted on the GitHub release page after artifacts are uploaded.

---

## Feedback

- **Bug reports:** [GitHub Issues](https://github.com/mixpiloteai-oss/mixpiloteai/issues)
- **Discord:** [discord.gg/neurotek](https://discord.gg/neurotek)
- **Email:** support@neurotek.ai

---

## What's Next (v1.0.0-beta.2)

- macOS build (Apple Silicon + Intel)
- MIDI controller mapping
- Per-track AI generation
- Offline AI mode (on-device)
- Performance improvements for large projects
