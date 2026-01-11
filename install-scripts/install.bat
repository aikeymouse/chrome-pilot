@echo off
setlocal enabledelayedexpansion

REM ChromePilot - Windows Installer
REM Supports: install, upgrade, diagnose, update-id, uninstall

REM Configuration
set "NATIVE_HOST_NAME=com.chromepilot.native_host"
set "INSTALL_DIR=%LOCALAPPDATA%\ChromePilot"
set "CHROME_DIR=%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts"
set "BACKUP_TIMESTAMP="
set "BACKUP_CREATED="

REM ============================================================================
REM Helper Functions
REM ============================================================================

goto :skip_functions

:print_info
echo [INFO] %*
goto :eof

:print_success
echo [OK] %*
goto :eof

:print_warning
echo [WARN] %*
goto :eof

:print_error
echo [ERROR] %*
goto :eof

:skip_functions

:show_usage
echo.
echo ChromePilot - Installation and Management Tool
echo.
echo Usage:
echo   install.bat [command] [options]
echo.
echo Commands:
echo   install           Install ChromePilot (default)
echo   upgrade           Check for and install latest version
echo   diagnose          Run diagnostic checks and optionally auto-fix issues
echo   update-id ^<ID^>    Update extension ID in manifest
echo   uninstall         Remove ChromePilot installation
echo   help              Show this help message
echo   version           Show installed version
echo.
echo Examples:
echo   install.bat                           # Install ChromePilot locally
echo   install.bat upgrade                   # Upgrade to latest version
echo   install.bat diagnose                  # Run diagnostics
echo   install.bat update-id abcd...xyz      # Set extension ID
echo   install.bat uninstall                 # Remove installation
echo.
exit /b 0

REM ============================================================================
REM Version Management
REM ============================================================================

:get_current_version
if not exist "%INSTALL_DIR%\native-host\package.json" (
    echo Not installed
    exit /b 1
)
for /f "tokens=2 delims=:, " %%a in ('type "%INSTALL_DIR%\native-host\package.json" ^| findstr /C:"\"version\""') do (
    set VERSION=%%~a
    echo !VERSION!
    exit /b 0
)
echo Unknown
exit /b 1

REM ============================================================================
REM Dependency Checks
REM ============================================================================

:check_dependencies
call :print_info "Checking dependencies..."

REM Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    call :print_error "Node.js is not installed"
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Recommended version: 18.x or higher
    exit /b 1
)

for /f "tokens=*" %%a in ('node --version') do set NODE_VERSION=%%a
call :print_success "Node.js !NODE_VERSION! found"

REM Check npm
where npm >nul 2>&1
if errorlevel 1 (
    call :print_error "npm is not installed"
    exit /b 1
)

for /f "tokens=*" %%a in ('npm --version') do set NPM_VERSION=%%a
call :print_success "npm !NPM_VERSION! found"

exit /b 0

REM ============================================================================
REM Auto-fix Functions
REM ============================================================================

:auto_fix_kill_server
call :print_info "Stopping running server..."

REM Kill Node.js processes running browser-pilot-server.js
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq node.exe" /fo list ^| findstr /C:"PID:"') do (
    set PID=%%a
    wmic process where ProcessId=!PID! get CommandLine 2^>nul | findstr "browser-pilot-server.js" >nul
    if not errorlevel 1 (
        call :print_info "Killing process !PID!..."
        taskkill /PID !PID! /F >nul 2>&1
    )
)

REM Check if port 9000 is free
netstat -ano | findstr ":9000" | findstr "LISTENING" >nul
if not errorlevel 1 (
    call :print_warning "Port 9000 is still in use"
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":9000" ^| findstr "LISTENING"') do (
        call :print_info "Killing process on port 9000 (PID: %%a)..."
        taskkill /PID %%a /F >nul 2>&1
    )
)

timeout /t 2 /nobreak >nul
call :print_success "Server stopped"
exit /b 0

:auto_fix_permissions
call :print_info "Fixing file permissions..."

REM On Windows, we mainly need to ensure files aren't read-only
if exist "%INSTALL_DIR%" (
    attrib -r "%INSTALL_DIR%\*" /s /d >nul 2>&1
    call :print_success "Permissions fixed"
)

exit /b 0

