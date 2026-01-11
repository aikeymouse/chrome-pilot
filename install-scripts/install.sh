#!/bin/bash

##############################################################################
# ChromePilot - Installation Script (macOS/Linux)
# This script installs, upgrades, diagnoses, or uninstalls ChromePilot
##############################################################################

set -e

# Configuration
EXTENSION_NAME="chrome-pilot"
INSTALL_DIR="$HOME/.${EXTENSION_NAME}"
NATIVE_HOST_NAME="com.chromepilot.extension"
VERSION_URL="https://api.github.com/repos/aikeymouse/chrome-pilot/releases/latest"
BACKUP_DIR="$HOME/.chromepilot-backup-$(date +%s)"

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

# Auto-fix functions
auto_fix_kill_server() {
    print_info "Checking for existing server..."
    
    # Check if server is running
    if pgrep -f "browser-pilot-server.js" > /dev/null; then
        print_warn "ChromePilot server is already running"
        read -p "Kill existing server and continue? (Y/n): " choice
        
        if [[ -z "$choice" || "$choice" =~ ^[Yy]$ ]]; then
            print_info "Stopping existing server..."
            pkill -f "browser-pilot-server.js" 2>/dev/null || true
            sleep 1
            
            # Force kill if still running
            if pgrep -f "browser-pilot-server.js" > /dev/null; then
                print_warn "Force killing server..."
                pkill -9 -f "browser-pilot-server.js" 2>/dev/null || true
            fi
            
            print_info "✓ Server stopped"
        else
            print_error "Cannot proceed with server running"
            exit 1
        fi
    fi
    
    # Check if port 9000 is occupied
    if command -v lsof &> /dev/null && lsof -ti :9000 > /dev/null 2>&1; then
        print_warn "Port 9000 is in use"
        read -p "Free port 9000? (Y/n): " choice
        
        if [[ -z "$choice" || "$choice" =~ ^[Yy]$ ]]; then
            print_info "Freeing port 9000..."
            lsof -ti :9000 | xargs kill -9 2>/dev/null || true
            print_info "✓ Port freed"
        fi
    fi
}

auto_fix_permissions() {
    print_info "Fixing file permissions..."
    
    if [ -f "$INSTALL_DIR/native-host/browser-pilot-server.js" ]; then
        chmod +x "$INSTALL_DIR/native-host/browser-pilot-server.js"
    fi
    
    if [ -f "$INSTALL_DIR/native-host/launch.sh" ]; then
        chmod +x "$INSTALL_DIR/native-host/launch.sh"
    fi
    
    if [ -d "$INSTALL_DIR/native-host/logs" ]; then
        chmod 755 "$INSTALL_DIR/native-host/logs"
    fi
    
    if [ -f "$CHROME_DIR/${NATIVE_HOST_NAME}.json" ]; then
        chmod 644 "$CHROME_DIR/${NATIVE_HOST_NAME}.json"
    fi
    
    print_info "✓ Permissions fixed"
}

create_backup() {
    if [ -d "$INSTALL_DIR" ]; then
        print_info "Creating backup..."
        mkdir -p "$BACKUP_DIR"
        cp -r "$INSTALL_DIR" "$BACKUP_DIR/" 2>/dev/null || true
        
        if [ -f "$CHROME_DIR/${NATIVE_HOST_NAME}.json" ]; then
            cp "$CHROME_DIR/${NATIVE_HOST_NAME}.json" "$BACKUP_DIR/manifest.json" 2>/dev/null || true
        fi
        
        print_info "✓ Backup created"
        return 0
    fi
    return 1
}

