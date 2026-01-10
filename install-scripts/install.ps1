# ChromePilot - Installation Script (Windows PowerShell)
# This script installs or upgrades the ChromePilot native host

param(
    [switch]$Upgrade,
    [switch]$Version,
    [switch]$Uninstall,
    [switch]$Help
)

# Configuration
$ExtensionName = "chrome-pilot"
$InstallDir = Join-Path $env:USERPROFILE ".$ExtensionName"
$NativeHostName = "com.chromedriver.extension"
$VersionUrl = "https://api.github.com/repos/aikeymouse/chrome-pilot/releases/latest"

# Registry path for Chrome native messaging
$RegistryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$NativeHostName"

# Functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Check-Dependencies {
    Write-Info "Checking dependencies..."
    
    # Check Node.js
    try {
        $nodeVersion = node -v
        $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        
        if ($versionNumber -lt 18) {
            Write-Error-Custom "Node.js version 18+ required. Current: $nodeVersion"
            exit 1
        }
        
        Write-Info "Node.js version: $nodeVersion ✓"
    }
    catch {
        Write-Error-Custom "Node.js is not installed. Please install Node.js 18+ first."
        Write-Host "Visit: https://nodejs.org/"
        exit 1
    }
    
    # Check npm
    try {
        $npmVersion = npm -v
        Write-Info "npm version: $npmVersion ✓"
    }
    catch {
        Write-Error-Custom "npm is not installed"
        exit 1
    }
}

function Get-CurrentVersion {
    $packageJsonPath = Join-Path $InstallDir "native-host\package.json"
    
    if (Test-Path $packageJsonPath) {
        $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
        return $packageJson.version
    }
    
    return "none"
}

function Install-Local {
    Write-Info "Installing from local files..."
    
    # Get script directory
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $ProjectDir = Split-Path -Parent $ScriptDir
    
    # Create install directory
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
    
    # Backup logs if upgrading
    $logsPath = Join-Path $InstallDir "native-host\logs"
    if (Test-Path $logsPath) {
        Write-Info "Backing up existing logs..."
        $backupPath = Join-Path $InstallDir "logs-backup-$(Get-Date -Format 'yyyyMMddHHmmss')"
        Copy-Item -Path $logsPath -Destination $backupPath -Recurse -Force
    }
    
    # Remove old native host
    $nativeHostPath = Join-Path $InstallDir "native-host"
    if (Test-Path $nativeHostPath) {
        Remove-Item -Path $nativeHostPath -Recurse -Force
    }
    
    # Copy native host files
    Write-Info "Copying native host files..."
    $sourcePath = Join-Path $ProjectDir "native-host"
    Copy-Item -Path $sourcePath -Destination $InstallDir -Recurse -Force
    
    # Restore logs
    $backupDirs = Get-ChildItem -Path $InstallDir -Filter "logs-backup-*" -Directory | Sort-Object -Descending | Select-Object -First 1
    if ($backupDirs) {
        Write-Info "Restoring logs..."
        $logsDestPath = Join-Path $InstallDir "native-host\logs"
        if (-not (Test-Path $logsDestPath)) {
            New-Item -ItemType Directory -Path $logsDestPath -Force | Out-Null
        }
        Copy-Item -Path "$($backupDirs.FullName)\*" -Destination $logsDestPath -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    # Install dependencies
    Write-Info "Installing Node.js dependencies..."
    Push-Location (Join-Path $InstallDir "native-host")
    npm install --production --silent
    Pop-Location
    
    Write-Info "Native host installed to: $InstallDir\native-host"
}

function Download-And-Install {
    Write-Info "Fetching latest release information..."
    
    try {
        $releaseInfo = Invoke-RestMethod -Uri $VersionUrl -ErrorAction Stop
        
        $latestVersion = $releaseInfo.tag_name
        $downloadUrl = ($releaseInfo.assets | Where-Object { $_.name -like "*native-host.zip" }).browser_download_url
        
        if (-not $downloadUrl) {
            Write-Warn "No release package found. Installing from local files..."
            Install-Local
            return
        }
        
        Write-Info "Latest version: $latestVersion"
        Write-Info "Downloading from: $downloadUrl"
        
        # Create temp directory
        $tempDir = Join-Path $env:TEMP "chrome-driver-temp-$(Get-Date -Format 'yyyyMMddHHmmss')"
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
        
        # Download release
        $zipPath = Join-Path $tempDir "native-host.zip"
        Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath
        
        # Extract
        Write-Info "Extracting..."
        Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
        
        # Backup logs
        $logsPath = Join-Path $InstallDir "native-host\logs"
        if (Test-Path $logsPath) {
            Write-Info "Backing up existing logs..."
            $backupPath = Join-Path $InstallDir "logs-backup-$(Get-Date -Format 'yyyyMMddHHmmss')"
            Copy-Item -Path $logsPath -Destination $backupPath -Recurse -Force
        }
        
        # Install
        Write-Info "Installing to $InstallDir..."
        $nativeHostPath = Join-Path $InstallDir "native-host"
        if (Test-Path $nativeHostPath) {
            Remove-Item -Path $nativeHostPath -Recurse -Force
        }
        Copy-Item -Path (Join-Path $tempDir "native-host") -Destination $InstallDir -Recurse -Force
        
        # Restore logs
        $backupDirs = Get-ChildItem -Path $InstallDir -Filter "logs-backup-*" -Directory | Sort-Object -Descending | Select-Object -First 1
        if ($backupDirs) {
            Write-Info "Restoring logs..."
            $logsDestPath = Join-Path $InstallDir "native-host\logs"
            if (-not (Test-Path $logsDestPath)) {
                New-Item -ItemType Directory -Path $logsDestPath -Force | Out-Null
            }
            Copy-Item -Path "$($backupDirs.FullName)\*" -Destination $logsDestPath -Recurse -Force -ErrorAction SilentlyContinue
        }
        
        # Install dependencies
        Write-Info "Installing Node.js dependencies..."
        Push-Location (Join-Path $InstallDir "native-host")
        npm install --production --silent
        Pop-Location
        
        # Cleanup
        Remove-Item -Path $tempDir -Recurse -Force
        
        Write-Info "Native host installed successfully"
    }
    catch {
        Write-Warn "Could not fetch release information. Installing from local files..."
        Install-Local
    }
}

function Register-NativeHost {
    Write-Info "Registering native messaging host..."
    
    # Create manifest
    $manifestPath = Join-Path $InstallDir "native-host\manifest.json"
    $serverPath = Join-Path $InstallDir "native-host\server.js"
    
    $manifest = @{
        name = $NativeHostName
        description = "ChromePilot Native Messaging Host"
        path = $serverPath -replace '\\', '\\'
        type = "stdio"
        allowed_origins = @("chrome-extension://EXTENSION_ID_PLACEHOLDER/")
    } | ConvertTo-Json
    
    # Save manifest
    $manifest | Set-Content -Path $manifestPath
    
    # Create registry key
    if (-not (Test-Path $RegistryPath)) {
        New-Item -Path $RegistryPath -Force | Out-Null
    }
    
    # Set registry value
    Set-ItemProperty -Path $RegistryPath -Name "(Default)" -Value $manifestPath
    
    Write-Info "Native messaging manifest registered at:"
    Write-Info $RegistryPath
    Write-Warn "NOTE: You need to update EXTENSION_ID_PLACEHOLDER with your actual extension ID"
}

function Test-Installation {
    Write-Info "Verifying installation..."
    
    # Check files exist
    $serverPath = Join-Path $InstallDir "native-host\server.js"
    if (-not (Test-Path $serverPath)) {
        Write-Error-Custom "Installation verification failed: server.js not found"
        return $false
    }
    
    # Check registry
    if (-not (Test-Path $RegistryPath)) {
        Write-Error-Custom "Installation verification failed: registry key not found"
        return $false
    }
    
    # Check node_modules
    $nodeModulesPath = Join-Path $InstallDir "native-host\node_modules"
    if (-not (Test-Path $nodeModulesPath)) {
        Write-Error-Custom "Installation verification failed: node_modules not found"
        return $false
    }
    
    Write-Info "Installation verified ✓"
    return $true
}

function Show-Usage {
    Write-Host @"
ChromePilot - Installation Script

Usage:
  .\install.ps1 [options]

Options:
  -Upgrade        Upgrade to latest version
  -Version        Show installed version
  -Uninstall      Remove installation
  -Help           Show this help message

Examples:
  .\install.ps1              # Install from local files
  .\install.ps1 -Upgrade     # Upgrade to latest version
  .\install.ps1 -Version     # Check installed version

"@
}

function Uninstall-Extension {
    Write-Info "Uninstalling ChromePilot..."
    
    # Ask for confirmation
    $confirmation = Read-Host "Are you sure you want to uninstall? (y/N)"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Info "Uninstall cancelled"
        exit 0
    }
    
    # Remove installation directory
    if (Test-Path $InstallDir) {
        Write-Info "Removing $InstallDir..."
        Remove-Item -Path $InstallDir -Recurse -Force
    }
    
    # Remove registry key
    if (Test-Path $RegistryPath) {
        Write-Info "Removing registry key..."
        Remove-Item -Path $RegistryPath -Force
    }
    
    Write-Info "Uninstall complete"
}