:create_backup
if not exist "%INSTALL_DIR%" (
    exit /b 0
)

for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set DATE=%%c%%a%%b
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set TIME=%%a%%b
set "BACKUP_DIR=%LOCALAPPDATA%\chromepilot-backup-%DATE%-%TIME%"

call :print_info "Creating backup..."
xcopy "%INSTALL_DIR%" "%BACKUP_DIR%" /E /I /Q /Y >nul 2>&1
if errorlevel 1 (
    call :print_error "Backup failed"
    exit /b 1
)

set BACKUP_CREATED=1
call :print_success "Backup created: %BACKUP_DIR%"
exit /b 0

:rollback_installation
if not defined BACKUP_DIR (
    exit /b 0
)

call :print_warning "Rolling back installation..."

if exist "%INSTALL_DIR%" (
    rd /s /q "%INSTALL_DIR%" >nul 2>&1
)

xcopy "%BACKUP_DIR%" "%INSTALL_DIR%" /E /I /Q /Y >nul 2>&1
call :print_info "Installation rolled back to backup"
exit /b 0

REM ============================================================================
REM Installation Functions
REM ============================================================================

:install_local
call :print_info "Installing ChromePilot locally..."

REM Get script directory
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."

if not exist "%PROJECT_ROOT%\extension" (
    call :print_error "Extension directory not found"
    exit /b 1
)

if not exist "%PROJECT_ROOT%\native-host" (
    call :print_error "Native host directory not found"
    exit /b 1
)

REM Create installation directory
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

REM Copy extension
call :print_info "Copying extension..."
if exist "%INSTALL_DIR%\extension" rd /s /q "%INSTALL_DIR%\extension"
xcopy "%PROJECT_ROOT%\extension" "%INSTALL_DIR%\extension" /E /I /Q /Y >nul
if errorlevel 1 (
    call :print_error "Failed to copy extension"
    exit /b 1
)
call :print_success "Extension copied"

REM Copy native host
call :print_info "Copying native host..."
if exist "%INSTALL_DIR%\native-host" rd /s /q "%INSTALL_DIR%\native-host"
xcopy "%PROJECT_ROOT%\native-host" "%INSTALL_DIR%\native-host" /E /I /Q /Y >nul
if errorlevel 1 (
    call :print_error "Failed to copy native host"
    exit /b 1
)
call :print_success "Native host copied"

REM Install npm dependencies
call :print_info "Installing npm dependencies..."
cd "%INSTALL_DIR%\native-host"
call npm install --production >nul 2>&1
if errorlevel 1 (
    call :print_error "Failed to install dependencies"
    exit /b 1
)
call :print_success "Dependencies installed"

REM Create logs directory
if not exist "%INSTALL_DIR%\native-host\logs" mkdir "%INSTALL_DIR%\native-host\logs"

exit /b 0

:register_native_host
call :print_info "Registering native messaging host..."

if not exist "%CHROME_DIR%" mkdir "%CHROME_DIR%"

REM Create manifest
set "MANIFEST_FILE=%CHROME_DIR%\%NATIVE_HOST_NAME%.json"
set "NODE_PATH="
for /f "tokens=*" %%a in ('where node') do set NODE_PATH=%%a

if not defined NODE_PATH (
    call :print_error "Node.js path not found"
    exit /b 1
)

REM Convert backslashes to forward slashes for JSON
set "NODE_PATH_JSON=!NODE_PATH:\=/!"
set "INSTALL_DIR_JSON=!INSTALL_DIR:\=/!"

REM Create manifest JSON
(
echo {
echo   "name": "%NATIVE_HOST_NAME%",
echo   "description": "ChromePilot Native Messaging Host",
echo   "path": "!NODE_PATH_JSON!",
echo   "type": "stdio",
echo   "allowed_origins": [
echo     "chrome-extension://EXTENSION_ID_PLACEHOLDER/"
echo   ],
echo   "command": [
echo     "!NODE_PATH_JSON!",
echo     "!INSTALL_DIR_JSON!/native-host/browser-pilot-server.js"
echo   ]
echo }
) > "%MANIFEST_FILE%"

if not exist "%MANIFEST_FILE%" (
    call :print_error "Failed to create manifest"
    exit /b 1
)