rollback_installation() {
    print_error "Installation failed!"
    
    if [ -d "$BACKUP_DIR" ]; then
        print_info "Rolling back to previous version..."
        
        if [ -d "$BACKUP_DIR/.chrome-pilot" ]; then
            rm -rf "$INSTALL_DIR"
            cp -r "$BACKUP_DIR/.chrome-pilot" "$INSTALL_DIR"
        fi
        
        if [ -f "$BACKUP_DIR/manifest.json" ]; then
            cp "$BACKUP_DIR/manifest.json" "$CHROME_DIR/${NATIVE_HOST_NAME}.json"
        fi
        
        print_info "✓ Rollback complete"
        rm -rf "$BACKUP_DIR"
    else
        print_warn "No backup found"
    fi
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
    
    # Make browser-pilot-server.js executable
    chmod +x "$INSTALL_DIR/native-host/browser-pilot-server.js"
    
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
    
    # Make browser-pilot-server.js executable
    chmod +x "$INSTALL_DIR/native-host/browser-pilot-server.js"
    
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
exec node browser-pilot-server.js 2>> /tmp/chromepilot-error.log
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
    if [ ! -f "$INSTALL_DIR/native-host/browser-pilot-server.js" ]; then
        print_error "Installation verification failed: browser-pilot-server.js not found"
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
ChromePilot - Installation & Management Script

Usage:
  $0 [command] [options]

Commands:
  install         Install ChromePilot (default)
  upgrade         Upgrade to latest version
  diagnose        Run diagnostics and health checks
  update-id <ID>  Update extension ID in manifest
  uninstall       Remove installation completely

Options:
  --version       Show installed version
  --help          Show this help message

Examples:
  $0                          # Install from local files
  $0 upgrade                  # Upgrade to latest version
  $0 diagnose                 # Check installation health
  $0 update-id abcd...        # Set extension ID
  $0 uninstall                # Remove ChromePilot

EOF
}

