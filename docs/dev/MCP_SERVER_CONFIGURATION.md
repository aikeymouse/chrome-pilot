# MCP Server Configuration Examples

This document provides configuration examples for using the ChromeLink MCP server with various AI agents and MCP clients.

## Claude Desktop

### macOS Configuration

Edit the configuration file:
```bash
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

Add the ChromeLink MCP server:
```json
{
  "mcpServers": {
    "chrome-link": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/Projects/chrome-driver-extension/mcp-server/index.js"],
      "env": {}
    }
  }
}
```

**Important**: Replace `/Users/YOUR_USERNAME/Projects/chrome-driver-extension` with the actual path to your project.

### Windows Configuration

Edit the configuration file:
```cmd
notepad %APPDATA%\Claude\claude_desktop_config.json
```

Add the ChromeLink MCP server:
```json
{
  "mcpServers": {
    "chrome-link": {
      "command": "node",
      "args": ["C:\\Users\\YOUR_USERNAME\\Projects\\chrome-driver-extension\\mcp-server\\index.js"],
      "env": {}
    }
  }
}
```

### Linux Configuration

Edit the configuration file:
```bash
nano ~/.config/Claude/claude_desktop_config.json
```

Add the ChromeLink MCP server:
```json
{
  "mcpServers": {
    "chrome-link": {
      "command": "node",
      "args": ["/home/YOUR_USERNAME/Projects/chrome-driver-extension/mcp-server/index.js"],
      "env": {}
    }
  }
}
```

## After Configuration

1. **Ensure browser-link-server is running**:
   ```bash
   node native-host/browser-link-server.js
   ```

2. **Restart Claude Desktop** to load the new configuration

3. **Verify MCP server is available**:
   - Open Claude Desktop
   - Start a new conversation
   - Type: "What Chrome tools do you have available?"
   - Claude should list the available Chrome automation tools

## Example Prompts for Claude

Once configured, you can ask Claude to automate Chrome tasks:

### Basic Tab Management
```
Open a new Chrome tab and go to https://example.com
```

### Web Scraping
```
Go to https://news.ycombinator.com and get the text of the first story title
```

### Form Automation
```
1. Open https://the-internet.herokuapp.com/login
2. Type "tomsmith" in the username field
3. Type "SuperSecretPassword!" in the password field
4. Click the login button
```

### Screenshot Capture
```
Open https://github.com and take a screenshot in PNG format
```

### Multi-Tab Workflow
```
1. List all my open Chrome tabs
2. Open three new tabs with Google, GitHub, and Stack Overflow
3. Switch back to the first tab
```

### JavaScript Execution
```
Go to https://example.com and execute JavaScript to change the page title to "Hello from Claude"
```

### Content Script Injection
```
Register a content script that highlights all links in red on any Wikipedia page
```

## Using with Other MCP Clients

The ChromeLink MCP server uses the standard MCP protocol over stdio, so it works with any MCP-compatible client.

### Generic MCP Client Configuration

```json
{
  "servers": {
    "chrome-link": {
      "transport": "stdio",
      "command": "node",
      "args": ["path/to/native-host/mcp-server.js"]
    }
  }
}
```

### Manual Testing with MCP Inspector

For development and debugging, use the MCP Inspector tool:

```bash
# Install MCP Inspector (if not already installed)
npm install -g @modelcontextprotocol/inspector

# Run MCP server with inspector
npx @modelcontextprotocol/inspector node mcp-server/index.js
```

This will open a web interface where you can:
- View available tools
- Test tool invocations
- See request/response logs
- Debug MCP protocol communication

## Environment Variables (Optional)

You can configure the WebSocket URL via environment variables:

```json
{
  "mcpServers": {
    "chrome-link": {
      "command": "node",
      "args": ["/path/to/mcp-server/index.js"],
      "env": {
        "CHROME_LINK_WS_URL": "ws://localhost:9000"
      }
    }
  }
}
```

**Note**: The current implementation uses hardcoded `ws://localhost:9000`. To support custom URLs, modify `mcp-server.js` to read from `process.env.CHROME_LINK_WS_URL`.

## Troubleshooting

### MCP Server Not Appearing in Claude

1. **Check configuration file syntax**:
   ```bash
   # Validate JSON
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | python3 -m json.tool
   ```

2. **Verify file path is absolute**:
   ```bash
   # Test the command manually
   node /Users/YOUR_USERNAME/Projects/chrome-driver-extension/mcp-server/index.js
   ```

3. **Check Claude Desktop logs**:
   - macOS: `~/Library/Logs/Claude/`
   - Windows: `%APPDATA%\Claude\logs\`
   - Linux: `~/.config/Claude/logs/`

### Connection Errors

1. **Ensure browser-link-server is running**:
   ```bash
   # Check server status
   curl http://localhost:9000/session
   # Expected: {"status":"ready","message":"Upgrade to WebSocket"}
   ```

2. **Test WebSocket connection**:
   ```bash
   # Using wscat (install: npm install -g wscat)
   wscat -c ws://localhost:9000
   ```

3. **Check Chrome extension is installed**:
   - Open `chrome://extensions/`
   - Verify "ChromeLink" is enabled

### Tool Execution Errors

1. **Check MCP server logs** (stderr output in Claude Desktop logs)

2. **Test tool manually** using MCP Inspector

3. **Verify tab IDs are valid**:
   - Use `chrome_list_tabs` first
   - Use the returned `tabId` in subsequent calls

## Multiple MCP Servers

You can run multiple MCP servers for different use cases:

```json
{
  "mcpServers": {
    "chrome-link": {
      "command": "node",
      "args": ["/path/to/native-host/mcp-server.js"]
    },
    "chrome-link-dev": {
      "command": "node",
      "args": ["/path/to/chrome-driver-extension-dev/native-host/mcp-server.js"],
      "env": {
        "CHROME_LINK_WS_URL": "ws://localhost:9001"
      }
    }
  }
}
```

This allows you to:
- Run production and development instances
- Connect to different browser profiles
- Isolate testing from production automation

## Security Notes

- MCP server has **full browser control** - only use with trusted AI agents
- Consider running in a separate browser profile for sensitive automation
- Monitor AI agent actions via logs
- Use content scripts carefully (they run on every matching page)
- Disable MCP server when not needed

## Additional Resources

- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Claude Desktop MCP Documentation](https://docs.anthropic.com/claude/docs/model-context-protocol)
- [ChromeLink Protocol Documentation](../PROTOCOL.md)
- [ChromeLink MCP Server Architecture](./MCP_SERVER_ARCHITECTURE.md)
