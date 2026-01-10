# ChromePilot

Remote Chrome tab control via WebSocket API with session management and side panel UI.

## Features

- **WebSocket API**: Control Chrome tabs remotely via WebSocket connection
- **Session Management**: Create sessions with configurable timeouts, resume existing sessions
- **Tab Operations**: List, open, navigate, switch tabs in current active window
- **JavaScript Execution**: Execute JavaScript in tabs with configurable timeout and result return
- **Side Panel UI**: Monitor connected clients, view session details, track logs in real-time
- **Per-Session Logging**: All requests/responses logged to dedicated session files
- **Chunked Messages**: Handle large results with automatic 1MB chunking
- **Auto-Restart**: Native host automatically restarts on extension updates

## Architecture

```
Client App (WebSocket) ←→ Node.js Native Host ←→ Chrome Extension (Service Worker)
                                   ↓                           ↓
                          Session Log Files              Side Panel UI
```

## Installation

### Prerequisites

- Node.js 18+ installed
- Google Chrome browser
- macOS, Linux, or Windows

### Install Steps

1. **Clone the repository**
   ```bash
   cd chrome-driver-extension
   ```

2. **Run installation script**
   
   **macOS/Linux:**
   ```bash
   chmod +x install-scripts/install.sh
   ./install-scripts/install.sh
   ```
   
   **Windows:**
   ```powershell
   .\install-scripts\install.ps1
   ```

3. **Load extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/` folder
   - Note the extension ID and update it in native host manifest if needed

4. **Open Side Panel**
   - Click the extension icon in Chrome toolbar
   - Side panel will open showing connection status

## Usage

### Create a Session

Send a POST request to create a new session:

```bash
curl -X POST "http://localhost:9000/session?timeout=300000" \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket"
```

Parameters:
- `timeout`: Session timeout in milliseconds (default: 300000 = 5 minutes)
- `sessionId`: (Optional) Resume existing session if not expired

### WebSocket Commands

Once connected via WebSocket, send JSON commands:

#### List Tabs
```json
{
  "action": "listTabs",
  "requestId": "req-001"
}
```

#### Open Tab
```json
{
  "action": "openTab",
  "params": {
    "url": "https://example.com",
    "focus": true
  },
  "requestId": "req-002"
}
```

#### Navigate Tab
```json
{
  "action": "navigateTab",
  "params": {
    "tabId": 123,
    "url": "https://google.com",
    "focus": false
  },
  "requestId": "req-003"
}
```

#### Switch Tab
```json
{
  "action": "switchTab",
  "params": {
    "tabId": 123
  },
  "requestId": "req-004"
}
```

#### Execute JavaScript
```json
{
  "action": "executeJS",
  "params": {
    "tabId": 123,
    "code": "document.title",
    "timeout": 30000,
    "focus": false
  },
  "requestId": "req-005"
}
```

Parameters:
- `tabId`: (Optional) Tab ID, defaults to active tab
- `code`: JavaScript code to execute
- `timeout`: (Optional) Execution timeout in ms (default: 30000)
- `focus`: (Optional) Focus Chrome window before execution

### Response Format

```json
{
  "requestId": "req-001",
  "result": { ... },
  "error": null
}
```

For large results (>1MB), responses are chunked:
```json
{
  "requestId": "req-001",
  "chunk": "...",
  "chunkIndex": 0,
  "totalChunks": 3
}
```

## Updating

To update to the latest version:

```bash
./install-scripts/install.sh --upgrade
```

This will:
- Download the latest version
- Preserve existing session logs
- Update the native host
- Automatically restart the service

## Configuration

### Log Retention

Configure log retention in the Side Panel UI:
- Default: 100 entries
- Adjustable via UI slider
- Older entries auto-deleted when limit exceeded

### Session Timeout

Set per-session when creating connection:
- Default: 5 minutes (300000 ms)
- Configurable via `timeout` parameter
- Session extends on activity

## Development

### Run Native Host Locally

```bash
cd native-host
npm install
npm start
```

### Debug

View native host logs:
```bash
tail -f native-host/logs/session-*.log
```

Chrome extension console:
- Right-click extension icon → "Inspect popup"
- Or view service worker in `chrome://extensions/`

## Protocol Documentation

See [docs/PROTOCOL.md](docs/PROTOCOL.md) for complete API documentation.

## Troubleshooting

### Extension can't connect to native host

1. Check native host is installed:
   ```bash
   ls -la ~/.chrome-driver-extension/
   ```

2. Verify native messaging manifest:
   - macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.chromedriver.extension.json`
   - Linux: `~/.config/google-chrome/NativeMessagingHosts/`
   - Windows: Check registry key

3. Check extension ID matches in native host manifest

### WebSocket connection fails

1. Verify native host is running:
   ```bash
   lsof -i :9000
   ```

2. Check firewall settings allow localhost:9000

### Commands not executing

1. Check Side Panel for error messages
2. Verify tab still exists (returns error if closed)
3. Check session hasn't expired

## License

MIT
