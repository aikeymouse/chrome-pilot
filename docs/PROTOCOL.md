# WebSocket API Protocol Documentation

## Overview

This document defines the JSON protocol for communication between WebSocket clients and ChromePilot via the Native Messaging Host.

## Connection Establishment

### REST API - Create/Resume Session

**Endpoint:** `POST /session`

**Query Parameters:**
- `timeout` (number, optional): Session timeout in milliseconds. Default: 300000 (5 minutes)
- `sessionId` (string, optional): Existing session ID to resume. If not provided or expired, creates new session

**Example:**
```bash
curl -X POST "http://localhost:9000/session?timeout=600000&sessionId=abc-123" \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Version: 13"
```

**Response:**
- HTTP 101 Switching Protocols → WebSocket connection established
- HTTP 400 Bad Request → Invalid parameters
- HTTP 404 Not Found → Session ID not found or expired

**Session Created Event:**
```json
{
  "type": "sessionCreated",
  "sessionId": "abc-123-def-456",
  "timeout": 600000,
  "expiresAt": 1704988800000
}
```

## Message Format

All messages are JSON objects sent over the WebSocket connection.

### Request Format

```json
{
  "action": "commandName",
  "params": { ... },
  "requestId": "unique-request-id"
}
```

**Fields:**
- `action` (string, required): Command to execute
- `params` (object, optional): Command-specific parameters
- `requestId` (string, required): Unique identifier for tracking response

### Response Format

**Success Response:**
```json
{
  "requestId": "unique-request-id",
  "result": { ... },
  "error": null
}
```

