#!/bin/bash
# Debian post-remove script for Neurotek Studio

set -e

# Remove MIME type registration
MIME_FILE=/usr/share/mime/packages/neurotek-studio.xml
if [ -f "$MIME_FILE" ]; then
  rm -f "$MIME_FILE"
  if command -v update-mime-database &>/dev/null; then
    update-mime-database /usr/share/mime || true
  fi
fi

# Update desktop database
if command -v update-desktop-database &>/dev/null; then
  update-desktop-database /usr/share/applications || true
fi

exit 0
