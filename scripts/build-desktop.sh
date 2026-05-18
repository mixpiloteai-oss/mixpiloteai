#!/usr/bin/env bash
# ============================================================
# NeuroTek AI — Desktop Build Script
# Usage: ./scripts/build-desktop.sh [win|mac|linux|all]
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
npm ci --prefer-offline

case "$PLATFORM" in
  win)   npm run build:win ;;
  mac)   npm run build:mac ;;
  linux) npm run build:linux ;;
  all)   npm run build ;;
  *)
    echo "Unknown platform: $PLATFORM"
    echo "Usage: $0 [win|mac|linux|all]"
    exit 1
    ;;
esac

echo "[NeuroTek AI] Build complete. Artifacts in electron/release/"
ls -lh "$ROOT_DIR/electron/release/" 2>/dev/null || true