**Error Response:**
```json
{
  "requestId": "unique-request-id",
  "result": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

### Chunked Response Format

For large results exceeding 1MB, responses are automatically chunked:

```json
{
  "requestId": "unique-request-id",
  "chunk": "base64-encoded-data-chunk",
  "chunkIndex": 0,
  "totalChunks": 5
}
```

**Fields:**
- `requestId` (string): Original request ID
- `chunk` (string): Base64-encoded data chunk
- `chunkIndex` (number): Zero-based index of this chunk
- `totalChunks` (number): Total number of chunks for this response

**Client Handling:**
- Collect all chunks with same `requestId`
- Decode each base64 chunk
- Concatenate in order by `chunkIndex`
- Parse final result when `chunkIndex + 1 === totalChunks`

## Commands

### 1. List Tabs

Get all tabs in the current active Chrome window.

**Request:**
```json
{
  "action": "listTabs",
  "requestId": "req-001"
}
```

**Response:**
```json
{
  "requestId": "req-001",
  "result": {
    "tabs": [
      {
        "id": 123,
        "url": "https://example.com",
        "title": "Example Domain",
        "active": true,
        "index": 0
      },
      {
        "id": 124,
        "url": "https://google.com",
        "title": "Google",
        "active": false,
        "index": 1
      }
    ],
    "windowId": 1
  },
  "error": null
}
```

### 2. Open Tab

Create a new tab in the current active window.

**Request:**
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

**Parameters:**
- `url` (string, required): URL to open
- `focus` (boolean, optional): Focus Chrome window before opening. Default: false

**Response:**
```json
{
  "requestId": "req-002",
  "result": {
    "tab": {
      "id": 125,
      "url": "https://example.com",
      "title": "",
      "active": true,
      "index": 2
    }
  },
  "error": null
}
```

### 3. Navigate Tab

Navigate an existing tab to a new URL.

**Request:**
```json
{
  "action": "navigateTab",
  "params": {
    "tabId": 123,
    "url": "https://github.com",
    "focus": false
  },
  "requestId": "req-003"
}
```

**Parameters:**
- `tabId` (number, required): Chrome tab ID
- `url` (string, required): URL to navigate to
- `focus` (boolean, optional): Focus Chrome window before navigating. Default: false

**Response:**
```json
{
  "requestId": "req-003",
  "result": {
    "success": true,
    "tabId": 123
  },
  "error": null
}
```

**Error Cases:**
```json
{
  "requestId": "req-003",
  "result": null,
  "error": {
    "code": "TAB_NOT_FOUND",
    "message": "Tab with ID 123 not found or was closed"
  }
}
```

### 4. Switch Tab

Activate (focus) a specific tab.

**Request:**
```json
{
  "action": "switchTab",
  "params": {
    "tabId": 124
  },
  "requestId": "req-004"
}
```

**Parameters:**
- `tabId` (number, required): Chrome tab ID to activate

**Response:**
```json
{
  "requestId": "req-004",
  "result": {
    "success": true,
    "tabId": 124
  },
  "error": null
}
```

### 5. Close Tab

Close (remove) a specific tab.

**Request:**
```json
{
  "action": "closeTab",
  "params": {
    "tabId": 124
  },
  "requestId": "req-005"
}
```

**Parameters:**
- `tabId` (number, required): Chrome tab ID to close

**Response:**
```json
{
  "requestId": "req-005",
  "result": {
    "success": true,
    "tabId": 124
  },
  "error": null
}
```

**Error Cases:**
```json
{
  "requestId": "req-005",
  "result": null,
  "error": {
    "code": "TAB_NOT_FOUND",
    "message": "Tab with ID 124 not found or was closed"
  }
}
```

### 6. Execute JavaScript

Execute JavaScript code in a tab and return the result.

**Request:**
```json
{
  "action": "executeJS",
  "params": {
    "tabId": 123,
    "code": "document.querySelector('h1').textContent",
    "timeout": 30000,
    "focus": false
  },
  "requestId": "req-005"
}
```

**Parameters:**
- `tabId` (number, optional): Tab ID to execute in. If omitted, uses active tab
- `code` (string, required): JavaScript code to execute
- `timeout` (number, optional): Execution timeout in milliseconds. Default: 30000
- `focus` (boolean, optional): Focus Chrome window before execution. Default: false

**Response:**
```json
{
  "requestId": "req-005",
  "result": {
    "value": "Example Heading",
    "type": "string"
  },
  "error": null
}
```

**Return Types:**
The `type` field indicates the JavaScript type:
- `"string"`, `"number"`, `"boolean"`, `"null"`, `"undefined"`
- `"object"`, `"array"` (serialized to JSON)
- `"error"` (execution error)

**Error Cases:**

Tab not found:
```json
{
  "requestId": "req-005",
  "result": null,
  "error": {
    "code": "TAB_NOT_FOUND",
    "message": "Tab with ID 123 not found or was closed"
  }
}
```

Execution timeout:
```json
{
  "requestId": "req-005",
  "result": null,
  "error": {
    "code": "EXECUTION_TIMEOUT",
    "message": "Script execution exceeded timeout of 30000ms"
  }
}
```

JavaScript error:
```json
{
  "requestId": "req-005",
  "result": null,
  "error": {
    "code": "SCRIPT_ERROR",
    "message": "Cannot read property 'textContent' of null"
  }
}
```

**Large Results:**

If the result exceeds 1MB, it will be chunked:
```json
// Chunk 1
{
  "requestId": "req-005",
  "chunk": "eyJ2YWx1ZSI6IlZlcnkgbG9uZyByZXN1bHQuLi4i...",
  "chunkIndex": 0,
  "totalChunks": 3
}

// Chunk 2
{
  "requestId": "req-005",
  "chunk": "Li4uY29udGludWVkIGRhdGEuLi4=",
  "chunkIndex": 1,
  "totalChunks": 3
}