call :print_success "Native host registered"
exit /b 0

:verify_installation
call :print_info "Verifying installation..."

if not exist "%INSTALL_DIR%\extension\manifest.json" (
    call :print_error "Extension manifest not found"
    exit /b 1
)

if not exist "%INSTALL_DIR%\native-host\browser-pilot-server.js" (
    call :print_error "Native host server not found"
    exit /b 1
)

if not exist "%CHROME_DIR%\%NATIVE_HOST_NAME%.json" (
    call :print_error "Native messaging manifest not found"
    exit /b 1
)

call :print_success "Installation verified"
exit /b 0

REM ============================================================================
REM Diagnostic Functions
REM ============================================================================

:diagnose
echo.
call :print_info "ChromePilot - Diagnostics"
echo ==========================
echo.

REM System Information
echo System Information:
echo   OS: Windows
for /f "tokens=*" %%a in ('ver') do echo   Version: %%a

REM Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo   Node.js: NOT FOUND
) else (
    for /f "tokens=*" %%a in ('node --version') do echo   Node.js: %%a
)

REM npm
where npm >nul 2>&1
if errorlevel 1 (
    echo   npm: NOT FOUND
) else (
    for /f "tokens=*" %%a in ('npm --version') do echo   npm: %%a
)
echo.

REM Installation Status
echo Installation Status:
if exist "%INSTALL_DIR%" (
    echo   Install Dir: %INSTALL_DIR% [OK]
    
    if exist "%INSTALL_DIR%\extension\manifest.json" (
        echo   Extension: Found [OK]
    ) else (
        echo   Extension: NOT FOUND [ERROR]
    )
    
    if exist "%INSTALL_DIR%\native-host\browser-pilot-server.js" (
        echo   Native Host: Found [OK]
    ) else (
        echo   Native Host: NOT FOUND [ERROR]
    )
    
    if exist "%INSTALL_DIR%\native-host\node_modules" (
        echo   Dependencies: Installed [OK]
    ) else (
        echo   Dependencies: NOT FOUND [WARNING]
    )
) else (
    echo   Installation: NOT FOUND [ERROR]
)
echo.

REM Manifest Check
echo Native Messaging Manifest:
if exist "%CHROME_DIR%\%NATIVE_HOST_NAME%.json" (
    echo   Location: %CHROME_DIR%\%NATIVE_HOST_NAME%.json [OK]
    
    findstr "EXTENSION_ID_PLACEHOLDER" "%CHROME_DIR%\%NATIVE_HOST_NAME%.json" >nul
    if not errorlevel 1 (
        echo   Extension ID: NOT SET [WARNING]
        echo   Run: install.bat update-id ^<your-extension-id^>
    ) else (
        echo   Extension ID: Set [OK]
    )
) else (
    echo   Manifest: NOT FOUND [ERROR]
)
echo.

REM Server Status
echo Server Status:
tasklist /fi "imagename eq node.exe" | findstr "node.exe" >nul
if not errorlevel 1 (
    echo   Node.js processes found - checking for server...
    REM This is a simplified check - full check would parse process command lines
) else (
    echo   Server: NOT RUNNING [INFO]
)

netstat -ano | findstr ":9000" | findstr "LISTENING" >nul
if not errorlevel 1 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":9000" ^| findstr "LISTENING"') do (
        echo   Port 9000: In use by PID %%a
    )
) else (
    echo   Port 9000: Available [OK]
)
echo.

REM Recent Logs
if exist "%INSTALL_DIR%\native-host\logs" (
    echo Recent Logs:
    for %%f in ("%INSTALL_DIR%\native-host\logs\*.log") do (
        echo   %%~nxf (%%~zf bytes)
    )
    echo.
)

REM Auto-fix prompt
echo.
set /p "AUTOFIX=Run auto-fix? (y/N): "
if /i "!AUTOFIX!"=="y" (
    echo.
    call :auto_fix_kill_server
    call :auto_fix_permissions
    
    if exist "%INSTALL_DIR%\native-host" (
        call :print_info "Reinstalling dependencies..."
        cd "%INSTALL_DIR%\native-host"
        call npm install --production >nul 2>&1
        call :print_success "Dependencies reinstalled"
    )
    
    echo.
    call :print_success "Auto-fix complete. Run 'install.bat diagnose' to verify."
)

