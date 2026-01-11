# ChromePilot - Windows PowerShell Installer
# Supports: install, upgrade, diagnose, update-id, uninstall

#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [ValidateSet('install', 'upgrade', 'diagnose', 'update-id', 'uninstall', 'help', 'version')]
    [string]$Command = 'install',
    
    [Parameter(Position=1)]
    [string]$ExtensionId
)

# Configuration
$script:NATIVE_HOST_NAME = "com.chromepilot.native_host"
$script:INSTALL_DIR = Join-Path $env:LOCALAPPDATA "ChromePilot"
$script:CHROME_DIR = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data\NativeMessagingHosts"
$script:BACKUP_DIR = $null
$script:BACKUP_CREATED = $false

# ============================================================================
# Helper Functions
# ============================================================================

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Show-Usage {
    Write-Host ""
    Write-Host "ChromePilot - Installation and Management Tool"
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  .\install.ps1 [command] [options]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  install           Install ChromePilot (default)"
    Write-Host "  upgrade           Check for and install latest version"
    Write-Host "  diagnose          Run diagnostic checks and optionally auto-fix issues"
    Write-Host "  update-id <ID>    Update extension ID in manifest"
    Write-Host "  uninstall         Remove ChromePilot installation"
    Write-Host "  help              Show this help message"
    Write-Host "  version           Show installed version"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\install.ps1                           # Install ChromePilot locally"
    Write-Host "  .\install.ps1 upgrade                   # Upgrade to latest version"
    Write-Host "  .\install.ps1 diagnose                  # Run diagnostics"
    Write-Host "  .\install.ps1 update-id abcd...xyz      # Set extension ID"
    Write-Host "  .\install.ps1 uninstall                 # Remove installation"
    Write-Host ""
}

# ============================================================================
# Version Management
# ============================================================================

function Get-CurrentVersion {
    $packageJsonPath = Join-Path $script:INSTALL_DIR "native-host\package.json"
    
    if (-not (Test-Path $packageJsonPath)) {
        Write-Output "Not installed"
        return $null
    }
    
    try {
        $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
        return $packageJson.version
    }
    catch {
        Write-Output "Unknown"
        return $null
    }
}

# ============================================================================
# Dependency Checks
# ============================================================================

function Test-Dependencies {
    Write-Info "Checking dependencies..."
    
    # Check Node.js
    $nodePath = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodePath) {
        Write-ErrorMsg "Node.js is not installed"
        Write-Host ""
        Write-Host "Please install Node.js from: https://nodejs.org/"
        Write-Host "Recommended version: 18.x or higher"
        throw "Node.js not found"
    }
    
    $nodeVersion = & node --version
    Write-Success "Node.js $nodeVersion found"
    
    # Check npm
    $npmPath = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npmPath) {
        Write-ErrorMsg "npm is not installed"
        throw "npm not found"
    }
    
    $npmVersion = & npm --version
    Write-Success "npm $npmVersion found"
}

# ============================================================================
# Auto-fix Functions
# ============================================================================