diagnose() {
    echo ""
    echo "ChromePilot - Diagnostic Tool"
    echo "=============================="
    echo ""
    
    local issues=0
    
    # System Information
    echo -e "${BLUE}System Information:${NC}"
    echo "  OS: $OSTYPE"
    echo "  Platform: $PLATFORM"
    echo "  Node.js: $(node --version 2>/dev/null || echo 'Not installed')"
    echo "  npm: $(npm --version 2>/dev/null || echo 'Not installed')"
    echo ""
    
    # Installation Status
    echo -e "${BLUE}Installation Status:${NC}"
    
    if [ -d "$INSTALL_DIR" ]; then
        echo -e "  ${GREEN}✓${NC} Installation directory exists"
        
        if [ -f "$INSTALL_DIR/native-host/package.json" ]; then
            VERSION=$(get_current_version)
            echo -e "  ${GREEN}✓${NC} Version: $VERSION"
        fi
    else
        echo -e "  ${RED}✗${NC} Installation directory not found"
        issues=$((issues + 1))
    fi
    
    if [ -f "$INSTALL_DIR/native-host/browser-pilot-server.js" ]; then
        echo -e "  ${GREEN}✓${NC} Server file exists"
    else
        echo -e "  ${RED}✗${NC} Server file missing"
        issues=$((issues + 1))
    fi
    
    if [ -d "$INSTALL_DIR/native-host/node_modules" ]; then
        echo -e "  ${GREEN}✓${NC} Dependencies installed"
    else
        echo -e "  ${RED}✗${NC} Dependencies not installed"
        issues=$((issues + 1))
    fi
    
    echo ""
    
    # Native Messaging Manifest
    echo -e "${BLUE}Native Messaging Manifest:${NC}"
    
    if [ -f "$CHROME_DIR/${NATIVE_HOST_NAME}.json" ]; then
        echo -e "  ${GREEN}✓${NC} Manifest registered"
        
        if grep -q "EXTENSION_ID_PLACEHOLDER" "$CHROME_DIR/${NATIVE_HOST_NAME}.json"; then
            echo -e "  ${YELLOW}⚠${NC}  Extension ID not configured"
            issues=$((issues + 1))
        else
            echo -e "  ${GREEN}✓${NC} Extension ID configured"
        fi
    else
        echo -e "  ${RED}✗${NC} Manifest not registered"
        issues=$((issues + 1))
    fi
    
    echo ""
    
    # Server Status
    echo -e "${BLUE}Server Status:${NC}"
    
    SERVER_RUNNING=false
    SERVER_RESPONSIVE=false
    
    if pgrep -f "browser-pilot-server.js" > /dev/null; then
        PID=$(pgrep -f "browser-pilot-server.js")
        SERVER_RUNNING=true
        echo -e "  ${GREEN}✓${NC} Server process running (PID: $PID)"
        
        # Check if server is actually responsive (listening on port 9000)
        if command -v lsof &> /dev/null && lsof -ti :9000 > /dev/null 2>&1; then
            PORT_PID=$(lsof -ti :9000)
            if [ "$PORT_PID" == "$PID" ]; then
                SERVER_RESPONSIVE=true
                echo -e "  ${GREEN}✓${NC} Server is listening on port 9000"
            else
                echo -e "  ${YELLOW}⚠${NC}  Server running but port 9000 used by different process"
                issues=$((issues + 1))
            fi
        else
            echo -e "  ${RED}✗${NC} Server running but NOT listening on port 9000 (stuck/crashed)"
            echo -e "      ${YELLOW}→${NC} Run auto-fix to restart the server"
            issues=$((issues + 1))
        fi
    else
        echo -e "  ${YELLOW}⚠${NC}  Server is not running"
    fi
    
    if command -v lsof &> /dev/null && lsof -ti :9000 > /dev/null 2>&1; then
        PORT_PID=$(lsof -ti :9000)
        PORT_PROCESS=$(ps -p $PORT_PID -o comm= 2>/dev/null || echo "unknown")
        
        if [[ "$PORT_PROCESS" == *"node"* ]]; then
            echo -e "  ${GREEN}✓${NC} Port 9000 listening (ChromePilot)"
        else
            echo -e "  ${RED}✗${NC} Port 9000 occupied by: $PORT_PROCESS"
            issues=$((issues + 1))
        fi
    else
        echo -e "  ${YELLOW}⚠${NC}  Port 9000 not in use"
    fi
    
    echo ""
    
    # Recommendations
    echo -e "${BLUE}Recommendations:${NC}"
    
    if ! command -v node > /dev/null; then
        echo -e "  ${RED}✗${NC} Install Node.js 18+ from https://nodejs.org/"
        issues=$((issues + 1))
    fi
    
    if [ ! -d "$INSTALL_DIR" ]; then
        echo -e "  ${RED}✗${NC} Run $0 to install ChromePilot"
        issues=$((issues + 1))
    fi
    
    if [ $issues -eq 0 ]; then
        echo -e "  ${GREEN}✓${NC} No issues detected!"
    fi
    
    echo ""
    
    # Offer auto-fix or force restart
    if [ $issues -gt 0 ] || [ "$1" == "--force-restart" ]; then
        if [ "$1" == "--force-restart" ]; then
            AUTO_FIX=true
        else
            read -p "Attempt to auto-fix detected issues? (y/N): " -n 1 -r
            echo
            AUTO_FIX=false
            [[ $REPLY =~ ^[Yy]$ ]] && AUTO_FIX=true
        fi
        
        if [ "$AUTO_FIX" = true ]; then
            echo ""
            print_info "Running auto-fix..."
            
            # Kill stuck server if detected, or force restart if requested
            if [ "$1" == "--force-restart" ] && [ "$SERVER_RUNNING" = true ]; then
                print_info "Force restarting server (--force-restart)..."
                auto_fix_kill_server
                echo ""
                print_info "Server stopped. Reload Chrome extension to restart it."
            elif [ "$SERVER_RUNNING" = true ] && [ "$SERVER_RESPONSIVE" = false ]; then
                print_info "Stopping stuck server process..."
                auto_fix_kill_server
            fi
            
            # Reinstall dependencies if missing
            if [ ! -d "$INSTALL_DIR/native-host/node_modules" ] && [ -d "$INSTALL_DIR/native-host" ]; then
                print_info "Reinstalling dependencies..."
                cd "$INSTALL_DIR/native-host"
                npm install --production --silent
            fi
            
            # Fix permissions
            auto_fix_permissions
            
            echo ""
            print_info "✓ Auto-fix complete. Restart Chrome and run '$0 diagnose' again to verify."
        fi
    fi
}

