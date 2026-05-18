#!/usr/bin/env bash
# ============================================================
# NeuroTek AI — Icon Generation Script
# Requires: Inkscape (SVG→PNG) + ImageMagick (PNG→ICO)
#           or: npm install -g @electron/icon-maker
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT_DIR/electron/assets"
SVG="$ASSETS/icon.svg"

if [ ! -f "$SVG" ]; then
  echo "ERROR: $SVG not found. Place your icon SVG at electron/assets/icon.svg"
  exit 1
fi

echo "[NeuroTek AI] Generating 512x512 PNG..."
inkscape --export-filename="$ASSETS/icon.png" --export-width=512 --export-height=512 "$SVG"

echo "[NeuroTek AI] Generating ICO (Windows)..."
convert "$ASSETS/icon.png" -define icon:auto-resize=256,128,64,48,32,16 "$ASSETS/icon.ico"

echo "[NeuroTek AI] Generating ICNS (macOS)..."
# macOS: requires png2icns or iconutil
if command -v png2icns &>/dev/null; then
  png2icns "$ASSETS/icon.icns" "$ASSETS/icon.png"
elif command -v iconutil &>/dev/null; then
  ICONSET="$ASSETS/icon.iconset"
  mkdir -p "$ICONSET"
  for SIZE in 16 32 64 128 256 512; do
    convert "$ASSETS/icon.png" -resize ${SIZE}x${SIZE} "$ICONSET/icon_${SIZE}x${SIZE}.png"
    convert "$ASSETS/icon.png" -resize $((SIZE*2))x$((SIZE*2)) "$ICONSET/icon_${SIZE}x${SIZE}@2x.png"
  done
  iconutil -c icns -o "$ASSETS/icon.icns" "$ICONSET"
  rm -rf "$ICONSET"
else
  echo "WARN: No ICNS generator found. Install png2icns or run on macOS with iconutil."
fi

echo "[NeuroTek AI] Icons generated in $ASSETS"
ls -lh "$ASSETS"
