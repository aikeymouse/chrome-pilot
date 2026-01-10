# Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- Google Chrome browser
- macOS, Linux, or Windows

## Installation (5 minutes)

### Step 1: Install Native Host

**macOS/Linux:**
```bash
cd chrome-driver-extension
chmod +x install-scripts/install.sh
./install-scripts/install.sh
```

**Windows:**
```cmd
cd C:\Path\To\chrome-driver-extension
install-scripts\install.bat
```

### Step 2: Load Extension in Chrome

1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `extension/` folder from the project directory
5. **Copy your extension ID** (looks like: `abcdefghijklmnopqrstuvwxyz123456`)

### Step 3: Update Extension ID

Edit the native host manifest:

**macOS:**
```bash
nano ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.chromepilot.extension.json
```

**Linux:**
```bash
nano ~/.config/google-chrome/NativeMessagingHosts/com.chromepilot.extension.json
```

**Windows:**

The installer will prompt you for the extension ID during installation.

Replace `EXTENSION_ID_PLACEHOLDER` with your actual extension ID from Step 2.

### Step 4: Restart Chrome

Completely quit and restart Chrome.

### Step 5: Test

1. Click the extension icon in Chrome toolbar
2. Side panel opens showing "Connected" status
3. You should see "Connected" with a green dot

## Usage

### Connect from Your Application

```javascript
const WebSocket = require('ws');

// Create session
const ws = new WebSocket('ws://localhost:9000/session?timeout=300000');

ws.on('open', () => {
  console.log('Connected to ChromePilot');
  
  // List all tabs in current window
  ws.send(JSON.stringify({
    action: 'listTabs',
    requestId: 'req-1'
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());
  console.log('Response:', response);
  
  if (response.type === 'sessionCreated') {
    console.log('Session ID:', response.sessionId);
  }
});
```

### Basic Commands

**List Tabs:**
```json
{
  "action": "listTabs",
  "requestId": "req-1"
}
```

**Open New Tab:**
```json
{
  "action": "openTab",
  "params": {
    "url": "https://example.com",
    "focus": true
  },
  "requestId": "req-2"
}
```

**Execute JavaScript:**
```json
{
  "action": "executeJS",
  "params": {
    "code": "document.title",
    "timeout": 30000
  },
  "requestId": "req-3"
}
```

## Verify Installation

### Check Native Host

```bash
# macOS/Linux
lsof -i :9000

# Should show: node (browser-pilot-server.js) listening on port 9000
```

### Check Extension

1. Go to `chrome://extensions/`
2. Find "ChromePilot"
3. Click "service worker" to open console
4. Should see: "Connected to native host"

### Check Side Panel

1. Click extension icon
2. Should show:
   - Status: Connected (green)
   - Connected Clients: 0
   - Current Window Tabs list

## Troubleshooting

### "Disconnected" Status in Side Panel

**Fix:**
1. Check native host is running: `lsof -i :9000`
2. If not running, restart Chrome
3. Check extension ID matches in manifest

### "Cannot connect to native host"

**Fix:**
```bash
# Verify manifest exists (macOS)
ls -la ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/

# Check manifest content
cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.chromepilot.extension.json

# Verify extension ID matches
```

### WebSocket Connection Refused

**Fix:**
1. Open side panel - this starts the native host
2. Wait 2-3 seconds for server to start
3. Try connecting again
4. Check firewall allows localhost:9000

## Next Steps

- Read full documentation: `README.md`
- See API protocol: `docs/PROTOCOL.md`
- Development guide: `DEVELOPMENT.md`

## Example Client

Create `test.js`:

```javascript
const WebSocket = require('ws');

async function main() {
  const ws = new WebSocket('ws://localhost:9000/session?timeout=600000');
  
  await new Promise(resolve => ws.once('open', resolve));
  console.log('✓ Connected');
  
  // Helper to send command
  const send = (action, params = {}) => {
    return new Promise((resolve) => {
      const requestId = `req-${Date.now()}`;
      
      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.requestId === requestId) {
          ws.off('message', handler);
          resolve(msg.result);
        }
      };
      
      ws.on('message', handler);
      ws.send(JSON.stringify({ action, params, requestId }));
    });
  };
  
  // List tabs
  const tabs = await send('listTabs');
  console.log('✓ Tabs:', tabs.tabs.length);
  
  // Open new tab
  const newTab = await send('openTab', { 
    url: 'https://example.com', 
    focus: true 
  });
  console.log('✓ Opened tab:', newTab.tab.id);
  
  // Wait for page load
  await new Promise(r => setTimeout(r, 2000));
  
  // Get title
  const result = await send('executeJS', { 
    code: 'document.title',
    tabId: newTab.tab.id
  });
  console.log('✓ Page title:', result.value);
  
  ws.close();
}

main().catch(console.error);
```

Run:
```bash
npm install ws
node test.js
```

Expected output:
```
✓ Connected
✓ Tabs: 3
✓ Opened tab: 123
✓ Page title: Example Domain
```

## Support

For issues, check:
1. Chrome service worker console: `chrome://extensions/` → "service worker"
2. Native host logs: `~/.chrome-driver-extension/native-host/logs/`
3. Side panel inspector: Right-click in panel → "Inspect"
