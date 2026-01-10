@echo off
REM ChromePilot - Installation Script (Windows)
REM This script installs the ChromePilot native host

setlocal enabledelayedexpansion

REM Configuration
set "EXTENSION_NAME=chrome-pilot"
set "INSTALL_DIR=%USERPROFILE%\.chrome-pilot"
set "NATIVE_HOST_NAME=com.chromepilot.extension"
set "MANIFEST_FILE=%INSTALL_DIR%\native-host\manifest.json"
set "REGISTRY_KEY=HKCU\Software\Google\Chrome\NativeMessagingHosts\%NATIVE_HOST_NAME%"

echo.
echo ===============================================
echo   ChromePilot Native Host Installer
echo ===============================================
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [INFO] Node.js version: %NODE_VERSION%

REM Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo [INFO] npm version: %NPM_VERSION%

echo.
echo [INFO] Installing from local files...

REM Get script directory
set "SCRIPT_DIR=%~dp0"
for %%i in ("%SCRIPT_DIR%..") do set "PROJECT_DIR=%%~fi"

REM Create install directory
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

REM Backup existing logs if upgrading
if exist "%INSTALL_DIR%\native-host\logs" (
    echo [INFO] Backing up existing logs...
    set "BACKUP_DIR=%INSTALL_DIR%\logs-backup-%RANDOM%"
    mkdir "!BACKUP_DIR!"
    xcopy /E /I /Y "%INSTALL_DIR%\native-host\logs" "!BACKUP_DIR!" >nul
)

REM Copy native host files
echo [INFO] Copying native host files...
if exist "%INSTALL_DIR%\native-host" (
    rmdir /S /Q "%INSTALL_DIR%\native-host"
)
xcopy /E /I /Y "%PROJECT_DIR%\native-host" "%INSTALL_DIR%\native-host" >nul

REM Install dependencies
echo [INFO] Installing Node.js dependencies...
pushd "%INSTALL_DIR%\native-host"
call npm install --production --silent
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    popd
    exit /b 1
)
popd

echo [INFO] Native host installed to: %INSTALL_DIR%\native-host

REM Create launch.bat if it doesn't exist
set "LAUNCH_BAT=%INSTALL_DIR%\native-host\launch.bat"
if not exist "%LAUNCH_BAT%" (
    echo [INFO] Creating launch.bat...
    (
        echo @echo off
        echo REM ChromePilot Native Host Launcher for Windows
        echo REM This wrapper ensures the correct node version is used
        echo.
        echo REM Change to the native host directory
        echo cd /d "%%~dp0"
        echo.
        echo REM Launch the server with error logging
        echo node browser-pilot-server.js 2^>^> %%TEMP%%\chromepilot-error.log
    ) > "%LAUNCH_BAT%"
)

REM Get Chrome extension ID
echo.
echo [INFO] You need to provide your Chrome extension ID
echo 1. Load the extension in Chrome ^(chrome://extensions/^)
echo 2. Enable 'Developer mode'
echo 3. Copy the extension ID
echo.
set /p EXTENSION_ID="Enter extension ID: "

if "%EXTENSION_ID%"=="" (
    echo [ERROR] Extension ID is required
    exit /b 1
)

REM Create native messaging manifest
echo [INFO] Creating native messaging manifest...
set "LAUNCH_BAT_ESCAPED=%LAUNCH_BAT:\=\\%"
(
    echo {
    echo   "name": "%NATIVE_HOST_NAME%",
    echo   "description": "ChromePilot Native Messaging Host",
    echo   "path": "%LAUNCH_BAT_ESCAPED%",
    echo   "type": "stdio",
    echo   "allowed_origins": [
    echo     "chrome-extension://%EXTENSION_ID%/"
    echo   ]
    echo }
) > "%MANIFEST_FILE%"

REM Register in Windows Registry
echo [INFO] Registering native messaging host in registry...
reg add "%REGISTRY_KEY%" /ve /t REG_SZ /d "%MANIFEST_FILE%" /f >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARN] Failed to add registry key. You may need to run as Administrator.
    echo [INFO] Trying alternative registration method...
    REM Try without /f flag
    reg add "%REGISTRY_KEY%" /ve /t REG_SZ /d "%MANIFEST_FILE%" >nul 2>nul
)

REM Verify installation
echo.
echo [INFO] Verifying installation...

if not exist "%INSTALL_DIR%\native-host\browser-pilot-server.js" (
    echo [ERROR] Installation verification failed: browser-pilot-server.js not found
    exit /b 1
)

if not exist "%MANIFEST_FILE%" (
    echo [ERROR] Installation verification failed: manifest.json not found
    exit /b 1
)

if not exist "%LAUNCH_BAT%" (
    echo [ERROR] Installation verification failed: launch.bat not found
    exit /b 1
)

echo [INFO] Installation verified successfully

echo.
echo ===============================================
echo   Installation Complete!
echo ===============================================
echo.
echo Next steps:
echo 1. Load the extension in Chrome ^(chrome://extensions/^)
echo 2. Enable the extension
echo 3. Click the ChromePilot icon to open the side panel
echo.
echo The native host will start automatically when the extension connects.
echo Error logs: %%TEMP%%\chromepilot-error.log
echo.

endlocal