exit /b 0

:update_extension_id
set "EXTENSION_ID=%~1"

REM Validate extension ID format (32 lowercase letters)
echo %EXTENSION_ID% | findstr /r "^[a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z]$" >nul
if errorlevel 1 (
    call :print_error "Invalid extension ID format"
    echo Extension ID must be exactly 32 lowercase letters
    echo Example: abcdefghijklmnopqrstuvwxyzabcdef
    exit /b 1
)

set "MANIFEST_FILE=%CHROME_DIR%\%NATIVE_HOST_NAME%.json"
if not exist "%MANIFEST_FILE%" (
    call :print_error "Manifest file not found: %MANIFEST_FILE%"
    echo Run 'install.bat install' first
    exit /b 1
)

call :print_info "Updating extension ID to: %EXTENSION_ID%"

REM Create backup
copy "%MANIFEST_FILE%" "%MANIFEST_FILE%.backup" >nul

REM Update the manifest (using PowerShell for better string replacement)
powershell -Command "(gc '%MANIFEST_FILE%') -replace 'EXTENSION_ID_PLACEHOLDER', '%EXTENSION_ID%' | Out-File -encoding ASCII '%MANIFEST_FILE%.tmp'"
move /y "%MANIFEST_FILE%.tmp" "%MANIFEST_FILE%" >nul

findstr "%EXTENSION_ID%" "%MANIFEST_FILE%" >nul
if errorlevel 1 (
    call :print_error "Failed to update extension ID"
    copy "%MANIFEST_FILE%.backup" "%MANIFEST_FILE%" >nul
    exit /b 1
)

call :print_success "Extension ID updated successfully"
echo.
echo Next step: Restart Chrome for changes to take effect
exit /b 0

REM ============================================================================
REM Upgrade Function
REM ============================================================================

:do_upgrade
call :print_info "Checking for updates..."

REM This is a placeholder - in production, check GitHub API
call :print_warning "Upgrade from GitHub not yet implemented on Windows"
echo.
echo Please download the latest release from:
echo https://github.com/aikeymouse/ChromePilot/releases
echo.
echo Then run: install.bat install
exit /b 0

REM ============================================================================
REM Uninstall Function
REM ============================================================================

:uninstall
echo.
call :print_info "ChromePilot - Uninstaller"
echo ==========================
echo.
echo This will remove:
echo   - Installation directory: %INSTALL_DIR%
echo   - Native messaging manifest
echo   - All logs and data
echo.

set /p "CONFIRM=Are you sure you want to uninstall? (y/N): "
if /i not "!CONFIRM!"=="y" (
    call :print_info "Uninstall cancelled"
    exit /b 0
)

echo.
call :print_info "Uninstalling ChromePilot..."

REM Kill running server
call :auto_fix_kill_server

REM Remove installation directory
if exist "%INSTALL_DIR%" (
    call :print_info "Removing installation directory..."
    rd /s /q "%INSTALL_DIR%" >nul 2>&1
    call :print_success "Installation directory removed"
)

REM Remove native messaging manifest
if exist "%CHROME_DIR%\%NATIVE_HOST_NAME%.json" (
    call :print_info "Removing native messaging manifest..."
    del /q "%CHROME_DIR%\%NATIVE_HOST_NAME%.json" >nul 2>&1
    del /q "%CHROME_DIR%\%NATIVE_HOST_NAME%.json.backup" >nul 2>&1
    call :print_success "Manifest removed"
)

REM Remove temp files
rd /s /q "%LOCALAPPDATA%\chromepilot-tmp" >nul 2>&1
for /d %%d in ("%LOCALAPPDATA%\chromepilot-backup-*") do rd /s /q "%%d" >nul 2>&1

echo.
call :print_success "ChromePilot uninstalled successfully"
echo.
echo Note: Chrome extension must be removed manually:
echo 1. Open chrome://extensions/
echo 2. Find ChromePilot and click 'Remove'
echo.
exit /b 0

REM ============================================================================
REM Main Entry Point
REM ============================================================================

:main
set "COMMAND=%~1"
if not defined COMMAND set "COMMAND=install"

if /i "%COMMAND%"=="help" goto help_command
if /i "%COMMAND%"=="--help" goto help_command
if /i "%COMMAND%"=="-h" goto help_command

