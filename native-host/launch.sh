#!/bin/bash
# ChromePilot Native Host Launcher
# This wrapper ensures the correct node version is used

# Kill any existing ChromePilot server on port 9000
lsof -ti :9000 2>/dev/null | xargs kill -9 2>/dev/null

# Set PATH to include common node locations
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
export PATH="$HOME/.nvm/versions/node/v20.11.0/bin:$PATH"
export PATH="$HOME/.nvm/versions/node/v18.19.0/bin:$PATH"
export PATH="/usr/local/bin:$PATH"
export PATH="/opt/homebrew/bin:$PATH"

# Change to the native host directory
cd "$(dirname "$0")"

# Launch the server with error logging
exec node server.js 2>> /tmp/chromepilot-error.log
