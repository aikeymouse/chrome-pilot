# WebSocket API Protocol Documentation

## Table of Contents

- [Overview](#overview)
- [Connection Establishment](#connection-establishment)
  - [WebSocket Connection](#websocket-connection---createresume-session)
  - [HTTP Endpoint](#http-endpoint---check-serversession-status)
- [Message Format](#message-format)
  - [Request Format](#request-format)
  - [Response Format](#response-format)
  - [Chunked Response Format](#chunked-response-format)
- [Commands](#commands)
  - [1. List Tabs](#1-list-tabs)
  - [2. Open Tab](#2-open-tab)
  - [3. Navigate Tab](#3-navigate-tab)
  - [4. Switch Tab](#4-switch-tab)
  - [5. Close Tab](#5-close-tab)
  - [6. Execute JavaScript](#6-execute-javascript)
  - [7. Call DOM Helper Function](#7-call-dom-helper-function)
  - [8. Capture Screenshot](#8-capture-screenshot)
  - [9. Register Script Injection](#9-register-script-injection)
  - [10. Unregister Script Injection](#10-unregister-script-injection)
- [Event Messages](#event-messages)
- [Error Codes](#error-codes)
- [Session Lifecycle](#session-lifecycle)
- [Best Practices](#best-practices)
- [Examples](#examples)
- [Versioning](#versioning)

## Overview

This document defines the JSON protocol for communication between WebSocket clients and ChromeLink via the Native Messaging Host.

## Connection Establishment

### WebSocket Connection - Create/Resume Session

**Endpoint:** `ws://localhost:9000/session`

**Query Parameters:**
- `timeout` (number, optional): Session timeout in milliseconds. Default: 300000 (5 minutes)
- `sessionId` (string, optional): Existing session ID to resume. If not provided, creates new session

**Example (Create New Session):**
```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:9000/session?timeout=600000');

ws.on('open', () => {
  console.log('Connected');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'sessionCreated') {
    console.log('Session ID:', msg.sessionId);
    // Save sessionId for resuming later
  }
});
```

**Example (Resume Existing Session):**
```javascript
const sessionId = 'abc-123-def-456'; // Previously saved session ID
const ws = new WebSocket(`ws://localhost:9000/session?sessionId=${sessionId}`);

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'sessionResumed') {
    console.log('Session resumed:', msg.sessionId);
  } else if (msg.type === 'error') {
    console.error('Failed to resume:', msg.message);
    // Session expired or not found, create new session
  }
});
```

### HTTP Endpoint - Check Server/Session Status

**Optional:** Before establishing WebSocket connection, you can check server readiness or query session info.

**Endpoint:** `GET http://localhost:9000/session`

**Query Parameters:**
- `sessionId` (string, optional): Check if a session exists and is valid

**Check Server Readiness:**
```bash
curl "http://localhost:9000/session"
```

Response:
```json
{
  "status": "ready",
  "message": "Upgrade to WebSocket"
}
```

**Check Session Status:**
```bash
curl "http://localhost:9000/session?sessionId=abc-123-def-456"
```

Response (Session Valid):
```json
{
  "type": "sessionResumed",
  "sessionId": "abc-123-def-456",
  "timeout": 600000,
  "expiresAt": 1736988800000
}
```

Response (Session Expired/Not Found):
```json
{
  "status": "ready",
  "message": "Upgrade to WebSocket"
}
```

**Note:** This HTTP endpoint does **not** create sessions or establish WebSocket connections. It only checks status. Actual session creation happens when you connect via WebSocket.

### WebSocket Events

**Session Created Event:**
```json
{
  "type": "sessionCreated",
  "sessionId": "abc-123-def-456",
  "timeout": 600000,
  "expiresAt": 1704988800000
}
```

**Session Resumed Event:**
```json
{
  "type": "sessionResumed",
  "sessionId": "abc-123-def-456",
  "timeout": 600000,
  "expiresAt": 1736988800000
}
```

**Error Response (Invalid/Expired Session):**
```json
{
  "type": "error",
  "message": "Session not found or expired"
}
```

**Notes:**
- WebSocket connection is established immediately upon successful handshake
- New sessions receive a unique UUID as `sessionId`
- Session timeout resets on any activity (command execution)
- Expired sessions cannot be resumed and will return an error
- Connection is automatically closed if session creation/resumption fails

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
11. **highlightElement(selector)** - Highlight all matching elements with yellow background (returns count)
12. **removeHighlights()** - Remove all highlights from the page (returns count)
13. **getElementBounds(selector)** - Get position and size of all matching elements (returns array)
14. **scrollElementIntoView(selector, index)** - Scroll element into view by index (returns bounds array)
15. **inspectElement(selector)** - Inspect element and return tree structure with parents, clicked element, and children
16. **getContainerElements(containerSelector, elementSelector)** - Get all elements within a container matching optional filter (returns array of element data)

**Note:** Functions prefixed with `_internal_` are restricted to internal UI use only and cannot be called via the `callHelper` API. Use public functions like `inspectElement(selector)` for programmatic access.

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
    "message": "ChromeLink helper not loaded"
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

**Highlight Examples:**

Highlight single element:
```json
{
  "action": "callHelper",
  "params": {
    "functionName": "highlightElement",
    "args": ["h1"]
  },
  "requestId": "req-007"
}
```

Response:
```json
{
  "requestId": "req-007",
  "result": {
    "value": 1,
    "type": "number"
  },
  "error": null
}
```

Highlight multiple elements:
```json
{
  "action": "callHelper",
  "params": {
    "functionName": "highlightElement",
    "args": ["button.action-btn"]
  },
  "requestId": "req-008"
}
```

Response (3 buttons highlighted):
```json
{
  "requestId": "req-008",
  "result": {
    "value": 3,
    "type": "number"
  },
  "error": null
}
```

Remove all highlights:
```json
{
  "action": "callHelper",
  "params": {
    "functionName": "removeHighlights",
    "args": []
  },
  "requestId": "req-009"
}
```

Response:
```json
{
  "requestId": "req-009",
  "result": {
    "value": 3,
    "type": "number"
  },
  "error": null
}
```

**Notes:**
- Returns the number of elements highlighted/unhighlighted
- Multiple elements matching the selector are all highlighted
- Highlights persist until explicitly removed with `removeHighlights()`
- Highlights are cleared automatically on page navigation
- Calling `highlightElement` with the same selector multiple times won't duplicate highlights

**Screenshot Examples:**

Get element bounds:
```json
{
  "action": "callHelper",
  "params": {
    "functionName": "getElementBounds",
    "args": ["button.submit"]
  },
  "requestId": "req-010"
}
```

Response (array of bounds for all matching elements):
```json
{
  "requestId": "req-010",
  "result": {
    "value": [
      {
        "index": 0,
        "x": 100,
        "y": 200,
        "width": 150,
        "height": 50,
        "absoluteX": 100,
        "absoluteY": 1200
      },
      {
        "index": 1,
        "x": 100,
        "y": 400,
        "width": 150,
        "height": 50,
        "absoluteX": 100,
        "absoluteY": 1400
      }
    ],
    "type": "object"
  },
  "error": null
}
```

Returns empty array if no elements found:
```json
{
  "requestId": "req-010",
  "result": {
    "value": [],
    "type": "object"
  },
  "error": null
}
```

Scroll element into view (with optional index for multiple elements):
```json
{
  "action": "callHelper",
  "params": {
    "functionName": "scrollElementIntoView",
    "args": ["button.submit", 1]
  },
  "requestId": "req-011"
}
```

Response (bounds array after scrolling):
```json
{
  "requestId": "req-011",
  "result": {
    "value": [
      {
        "index": 0,
        "x": 100,
        "y": 50,
        "width": 150,
        "height": 50,
        "absoluteX": 100,
        "absoluteY": 1200
      },
      {
        "index": 1,
        "x": 100,
        "y": 250,
        "width": 150,
        "height": 50,
        "absoluteX": 100,
        "absoluteY": 1400
      }
    ],
    "type": "object"
  },
  "error": null
}
```

**Inspector Mode Example:**

Inspect element and get tree structure:
```json
{
  "action": "callHelper",
  "params": {
    "functionName": "inspectElement",
    "args": ["button.submit"]
  },
  "requestId": "req-012"
}
```

Response:
```json
{
  "requestId": "req-012",
  "result": {
    "value": {
      "clickedElement": {
        "tagName": "button",
        "selector": "button.submit",
        "attributes": {
          "class": "submit primary-btn",
          "type": "submit"
        },
        "textContent": "Submit Form",
        "isClickedElement": true,
        "siblingCount": 2
      },
      "parents": [
        {
          "tagName": "form",
          "selector": "#contact-form",
          "attributes": {
            "id": "contact-form",
            "class": "form-container"
          },
          "textContent": "...",
          "isClickedElement": false,
          "siblingCount": 1
        },
        {
          "tagName": "div",
          "selector": "div.form-wrapper",
          "attributes": {
            "class": "form-wrapper"
          },
          "textContent": "...",
          "isClickedElement": false,
          "siblingCount": 3
        }
      ],
      "children": [
        {
          "tagName": "span",
          "selector": "button.submit > span",
          "attributes": {
            "class": "icon"
          },
          "textContent": "✓",
          "isClickedElement": false,
          "siblingCount": 1
        }
      ],
      "timestamp": 1736793600000
    },
    "type": "object"
  },
  "error": null
}
```

**Notes:**
- `inspectElement()` does not highlight the element (unlike clicking in inspector mode)
- Works independently without requiring `enableClickTracking()` to be called first
- Returns detailed tree structure including:
  - `clickedElement`: The inspected element with full details
  - `parents`: Array of parent elements up to `<body>` (ordered from outermost to innermost)
  - `children`: Array of direct child elements
  - `timestamp`: When the inspection occurred
- Each element includes:
  - `tagName`: Lowercase HTML tag name
  - `selector`: Unique CSS selector generated by `_internal_generateSelector`
  - `attributes`: Relevant attributes (id, class, name, type, href, src, data-*, placeholder, value)
  - `textContent`: Trimmed text content
  - `isClickedElement`: Boolean indicating if this is the inspected element
  - `siblingCount`: Count of siblings with same tag and first class

**Container Elements Example:**

Get all form elements from a container:
```json
{
  "action": "callHelper",
  "params": {
    "functionName": "getContainerElements",
    "args": ["form", "input, button, select, textarea, label"]
  },
  "requestId": "req-013"
}
```

Response:
```json
{
  "requestId": "req-013",
  "result": {
    "value": [
      {
        "tagName": "input",
        "selector": "#my-text-id",
        "attributes": {
          "id": "my-text-id",
          "name": "my-text",
          "type": "text",
          "class": "form-control"
        },
        "textContent": "",
        "visible": true
      },
      {
        "tagName": "label",
        "selector": "label:has(#my-text-id)",
        "attributes": {
          "class": "form-label"
        },
        "textContent": "Text input",
        "visible": true
      },
      {
        "tagName": "button",
        "selector": "button[type=\"submit\"]",
        "attributes": {
          "type": "submit",
          "class": "btn btn-primary"
        },
        "textContent": "Submit",
        "visible": true
      }
    ],
    "type": "object"
  },
  "error": null
}
```

**Parameters:**
- `containerSelector` (string, required): CSS selector for the container element
- `elementSelector` (string, optional): CSS selector filter for elements within container. Default: `'*'` (all descendants)

**Returns:**
Array of element objects, each containing:
- `tagName` (string): Lowercase HTML tag name
- `selector` (string): Stable CSS selector generated using priority order:
  1. ID selector (`#id`)
  2. Radio/checkbox with name+value (`input[name="..."][value="..."]`)
  3. Name attribute (`element[name="..."]`)
  4. Name+type combination (`input[type="..."][name="..."]`)
  5. Data-* attributes (`[data-testid="..."]`)
  6. ARIA label (`element[aria-label="..."]`)
  7. Type+placeholder for inputs (`input[type="..."][placeholder="..."]`)
  8. Unique class (excluding utility classes)
  9. Element-specific attributes:
     - Labels with `for`: `label[for="..."]`
     - Wrapping labels: `label:has(input[name="..."])`
     - Buttons with type: `button[type="submit"]`
     - Links with href: `a[href="..."]`
     - Images with src: `img[src="..."]`
  10. nth-child path (last resort)
- `attributes` (object): All element attributes as key-value pairs
- `textContent` (string): Trimmed text content of the element
- `visible` (boolean): Whether element is visible (checks `display`, `visibility`, `opacity`)

**Notes:**
- Efficiently extracts all elements in a single call (avoids multiple DOM queries)
- Generates stable, semantic selectors optimized for test automation
- Works on CSP-restricted pages
- Filters out generic utility classes (Bootstrap, Tailwind patterns) from class-based selectors
- Returns empty array if no elements match the filter
- Throws error if container element not found

**Use Cases:**
- Form analysis and automation
- Scraping structured data from containers
- Generating stable selectors for test scripts
- Identifying all interactive elements in a section

### 8. Capture Screenshot

Capture screenshot of the visible viewport or specific elements.

**Request (Full Viewport):**
```json
{
  "action": "captureScreenshot",
  "params": {
    "tabId": 123,
    "format": "png",
    "quality": 90
  },
  "requestId": "req-014"
}
```

**Parameters:**
- `tabId` (number, optional): Tab ID to capture. If omitted, uses active tab
- `format` (string, optional): Image format - `"png"` or `"jpeg"`. Default: `"png"`
- `quality` (number, optional): JPEG quality 0-100. Only used when format is `"jpeg"`. Default: 90
- `selectors` (string | string[], optional): CSS selector(s) to capture specific elements
  - Single selector string: `"h1"` - captures all matching elements
  - Array of selectors: `["h1", "button.submit"]` - captures all elements matching any selector
  - If provided, captures all matching elements in a single combined screenshot

**Response (Full Viewport):**
```json
{
  "requestId": "req-013",
  "result": {
    "dataUrl": "data:image/png;base64,iVBORw0KGgo..."
  },
  "error": null
}
```

**Request (Element Screenshot):**
```json
{
  "action": "captureScreenshot",
  "params": {
    "tabId": 123,
    "selectors": ["h1", "button.submit"]
  },
  "requestId": "req-014"
}
```

**Response (Element Screenshot - Combined):**
```json
{
  "requestId": "req-014",
  "result": {
    "dataUrl": "data:image/png;base64,iVBORw0KGgo...",
    "bounds": {
      "x": 100,
      "y": 50,
      "width": 800,
      "height": 600,
      "absoluteX": 100,
      "absoluteY": 1050
    },
    "elementCount": 3,
    "devicePixelRatio": 2
  },
  "error": null
}
```

**Response (No Elements Found):**
```json
{
  "requestId": "req-014",
  "result": null,
  "error": {
    "code": "ELEMENTS_NOT_FOUND",
    "message": "No elements found matching selectors: h1, button.submit"
  }
}
```

**Response (Rate Limit Exceeded):**
```json
{
  "requestId": "req-015",
  "result": null,
  "error": {
    "code": "EXECUTION_ERROR",
    "message": "This request exceeds the MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND quota."
  }
}
```

**Notes:**
- Uses `chrome.tabs.captureVisibleTab` which only captures visible viewport (not full page)
- Captures at device resolution (2x on Retina displays)
- When `selectors` is provided:
  - Accepts either a single selector string or an array of selector strings
  - Finds ALL matching elements using `querySelectorAll` for each selector
  - Calculates a bounding box that encompasses all matched elements
  - Returns a SINGLE screenshot cropped to the combined bounding area
  - Adds 10px padding around the combined bounds
- Elements must be visible in current viewport
- Device pixel ratio is automatically handled for accurate cropping
- Works on CSP-restricted pages
- For multiple separate screenshots, make multiple requests with different selectors
- **Rate Limiting**: Chrome enforces `MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND` quota (2 calls/second)
  - Exceeding this quota results in `EXECUTION_ERROR`
  - Add 500ms delays between consecutive screenshot requests
  - Using array selectors helps reduce API calls by combining multiple selectors into one request

**Example Usage:**

Viewport screenshot:
```javascript
const result = await client.sendRequest('captureScreenshot', { tabId });
// Returns: { dataUrl: "data:image/png;base64,..." }
```

Single element screenshot:
```javascript
const result = await client.sendRequest('captureScreenshot', { 
  tabId, 
  selectors: 'h1' 
});
// Returns: { dataUrl: "...", bounds: {...}, elementCount: 1, devicePixelRatio: 2 }
```

Multiple elements combined screenshot:
```javascript
const result = await client.sendRequest('captureScreenshot', { 
  tabId, 
  selectors: ['label[for="username"]', 'input#username']
});
// Returns single screenshot encompassing both label and input
// { dataUrl: "...", bounds: {...}, elementCount: 2, devicePixelRatio: 2 }
```

Using CSS selector grouping (alternative):
```javascript
const result = await client.sendRequest('captureScreenshot', { 
  tabId, 
  selectors: 'label[for="username"], input#username' 
});
// Same result as above
```


### 9. Register Script Injection

Register early script injection for WebView2 testing and page mocking. Scripts are injected before page load into the main world, allowing you to mock browser APIs, inject test data, or modify page behavior.

**Request:**
```json
{
  "action": "registerInjection",
  "params": {
    "id": "webview2-mock",
    "code": "window.chrome = window.chrome || {}; window.chrome.webview = { postMessage: () => {} };",
    "matches": ["https://your-app.com/*"],
    "runAt": "document_start"
  },
  "requestId": "req-016"
}
```

**Parameters:**
- `id` (string, required): Unique identifier for this injection
- `code` (string, required): JavaScript code to inject
- `matches` (string[], optional): URL patterns to inject on. Default: `["<all_urls>"]`
  - Supports Chrome match patterns: `https://example.com/*`, `*://*.google.com/*`, etc.
- `runAt` (string, optional): When to inject. Default: `"document_start"`
  - `"document_start"` - Before any page scripts run (recommended for mocking)
  - `"document_end"` - After DOM is loaded but before images/resources
  - `"document_idle"` - After page is fully loaded

**Response:**
```json
{
  "requestId": "req-016",
  "result": {
    "registered": true,
    "id": "webview2-mock"
  },
  "error": null
}
```

**Error Cases:**

Missing parameters:
```json
{
  "requestId": "req-016",
  "result": null,
  "error": {
    "code": "MISSING_PARAMS",
    "message": "Missing required parameters: id, code"
  }
}
```

Registration failed:
```json
{
  "requestId": "req-016",
  "result": null,
  "error": {
    "code": "INJECTION_ERROR",
    "message": "Failed to register injection: Content script with ID 'webview2-mock' already exists"
  }
}
```

**Scope:**
- Applies to **all tabs and windows** (current and future) matching URL patterns
- Persists across tab navigations if URL still matches
- Automatic injection - no need to track individual tabs
- Injected into MAIN world (page context), not isolated extension context

**Example Use Cases:**

Mock WebView2 API:
```json
{
  "action": "registerInjection",
  "params": {
    "id": "webview2-api",
    "code": "window.chrome = window.chrome || {}; window.chrome.webview = { postMessage: (msg) => console.log('Mock:', msg), addEventListener: (evt, handler) => { setTimeout(() => handler({ data: JSON.stringify({ token: 'test-token-123' }) }), 100); } };",
    "matches": ["https://my-webview-app.com/*"]
  },
  "requestId": "req-017"
}
```

Inject test configuration:
```json
{
  "action": "registerInjection",
  "params": {
    "id": "test-config",
    "code": "window.__TEST_MODE__ = true; window.__API_URL__ = 'https://staging-api.example.com';",
    "matches": ["https://app.example.com/*", "https://staging.example.com/*"]
  },
  "requestId": "req-018"
}
```

Override fetch for testing:
```json
{
  "action": "registerInjection",
  "params": {
    "id": "fetch-mock",
    "code": "const originalFetch = window.fetch; window.fetch = async (...args) => { console.log('Fetch intercepted:', args[0]); return originalFetch(...args); };",
    "matches": ["<all_urls>"],
    "runAt": "document_start"
  },
  "requestId": "req-019"
}
```

**Notes:**
- No warning banner (unlike chrome.debugger API)
- Code executes in page context, has full access to page APIs
- Multiple injections can be registered with different IDs
- Registering with an existing ID will fail - unregister first
- Code is injected as-is, ensure it's valid JavaScript
- Use `runAt: "document_start"` for API mocking to ensure code runs before page scripts

### 10. Unregister Script Injection

Remove a previously registered script injection.

**Request:**
```json
{
  "action": "unregisterInjection",
  "params": {
    "id": "webview2-mock"
  },
  "requestId": "req-020"
}
```

**Parameters:**
- `id` (string, required): ID of the injection to remove

**Response:**
```json
{
  "requestId": "req-020",
  "result": {
    "unregistered": true,
    "id": "webview2-mock"
  },
  "error": null
}
```

**Error Cases:**

Missing parameter:
```json
{
  "requestId": "req-020",
  "result": null,
  "error": {
    "code": "MISSING_PARAMS",
    "message": "Missing required parameter: id"
  }
}
```

Unregistration failed:
```json
{
  "requestId": "req-020",
  "result": null,
  "error": {
    "code": "INJECTION_ERROR",
    "message": "Failed to unregister injection: Content script with ID 'webview2-mock' not found"
  }
}
```

**Notes:**
- Only affects future page loads - already loaded pages keep the injected code
- Does not remove code from currently running pages
- Use when test session is complete or switching to different test configuration

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