update_extension_id() {
    local EXTENSION_ID="$1"
    
    if [ -z "$EXTENSION_ID" ]; then
        print_error "Usage: $0 update-id <extension-id>"
        exit 1
    fi
    
    if ! [[ "$EXTENSION_ID" =~ ^[a-z]{32}$ ]]; then
        print_error "Invalid extension ID format"
        echo "Expected: 32 lowercase letters"
        echo "Got: $EXTENSION_ID"
        exit 1
    fi
    
    if [ ! -f "$CHROME_DIR/${NATIVE_HOST_NAME}.json" ]; then
        print_error "Manifest not found. Install ChromePilot first."
        exit 1
    fi
    
    print_info "Updating extension ID: $EXTENSION_ID"
    
    # Backup
    cp "$CHROME_DIR/${NATIVE_HOST_NAME}.json" "$CHROME_DIR/${NATIVE_HOST_NAME}.json.backup"
    
    # Update
    sed -i.bak "s/EXTENSION_ID_PLACEHOLDER/$EXTENSION_ID/g" "$CHROME_DIR/${NATIVE_HOST_NAME}.json"
    sed -i.bak "s/chrome-extension:\/\/[a-z]\{32\}\//chrome-extension:\/\/$EXTENSION_ID\//g" "$CHROME_DIR/${NATIVE_HOST_NAME}.json"
    rm -f "$CHROME_DIR/${NATIVE_HOST_NAME}.json.bak"
    
    print_info "✓ Extension ID updated"
    print_info "Restart Chrome for changes to take effect"
}

do_upgrade() {
    CURRENT_VERSION=$(get_current_version)
    print_info "Current version: $CURRENT_VERSION"
    
    print_info "Checking for updates..."
    RELEASE_INFO=$(curl -s "$VERSION_URL" 2>/dev/null || echo "")
    
    if [ -z "$RELEASE_INFO" ]; then
        print_error "Failed to fetch release information"
        exit 1
    fi
    
    LATEST_VERSION=$(echo "$RELEASE_INFO" | grep '"tag_name"' | head -1 | sed 's/.*: "\(.*\)".*/\1/' | sed 's/v//')
    
    print_info "Latest version: $LATEST_VERSION"
    
    if [ "$CURRENT_VERSION" == "$LATEST_VERSION" ]; then
        print_info "✓ Already on latest version"
        exit 0
    fi
    
    echo ""
    print_info "Update available: $CURRENT_VERSION → $LATEST_VERSION"
    read -p "Install update? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Update cancelled"
        exit 0
    fi
    
    # Run installation with upgrade
    create_backup || true
    download_and_install
    
    print_info "✓ Update complete"
}

uninstall() {
    echo ""
    print_info "ChromePilot - Uninstaller"
    echo "=========================="
    echo ""
    echo "This will remove:"
    echo "  - Installation directory: $INSTALL_DIR"
    echo "  - Native messaging manifest"
    echo "  - All logs and data"
    echo ""
    
    read -p "Are you sure you want to uninstall? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Uninstall cancelled"
        exit 0
    fi
    
    echo ""
    print_info "Uninstalling ChromePilot..."
    
    # Kill running server
    if pgrep -f "browser-pilot-server.js" > /dev/null; then
        print_info "Stopping server..."
        pkill -f "browser-pilot-server.js" 2>/dev/null || true
        sleep 1
    fi
    
    # Remove installation directory
    if [ -d "$INSTALL_DIR" ]; then
        print_info "Removing installation directory..."
        rm -rf "$INSTALL_DIR"
        print_info "✓ Installation directory removed"
    fi
    
    # Remove native messaging manifest
    if [ -f "$CHROME_DIR/${NATIVE_HOST_NAME}.json" ]; then
        print_info "Removing native messaging manifest..."
        rm -f "$CHROME_DIR/${NATIVE_HOST_NAME}.json"
        rm -f "$CHROME_DIR/${NATIVE_HOST_NAME}.json.backup" 2>/dev/null || true
        print_info "✓ Manifest removed"
    fi
    
    # Remove temp files
    rm -rf "$HOME/.chromepilot-tmp" 2>/dev/null || true
    rm -rf "$HOME/.chromepilot-backup-"* 2>/dev/null || true
    
    echo ""
    print_info "✓ ChromePilot uninstalled successfully"
    echo ""
    echo "Note: Chrome extension must be removed manually:"
    echo "1. Open chrome://extensions/"
    echo "2. Find ChromePilot and click 'Remove'"
    echo ""
}

