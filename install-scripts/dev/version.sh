#!/bin/bash
# Version Sync Script
# Updates version numbers across all project files

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
VERSION_FILE="$PROJECT_ROOT/VERSION"

# Colors
COLOR_RESET="\033[0m"
COLOR_GREEN="\033[0;32m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[0;31m"
COLOR_BLUE="\033[0;34m"

print_info() {
    echo -e "${COLOR_BLUE}[INFO]${COLOR_RESET} $1"
}

print_success() {
    echo -e "${COLOR_GREEN}[OK]${COLOR_RESET} $1"
}

print_error() {
    echo -e "${COLOR_RED}[ERROR]${COLOR_RESET} $1"
}

print_warning() {
    echo -e "${COLOR_YELLOW}[WARN]${COLOR_RESET} $1"
}

# Read current version
if [ ! -f "$VERSION_FILE" ]; then
    print_error "VERSION file not found: $VERSION_FILE"
    exit 1
fi

CURRENT_VERSION=$(cat "$VERSION_FILE" | tr -d '[:space:]')

# Parse command
COMMAND="${1:-show}"

case "$COMMAND" in
    show)
        echo ""
        print_info "Current Version: $CURRENT_VERSION"
        echo ""
        echo "Version files:"
        
        # Extension manifest
        if [ -f "$PROJECT_ROOT/extension/manifest.json" ]; then
            EXT_VERSION=$(jq -r '.version' "$PROJECT_ROOT/extension/manifest.json")
            if [ "$EXT_VERSION" == "$CURRENT_VERSION" ]; then
                echo "  ✓ extension/manifest.json: $EXT_VERSION"
            else
                echo "  ✗ extension/manifest.json: $EXT_VERSION (expected: $CURRENT_VERSION)"
            fi
        fi
        
        # Native host package.json
        if [ -f "$PROJECT_ROOT/native-host/package.json" ]; then
            NH_VERSION=$(jq -r '.version' "$PROJECT_ROOT/native-host/package.json")
            if [ "$NH_VERSION" == "$CURRENT_VERSION" ]; then
                echo "  ✓ native-host/package.json: $NH_VERSION"
            else
                echo "  ✗ native-host/package.json: $NH_VERSION (expected: $CURRENT_VERSION)"
            fi
        fi
        
        echo ""
        ;;
        
    set)
        NEW_VERSION="$2"
        if [ -z "$NEW_VERSION" ]; then
            print_error "Version is required"
            echo "Usage: $0 set <version>"
            echo "Example: $0 set 1.2.3"
            exit 1
        fi
        
        # Validate version format (semantic versioning)
        if ! echo "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
            print_error "Invalid version format: $NEW_VERSION"
            echo "Version must be in format: MAJOR.MINOR.PATCH"
            echo "Example: 1.2.3"
            exit 1
        fi
        
        echo ""
        print_info "Updating version from $CURRENT_VERSION to $NEW_VERSION"
        echo ""
        
        # Update VERSION file
        echo "$NEW_VERSION" > "$VERSION_FILE"
        print_success "VERSION file updated"
        
        # Update extension manifest.json
        if [ -f "$PROJECT_ROOT/extension/manifest.json" ]; then
            TEMP_FILE=$(mktemp)
            jq --arg version "$NEW_VERSION" '.version = $version' "$PROJECT_ROOT/extension/manifest.json" > "$TEMP_FILE"
            mv "$TEMP_FILE" "$PROJECT_ROOT/extension/manifest.json"
            print_success "extension/manifest.json updated"
        fi
        
        # Update native-host package.json
        if [ -f "$PROJECT_ROOT/native-host/package.json" ]; then
            TEMP_FILE=$(mktemp)
            jq --arg version "$NEW_VERSION" '.version = $version' "$PROJECT_ROOT/native-host/package.json" > "$TEMP_FILE"
            mv "$TEMP_FILE" "$PROJECT_ROOT/native-host/package.json"
            print_success "native-host/package.json updated"
        fi
        
        echo ""
        print_success "Version updated to $NEW_VERSION"
        echo ""
        echo "Next steps:"
        echo "  1. Commit changes: git commit -am 'Bump version to $NEW_VERSION'"
        echo "  2. Create tag: git tag -a v$NEW_VERSION -m 'Release v$NEW_VERSION'"
        echo "  3. Push changes: git push && git push --tags"
        echo ""
        ;;
        
    sync)
        echo ""
        print_info "Syncing versions to $CURRENT_VERSION"
        echo ""
        
        UPDATED=0
        
        # Update extension manifest.json if needed
        if [ -f "$PROJECT_ROOT/extension/manifest.json" ]; then
            EXT_VERSION=$(jq -r '.version' "$PROJECT_ROOT/extension/manifest.json")
            if [ "$EXT_VERSION" != "$CURRENT_VERSION" ]; then
                TEMP_FILE=$(mktemp)
                jq --arg version "$CURRENT_VERSION" '.version = $version' "$PROJECT_ROOT/extension/manifest.json" > "$TEMP_FILE"
                mv "$TEMP_FILE" "$PROJECT_ROOT/extension/manifest.json"
                print_success "extension/manifest.json synced: $EXT_VERSION → $CURRENT_VERSION"
                UPDATED=1
            else
                print_info "extension/manifest.json already synced: $EXT_VERSION"
            fi
        fi
        
        # Update native-host package.json if needed
        if [ -f "$PROJECT_ROOT/native-host/package.json" ]; then
            NH_VERSION=$(jq -r '.version' "$PROJECT_ROOT/native-host/package.json")
            if [ "$NH_VERSION" != "$CURRENT_VERSION" ]; then
                TEMP_FILE=$(mktemp)
                jq --arg version "$CURRENT_VERSION" '.version = $version' "$PROJECT_ROOT/native-host/package.json" > "$TEMP_FILE"
                mv "$TEMP_FILE" "$PROJECT_ROOT/native-host/package.json"
                print_success "native-host/package.json synced: $NH_VERSION → $CURRENT_VERSION"
                UPDATED=1
            else
                print_info "native-host/package.json already synced: $NH_VERSION"
            fi
        fi
        
        echo ""
        if [ $UPDATED -eq 1 ]; then
            print_success "Sync complete"
        else
            print_info "All versions already synced to $CURRENT_VERSION"
        fi
        echo ""
        ;;
        
    bump)
        BUMP_TYPE="${2:-patch}"
        
        # Parse current version
        IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
        
        case "$BUMP_TYPE" in
            major)
                MAJOR=$((MAJOR + 1))
                MINOR=0
                PATCH=0
                ;;
            minor)
                MINOR=$((MINOR + 1))
                PATCH=0
                ;;
            patch)
                PATCH=$((PATCH + 1))
                ;;
            *)
                print_error "Invalid bump type: $BUMP_TYPE"
                echo "Valid types: major, minor, patch"
                exit 1
                ;;
        esac
        
        NEW_VERSION="$MAJOR.$MINOR.$PATCH"
        
        echo ""
        print_info "Bumping $BUMP_TYPE version: $CURRENT_VERSION → $NEW_VERSION"
        echo ""
        
        # Call set command
        "$0" set "$NEW_VERSION"
        ;;
        
    *)
        echo ""
        echo "Version Management Tool"
        echo ""
        echo "Usage:"
        echo "  $0 show              Show current version and status"
        echo "  $0 set <version>     Set new version (e.g., 1.2.3)"
        echo "  $0 sync              Sync all files to VERSION file"
        echo "  $0 bump [type]       Bump version (major|minor|patch, default: patch)"
        echo ""
        echo "Examples:"
        echo "  $0 show              # Show current version: 1.0.0"
        echo "  $0 set 1.2.3         # Set version to 1.2.3"
        echo "  $0 sync              # Sync all files to VERSION"
        echo "  $0 bump patch        # 1.0.0 → 1.0.1"
        echo "  $0 bump minor        # 1.0.0 → 1.1.0"
        echo "  $0 bump major        # 1.0.0 → 2.0.0"
        echo ""
        exit 1
        ;;
esac
