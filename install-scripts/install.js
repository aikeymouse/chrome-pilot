#!/usr/bin/env node

/**
 * ChromePilot - Cross-Platform Installer
 * Supports: install, upgrade, diagnose, update-id, uninstall
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

// Configuration
const NATIVE_HOST_NAME = 'com.chromepilot.extension';
const INSTALL_DIR = path.join(os.homedir(), '.chrome-pilot');
const PLATFORM = os.platform();

// Platform-specific paths
const CHROME_DIR = PLATFORM === 'darwin'
  ? path.join(os.homedir(), 'Library/Application Support/Google/Chrome/NativeMessagingHosts')
  : PLATFORM === 'win32'
  ? path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'NativeMessagingHosts')
  : path.join(os.homedir(), '.config/google-chrome/NativeMessagingHosts');

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// Helper functions
function print(message, color = 'reset') {
  const c = process.stdout.isTTY ? colors[color] : '';
  const reset = process.stdout.isTTY ? colors.reset : '';
  console.log(`${c}${message}${reset}`);
}

function printInfo(message) {
  print(`[INFO] ${message}`, 'cyan');
}

function printSuccess(message) {
  print(`[OK] ${message}`, 'green');
}

function printWarn(message) {
  print(`[WARN] ${message}`, 'yellow');
}

function printError(message) {
  print(`[ERROR] ${message}`, 'red');
}

function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function mkdir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyRecursive(src, dest) {
  if (!exists(src)) return;
  
  const stat = fs.statSync(src);
  
  if (stat.isDirectory()) {
    mkdir(dest);
    const files = fs.readdirSync(src);
    files.forEach(file => {
      copyRecursive(path.join(src, file), path.join(dest, file));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

function removeRecursive(dirPath) {
  if (!exists(dirPath)) return;
  
  if (fs.statSync(dirPath).isDirectory()) {
    fs.readdirSync(dirPath).forEach(file => {
      removeRecursive(path.join(dirPath, file));
    });
    fs.rmdirSync(dirPath);
  } else {
    fs.unlinkSync(dirPath);
  }
}

// Check dependencies
function checkDependencies() {
  printInfo('Checking dependencies...');
  
  // Check Node.js version
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  
  if (major < 18) {
    printError(`Node.js 18+ required. Current: ${version}`);
    process.exit(1);
  }
  
  printSuccess(`Node.js ${version} found`);
  
  // Check npm
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
    printSuccess(`npm ${npmVersion} found`);
  } catch {
    printError('npm is not installed');
    process.exit(1);
  }
}

// Get current version
function getCurrentVersion() {
  const packageJsonPath = path.join(INSTALL_DIR, 'native-host', 'package.json');
  
  if (!exists(packageJsonPath)) {
    return null;
  }
  
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return pkg.version;
  } catch {
    return 'Unknown';
  }
}

// Stop server processes
function stopServerProcesses() {
  printInfo('Stopping running server...');
  
  try {
    if (PLATFORM === 'win32') {
      // Windows: Find and kill node processes running browser-pilot-server.js
      execSync('taskkill /F /FI "IMAGENAME eq node.exe" /FI "WINDOWTITLE eq *browser-pilot-server*" 2>nul', { stdio: 'ignore' });
    } else {
      // Unix: pkill
      execSync('pkill -f browser-pilot-server.js', { stdio: 'ignore' });
    }
    
    // Wait a bit
    setTimeout(() => {}, 1000);
    
    printSuccess('Server stopped');
  } catch {
    // Ignore errors if process not found
  }
}

// Install from local files
function installLocal() {
  printInfo('Installing from local files...');
  
  // Get script directory
  const scriptDir = __dirname;
  const projectDir = path.dirname(scriptDir);
  
  const nativeHostPath = path.join(projectDir, 'native-host');
  
  if (!exists(nativeHostPath)) {
    printError('Native host directory not found');
    console.log('Expected:', nativeHostPath);
    console.log('');
    console.log('Make sure you:');
    console.log('  1. Downloaded chromepilot-native-host-v*.zip');
    console.log('  2. Extracted it completely');
    console.log('  3. Running install.js from the install-scripts folder');
    process.exit(1);
  }
  
  // Create installation directory
  mkdir(INSTALL_DIR);
  
  // Backup logs if upgrading
  const logsPath = path.join(INSTALL_DIR, 'native-host', 'logs');
  if (exists(logsPath)) {
    const timestamp = Math.floor(Date.now() / 1000);
    const backupLogsPath = path.join(INSTALL_DIR, `logs-backup-${timestamp}`);
    printInfo('Backing up existing logs...');
    copyRecursive(logsPath, backupLogsPath);
  }
  
  // Copy native host files
  printInfo('Copying native host files...');
  const installNativeHostPath = path.join(INSTALL_DIR, 'native-host');
  if (exists(installNativeHostPath)) {
    removeRecursive(installNativeHostPath);
  }
  copyRecursive(nativeHostPath, installNativeHostPath);
  
  // Restore logs
  const backupDirs = fs.readdirSync(INSTALL_DIR)
    .filter(name => name.startsWith('logs-backup-'))
    .map(name => ({ name, path: path.join(INSTALL_DIR, name) }))
    .sort((a, b) => b.name.localeCompare(a.name));
  
  if (backupDirs.length > 0) {
    printInfo('Restoring logs...');
    const latestBackup = backupDirs[0].path;
    const newLogsPath = path.join(installNativeHostPath, 'logs');
    mkdir(newLogsPath);
    
    try {
      fs.readdirSync(latestBackup).forEach(file => {
        copyRecursive(
          path.join(latestBackup, file),
          path.join(newLogsPath, file)
        );
      });
    } catch (err) {
      // Ignore errors restoring logs
    }
  }
  
  // Install npm dependencies
  printInfo('Installing Node.js dependencies...');
  try {
    execSync('npm install --production --silent', {
      cwd: installNativeHostPath,
      stdio: 'inherit',
    });
  } catch (err) {
    printError('Failed to install dependencies');
    throw err;
  }
  
  // Create logs directory if it doesn't exist
  const finalLogsPath = path.join(installNativeHostPath, 'logs');
  mkdir(finalLogsPath);
  
  // Make executable on Unix
  if (PLATFORM !== 'win32') {
    const serverPath = path.join(installNativeHostPath, 'browser-pilot-server.js');
    try {
      fs.chmodSync(serverPath, 0o755);
    } catch {
      // Ignore
    }
  }
  
  printInfo(`Native host installed to: ${installNativeHostPath}`);
}

// Register native host
function registerNativeHost() {
  printInfo('Registering native messaging host...');
  
  mkdir(CHROME_DIR);
  
  let manifest;
  let launchScriptPath;
  
  if (PLATFORM === 'win32') {
    // Windows: Use launch.bat script
    launchScriptPath = path.join(INSTALL_DIR, 'native-host', 'launch.bat');
    const launchPathJson = launchScriptPath.replace(/\\/g, '/');
    
    manifest = {
      name: NATIVE_HOST_NAME,
      description: 'ChromePilot Native Messaging Host',
      path: launchPathJson,
      type: 'stdio',
      allowed_origins: [
        'chrome-extension://EXTENSION_ID_PLACEHOLDER/',
      ],
    };
  } else {
    // Unix: Use launch.sh script
    launchScriptPath = path.join(INSTALL_DIR, 'native-host', 'launch.sh');
    const launchPathJson = launchScriptPath.replace(/\\/g, '/');
    
    manifest = {
      name: NATIVE_HOST_NAME,
      description: 'ChromePilot Native Messaging Host',
      path: launchPathJson,
      type: 'stdio',
      allowed_origins: [
        'chrome-extension://EXTENSION_ID_PLACEHOLDER/',
      ],
    };
  }
  
  const manifestFile = path.join(CHROME_DIR, `${NATIVE_HOST_NAME}.json`);
  
  try {
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf-8');
    printSuccess('Native host registered');
    
    // Verify the launch script exists
    if (!exists(launchScriptPath)) {
      printError(`Launch script not found: ${launchScriptPath}`);
      throw new Error('Launch script missing');
    }
    printSuccess(`Launch script verified: ${launchScriptPath}`);
    
    // Windows requires registry entry
    if (PLATFORM === 'win32') {
      printInfo('Registering in Windows Registry...');
      try {
        const regKey = 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\' + NATIVE_HOST_NAME;
        const manifestPathForReg = manifestFile.replace(/\//g, '\\');
        
        // Create registry key and set default value
        execSync(`reg add "${regKey}" /ve /d "${manifestPathForReg}" /f`, { stdio: 'ignore' });
        
        printSuccess('Registry entry created');
        console.log(`  Key: ${regKey}`);
        console.log(`  Value: ${manifestPathForReg}`);
      } catch (err) {
        printError('Failed to create registry entry');
        printWarn('You may need to run this as Administrator');
        throw err;
      }
    }
  } catch (err) {
    printError(`Failed to register native host: ${err.message}`);
    throw err;
  }
}

// Verify installation
function verifyInstallation() {
  printInfo('Verifying installation...');
  
  const serverScript = path.join(INSTALL_DIR, 'native-host', 'browser-pilot-server.js');
  if (!exists(serverScript)) {
    printError('Native host server not found');
    throw new Error('Installation verification failed');
  }
  
  const nativeManifest = path.join(CHROME_DIR, `${NATIVE_HOST_NAME}.json`);
  if (!exists(nativeManifest)) {
    printError('Native messaging manifest not found');
    throw new Error('Installation verification failed');
  }
  
  printSuccess('Installation verified');
}

// Update extension ID
function updateExtensionId(extensionId) {
  if (!extensionId) {
    printError('Extension ID is required');
    console.log('Usage: node install.js update-id <extension-id>');
    process.exit(1);
  }
  
  // Validate format (32 lowercase letters)
  if (!/^[a-z]{32}$/.test(extensionId)) {
    printError('Invalid extension ID format');
    console.log('Extension ID must be exactly 32 lowercase letters');
    console.log('Example: abcdefghijklmnopqrstuvwxyzabcdef');
    process.exit(1);
  }
  
  const manifestFile = path.join(CHROME_DIR, `${NATIVE_HOST_NAME}.json`);
  if (!exists(manifestFile)) {
    printError('Manifest file not found: ' + manifestFile);
    console.log("Run 'node install.js install' first");
    process.exit(1);
  }
  
  printInfo(`Updating extension ID to: ${extensionId}`);
  
  // Create backup
  const backupFile = `${manifestFile}.backup`;
  fs.copyFileSync(manifestFile, backupFile);
  
  try {
    // Read, update, and save manifest
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
    manifest.allowed_origins = [`chrome-extension://${extensionId}/`];
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf-8');
    
    // Verify update
    const updated = fs.readFileSync(manifestFile, 'utf-8');
    if (!updated.includes(extensionId)) {
      throw new Error('Failed to verify extension ID in manifest');
    }
    
    printSuccess('Extension ID updated successfully');
    console.log('');
    console.log('Next step: Restart Chrome for changes to take effect');
  } catch (err) {
    printError(`Failed to update extension ID: ${err.message}`);
    // Restore backup
    fs.copyFileSync(backupFile, manifestFile);
    process.exit(1);
  }
}

// Diagnose
function diagnose() {
  console.log('');
  printInfo('ChromePilot - Diagnostics');
  console.log('==========================');
  console.log('');
  
  // System Information
  console.log('System Information:');
  console.log(`  OS: ${PLATFORM}`);
  console.log(`  Node.js: ${process.version}`);
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
    console.log(`  npm: ${npmVersion}`);
  } catch {
    console.log('  npm: NOT FOUND');
  }
  console.log('');
  
  // Installation Status
  console.log('Installation Status:');
  if (exists(INSTALL_DIR)) {
    const okTag = process.stdout.isTTY ? `${colors.green}[OK]${colors.reset}` : '[OK]';
    console.log(`  Install Dir: ${INSTALL_DIR} ${okTag}`);
    
    const serverScript = path.join(INSTALL_DIR, 'native-host', 'browser-pilot-server.js');
    if (exists(serverScript)) {
      console.log(`  Native Host: Found ${okTag}`);
    } else {
      const errTag = process.stdout.isTTY ? `${colors.red}[ERROR]${colors.reset}` : '[ERROR]';
      console.log(`  Native Host: NOT FOUND ${errTag}`);
    }
    
    const nodeModules = path.join(INSTALL_DIR, 'native-host', 'node_modules');
    if (exists(nodeModules)) {
      console.log(`  Dependencies: Installed ${okTag}`);
    } else {
      const warnTag = process.stdout.isTTY ? `${colors.yellow}[WARNING]${colors.reset}` : '[WARNING]';
      console.log(`  Dependencies: NOT FOUND ${warnTag}`);
    }
  } else {
    const errTag = process.stdout.isTTY ? `${colors.red}[ERROR]${colors.reset}` : '[ERROR]';
    console.log(`  Installation: NOT FOUND ${errTag}`);
  }
  console.log('');
  
  // Manifest Check
  console.log('Native Messaging Manifest:');
  const nativeManifest = path.join(CHROME_DIR, `${NATIVE_HOST_NAME}.json`);
  const okTag = process.stdout.isTTY ? `${colors.green}[OK]${colors.reset}` : '[OK]';
  const errTag = process.stdout.isTTY ? `${colors.red}[ERROR]${colors.reset}` : '[ERROR]';
  const warnTag = process.stdout.isTTY ? `${colors.yellow}[WARNING]${colors.reset}` : '[WARNING]';
  
  if (exists(nativeManifest)) {
    console.log(`  Location: ${nativeManifest} ${okTag}`);
    
    try {
      const content = fs.readFileSync(nativeManifest, 'utf-8');
      const manifest = JSON.parse(content);
      
      if (content.includes('EXTENSION_ID_PLACEHOLDER')) {
        console.log(`  Extension ID: NOT SET ${warnTag}`);
        console.log('  Run: node install.js update-id <your-extension-id>');
      } else if (manifest.allowed_origins && manifest.allowed_origins.length > 0) {
        const origin = manifest.allowed_origins[0];
        const match = origin.match(/chrome-extension:\/\/([a-z]{32})\//);
        if (match) {
          console.log(`  Extension ID: ${match[1]} ${okTag}`);
        } else {
          console.log(`  Extension ID: Set ${okTag}`);
        }
      } else {
        console.log(`  Extension ID: Set ${okTag}`);
      }
      
      // Show manifest path
      if (manifest.path) {
        const scriptName = path.basename(manifest.path);
        console.log(`  Launch Script: ${scriptName}`);
        console.log(`    Path: ${manifest.path}`);
        
        const scriptPath = manifest.path.replace(/\//g, path.sep);
        if (exists(scriptPath)) {
          console.log(`    Exists: ${okTag}`);
        } else {
          console.log(`    Exists: NOT FOUND ${errTag}`);
        }
      }
    } catch (err) {
      console.log(`  Extension ID: Error reading manifest ${errTag}`);
    }
  } else {
    console.log(`  Manifest: NOT FOUND ${errTag}`);
  }
  console.log('');
  
  // Windows Registry Check
  if (PLATFORM === 'win32') {
    console.log('Windows Registry:');
    const regKey = 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\' + NATIVE_HOST_NAME;
    try {
      const output = execSync(`reg query "${regKey}" /ve`, { encoding: 'utf-8' });
      if (output.includes(NATIVE_HOST_NAME + '.json')) {
        console.log(`  Registry Key: ${okTag}`);
        console.log(`    ${regKey}`);
        // Extract path from output
        const match = output.match(/REG_SZ\s+(.+)/);
        if (match) {
          console.log(`    Path: ${match[1].trim()}`);
        }
      } else {
        console.log(`  Registry Key: NOT FOUND ${errTag}`);
      }
    } catch {
      console.log(`  Registry Key: NOT FOUND ${errTag}`);
      console.log(`    Expected: ${regKey}`);
    }
    console.log('');
  }
  
  // Server Status
  console.log('Server Status:');
  let serverRunning = false;
  let serverPid = null;
  
  try {
    if (PLATFORM === 'win32') {
      // Windows: Use PowerShell Get-Process
      const psCmd = `powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*browser-pilot-server.js*' } | Select-Object -First 1 -ExpandProperty Id"`;
      const output = execSync(psCmd, { encoding: 'utf-8' }).trim();
      if (output && !isNaN(output)) {
        serverRunning = true;
        serverPid = output;
      }
    } else {
      // macOS/Linux: Use pgrep
      const output = execSync('pgrep -f browser-pilot-server.js', { encoding: 'utf-8' }).trim();
      if (output) {
        serverRunning = true;
        serverPid = output.split('\n')[0];
      }
    }
  } catch {
    // Process not found
    serverRunning = false;
  }
  
  if (serverRunning) {
    console.log(`  Server Process: Running (PID: ${serverPid}) ${okTag}`);
  } else {
    console.log(`  Server Process: Not Running ${warnTag}`);
    console.log('  Note: Server starts automatically when Chrome extension connects');
  }
  
  // Check port 9000
  let portInUse = false;
  let portPid = null;
  
  try {
    if (PLATFORM === 'win32') {
      // Windows: netstat
      const output = execSync('netstat -ano | findstr :9000', { encoding: 'utf-8' });
      const match = output.match(/LISTENING\s+(\d+)/);
      if (match) {
        portInUse = true;
        portPid = match[1];
      }
    } else {
      // macOS/Linux: lsof
      const output = execSync('lsof -ti :9000', { encoding: 'utf-8' }).trim();
      if (output) {
        portInUse = true;
        portPid = output.split('\n')[0];
      }
    }
  } catch {
    // Port not in use
    portInUse = false;
  }
  
  if (portInUse) {
    if (serverPid && portPid === serverPid) {
      console.log(`  Port 9000: Listening ${okTag}`);
    } else {
      console.log(`  Port 9000: In use by different process (PID: ${portPid}) ${warnTag}`);
    }
  } else {
    console.log(`  Port 9000: Available ${warnTag}`);
    console.log('  Note: Port will be used when server starts');
  }
  console.log('');
  
  // Recent Logs
  const logsPath = path.join(INSTALL_DIR, 'native-host', 'logs');
  if (exists(logsPath)) {
    console.log('Recent Logs:');
    try {
      fs.readdirSync(logsPath)
        .filter(file => file.endsWith('.log'))
        .forEach(file => {
          const stat = fs.statSync(path.join(logsPath, file));
          console.log(`  ${file} (${stat.size} bytes)`);
        });
    } catch {
      // Ignore
    }
    console.log('');
  }
}

// Uninstall
function uninstall() {
  console.log('');
  printInfo('ChromePilot - Uninstaller');
  console.log('==========================');
  console.log('');
  console.log('This will remove:');
  console.log(`  - Installation directory: ${INSTALL_DIR}`);
  console.log('  - Native messaging manifest');
  console.log('  - All logs and data');
  console.log('');
  
  // Note: In a real implementation, you'd want to use readline for confirmation
  // For now, just proceed
  
  printInfo('Uninstalling ChromePilot...');
  
  // Kill running server
  stopServerProcesses();
  
  // Windows: Wait for process to fully terminate
  if (PLATFORM === 'win32') {
    printInfo('Waiting for processes to terminate...');
    setTimeout(() => {}, 2000);
  }
  
  // Remove installation directory
  if (exists(INSTALL_DIR)) {
    printInfo('Removing installation directory...');
    try {
      removeRecursive(INSTALL_DIR);
      printSuccess('Installation directory removed');
    } catch (err) {
      if (PLATFORM === 'win32') {
        printError('Failed to remove installation directory');
        printWarn('Server may still be running. Try:');
        console.log('  1. Close Chrome completely');
        console.log('  2. Check Task Manager for node.exe processes');
        console.log('  3. Run uninstall again');
      } else {
        throw err;
      }
    }
  }
  
  // Remove native messaging manifest
  const manifestFile = path.join(CHROME_DIR, `${NATIVE_HOST_NAME}.json`);
  if (exists(manifestFile)) {
    printInfo('Removing native messaging manifest...');
    fs.unlinkSync(manifestFile);
    try {
      fs.unlinkSync(`${manifestFile}.backup`);
    } catch {
      // Ignore
    }
    printSuccess('Manifest removed');
  }
  
  // Remove Windows registry entry
  if (PLATFORM === 'win32') {
    printInfo('Removing Windows registry entry...');
    try {
      const regKey = 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\' + NATIVE_HOST_NAME;
      execSync(`reg delete "${regKey}" /f`, { stdio: 'ignore' });
      printSuccess('Registry entry removed');
    } catch {
      // Ignore if doesn't exist
    }
  }
  
  console.log('');
  printSuccess('ChromePilot uninstalled successfully');
  console.log('');
  console.log('Note: Chrome extension must be removed manually:');
  console.log('1. Open chrome://extensions/');
  console.log("2. Find ChromePilot and click 'Remove'");
  console.log('');
}

// Show usage
function showUsage() {
  console.log('');
  console.log('ChromePilot - Installation and Management Tool');
  console.log('');
  console.log('Usage:');
  console.log('  node install.js [command] [options]');
  console.log('');
  console.log('Commands:');
  console.log('  install           Install ChromePilot (default)');
  console.log('  diagnose          Run diagnostic checks');
  console.log('  test              Test native host execution (Windows)');
  console.log('  update-id <ID>    Update extension ID in manifest');
  console.log('  uninstall         Remove ChromePilot installation');
  console.log('  help              Show this help message');
  console.log('  version           Show installed version');
  console.log('');
  console.log('Examples:');
  console.log('  node install.js                           # Install ChromePilot');
  console.log('  node install.js diagnose                  # Run diagnostics');
  console.log('  node install.js update-id abcd...xyz      # Set extension ID');
  console.log('  node install.js uninstall                 # Remove installation');
  console.log('');
}

// Main install function
function doInstall() {
  console.log('');
  printInfo('ChromePilot - Installer');
  console.log('==========================');
  console.log('');
  
  try {
    checkDependencies();
    installLocal();
    registerNativeHost();
    verifyInstallation();
    
    // Show next steps
    console.log('');
    printSuccess('Installation complete!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Download chromepilot-extension-v*.zip');
    console.log('  2. Load the extension in Chrome:');
    console.log('     - Open chrome://extensions/');
    console.log("     - Enable 'Developer mode'");
    console.log("     - Click 'Load unpacked'");
    console.log('     - Select the extracted extension folder');
    console.log('');
    console.log('  3. Update the extension ID in the manifest:');
    console.log('     - Find your extension ID in chrome://extensions/');
    console.log('     - Run: node install.js update-id <your-extension-id>');
    console.log('');
    console.log('  4. Restart Chrome');
    console.log('');
    console.log('  5. Click the extension icon to open the side panel');
    console.log('');
    console.log('Troubleshooting:');
    console.log('  - Run diagnostics: node install.js diagnose');
    console.log(`  - Check logs: ${path.join(INSTALL_DIR, 'native-host', 'logs')}`);
    console.log('');
    
    const version = getCurrentVersion();
    if (version) {
      printInfo(`Installed version: ${version}`);
    }
  } catch (err) {
    printError(`Installation failed: ${err.message}`);
    process.exit(1);
  }
}

// Main entry point
function main() {
  const command = process.argv[2] || 'install';
  const arg = process.argv[3];
  
  switch (command.toLowerCase()) {
    case 'help':
    case '--help':
    case '-h':
      showUsage();
      break;
      
    case 'version':
    case '--version':
    case '-v':
      const version = getCurrentVersion();
      if (!version) {
        console.log('ChromePilot is not installed');
        process.exit(1);
      }
      console.log(`ChromePilot version: ${version}`);
      break;
      
    case 'diagnose':
      diagnose();
      break;
      
    case 'update-id':
      updateExtensionId(arg);
      break;
      
    case 'uninstall':
      uninstall();
      break;
      
    case 'install':
      doInstall();
      break;
      
    case 'test':
      testNativeHost();
      break;
      
    default:
      printError(`Unknown command: ${command}`);
      console.log('');
      showUsage();
      process.exit(1);
  }
}

// Test native host
function testNativeHost() {
  console.log('');
  printInfo('ChromePilot - Native Host Test');
  console.log('==========================');
  console.log('');
  
  const manifestFile = path.join(CHROME_DIR, `${NATIVE_HOST_NAME}.json`);
  
  if (!exists(manifestFile)) {
    printError('Manifest not found. Run: node install.js install');
    process.exit(1);
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
  
  if (!manifest.path) {
    printError('Invalid manifest: no path specified');
    process.exit(1);
  }
  
  const launchScript = manifest.path.replace(/\//g, path.sep);
  
  if (!exists(launchScript)) {
    printError(`Launch script not found: ${launchScript}`);
    process.exit(1);
  }
  
  printInfo(`Testing: ${launchScript}`);
  console.log('');
  
  try {
    // Spawn the process to see its output
    printInfo('Starting native host (will auto-terminate after 3 seconds)...');
    console.log('');
    
    const isWindows = PLATFORM === 'win32';
    const proc = spawn(isWindows ? 'cmd.exe' : launchScript, isWindows ? ['/c', launchScript] : [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });
    
    // Auto-kill after 3 seconds
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill();
      }
    }, 3000);
    
    proc.on('exit', (code, signal) => {
      console.log('');
      if (stdout.includes('WebSocket server') || stdout.includes('listening on')) {
        printSuccess('Native host started successfully!');
        console.log(`Process exited (code: ${code}, signal: ${signal})`);
      } else if (code === 0) {
        printSuccess('Native host executable!');
      } else {
        printError(`Process exited with code: ${code}`);
      }
      
      if (stderr) {
        console.log('');
        printWarn('Errors detected:');
        console.log(stderr);
      }
      
      console.log('');
      printInfo('This test verifies the native host can start.');
      printInfo('The actual connection will be made by Chrome extension.');
    });
    
  } catch (err) {
    printError('Failed to execute native host');
    console.log('Error:', err.message);
    console.log('');
    printWarn('Chrome will also fail to start the native host.');
  }
}

// Run
main();
