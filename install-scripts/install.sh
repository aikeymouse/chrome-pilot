#!/bin/bash

##############################################################################
# ChromePilot - Installation Script (macOS/Linux)
# This script installs or upgrades the ChromePilot native host
##############################################################################

set -e

# Configuration
EXTENSION_NAME="chrome-pilot"
INSTALL_DIR="$HOME/.${EXTENSION_NAME}"
NATIVE_HOST_NAME="com.chromepilot.extension"
VERSION_URL="https://api.github.com/repos/aikeymouse/chrome-pilot/releases/latest"

# Platform detection
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="macos"
    CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    PLATFORM="linux"
    CHROME_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
else
    echo "Error: Unsupported platform: $OSTYPE"
    exit 1
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    print_info "Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        echo "Visit: https://nodejs.org/"
        exit 1
    fi
    
    local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        print_error "Node.js version 18+ required. Current: $(node -v)"
        exit 1
    fi
    
    print_info "Node.js version: $(node -v) ✓"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    print_info "npm version: $(npm -v) ✓"
}

get_current_version() {
    if [ -f "$INSTALL_DIR/native-host/package.json" ]; then
        grep '"version"' "$INSTALL_DIR/native-host/package.json" | head -1 | sed 's/.*: "\(.*\)".*/\1/'
    else
        echo "none"
    fi
}