# Main script
main() {
    # Parse command
    COMMAND="${1:-install}"
    
    case "$COMMAND" in
        help|--help|-h)
            show_usage
            exit 0
            ;;
            
        version|--version|-v)
            CURRENT_VERSION=$(get_current_version)
            if [ "$CURRENT_VERSION" == "Not installed" ]; then
                echo "ChromePilot is not installed"
                exit 1
            fi
            echo "ChromePilot version: $CURRENT_VERSION"
            exit 0
            ;;
            
        diagnose|--diagnose)
            diagnose "$2"
            exit 0
            ;;
            
        update-id|--update-id)
            if [ -z "$2" ]; then
                print_error "Extension ID is required"
                echo "Usage: $0 update-id <extension-id>"
                exit 1
            fi
            update_extension_id "$2"
            exit 0
            ;;
            
        upgrade|--upgrade)
            do_upgrade
            exit 0
            ;;
            
        uninstall|--uninstall)
            uninstall
            exit 0
            ;;
            
        install|--install)
            # Continue to installation
            ;;
            
        *)
            if [ -n "$COMMAND" ] && [ "$COMMAND" != "install" ]; then
                print_error "Unknown command: $COMMAND"
                echo ""
                show_usage
                exit 1
            fi
            ;;
    esac
    
    # Installation flow
    echo ""
    print_info "ChromePilot - Installer"
    echo "=========================="
    echo ""
    
    # Check dependencies
    check_dependencies
    
    # Create backup if upgrading
    if [ -d "$INSTALL_DIR" ]; then
        print_info "Existing installation detected"
        read -p "Create backup before upgrade? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            create_backup
        fi
    fi
    
    # Install
    if [ -n "${DOWNLOAD_LATEST:-}" ]; then
        if ! download_and_install; then
            print_error "Installation failed"
            if [ -n "$BACKUP_CREATED" ]; then
                rollback_installation
            fi
            exit 1
        fi
    else
        if ! install_local; then
            print_error "Installation failed"
            if [ -n "$BACKUP_CREATED" ]; then
                rollback_installation
            fi
            exit 1
        fi
    fi
    
    # Register native host
    if ! register_native_host; then
        print_error "Failed to register native host"
        if [ -n "$BACKUP_CREATED" ]; then
            rollback_installation
        fi
        exit 1
    fi
    
    # Verify installation
    if ! verify_installation; then
        print_error "Installation verification failed"
        if [ -n "$BACKUP_CREATED" ]; then
            rollback_installation
        fi
        exit 1
    fi
    
    # Show next steps
    echo ""
    print_info "✓ Installation complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Load the extension in Chrome:"
    echo "     - Open chrome://extensions/"
    echo "     - Enable 'Developer mode'"
    echo "     - Click 'Load unpacked'"
    echo "     - Select: $INSTALL_DIR/extension/"
    echo ""
    echo "  2. Update the extension ID in the manifest:"
    echo "     - Find your extension ID in chrome://extensions/"
    echo "     - Run: $0 update-id <your-extension-id>"
    echo "     Or manually edit: $CHROME_DIR/${NATIVE_HOST_NAME}.json"
    echo ""
    echo "  3. Restart Chrome"
    echo ""
    echo "  4. Click the extension icon to open the side panel"
    echo ""
    echo "Troubleshooting:"
    echo "  - Run diagnostics: $0 diagnose"
    echo "  - Check logs: tail -f $INSTALL_DIR/native-host/logs/*.log"
    echo ""
    
    INSTALLED_VERSION=$(get_current_version)
    print_info "Installed version: $INSTALLED_VERSION"
    
    # Cleanup backup on success
    if [ -n "$BACKUP_CREATED" ]; then
        read -p "Installation successful. Remove backup? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$BACKUP_DIR"
            print_info "Backup removed"
        else
            print_info "Backup kept at: $BACKUP_DIR"
        fi
    fi
}

main "$@"
