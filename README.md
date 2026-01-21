# ChromeLink

Remote Chrome tab control via WebSocket API with session management and side panel UI.

[![Patreon](https://img.shields.io/badge/Support-Patreon-orange?logo=patreon)](https://www.patreon.com/aikeymouse)
[![npm](https://img.shields.io/npm/v/@aikeymouse/chromelink-client)](https://www.npmjs.com/package/@aikeymouse/chromelink-client)
[![npm](https://img.shields.io/npm/v/@aikeymouse/chromelink-mcp)](https://www.npmjs.com/package/@aikeymouse/chromelink-mcp)

## Quick Start

**Install NPM Client:**
```bash
npm install @aikeymouse/chromelink-client
```

**Or use with AI Agents (MCP):**
```bash
npm install -g @aikeymouse/chromelink-mcp
```

See [Installation](#installation) for complete setup.

## Features

- **WebSocket API**: Control Chrome tabs remotely via WebSocket connection
- **Session Management**: Create sessions with configurable timeouts, resume existing sessions
- **Tab Operations**: List, open, navigate, switch, close tabs in current active window
- **JavaScript Execution**: Execute JavaScript in tabs with configurable timeout and result return
- **Script Injection**: Register early script injections for WebView2 mocking, test configuration, and API interception without debugger warnings
- **Inspector Mode**: Interactive element inspection with detailed DOM tree analysis and CSS selectors
- **Helper Functions**: Comprehensive DOM operations for CSP-restricted pages including click, type, highlight, element bounds, viewport scrolling, and container analysis
- **Screenshot Capture**: Full page or element-cropped screenshots with base64 PNG output
- **Side Panel UI**: Monitor connected clients, view session details, manage script injections, track logs in real-time
- **Per-Session Logging**: All requests/responses logged to dedicated session files with configurable retention
- **Chunked Messages**: Handle large results with automatic 1MB chunking
- **Auto-Restart**: Native host automatically restarts on extension updates

## Screenshots

| Session Logs | Inspector Mode |
|:------------:|:--------------:|
| ![Session Logs](docs/chromelink_session_logs.png) | ![Inspector Mode](docs/chromelink_inspector_mode.png) |

## Architecture

```
Client App (WebSocket) ←→ Node.js Native Host ←→ Chrome Extension (Service Worker)
                                   ↓                           ↓
                          Session Log Files              Side Panel UI
```

## Installation

See [install-scripts/INSTALL.md](install-scripts/INSTALL.md) for complete installation instructions.

## Usage

### Quick Start with Node.js Client

```javascript
const ChromeLinkClient = require('@aikeymouse/chromelink-client');

async function example() {
  // Create client
  const client = new ChromeLinkClient();
  
  // Connect to ChromeLink server
  await client.connect('ws://localhost:9000');
  
  // List all tabs
  const { tabs } = await client.listTabs();
  console.log(`Found ${tabs.length} tabs`);
  
  // Open a new tab
  const { tab } = await client.openTab('https://example.com');
  const tabId = tab.id;
  
  // Wait for page to load and get heading
  await client.waitForElement('h1', 10000, tabId);
  const heading = await client.getText('h1', tabId);
  console.log('Page heading:', heading.value);
  
  // Execute JavaScript
  const result = await client.executeJS('document.title', tabId);
  console.log('Page title:', result.value);
  
  // Clean up
  await client.closeTab(tabId);
  client.close();
}

example().catch(console.error);
```

### Common Operations

**Open tab and interact with form:**
```javascript
const { tab } = await client.openTab('https://example.com/login');
await client.waitForElement('input[name="email"]', 5000, tab.id);
await client.type('input[name="email"]', 'user@example.com', tab.id);
await client.type('input[name="password"]', 'secret123', tab.id);
await client.click('button[type="submit"]', tab.id);
```

**Capture screenshot:**
```javascript
const { screenshot } = await client.captureScreenshot({ 
  format: 'png',
  fullPage: true 
});
// screenshot is a base64 data URL
```

**Use helper functions (works on CSP-restricted pages):**
```javascript
// Extract page elements with CSS and XPath selectors
const elements = await client.callHelper(
  'extractPageElements', 
  ['form', false], // containerSelector, includeHidden
  tabId
);

// Highlight an element
await client.callHelper('highlightElement', ['button.submit'], tabId);
```

See [Node.js Client Documentation](clients/node/README.md) for complete API reference.

### Advanced: Direct WebSocket API

For direct WebSocket control (without the Node.js client), see [PROTOCOL.md](docs/PROTOCOL.md) for the complete WebSocket message format.

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

See [docs/dev/DEVELOPMENT.md](docs/dev/DEVELOPMENT.md) for development setup and guidelines.

## Protocol Documentation

See [docs/PROTOCOL.md](docs/PROTOCOL.md) for complete API documentation.

## License

ChromeLink uses **dual licensing** to support both non-commercial and commercial use cases:

### Non-Commercial Use (Free)

**License:** Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0)

**Permitted for:**
- Personal projects and learning
- Educational institutions and students
- Research and academic work
- Open source projects (non-commercial)

**You can:**
- ✅ Use ChromeLink for free
- ✅ Share and redistribute (with attribution)

**Restrictions:**
- ❌ No commercial use
- ❌ No derivative works
- ✅ Attribution required

### Commercial Use (Paid License Required)

**License:** Commercial License

**Required for:**
- Commercial products or services
- Revenue-generating applications
- Internal business automation
- SaaS applications
- Consulting or client work

**Benefits:**
- ✅ Full commercial usage rights
- ✅ Modification and integration rights
- ✅ Priority support
- ✅ Updates and maintenance

**Contact:** https://github.com/aikeymouse/chrome-link/issues

### Published NPM Packages (MIT License)

The following NPM packages are MIT licensed and can be freely used:

- **[@aikeymouse/chromelink-client](https://www.npmjs.com/package/@aikeymouse/chromelink-client)** - Node.js WebSocket client
- **[@aikeymouse/chromelink-mcp](https://www.npmjs.com/package/@aikeymouse/chromelink-mcp)** - Model Context Protocol server for AI agents

**Important:** While these NPM packages are MIT licensed, they require the ChromeLink browser extension to function. The extension uses dual licensing (CC BY-NC-ND 4.0 or Commercial), so commercial applications need a commercial license.

### Complete Licensing Details

See [LICENSE](LICENSE) file for complete dual-licensing terms and conditions.

**Questions?** Open an issue: https://github.com/aikeymouse/chrome-link/issues
