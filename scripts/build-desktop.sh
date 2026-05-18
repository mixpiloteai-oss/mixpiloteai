#!/usr/bin/env bash
# ============================================================
# NeuroTek AI — Desktop Build Script
#
# Usage:
#   ./scripts/build-desktop.sh [win|mac|linux|all]
#
# NOTE: Windows (.exe) builds require running on Windows or
#   triggering the GitHub Actions workflow:
#   .github/workflows/build-desktop-win.yml
#
# On Linux, this produces win-unpacked/ (functional Windows app)
# but cannot generate the NSIS installer without Wine.
# Use GitHub Actions for official release builds.
# ============================================================
set -euo pipefail

PLATFORM=${1:-win}
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[NeuroTek AI] Building frontend..."
cd "$ROOT_DIR/frontend"
npm ci --prefer-offline
npm run build

echo "[NeuroTek AI] Building Electron ($PLATFORM)..."
cd "$ROOT_DIR/electron"
npm ci --prefer-offline --ignore-scripts

export CSC_IDENTITY_AUTO_DISCOVERY=false

case "$PLATFORM" in
  win)
    npx electron-builder --win --x64
    echo "[NeuroTek AI] Portable zip packaging..."
    cd "$ROOT_DIR/electron/release"
    VERSION=$(node -e "console.log(require('../package.json').version)")
    zip -r "NeuroTek-AI-Portable-${VERSION}.zip" win-unpacked/ -q 2>/dev/null || true
    ls -lh *.exe *.zip 2>/dev/null || ls -lh
    ;;
  mac)   npx electron-builder --mac ;;
  linux) npx electron-builder --linux ;;
  all)   npx electron-builder ;;
  *)
    echo "Unknown platform: $PLATFORM"
    exit 1
    ;;
esac

echo "[NeuroTek AI] Done. Artifacts in electron/release/"