// Chunk 3
{
  "requestId": "req-005",
  "chunk": "Li4uZmluYWwgY2h1bmsgZGF0YX0=",
  "chunkIndex": 2,
  "totalChunks": 3
}
```

### 7. Call DOM Helper Function

Call a predefined DOM helper function for CSP-restricted pages. This command is designed for pages with strict Content Security Policies that block dynamic JavaScript evaluation.

**Request:**
```json
{
  "action": "callHelper",
  "params": {
    "tabId": 123,
    "functionName": "clickElement",
    "args": ["button.send-button"],
    "timeout": 30000,
    "focus": false
  },
  "requestId": "req-006"
}
```

**Parameters:**
- `tabId` (number, optional): Tab ID to execute in. If omitted, uses active tab
- `functionName` (string, required): Name of the helper function to call
- `args` (array, optional): Arguments to pass to the function. Default: []
- `timeout` (number, optional): Execution timeout in milliseconds. Default: 30000
- `focus` (boolean, optional): Focus Chrome window before execution. Default: false

**Available Helper Functions:**

1. **clickElement(selector)** - Click and focus an element
2. **typeText(selector, text, clearFirst)** - Type text into input/textarea/contenteditable
3. **appendChar(selector, char)** - Append single character to contenteditable element
4. **clearContentEditable(selector)** - Clear contenteditable element
5. **getText(selector)** - Get text content of element
6. **getHTML(selector)** - Get innerHTML of element
7. **getLastHTML(selector)** - Get innerHTML of last element matching selector
8. **elementExists(selector)** - Check if element exists
9. **isVisible(selector)** - Check if element is visible
10. **waitForElement(selector, timeoutMs)** - Wait for element to appear

**Response:**
```json
{
  "requestId": "req-006",
  "result": {
    "value": true,
    "type": "boolean"
  },
  "error": null
}
```

**Error Cases:**

Helper not loaded:
```json
{
  "requestId": "req-006",
  "result": null,
  "error": {
    "code": "EXECUTION_ERROR",
    "message": "ChromePilot helper not loaded"
  }
}
```

Function not found:
```json
{
  "requestId": "req-006",
  "result": null,
  "error": {
    "code": "EXECUTION_ERROR",
    "message": "Helper function not found: invalidFunction"
  }
}
```

Element not found:
```json
{
  "requestId": "req-006",
  "result": null,
  "error": {
    "code": "EXECUTION_ERROR",
    "message": "Element not found: button.send-button"
  }
}
```

## Event Messages

Events are sent from the server to the client without a corresponding request.

### Session Timeout Warning

Sent 60 seconds before session expires:

```json
{
  "type": "sessionTimeout",
  "sessionId": "abc-123",
  "remainingTime": 60000,
  "message": "Session will expire in 60 seconds"
}
```

### Session Expired

Sent when session times out:

```json
{
  "type": "sessionExpired",
  "sessionId": "abc-123",
  "message": "Session has expired due to inactivity"
}
```

After this event, the WebSocket connection will be closed.

### Tab Update Event

Sent when tabs change in the active window:

```json
{
  "type": "tabUpdate",
  "event": "created" | "updated" | "removed" | "activated",
  "tab": {
    "id": 123,
    "url": "https://example.com",
    "title": "Example",
    "active": true
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_ACTION` | Unknown or invalid action specified |
| `MISSING_PARAMS` | Required parameters missing |
| `TAB_NOT_FOUND` | Tab ID does not exist or was closed |
| `EXECUTION_TIMEOUT` | Script execution exceeded timeout |
| `SCRIPT_ERROR` | JavaScript execution error |
| `PERMISSION_DENIED` | Extension lacks permission for operation |
| `NATIVE_HOST_ERROR` | Error communicating with native host |
| `SESSION_EXPIRED` | Session has expired |
| `INVALID_SESSION` | Session ID invalid or not found |

## Session Lifecycle

1. **Create Session**: Client sends POST request to `/session`
2. **Active Session**: WebSocket connection established, commands can be sent
3. **Activity**: Each command resets the session timeout
4. **Warning**: 60 seconds before timeout, `sessionTimeout` event sent
5. **Expiration**: Session expires, `sessionExpired` event sent, connection closed
6. **Resumption**: Client can resume by reconnecting with same `sessionId` if not expired

## Best Practices

### Request IDs

Use unique, sequential request IDs for easier debugging:
```javascript
let requestCounter = 0;
const requestId = `req-${Date.now()}-${++requestCounter}`;
```

### Error Handling

Always check the `error` field in responses:
```javascript
const response = JSON.parse(message);
if (response.error) {
  console.error(`Error: ${response.error.message}`);
  return;
}
// Process response.result
```

### Chunked Responses

Implement chunk assembly:
```javascript
const chunks = new Map();

function handleMessage(message) {
  const data = JSON.parse(message);
  
  if (data.chunk !== undefined) {
    // Chunked response
    if (!chunks.has(data.requestId)) {
      chunks.set(data.requestId, new Array(data.totalChunks));
    }
    chunks.get(data.requestId)[data.chunkIndex] = data.chunk;
    
    if (chunks.get(data.requestId).every(c => c !== undefined)) {
      // All chunks received
      const combined = chunks.get(data.requestId).join('');
      const decoded = atob(combined);
      const result = JSON.parse(decoded);
      chunks.delete(data.requestId);
      return result;
    }
    return null; // Wait for more chunks
  }
  
  // Regular response
  return data;
}
```

### Session Keep-Alive

Send periodic ping commands to prevent session timeout:
```javascript
setInterval(() => {
  send({
    action: "listTabs",
    requestId: `ping-${Date.now()}`
  });
}, 240000); // Every 4 minutes (if timeout is 5 minutes)
```

### Tab ID Management

Cache tab IDs but validate before use:
```javascript
// Always check for TAB_NOT_FOUND errors
// Refresh tab list periodically
```

## Examples

### Complete Client Example (Node.js)

```javascript
const WebSocket = require('ws');

class ChromeDriverClient {
  constructor(url = 'ws://localhost:9000/session?timeout=600000') {
    this.ws = new WebSocket(url);
    this.requestCounter = 0;
    this.pending = new Map();
    this.chunks = new Map();
    
    this.ws.on('open', () => console.log('Connected'));
    this.ws.on('message', (data) => this.handleMessage(data));
    this.ws.on('close', () => console.log('Disconnected'));
    this.ws.on('error', (err) => console.error('Error:', err));
  }
  
  handleMessage(data) {
    const msg = JSON.parse(data.toString());
    
    // Handle events
    if (msg.type) {
      console.log('Event:', msg);
      return;
    }
    
    // Handle chunks
    if (msg.chunk !== undefined) {
      if (!this.chunks.has(msg.requestId)) {
        this.chunks.set(msg.requestId, new Array(msg.totalChunks));
      }
      this.chunks.get(msg.requestId)[msg.chunkIndex] = msg.chunk;
      
      if (this.chunks.get(msg.requestId).every(c => c !== undefined)) {
        const combined = this.chunks.get(msg.requestId).join('');
        const decoded = Buffer.from(combined, 'base64').toString();
        const result = JSON.parse(decoded);
        this.chunks.delete(msg.requestId);
        
        const resolver = this.pending.get(msg.requestId);
        if (resolver) {
          resolver.resolve(result);
          this.pending.delete(msg.requestId);
        }
      }
      return;
    }
    
    // Handle regular response
    const resolver = this.pending.get(msg.requestId);
    if (resolver) {
      if (msg.error) {
        resolver.reject(new Error(msg.error.message));
      } else {
        resolver.resolve(msg.result);
      }
      this.pending.delete(msg.requestId);
    }
  }
  
  send(action, params = {}) {
    const requestId = `req-${Date.now()}-${++this.requestCounter}`;
    
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      
      this.ws.send(JSON.stringify({
        action,
        params,
        requestId
      }));
      
      // Timeout
      setTimeout(() => {
        if (this.pending.has(requestId)) {
          this.pending.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 60000);
    });
  }
  
  async listTabs() {
    return this.send('listTabs');
  }
  
  async openTab(url, focus = false) {
    return this.send('openTab', { url, focus });
  }
  
  async navigateTab(tabId, url, focus = false) {
    return this.send('navigateTab', { tabId, url, focus });
  }
  
  async switchTab(tabId) {
    return this.send('switchTab', { tabId });
  }
  
  async executeJS(code, tabId = null, timeout = 30000, focus = false) {
    return this.send('executeJS', { 
      ...(tabId && { tabId }),
      code,
      timeout,
      focus
    });
  }
}

// Usage
(async () => {
  const client = new ChromeDriverClient();
  
  // Wait for connection
  await new Promise(resolve => client.ws.once('open', resolve));
  
  // List tabs
  const tabs = await client.listTabs();
  console.log('Tabs:', tabs);
  
  // Open new tab
  const newTab = await client.openTab('https://example.com', true);
  console.log('Opened tab:', newTab);
  
  // Execute JS
  const title = await client.executeJS('document.title', newTab.tab.id);
  console.log('Page title:', title);
})();
```

## Versioning

Current Protocol Version: **1.0.0**

Future versions will maintain backward compatibility or increment major version.
