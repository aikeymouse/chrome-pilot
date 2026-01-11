#!/bin/bash

##############################################################################
# ChromePilot - Update Server Script
# Copies updated server code to installed location and restarts the server
##############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}ChromePilot Server Update${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Configuration
INSTALL_DIR="$HOME/.chrome-pilot"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check if installed directory exists
if [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${RED}Error: ChromePilot is not installed at $INSTALL_DIR${NC}"
    echo "Please run the installation script first."
    exit 1
fi

# Stop the running server
echo -e "${YELLOW}→${NC} Stopping server..."
pkill -9 -f browser-pilot-server.js 2>/dev/null || true
sleep 1

# Copy updated server file
echo -e "${YELLOW}→${NC} Copying updated server code..."
cp "$SOURCE_DIR/native-host/browser-pilot-server.js" "$INSTALL_DIR/native-host/browser-pilot-server.js"

echo -e "${GREEN}✓${NC} Server code updated successfully"
echo ""
echo "Next steps:"
echo "  1. Reload the Chrome extension at chrome://extensions"
echo "  2. The server will restart automatically when the extension reconnects"
echo ""