function Stop-ServerProcesses {
    Write-Info "Stopping running server..."
    
    # Kill Node.js processes running browser-pilot-server.js
    $processes = Get-WmiObject Win32_Process -Filter "name='node.exe'" | Where-Object {
        $_.CommandLine -like "*browser-pilot-server.js*"
    }
    
    foreach ($proc in $processes) {
        Write-Info "Killing process $($proc.ProcessId)..."
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    }
    
    # Check if port 9000 is free
    $port9000 = Get-NetTCPConnection -LocalPort 9000 -State Listen -ErrorAction SilentlyContinue
    if ($port9000) {
        Write-Warning "Port 9000 is still in use"
        foreach ($conn in $port9000) {
            Write-Info "Killing process on port 9000 (PID: $($conn.OwningProcess))..."
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
    
    Start-Sleep -Seconds 2
    Write-Success "Server stopped"
}

function Repair-FilePermissions {
    Write-Info "Fixing file permissions..."
    
    if (Test-Path $script:INSTALL_DIR) {
        Get-ChildItem -Path $script:INSTALL_DIR -Recurse -Force | ForEach-Object {
            $_.Attributes = $_.Attributes -band (-bnot [System.IO.FileAttributes]::ReadOnly)
        }
        Write-Success "Permissions fixed"
    }
}

function New-Backup {
    if (-not (Test-Path $script:INSTALL_DIR)) {
        return
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $script:BACKUP_DIR = Join-Path $env:LOCALAPPDATA "chromepilot-backup-$timestamp"
    
    Write-Info "Creating backup..."
    try {
        Copy-Item -Path $script:INSTALL_DIR -Destination $script:BACKUP_DIR -Recurse -Force
        $script:BACKUP_CREATED = $true
        Write-Success "Backup created: $script:BACKUP_DIR"
    }
    catch {
        Write-ErrorMsg "Backup failed: $_"
        throw
    }
}

function Restore-Installation {
    if (-not $script:BACKUP_DIR) {
        return
    }
    
    Write-Warning "Rolling back installation..."
    
    if (Test-Path $script:INSTALL_DIR) {
        Remove-Item -Path $script:INSTALL_DIR -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    Copy-Item -Path $script:BACKUP_DIR -Destination $script:INSTALL_DIR -Recurse -Force
    Write-Info "Installation rolled back to backup"
}

# ============================================================================
# Installation Functions
# ============================================================================

function Install-Local {
    Write-Info "Installing ChromePilot locally..."
    
    # Get script directory
    $scriptDir = $PSScriptRoot
    $projectRoot = Split-Path $scriptDir -Parent
    
    $extensionPath = Join-Path $projectRoot "extension"
    $nativeHostPath = Join-Path $projectRoot "native-host"
    
    if (-not (Test-Path $extensionPath)) {
        Write-ErrorMsg "Extension directory not found: $extensionPath"
        throw "Extension directory not found"
    }
    
    if (-not (Test-Path $nativeHostPath)) {
        Write-ErrorMsg "Native host directory not found: $nativeHostPath"
        throw "Native host directory not found"
    }
    
    # Create installation directory
    if (-not (Test-Path $script:INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $script:INSTALL_DIR -Force | Out-Null
    }
    
    # Copy extension
    Write-Info "Copying extension..."
    $installExtPath = Join-Path $script:INSTALL_DIR "extension"
    if (Test-Path $installExtPath) {
        Remove-Item -Path $installExtPath -Recurse -Force
    }
    Copy-Item -Path $extensionPath -Destination $installExtPath -Recurse -Force
    Write-Success "Extension copied"
    
    # Copy native host
    Write-Info "Copying native host..."
    $installNativeHostPath = Join-Path $script:INSTALL_DIR "native-host"
    if (Test-Path $installNativeHostPath) {
        Remove-Item -Path $installNativeHostPath -Recurse -Force
    }
    Copy-Item -Path $nativeHostPath -Destination $installNativeHostPath -Recurse -Force
    Write-Success "Native host copied"
    
    # Install npm dependencies
    Write-Info "Installing npm dependencies..."
    Push-Location $installNativeHostPath
    try {
        $output = & npm install --production 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorMsg "Failed to install dependencies"
            throw "npm install failed"
        }
        Write-Success "Dependencies installed"
    }
    finally {
        Pop-Location
    }
    
    # Create logs directory
    $logsPath = Join-Path $installNativeHostPath "logs"
    if (-not (Test-Path $logsPath)) {
        New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
    }
}

function Register-NativeHost {
    Write-Info "Registering native messaging host..."
    
    if (-not (Test-Path $script:CHROME_DIR)) {
        New-Item -ItemType Directory -Path $script:CHROME_DIR -Force | Out-Null
    }
    
    # Get Node.js path
    $nodePath = (Get-Command node).Source
    if (-not $nodePath) {
        Write-ErrorMsg "Node.js path not found"
        throw "Node.js path not found"
    }
    
    # Convert backslashes to forward slashes for JSON
    $nodePathJson = $nodePath -replace '\\', '/'
    $installDirJson = $script:INSTALL_DIR -replace '\\', '/'
    $serverPath = "$installDirJson/native-host/browser-pilot-server.js"
    
    # Create manifest object
    $manifest = @{
        name = $script:NATIVE_HOST_NAME
        description = "ChromePilot Native Messaging Host"
        path = $nodePathJson
        type = "stdio"
        allowed_origins = @(
            "chrome-extension://EXTENSION_ID_PLACEHOLDER/"
        )
        command = @(
            $nodePathJson,
            $serverPath
        )
    }
    
    # Save manifest
    $manifestFile = Join-Path $script:CHROME_DIR "$script:NATIVE_HOST_NAME.json"
    try {
        $manifest | ConvertTo-Json -Depth 10 | Set-Content -Path $manifestFile -Encoding ASCII
        Write-Success "Native host registered"
    }
    catch {
        Write-ErrorMsg "Failed to create manifest: $_"
        throw
    }
}

function Test-Installation {
    Write-Info "Verifying installation..."
    
    $extensionManifest = Join-Path $script:INSTALL_DIR "extension\manifest.json"
    if (-not (Test-Path $extensionManifest)) {
        Write-ErrorMsg "Extension manifest not found"
        throw "Extension manifest not found"
    }
    
    $serverScript = Join-Path $script:INSTALL_DIR "native-host\browser-pilot-server.js"
    if (-not (Test-Path $serverScript)) {
        Write-ErrorMsg "Native host server not found"
        throw "Native host server not found"
    }
    
    $nativeManifest = Join-Path $script:CHROME_DIR "$script:NATIVE_HOST_NAME.json"
    if (-not (Test-Path $nativeManifest)) {
        Write-ErrorMsg "Native messaging manifest not found"
        throw "Native messaging manifest not found"
    }
    
    Write-Success "Installation verified"
}

# ============================================================================
# Diagnostic Functions
# ============================================================================

function Invoke-Diagnostics {
    Write-Host ""
    Write-Info "ChromePilot - Diagnostics"
    Write-Host "=========================="
    Write-Host ""
    
    # System Information
    Write-Host "System Information:"
    Write-Host "  OS: Windows"
    $osVersion = [System.Environment]::OSVersion.VersionString
    Write-Host "  Version: $osVersion"
    Write-Host "  PowerShell: $($PSVersionTable.PSVersion)"
    
    # Node.js
    $nodePath = Get-Command node -ErrorAction SilentlyContinue
    if ($nodePath) {
        $nodeVersion = & node --version
        Write-Host "  Node.js: $nodeVersion"
    } else {
        Write-Host "  Node.js: NOT FOUND"
    }
    
    # npm
    $npmPath = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmPath) {
        $npmVersion = & npm --version
        Write-Host "  npm: $npmVersion"
    } else {
        Write-Host "  npm: NOT FOUND"
    }
    Write-Host ""
    
    # Installation Status
    Write-Host "Installation Status:"
    if (Test-Path $script:INSTALL_DIR) {
        Write-Host "  Install Dir: $script:INSTALL_DIR [OK]"
        
        $extensionManifest = Join-Path $script:INSTALL_DIR "extension\manifest.json"
        if (Test-Path $extensionManifest) {
            Write-Host "  Extension: Found [OK]"
        } else {
            Write-Host "  Extension: NOT FOUND [ERROR]"
        }
        
        $serverScript = Join-Path $script:INSTALL_DIR "native-host\browser-pilot-server.js"
        if (Test-Path $serverScript) {
            Write-Host "  Native Host: Found [OK]"
        } else {
            Write-Host "  Native Host: NOT FOUND [ERROR]"
        }
        
        $nodeModules = Join-Path $script:INSTALL_DIR "native-host\node_modules"
        if (Test-Path $nodeModules) {
            Write-Host "  Dependencies: Installed [OK]"
        } else {
            Write-Host "  Dependencies: NOT FOUND [WARNING]"
        }
    } else {
        Write-Host "  Installation: NOT FOUND [ERROR]"
    }
    Write-Host ""
    
    # Manifest Check
    Write-Host "Native Messaging Manifest:"
    $nativeManifest = Join-Path $script:CHROME_DIR "$script:NATIVE_HOST_NAME.json"
    if (Test-Path $nativeManifest) {
        Write-Host "  Location: $nativeManifest [OK]"
        
        $manifestContent = Get-Content $nativeManifest -Raw
        if ($manifestContent -match "EXTENSION_ID_PLACEHOLDER") {
            Write-Host "  Extension ID: NOT SET [WARNING]"
            Write-Host "  Run: .\install.ps1 update-id <your-extension-id>"
        } else {
            Write-Host "  Extension ID: Set [OK]"
        }
    } else {
        Write-Host "  Manifest: NOT FOUND [ERROR]"
    }
    Write-Host ""
    
    # Server Status
    Write-Host "Server Status:"
    $serverProcesses = Get-WmiObject Win32_Process -Filter "name='node.exe'" | Where-Object {
        $_.CommandLine -like "*browser-pilot-server.js*"
    }
    
    if ($serverProcesses) {
        Write-Host "  Server: RUNNING (PID: $($serverProcesses.ProcessId -join ', '))"
    } else {
        Write-Host "  Server: NOT RUNNING [INFO]"
    }
    
    $port9000 = Get-NetTCPConnection -LocalPort 9000 -State Listen -ErrorAction SilentlyContinue
    if ($port9000) {
        Write-Host "  Port 9000: In use by PID $($port9000.OwningProcess)"
    } else {
        Write-Host "  Port 9000: Available [OK]"
    }
    Write-Host ""
    
    # Recent Logs
    $logsPath = Join-Path $script:INSTALL_DIR "native-host\logs"
    if (Test-Path $logsPath) {
        Write-Host "Recent Logs:"
        $logFiles = Get-ChildItem -Path $logsPath -Filter "*.log" -ErrorAction SilentlyContinue
        foreach ($logFile in $logFiles) {
            Write-Host "  $($logFile.Name) ($($logFile.Length) bytes)"
        }
        Write-Host ""
    }
    
    # Auto-fix prompt
    Write-Host ""
    $autoFix = Read-Host "Run auto-fix? (y/N)"
    if ($autoFix -eq 'y' -or $autoFix -eq 'Y') {
        Write-Host ""
        Stop-ServerProcesses
        Repair-FilePermissions
        
        $installNativeHostPath = Join-Path $script:INSTALL_DIR "native-host"
        if (Test-Path $installNativeHostPath) {
            Write-Info "Reinstalling dependencies..."
            Push-Location $installNativeHostPath
            try {
                & npm install --production 2>&1 | Out-Null
                Write-Success "Dependencies reinstalled"
            }
            finally {
                Pop-Location
            }
        }
        
        Write-Host ""
        Write-Success "Auto-fix complete. Run '.\install.ps1 diagnose' to verify."
    }
}

# ============================================================================
# Update Extension ID
# ============================================================================

function Update-ExtensionId {
    param([string]$Id)
    
    # Validate extension ID format (32 lowercase letters)
    if ($Id -notmatch '^[a-z]{32}$') {
        Write-ErrorMsg "Invalid extension ID format"
        Write-Host "Extension ID must be exactly 32 lowercase letters"
        Write-Host "Example: abcdefghijklmnopqrstuvwxyzabcdef"
        throw "Invalid extension ID"
    }
    
    $manifestFile = Join-Path $script:CHROME_DIR "$script:NATIVE_HOST_NAME.json"
    if (-not (Test-Path $manifestFile)) {
        Write-ErrorMsg "Manifest file not found: $manifestFile"
        Write-Host "Run '.\install.ps1 install' first"
        throw "Manifest not found"
    }
    
    Write-Info "Updating extension ID to: $Id"
    
    # Create backup
    $backupFile = "$manifestFile.backup"
    Copy-Item -Path $manifestFile -Destination $backupFile -Force
    
    try {
        # Read, update, and save manifest using JSON parsing
        $manifest = Get-Content $manifestFile -Raw | ConvertFrom-Json
        $manifest.allowed_origins = @("chrome-extension://$Id/")
        $manifest | ConvertTo-Json -Depth 10 | Set-Content -Path $manifestFile -Encoding ASCII
        
        # Verify update
        $updatedContent = Get-Content $manifestFile -Raw
        if ($updatedContent -notmatch $Id) {
            throw "Failed to verify extension ID in manifest"
        }
        
        Write-Success "Extension ID updated successfully"
        Write-Host ""
        Write-Host "Next step: Restart Chrome for changes to take effect"
    }
    catch {
        Write-ErrorMsg "Failed to update extension ID: $_"
        Copy-Item -Path $backupFile -Destination $manifestFile -Force
        throw
    }
}

# ============================================================================
# Upgrade Function
# ============================================================================

function Invoke-Upgrade {
    Write-Info "Checking for updates..."
    
    # This is a placeholder - in production, check GitHub API
    Write-Warning "Upgrade from GitHub not yet implemented on Windows"
    Write-Host ""
    Write-Host "Please download the latest release from:"
    Write-Host "https://github.com/aikeymouse/chrome-pilot/releases"
    Write-Host ""
    Write-Host "Then run: .\install.ps1 install"
}

# ============================================================================
# Uninstall Function
# ============================================================================

function Invoke-Uninstall {
    Write-Host ""
    Write-Info "ChromePilot - Uninstaller"
    Write-Host "=========================="
    Write-Host ""
    Write-Host "This will remove:"
    Write-Host "  - Installation directory: $script:INSTALL_DIR"
    Write-Host "  - Native messaging manifest"
    Write-Host "  - All logs and data"
    Write-Host ""
    
    $confirm = Read-Host "Are you sure you want to uninstall? (y/N)"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Info "Uninstall cancelled"
        return
    }
    
    Write-Host ""
    Write-Info "Uninstalling ChromePilot..."
    
    # Kill running server
    Stop-ServerProcesses
    
    # Remove installation directory
    if (Test-Path $script:INSTALL_DIR) {
        Write-Info "Removing installation directory..."
        Remove-Item -Path $script:INSTALL_DIR -Recurse -Force -ErrorAction SilentlyContinue
        Write-Success "Installation directory removed"
    }
    
    # Remove native messaging manifest
    $manifestFile = Join-Path $script:CHROME_DIR "$script:NATIVE_HOST_NAME.json"
    if (Test-Path $manifestFile) {
        Write-Info "Removing native messaging manifest..."
        Remove-Item -Path $manifestFile -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "$manifestFile.backup" -Force -ErrorAction SilentlyContinue
        Write-Success "Manifest removed"
    }
    
    # Remove temp and backup files
    $tempDir = Join-Path $env:LOCALAPPDATA "chromepilot-tmp"
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    Get-ChildItem -Path $env:LOCALAPPDATA -Filter "chromepilot-backup-*" -Directory | ForEach-Object {
        Remove-Item -Path $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host ""
    Write-Success "ChromePilot uninstalled successfully"
    Write-Host ""
    Write-Host "Note: Chrome extension must be removed manually:"
    Write-Host "1. Open chrome://extensions/"
    Write-Host "2. Find ChromePilot and click 'Remove'"
    Write-Host ""
}

# ============================================================================
# Command Handlers
# ============================================================================

function Invoke-Install {
    Write-Host ""
    Write-Info "ChromePilot - Installer"
    Write-Host "=========================="
    Write-Host ""
    
    try {
        Test-Dependencies
        
        # Create backup if upgrading
        if (Test-Path $script:INSTALL_DIR) {
            Write-Info "Existing installation detected"
            $createBackup = Read-Host "Create backup before upgrade? (Y/n)"
            if ($createBackup -ne 'n' -and $createBackup -ne 'N') {
                New-Backup
            }
        }
        
        # Install
        Install-Local
        
        # Register native host
        Register-NativeHost
        
        # Verify
        Test-Installation
        
        # Show next steps
        Write-Host ""
        Write-Success "Installation complete!"
        Write-Host ""
        Write-Host "Next steps:"
        Write-Host "  1. Load the extension in Chrome:"
        Write-Host "     - Open chrome://extensions/"
        Write-Host "     - Enable 'Developer mode'"
        Write-Host "     - Click 'Load unpacked'"
        Write-Host "     - Select: $script:INSTALL_DIR\extension\"
        Write-Host ""
        Write-Host "  2. Update the extension ID in the manifest:"
        Write-Host "     - Find your extension ID in chrome://extensions/"
        Write-Host "     - Run: .\install.ps1 update-id <your-extension-id>"
        Write-Host "     Or manually edit: $(Join-Path $script:CHROME_DIR "$script:NATIVE_HOST_NAME.json")"
        Write-Host ""
        Write-Host "  3. Restart Chrome"
        Write-Host ""
        Write-Host "  4. Click the extension icon to open the side panel"
        Write-Host ""
        Write-Host "Troubleshooting:"
        Write-Host "  - Run diagnostics: .\install.ps1 diagnose"
        Write-Host "  - Check logs: $(Join-Path $script:INSTALL_DIR 'native-host\logs\')"
        Write-Host ""
        
        $version = Get-CurrentVersion
        Write-Info "Installed version: $version"
        
        # Cleanup backup on success
        if ($script:BACKUP_CREATED) {
            $removeBackup = Read-Host "Installation successful. Remove backup? (y/N)"
            if ($removeBackup -eq 'y' -or $removeBackup -eq 'Y') {
                Remove-Item -Path $script:BACKUP_DIR -Recurse -Force -ErrorAction SilentlyContinue
                Write-Info "Backup removed"
            } else {
                Write-Info "Backup kept at: $script:BACKUP_DIR"
            }
        }
    }
    catch {
        Write-ErrorMsg "Installation failed: $_"
        if ($script:BACKUP_CREATED) {
            Restore-Installation
        }
        exit 1
    }
}

function Show-Version {
    $version = Get-CurrentVersion
    if ($null -eq $version) {
        Write-Host "ChromePilot is not installed"
        exit 1
    }
    Write-Host "ChromePilot version: $version"
}

# ============================================================================
# Main Entry Point
# ============================================================================

try {
    switch ($Command.ToLower()) {
        'help' {
            Show-Usage
        }
        'version' {
            Show-Version
        }
        'diagnose' {
            Invoke-Diagnostics
        }
        'update-id' {
            if (-not $ExtensionId) {
                Write-ErrorMsg "Extension ID is required"
                Write-Host "Usage: .\install.ps1 update-id <extension-id>"
                exit 1
            }
            Update-ExtensionId -Id $ExtensionId
        }
        'upgrade' {
            Invoke-Upgrade
        }
        'uninstall' {
            Invoke-Uninstall
        }
        'install' {
            Invoke-Install
        }
        default {
            Write-ErrorMsg "Unknown command: $Command"
            Write-Host ""
            Show-Usage
            exit 1
        }
    }
}
catch {
    Write-ErrorMsg "An error occurred: $_"
    exit 1
}
