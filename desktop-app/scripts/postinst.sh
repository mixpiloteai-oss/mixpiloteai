#!/bin/bash
# Debian post-install script for Neurotek Studio

set -e

# Register MIME type for .ntai project files
if command -v update-mime-database &>/dev/null; then
  mkdir -p /usr/share/mime/packages
  cat > /usr/share/mime/packages/neurotek-studio.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="application/x-neurotek-studio">
    <comment>Neurotek Studio Project</comment>
    <glob pattern="*.ntai"/>
  </mime-type>
</mime-info>
EOF
  update-mime-database /usr/share/mime || true
fi

# Update desktop database so the app appears in launchers
if command -v update-desktop-database &>/dev/null; then
  update-desktop-database /usr/share/applications || true
fi

exit 0