# Main script
function Main {
    Write-Host ""
    Write-Host "ChromePilot - Installer"
    Write-Host "===================================="
    Write-Host ""
    
    # Handle arguments
    if ($Help) {
        Show-Usage
        exit 0
    }
    
    if ($Version) {
        $currentVersion = Get-CurrentVersion
        Write-Host "Installed version: $currentVersion"
        exit 0
    }
    
    if ($Uninstall) {
        Uninstall-Extension
        exit 0
    }
    
    if ($Upgrade) {
        $currentVersion = Get-CurrentVersion
        Write-Info "Current version: $currentVersion"
    }
    
    # Check dependencies
    Check-Dependencies
    
    # Install
    if ($Upgrade) {
        Download-And-Install
    }
    else {
        Install-Local
    }
    
    # Register
    Register-NativeHost
    
    # Verify
    $verified = Test-Installation
    
    if (-not $verified) {
        Write-Error-Custom "Installation failed"
        exit 1
    }
    
    # Show next steps
    Write-Host ""
    Write-Info "Installation complete!"
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Load the extension in Chrome:"
    Write-Host "     - Open chrome://extensions/"
    Write-Host "     - Enable 'Developer mode'"
    Write-Host "     - Click 'Load unpacked'"
    Write-Host "     - Select: $(Split-Path -Parent $InstallDir)\extension\"
    Write-Host ""
    Write-Host "  2. Update the native messaging manifest with your extension ID:"
    Write-Host "     - Find your extension ID in chrome://extensions/"
    Write-Host "     - Edit: $InstallDir\native-host\manifest.json"
    Write-Host "     - Replace EXTENSION_ID_PLACEHOLDER with your actual ID"
    Write-Host ""
    Write-Host "  3. Restart Chrome"
    Write-Host ""
    Write-Host "  4. Click the extension icon to open the side panel"
    Write-Host ""
    
    $installedVersion = Get-CurrentVersion
    Write-Info "Installed version: $installedVersion"
}

# Run main
Main