if /i "%COMMAND%"=="version" goto version_command
if /i "%COMMAND%"=="--version" goto version_command
if /i "%COMMAND%"=="-v" goto version_command

if /i "%COMMAND%"=="diagnose" goto diagnose_command
if /i "%COMMAND%"=="--diagnose" goto diagnose_command

if /i "%COMMAND%"=="update-id" goto update_id_command
if /i "%COMMAND%"=="--update-id" goto update_id_command

if /i "%COMMAND%"=="upgrade" goto upgrade_command
if /i "%COMMAND%"=="--upgrade" goto upgrade_command

if /i "%COMMAND%"=="uninstall" goto uninstall_command
if /i "%COMMAND%"=="--uninstall" goto uninstall_command

if /i "%COMMAND%"=="install" goto install_command
if /i "%COMMAND%"=="--install" goto install_command

if /i not "%COMMAND%"=="install" (
    call :print_error "Unknown command: %COMMAND%"
    echo.
    call :show_usage
    exit /b 1
)

:install_command
echo.
echo [INFO] ChromePilot - Installer
echo ==========================
echo.
echo [DEBUG] About to check dependencies...

call :check_dependencies
if errorlevel 1 (
    echo [DEBUG] Dependencies check failed
    exit /b 1
)
echo [DEBUG] Dependencies check passed

REM Create backup if upgrading
if exist "%INSTALL_DIR%" (
    call :print_info "Existing installation detected"
    set /p "BACKUP=Create backup before upgrade? (Y/n): "
    if /i not "!BACKUP!"=="n" (
        call :create_backup
    )
)

REM Install
call :install_local
if errorlevel 1 (
    call :print_error "Installation failed"
    if defined BACKUP_CREATED call :rollback_installation
    exit /b 1
)

REM Register native host
call :register_native_host
if errorlevel 1 (
    call :print_error "Failed to register native host"
    if defined BACKUP_CREATED call :rollback_installation
    exit /b 1
)

REM Verify
call :verify_installation
if errorlevel 1 (
    call :print_error "Installation verification failed"
    if defined BACKUP_CREATED call :rollback_installation
    exit /b 1
)

REM Show next steps
echo.
call :print_success "Installation complete!"
echo.
echo Next steps:
echo   1. Load the extension in Chrome:
echo      - Open chrome://extensions/
echo      - Enable 'Developer mode'
echo      - Click 'Load unpacked'
echo      - Select: %INSTALL_DIR%\extension\
echo.
echo   2. Update the extension ID in the manifest:
echo      - Find your extension ID in chrome://extensions/
echo      - Run: install.bat update-id ^<your-extension-id^>
echo      Or manually edit: %CHROME_DIR%\%NATIVE_HOST_NAME%.json
echo.
echo   3. Restart Chrome
echo.
echo   4. Click the extension icon to open the side panel
echo.
echo Troubleshooting:
echo   - Run diagnostics: install.bat diagnose
echo   - Check logs: %INSTALL_DIR%\native-host\logs\
echo.

call :get_current_version
call :print_info "Installed version: !VERSION!"

REM Cleanup backup on success
if defined BACKUP_CREATED (
    set /p "REMOVE_BACKUP=Installation successful. Remove backup? (y/N): "
    if /i "!REMOVE_BACKUP!"=="y" (
        rd /s /q "%BACKUP_DIR%" >nul 2>&1
        call :print_info "Backup removed"
    ) else (
        call :print_info "Backup kept at: %BACKUP_DIR%"
    )
)

exit /b 0

:help_command
call :show_usage
exit /b 0

:version_command
call :get_current_version
if errorlevel 1 (
    echo ChromePilot is not installed
    exit /b 1
)
echo ChromePilot version: !VERSION!
exit /b 0

:diagnose_command
call :diagnose
exit /b 0

:update_id_command
if "%~2"=="" (
    call :print_error "Extension ID is required"
    echo Usage: install.bat update-id ^<extension-id^>
    exit /b 1
)
call :update_extension_id "%~2"
exit /b 0

:upgrade_command
call :do_upgrade
exit /b 0

:uninstall_command
call :uninstall
exit /b 0

REM Run main
call :main %*
