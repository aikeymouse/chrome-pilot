# ChromePilot - Development Guide

## Project Structure

```
chrome-driver-extension/
├── extension/                  # Chrome extension files
│   ├── manifest.json          # Extension manifest
│   ├── background/
│   │   └── service-worker.js  # Background service worker
│   └── sidepanel/
│       ├── panel.html         # Side panel UI
│       ├── panel.js           # Side panel logic
│       └── panel.css          # Side panel styles
├── native-host/               # Native messaging host
│   ├── server.js              # WebSocket server + native messaging
│   ├── package.json           # Node.js dependencies
│   ├── manifest.json          # Native host manifest
│   └── logs/                  # Session log files
├── install-scripts/           # Installation scripts
│   ├── install.sh             # macOS/Linux installer
│   └── install.ps1            # Windows installer
├── docs/
│   └── PROTOCOL.md            # WebSocket protocol documentation
├── PLAN.md                    # Implementation plan
└── README.md                  # User documentation

```

## Development Setup

### 1. Install Dependencies

```bash
cd native-host
npm install
```

### 2. Run Native Host in Development Mode

```bash
cd native-host
npm run dev
```

This will start the native host with nodemon for auto-restart on file changes.

### 3. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension/` directory
5. Note the extension ID (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

### 4. Update Native Host Manifest

Edit `native-host/manifest.json` and replace `EXTENSION_ID_PLACEHOLDER` with your actual extension ID:

```json
{
  "name": "com.chromedriver.extension",
  "description": "ChromePilot Native Messaging Host",
  "path": "/full/path/to/native-host/server.js",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://YOUR_ACTUAL_EXTENSION_ID/"
  ]
}
```

### 5. Register Native Host for Development

**macOS:**
```bash
mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
cp native-host/manifest.json ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.chromedriver.extension.json
```

**Linux:**
```bash
mkdir -p ~/.config/google-chrome/NativeMessagingHosts/
cp native-host/manifest.json ~/.config/google-chrome/NativeMessagingHosts/com.chromedriver.extension.json
```

**Windows:**
Create registry key at `HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.chromedriver.extension`
with default value pointing to manifest.json path.

### 6. Restart Chrome

After registering the native host, restart Chrome completely.

## Testing

### Test Native Host

```bash
cd native-host
node server.js
```

You should see:
```
WebSocket server listening on port 9000
```

### Test WebSocket Connection

```bash
# Install wscat for testing
npm install -g wscat

# Connect to WebSocket server
wscat -c "ws://localhost:9000/session?timeout=300000"
```

Send commands:
```json
{"action": "listTabs", "requestId": "test-1"}
```

### Test Extension

1. Click the extension icon in Chrome toolbar
2. Side panel should open
3. Check connection status (should show "Connected")
4. Look at background service worker console:
   - Go to `chrome://extensions/`
   - Find your extension
   - Click "service worker" link
   - Check for connection messages

### Test Full Flow

Create a test client:

```javascript
// test-client.js
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:9000/session?timeout=600000');

ws.on('open', () => {
  console.log('Connected');
  
  // List tabs
  ws.send(JSON.stringify({
    action: 'listTabs',
    requestId: 'req-1'
  }));
  
  // Open new tab after 2 seconds
  setTimeout(() => {
    ws.send(JSON.stringify({
      action: 'openTab',
      params: { url: 'https://example.com', focus: true },
      requestId: 'req-2'
    }));
  }, 2000);
});

ws.on('message', (data) => {
  console.log('Response:', data.toString());
});

ws.on('error', (err) => {
  console.error('Error:', err);
});
```

Run:
```bash
node test-client.js
```

## Debugging

### Native Host Logs

Check session logs:
```bash
tail -f native-host/logs/session-*.log
```

### Extension Logs

1. **Service Worker Console:**
   - `chrome://extensions/` → Click "service worker"

2. **Side Panel Console:**
   - Open side panel
   - Right-click inside panel → "Inspect"

### Common Issues

**Native host not connecting:**
- Check manifest.json has correct extension ID
- Verify manifest is registered in Chrome directory
- Check server.js is executable
- Look at service worker console for errors

**WebSocket connection fails:**
- Ensure native host is running: `lsof -i :9000`
- Check firewall settings
- Verify no other service is using port 9000

**Commands not executing:**
- Check tab still exists (IDs can change)
- Verify extension has necessary permissions
- Look at session log files for errors

## Code Structure

### Native Host (`native-host/server.js`)

- **Session Management:** Handles session creation, timeout, resumption
- **WebSocket Server:** Accepts connections, routes messages
- **Native Messaging:** Communicates with Chrome extension via stdin/stdout
- **Logging:** Writes all events to per-session log files
- **Chunking:** Splits large messages into 1MB chunks

### Background Worker (`extension/background/service-worker.js`)

- **Native Messaging Bridge:** Connects to native host
- **Command Execution:** Executes Chrome API calls
- **Tab Tracking:** Monitors tab events and updates
- **Error Handling:** Handles disconnections and errors
- **Broadcasting:** Sends updates to side panel

### Side Panel (`extension/sidepanel/`)

- **Connection Status:** Shows native host connection state
- **Session Display:** Lists active sessions with details
- **Tab List:** Shows tabs in current window
- **Log Viewer:** Displays request/response logs with retention
- **Real-time Updates:** Receives updates from background worker

## Making Changes

### Adding New Commands

1. **Update Protocol Documentation** (`docs/PROTOCOL.md`)
   - Add command schema
   - Document parameters and response

2. **Implement in Background Worker** (`extension/background/service-worker.js`)
   - Add case in `handleCommand()`
   - Implement Chrome API calls
   - Add error handling

3. **Handle in Native Host** (`native-host/server.js`)
   - No changes needed (it forwards all commands)

4. **Update Side Panel** (if UI changes needed)
   - Modify `extension/sidepanel/panel.js`

### Modifying Session Management

Edit `Session` class in `native-host/server.js`:
- Timeout logic
- Log format
- Activity tracking
- Cleanup behavior

### Changing UI

Edit files in `extension/sidepanel/`:
- `panel.html` - Structure
- `panel.css` - Styles
- `panel.js` - Behavior

## Building for Release

### 1. Update Version

Update version in:
- `native-host/package.json`
- `extension/manifest.json`

### 2. Create Native Host Package

```bash
cd native-host
npm install --production
cd ..
tar -czf chrome-driver-native-host.tar.gz native-host/
```

For Windows:
```powershell
Compress-Archive -Path native-host -DestinationPath chrome-driver-native-host.zip
```

### 3. Package Extension

```bash
cd extension
zip -r chrome-driver-extension.zip .
```

### 4. Create GitHub Release

1. Tag version: `git tag v1.0.0`
2. Push: `git push origin v1.0.0`
3. Create release on GitHub
4. Upload `chrome-driver-native-host.tar.gz` and `chrome-driver-extension.zip`

## Best Practices

### Code Style

- Use descriptive variable names
- Add comments for complex logic
- Keep functions small and focused
- Handle all error cases

### Error Handling

- Always validate input parameters
- Check tab existence before operations
- Return meaningful error messages
- Log errors for debugging

### Performance

- Avoid blocking operations
- Use async/await for Chrome APIs
- Implement command queuing per session
- Clean up resources on disconnect

### Security

- Validate all incoming messages
- Sanitize user input
- Use localhost-only connections
- Don't expose sensitive data in logs

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Make changes and test thoroughly
4. Update documentation
5. Commit: `git commit -am 'Add feature'`
6. Push: `git push origin feature-name`
7. Create Pull Request

## License

MIT
