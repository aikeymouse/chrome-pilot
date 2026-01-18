# ChromeLink MCP Server

Model Context Protocol (MCP) server that exposes Chrome browser automation capabilities to AI agents like Claude, GPT, and other MCP-compatible tools.

## Installation

### Option 1: NPM (Recommended)

```bash
npm install -g @chromelink/mcp-server
```

Then configure in your MCP client:

```json
{
  "mcpServers": {
    "chrome-link": {
      "command": "chromelink-mcp"
    }
  }
}
```

### Option 2: From Source

Clone the repository and use the server directly:

```bash
git clone https://github.com/aikeymouse/chrome-link.git
cd chrome-link/mcp-server
npm install
```

Configure with absolute path:

```json
{
  "mcpServers": {
    "chrome-link": {
      "command": "node",
      "args": ["/absolute/path/to/chrome-link/mcp-server/index.js"]
    }
  }
}
```

## Prerequisites

1. **Install ChromeLink extension** in Chrome
2. **Start browser-link-server** (automatically started by extension on first connection)
3. **Install Node.js** dependencies:
   ```bash
   cd clients/node
   npm install
   ```

### Running the MCP Server

```bash
node mcp-server/index.js
```

The MCP server will:
- Connect to `ws://localhost:9000` (browser-link-server)
- Expose 18 Chrome automation tools via MCP protocol
- Communicate with AI agents via stdio

## Available Tools

### Tab Management
- `chrome_list_tabs` - List all open tabs
- `chrome_open_tab` - Open new tab with URL
- `chrome_navigate_tab` - Navigate tab to URL
- `chrome_switch_tab` - Switch to specific tab
- `chrome_close_tab` - Close a tab
- `chrome_get_active_tab` - Get active tab info

### Navigation History
- `chrome_go_back` - Navigate back in history
- `chrome_go_forward` - Navigate forward in history

### DOM Interaction
- `chrome_wait_for_element` - Wait for element to appear
- `chrome_get_text` - Get element text content
- `chrome_click` - Click an element
- `chrome_type` - Type text into element

### JavaScript Execution
- `chrome_execute_js` - Execute arbitrary JavaScript
- `chrome_call_helper` - Call predefined helper functions:
  - **Element Interaction**: clickElement, typeText, appendChar, clearContentEditable
  - **Element Query**: getText, getHTML, getLastHTML, elementExists, isVisible, waitForElement
  - **Element Highlighting**: highlightElement, removeHighlights
  - **Element Positioning**: getElementBounds, scrollElementIntoView
  - **Element Inspection**: inspectElement, getContainerElements

### Screenshots
- `chrome_capture_screenshot` - Capture tab screenshot (PNG/JPEG)

### Script Injection
- `chrome_register_injection` - Register content script
- `chrome_unregister_injection` - Unregister content script

## Configuration for AI Agents

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "chrome-link": {
      "command": "node",
      "args": ["/absolute/path/to/chrome-driver-extension/mcp-server/index.js"]
    }
  }
}
```

**Important**: Use absolute path to `index.js`

After configuration:
1. Restart Claude Desktop
2. Start a conversation
3. Ask Claude: "What Chrome tools do you have?"

### Example Prompts

```
Open https://github.com in a new Chrome tab

List all my open Chrome tabs

Go to https://example.com and get the text of the h1 element

Take a screenshot of the current tab in PNG format

Fill out the login form:
1. Open https://the-internet.herokuapp.com/login
2. Type "tomsmith" in #username
3. Type "SuperSecretPassword!" in #password
4. Click the login button
```

## Architecture

```
AI Agent (Claude/GPT)
    ↓ stdio (MCP protocol)
MCP Server (this file)
    ↓ WebSocket (ws://localhost:9000)
browser-link-server
    ↓ native messaging (stdin/stdout)
Chrome Extension
```

**Key Design Points:**
- MCP server runs as **separate process** (avoids stdio conflict)
- Uses existing WebSocket client (thin wrapper, no code duplication)
- Zero changes needed to browser-link-server or extension
- Multiple MCP servers can connect simultaneously

## Testing

### Manual Test

```bash
# Start browser-link-server (if not auto-started)
node native-host/browser-link-server.js

# In another terminal, test MCP server
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node mcp-server/index.js
```

Expected output:
```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"chrome-link","version":"1.0.0"}}}
```

### Test Tool Invocation

```bash
# Create test file
cat > /tmp/test-mcp.json << 'EOF'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"chrome_list_tabs","arguments":{}}}
EOF

# Run test
cat /tmp/test-mcp.json | node native-host/mcp-server.js 2>/dev/null
```

### Using MCP Inspector

```bash
npm install -g @modelcontextprotocol/inspector
npx @modelcontextprotocol/inspector node mcp-server/index.js
```

Opens web UI for testing tools interactively.

## Troubleshooting

### MCP Server Won't Connect

**Error**: `Failed to connect to browser-link-server`

**Solution**:
1. Check Chrome extension is installed: `chrome://extensions/`
2. Check browser-link-server is running: `curl http://localhost:9000/session` (expect `{"status":"ready","message":"Upgrade to WebSocket"}`)
3. Test WebSocket manually: `wscat -c ws://localhost:9000`

### Tools Not Showing in Claude

**Error**: Claude doesn't list Chrome tools

**Solution**:
1. Verify config file path is absolute (not relative)
2. Check JSON syntax: `python3 -m json.tool < ~/Library/Application\ Support/Claude/claude_desktop_config.json`
3. Restart Claude Desktop
4. Check Claude logs: `~/Library/Logs/Claude/`

### Tool Execution Fails

**Error**: `TypeError: tabId is not a number`

**Solution**:
1. Use `chrome_list_tabs` first to get valid tab IDs
2. Ensure tab still exists (not closed)
3. Check MCP server logs (stderr output)

## Logging

MCP server logs to **stderr** (stdout is reserved for MCP protocol):
- Connection status
- Tool invocations
- Errors and warnings

To see logs:
```bash
node native-host/mcp-server.js 2>&1 | grep "\[MCP Server\]"
```

## Security

⚠️ **MCP server has full browser control** - use with trusted AI agents only

Recommendations:
- Run in separate browser profile for automation
- Monitor AI agent actions via logs
- Disable MCP server when not needed
- Consider adding authentication for production use

## Documentation

- [MCP Server Architecture](../docs/dev/MCP_SERVER_ARCHITECTURE.md) - Detailed design docs
- [MCP Server Configuration](../docs/dev/MCP_SERVER_CONFIGURATION.md) - Setup guide for various clients
- [ChromeLink Protocol](../docs/PROTOCOL.md) - WebSocket protocol specification
- [Node.js Client](../clients/node/README.md) - Client library used by MCP server

## License

MIT - See LICENSE file in repository root