install_local() {
    print_info "Installing from local files..."
    
    # Get script directory
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
    
    # Create install directory
    mkdir -p "$INSTALL_DIR"
    
    # Backup logs if upgrading
    if [ -d "$INSTALL_DIR/native-host/logs" ]; then
        print_info "Backing up existing logs..."
        cp -r "$INSTALL_DIR/native-host/logs" "$INSTALL_DIR/logs-backup-$(date +%s)"
    fi
    
    # Copy native host files
    print_info "Copying native host files..."
    rm -rf "$INSTALL_DIR/native-host"
    cp -r "$PROJECT_DIR/native-host" "$INSTALL_DIR/"
    
    # Restore logs
    if [ -d "$INSTALL_DIR/logs-backup-"* ]; then
        print_info "Restoring logs..."
        LATEST_BACKUP=$(ls -td "$INSTALL_DIR"/logs-backup-* | head -1)
        mkdir -p "$INSTALL_DIR/native-host/logs"
        cp -r "$LATEST_BACKUP"/* "$INSTALL_DIR/native-host/logs/" 2>/dev/null || true
    fi
    
    # Install dependencies
    print_info "Installing Node.js dependencies..."
    cd "$INSTALL_DIR/native-host"
    npm install --production --silent
    
    # Make server.js executable
    chmod +x "$INSTALL_DIR/native-host/server.js"
    
    print_info "Native host installed to: $INSTALL_DIR/native-host"
}

download_and_install() {
    print_info "Fetching latest release information..."
    
    # Download latest release info
    RELEASE_INFO=$(curl -s "$VERSION_URL" 2>/dev/null || echo "")
    
    if [ -z "$RELEASE_INFO" ]; then
        print_warn "Could not fetch release information. Installing from local files..."
        install_local
        return
    fi
    
    LATEST_VERSION=$(echo "$RELEASE_INFO" | grep '"tag_name"' | head -1 | sed 's/.*: "\(.*\)".*/\1/')
    DOWNLOAD_URL=$(echo "$RELEASE_INFO" | grep '"browser_download_url"' | grep "${EXTENSION_NAME}-native-host.tar.gz" | head -1 | sed 's/.*: "\(.*\)".*/\1/')
    
    if [ -z "$DOWNLOAD_URL" ]; then
        print_warn "No release package found. Installing from local files..."
        install_local
        return
    fi
    
    print_info "Latest version: $LATEST_VERSION"
    print_info "Downloading from: $DOWNLOAD_URL"
    
    # Create temp directory
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    
    # Download release
    curl -L -o native-host.tar.gz "$DOWNLOAD_URL"
    
    # Extract
    print_info "Extracting..."
    tar -xzf native-host.tar.gz
    
    # Backup logs
    if [ -d "$INSTALL_DIR/native-host/logs" ]; then
        print_info "Backing up existing logs..."
        cp -r "$INSTALL_DIR/native-host/logs" "$INSTALL_DIR/logs-backup-$(date +%s)"
    fi
    
    # Install
    print_info "Installing to $INSTALL_DIR..."
    rm -rf "$INSTALL_DIR/native-host"
    mkdir -p "$INSTALL_DIR"
    cp -r native-host "$INSTALL_DIR/"
    
    # Restore logs
    if [ -d "$INSTALL_DIR/logs-backup-"* ]; then
        print_info "Restoring logs..."
        LATEST_BACKUP=$(ls -td "$INSTALL_DIR"/logs-backup-* | head -1)
        mkdir -p "$INSTALL_DIR/native-host/logs"
        cp -r "$LATEST_BACKUP"/* "$INSTALL_DIR/native-host/logs/" 2>/dev/null || true
    fi
    
    # Install dependencies
    print_info "Installing Node.js dependencies..."
    cd "$INSTALL_DIR/native-host"
    npm install --production --silent
    
    # Make server.js executable
    chmod +x "$INSTALL_DIR/native-host/server.js"
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    print_info "Native host installed successfully"
}

register_native_host() {
    print_info "Registering native messaging host..."
    
    # Create Chrome native messaging directory
    mkdir -p "$CHROME_DIR"
    
    # Get node path
    NODE_PATH=$(which node)
    
    # Create launch script
    cat > "$INSTALL_DIR/native-host/launch.sh" <<'LAUNCH_EOF'
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
LAUNCH_EOF
    
    chmod +x "$INSTALL_DIR/native-host/launch.sh"
    
    # Create native messaging manifest
    cat > "$CHROME_DIR/${NATIVE_HOST_NAME}.json" <<EOF
{
  "name": "${NATIVE_HOST_NAME}",
  "description": "ChromePilot Native Messaging Host",
  "path": "$INSTALL_DIR/native-host/launch.sh",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://EXTENSION_ID_PLACEHOLDER/"
  ]
}
EOF
    
    print_info "Native messaging manifest registered at:"
    print_info "$CHROME_DIR/${NATIVE_HOST_NAME}.json"
    print_warn "NOTE: You need to update EXTENSION_ID_PLACEHOLDER with your actual extension ID"
}

verify_installation() {
    print_info "Verifying installation..."
    
    # Check files exist
    if [ ! -f "$INSTALL_DIR/native-host/server.js" ]; then
        print_error "Installation verification failed: server.js not found"
        return 1
    fi
    
    if [ ! -f "$CHROME_DIR/${NATIVE_HOST_NAME}.json" ]; then
        print_error "Installation verification failed: native messaging manifest not found"
        return 1
    fi
    
    # Check Node.js modules
    if [ ! -d "$INSTALL_DIR/native-host/node_modules" ]; then
        print_error "Installation verification failed: node_modules not found"
        return 1
    fi
    
    print_info "Installation verified ✓"
}

show_usage() {
    cat <<EOF
ChromePilot - Installation Script

Usage:
  $0 [options]

Options:
  --upgrade       Upgrade to latest version
  --version       Show installed version
  --uninstall     Remove installation
  --help          Show this help message

Examples:
  $0              # Install from local files
  $0 --upgrade    # Upgrade to latest version
  $0 --version    # Check installed version

EOF
}

uninstall() {
    print_info "Uninstalling ChromePilot..."
    
    # Ask for confirmation
    read -p "Are you sure you want to uninstall? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Uninstall cancelled"
        exit 0
    fi
    
    # Remove installation directory
    if [ -d "$INSTALL_DIR" ]; then
        print_info "Removing $INSTALL_DIR..."
        rm -rf "$INSTALL_DIR"
    fi
    
    # Remove native messaging manifest
    if [ -f "$CHROME_DIR/${NATIVE_HOST_NAME}.json" ]; then
        print_info "Removing native messaging manifest..."
        rm -f "$CHROME_DIR/${NATIVE_HOST_NAME}.json"
    fi
    
    print_info "Uninstall complete"
}

# Main script
main() {
    echo ""
    echo "ChromePilot - Installer"
    echo "===================================="
    echo ""
    
    # Parse arguments
    case "${1:-}" in
        --help)
            show_usage
            exit 0
            ;;
        --version)
            CURRENT_VERSION=$(get_current_version)
            echo "Installed version: $CURRENT_VERSION"
            exit 0
            ;;
        --uninstall)
            uninstall
            exit 0
            ;;
        --upgrade)
            CURRENT_VERSION=$(get_current_version)
            print_info "Current version: $CURRENT_VERSION"
            ;;
    esac
    
    # Check dependencies
    check_dependencies
    
    # Install
    if [ "${1:-}" == "--upgrade" ]; then
        download_and_install
    else
        install_local
    fi
    
    # Register
    register_native_host
    
    # Verify
    verify_installation
    
    # Show next steps
    echo ""
    print_info "Installation complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Load the extension in Chrome:"
    echo "     - Open chrome://extensions/"
    echo "     - Enable 'Developer mode'"
    echo "     - Click 'Load unpacked'"
    echo "     - Select: $(dirname "$INSTALL_DIR")/extension/"
    echo ""
    echo "  2. Update the native messaging manifest with your extension ID:"
    echo "     - Find your extension ID in chrome://extensions/"
    echo "     - Edit: $CHROME_DIR/${NATIVE_HOST_NAME}.json"
    echo "     - Replace EXTENSION_ID_PLACEHOLDER with your actual ID"
    echo ""
    echo "  3. Restart Chrome"
    echo ""
    echo "  4. Click the extension icon to open the side panel"
    echo ""
    
    INSTALLED_VERSION=$(get_current_version)
    print_info "Installed version: $INSTALLED_VERSION"
}

main "$@"
