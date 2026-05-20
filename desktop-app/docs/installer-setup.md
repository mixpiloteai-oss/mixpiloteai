# Neurotek Studio — Production Build & Installer Setup

## Environment Variables

### Windows Code Signing
- `CSC_LINK` — path or URL to your `.p12` / `.pfx` certificate
- `CSC_KEY_PASSWORD` — password for the certificate

### macOS Code Signing & Notarization
- `CSC_LINK` — path or URL to your `.p12` certificate
- `CSC_KEY_PASSWORD` — certificate password
- `APPLE_ID` — your Apple developer email
- `APPLE_APP_SPECIFIC_PASSWORD` — app-specific password from appleid.apple.com
- `APPLE_TEAM_ID` — your 10-character Team ID from developer.apple.com

### GitHub Releases (auto-updater publish)
- `GH_TOKEN` — GitHub personal access token with `repo` scope

## Replacing Placeholder Icons

The `assets/` directory contains generated placeholder icons (purple 1024x1024).
Before shipping, replace them:

1. `assets/icon.png` — 1024x1024 PNG, used for macOS and Linux
2. `assets/icon.ico` — multi-size ICO (256, 128, 64, 32, 16 px), used for Windows

Tools: use [electron-icon-builder](https://github.com/safu9/electron-icon-builder)
or generate from a source SVG with Inkscape / ImageMagick.

## Build Commands

```bash
# Windows installer (NSIS) + portable exe
npm run build:win

# macOS DMG (x64 + arm64 universal)
npm run build:mac

# Linux AppImage
npm run build:linux
```

Output goes to the `release/` directory.

## Publishing a GitHub Release

1. Create and push a git tag: `git tag v1.2.3 && git push origin v1.2.3`
2. Create a GitHub release (draft) for that tag on GitHub.com
3. Run the build with `GH_TOKEN` set — electron-builder will upload artifacts:
   ```bash
   GH_TOKEN=ghp_... npm run build:mac
   GH_TOKEN=ghp_... npm run build:win
   GH_TOKEN=ghp_... npm run build:linux
   ```
4. Publish the release on GitHub — auto-updater clients will pick it up.

Publish config (in `package.json`):
- provider: `github`, owner: `mixpiloteai-oss`, repo: `mixpiloteai`

## Auto-Updater Flow

- On launch (5s delay) and every 6 hours, the app calls `autoUpdater.checkForUpdates()`.
- When an update is found, the renderer shows the `UpdateBanner` with version info.
- The user clicks **Download** — the update downloads in the background with progress.
- When complete, a **Restart Now / Later** prompt appears in both the banner and a
  native dialog.
- On next quit (or immediately), the installer is invoked silently.
- In development (`app.isPackaged === false`) all updater calls return `{ dev: true }`.

## Startup Guard (Crash Recovery)

`src/main/modules/startupGuard.ts` writes a counter to `userData/startup-guard.json`.
If the app starts 3+ times without staying open for 30 seconds, it shows a recovery
dialog offering:

1. **Reset Settings** — deletes `config.json`, `startup-guard.json`, `plugin-blacklist.json`
2. **Reinstall** — opens `https://mixpiloteai.com/download` and quits
3. **Continue Anyway** — resets the counter and proceeds normally

## NSIS Customization

`build/installer.nsh` provides two hooks:

- `customInstall` — kills any running Neurotek Studio process before installation
- `customUnInstall` — asks the user whether to delete `%APPDATA%\Neurotek Studio`
  and registry keys; defaults to keeping data

To customize installer UI further, add NSIS directives to `build/installer.nsh`.
