# @aikeymouse/chromelink-client

Official Node.js client for [ChromeLink](https://github.com/aikeymouse/chrome-link) browser automation via WebSocket.

ChromeLink enables remote control of Chrome browser through a native messaging host and WebSocket API. This client library provides a clean, Promise-based interface for browser automation, testing, and scripting.

## Installation

```bash
npm install @aikeymouse/chromelink-client
```

**Alternative:** For convenience, you can also install the unscoped package:
```bash
npm install chromelink-client
```

## Quick Start

```javascript
const ChromeLinkClient = require('@aikeymouse/chromelink-client');

async function example() {
  // Create client (verbose logging enabled by default)
  const client = new ChromeLinkClient();
  
  // Connect to ChromeLink server
  await client.connect('ws://localhost:9000');
  
  // Open a new tab
  const { tab } = await client.openTab('https://example.com');
  const tabId = tab.id;
  
  // Interact with elements (tabId required)
  await client.waitForElement('h1', 10000, tabId);
  const heading = await client.getText('h1', tabId);
  console.log('Page heading:', heading.value);
  
  // Clean up
  await client.closeTab(tabId);
  client.close();
}

example().catch(console.error);
```

## Configuration

### Constructor Options

```javascript
const client = new ChromeLinkClient({
  verbose: false  // Disable console logging (default: true)
});
```

**Verbose Mode:**
- `true` (default): Logs all operations with emoji indicators (✓, ✗, →, ←)
- `false`: Silent mode for automation/CI environments

## API Reference

### Connection

#### `connect(url, timeout)`
Connect to WebSocket server and create session.

```javascript
await client.connect('ws://localhost:9000', 60000);
```

**Parameters:**
- `url` (string): WebSocket URL (default: `'ws://localhost:9000'`)
- `timeout` (number): Session timeout in ms (default: `60000`)

**Returns:** `Promise<void>`

---

### Navigation

**Deprecated:** The `navigate()` method has been removed. Use `openTab()` or `navigateTab()` instead.

---

### JavaScript Execution

#### `executeJS(code, tabId)`
Execute JavaScript code in a tab.

```javascript
const result = await client.executeJS('document.title', tabId);
console.log('Title:', result.value);
```

**Parameters:**
- `code` (string): JavaScript code to execute
- `tabId` (number): Tab ID to execute in

**Returns:** `Promise<{ value: any, type: string }>`

**Note:** For large results (>1MB), responses are automatically chunked and reassembled.

---

#### `callHelper(functionName, args, tabId)`
Call predefined DOM helper function (works on CSP-restricted pages).

```javascript
// Click element
await client.callHelper('clickElement', ['button.submit'], tabId);

// Type text
await client.callHelper('typeText', ['input[name="email"]', 'test@example.com'], tabId);

// Get element bounds
const bounds = await client.callHelper('getElementBounds', ['div.container'], tabId);
```

**Parameters:**
- `functionName` (string): Helper function name
- `args` (array, optional): Function arguments (default: `[]`)
- `tabId` (number): Tab ID to execute in

**Returns:** `Promise<{ value: any, type: string }>`

**Available Helper Functions:**
- `clickElement(selector)`
- `typeText(selector, text, clearFirst)`
- `getText(selector)`
- `getHTML(selector)`
- `elementExists(selector)`
- `isVisible(selector)`
- `waitForElement(selector, timeout)`
- `highlightElement(selector)`
- `removeHighlights()`
- `getElementBounds(selector)`
- `scrollElementIntoView(selector, index)`
- `inspectElement(selector)`
- `getContainerElements(containerSelector, elementSelector)`
- And more... (see [PROTOCOL.md](https://github.com/aikeymouse/chrome-link/blob/main/docs/PROTOCOL.md#7-call-dom-helper-function))

---

### DOM Interaction

#### `click(selector, tabId)`
Click an element.

```javascript
await client.click('button.submit', tabId);
```

**Parameters:**
- `selector` (string): CSS selector
- `tabId` (number): Tab ID to execute in

**Returns:** `Promise<{ value: boolean }>`

**Throws:** Error if element not found

---

#### `type(selector, text, tabId)`
Type text into an element.

```javascript
await client.type('input[name="username"]', 'john@example.com', tabId);
```

**Parameters:**
- `selector` (string): CSS selector
- `text` (string): Text to type
- `tabId` (number): Tab ID to execute in

**Returns:** `Promise<{ value: boolean }>`

---

#### `getText(selector, tabId)`
Get text content of an element.

```javascript
const result = await client.getText('h1', tabId);
console.log(result.value);
```

**Parameters:**
- `selector` (string): CSS selector
- `tabId` (number): Tab ID to execute in

**Returns:** `Promise<{ value: string }>`

---

#### `waitForElement(selector, timeout, tabId)`
Wait for element to appear in DOM.

```javascript
await client.waitForElement('div.loaded', 5000, tabId);
```

**Parameters:**
- `selector` (string): CSS selector
- `timeout` (number): Max wait time in ms (default: `10000`)
- `tabId` (number): Tab ID to check in

**Returns:** `Promise<{ found: boolean }>`

**Throws:** Error if element not found within timeout

---

### Screenshots

#### `captureScreenshot(options)`
Capture screenshot of visible area or full page.

```javascript
// Capture visible area (default)
const { screenshot } = await client.captureScreenshot();

// Capture full page
const { screenshot } = await client.captureScreenshot({ fullPage: true });

// Custom format and quality
const { screenshot } = await client.captureScreenshot({
  format: 'jpeg',
  quality: 90,
  fullPage: true
});
```

**Parameters:**
- `options` (object, optional): Screenshot options
  - `format` (string): Image format - `'png'` or `'jpeg'` (default: `'png'`)
  - `quality` (number): JPEG quality 0-100 (default: `90`)
  - `fullPage` (boolean): Capture full scrollable page (default: `false`)

**Returns:** `Promise<{ success: boolean, screenshot: string }>`

`screenshot` is a base64-encoded data URL (e.g., `data:image/png;base64,...`).

---

### Script Injection

#### `registerInjection(id, code, matches, runAt)`
Register a content script to inject into matching pages.

```javascript
await client.registerInjection(
  'my-script',
  'console.log("Page loaded:", document.title)',
  ['https://example.com/*'],
  'document_end'
);
```

**Parameters:**
- `id` (string): Unique injection ID
- `code` (string): JavaScript code to inject
- `matches` (array): URL match patterns (e.g., `['https://*.example.com/*']`)
- `runAt` (string, optional): When to inject - `'document_start'`, `'document_end'`, or `'document_idle'` (default: `'document_end'`)

**Returns:** `Promise<{ success: boolean, id: string }>`

---

#### `unregisterInjection(id)`
Remove a registered content script injection.

```javascript
await client.unregisterInjection('my-script');
```

**Parameters:**
- `id` (string): Injection ID to remove

**Returns:** `Promise<{ success: boolean, id: string }>`

---

### Tab Management

#### `listTabs()`
Get all tabs in current window.

```javascript
const result = await client.listTabs();
console.log('Tabs:', result.tabs);
```

**Returns:** `Promise<{ tabs: Tab[], windowId: number }>`

---

#### `openTab(url, focus)`
Open a new tab with URL.

```javascript
const { tab } = await client.openTab('https://example.com', true);
console.log('Tab ID:', tab.id);
```

**Parameters:**
- `url` (string): URL to open
- `focus` (boolean, optional): Whether to focus the tab (default: `true`)

**Returns:** `Promise<{ success: boolean, tab: Tab }>`

---

#### `navigateTab(tabId, url, focus)`
Navigate an existing tab to URL.

```javascript
await client.navigateTab(123, 'https://github.com', true);
```

**Parameters:**
- `tabId` (number): Tab ID to navigate
- `url` (string): URL to navigate to
- `focus` (boolean, optional): Whether to focus the tab (default: `true`)

**Returns:** `Promise<{ success: boolean, tabId: number }>`

---

#### `switchTab(tabId)`
Switch to (activate) a tab.

```javascript
await client.switchTab(123);
```

**Parameters:**
- `tabId` (number): Tab ID to activate

**Returns:** `Promise<{ success: boolean, tabId: number }>`

---

#### `closeTab(tabId)`
Close a tab.

```javascript
await client.closeTab(123);
```

**Parameters:**
- `tabId` (number): Tab ID to close

**Returns:** `Promise<{ success: boolean, tabId: number }>`

---

#### `getActiveTab()`
Get the currently active tab.

```javascript
const { tab } = await client.getActiveTab();
console.log('Active tab:', tab.id, tab.url);
```

**Returns:** `Promise<{ success: boolean, tab: Tab }>`

---

### Navigation History

#### `goBack(tabId)`
Navigate back in tab history.

```javascript
await client.goBack(123);
```

**Parameters:**
- `tabId` (number): Tab ID to navigate

**Returns:** `Promise<{ success: boolean, tabId: number, message?: string }>`

**Note:** Returns `success: false` if tab cannot go back (e.g., no history).

---

#### `goForward(tabId)`
Navigate forward in tab history.

```javascript
await client.goForward(123);
```

**Parameters:**
- `tabId` (number): Tab ID to navigate

**Returns:** `Promise<{ success: boolean, tabId: number, message?: string }>`

**Note:** Returns `success: false` if tab cannot go forward (e.g., at end of history).

---

### Utilities

#### `wait(ms)`
Wait for a period of time.

```javascript
await client.wait(1000); // Wait 1 second
```

**Parameters:**
- `ms` (number): Milliseconds to wait

**Returns:** `Promise<void>`

---

#### `close()`
Close WebSocket connection.

```javascript
client.close();
```

**Returns:** `void`

---

## Usage Examples

### Basic Browser Automation

```javascript
const ChromeLinkClient = require('@aikeymouse/chromelink-client');

async function automateForm() {
  const client = new ChromeLinkClient();
  await client.connect();
  
  // Open form page
  const { tab } = await client.openTab('https://example.com/form');
  const tabId = tab.id;
  
  await client.waitForElement('form', 10000, tabId);
  
  await client.type('input[name="name"]', 'John Doe', tabId);
  await client.type('input[name="email"]', 'john@example.com', tabId);
  await client.click('button[type="submit"]', tabId);
  
  await client.wait(2000);
  const message = await client.getText('.success-message', tabId);
  console.log('Result:', message.value);
  
  await client.closeTab(tabId);
  client.close();
}

automateForm().catch(console.error);
```

### Silent Mode for CI/Automation

```javascript
const ChromeLinkClient = require('@aikeymouse/chromelink-client');

async function ciTest() {
  // Disable verbose logging
  const client = new ChromeLinkClient({ verbose: false });
  
  await client.connect();
  const { tab } = await client.openTab('https://example.com');
  
  const title = await client.executeJS('document.title', tab.id);
  
  if (title.value !== 'Expected Title') {
    throw new Error('Title mismatch');
  }
  
  await client.closeTab(tab.id);
  client.close();
}

ciTest().catch(console.error);
```

### Using DOM Helpers on CSP-Restricted Pages

```javascript
const ChromeLinkClient = require('@aikeymouse/chromelink-client');

async function cspExample() {
  const client = new ChromeLinkClient();
  await client.connect();
  
  const { tab } = await client.openTab('https://csp-protected-site.com');
  const tabId = tab.id;
  
  // Use callHelper instead of executeJS for CSP-restricted pages
  await client.callHelper('clickElement', ['button.action'], tabId);
  await client.callHelper('typeText', ['input.search', 'query text', true], tabId);
  
  const text = await client.callHelper('getText', ['div.result'], tabId);
  console.log('Result:', text.value);
  
  await client.closeTab(tabId);
  client.close();
}

cspExample().catch(console.error);
```

### Handling Large Results (Chunked Responses)

```javascript
const ChromeLinkClient = require('@aikeymouse/chromelink-client');

async function largeData() {
  const client = new ChromeLinkClient();
  await client.connect();
  
  const { tab } = await client.openTab('https://example.com/big-table');
  
  // If result >1MB, it will be automatically chunked and reassembled
  const result = await client.executeJS(`
    Array.from(document.querySelectorAll('table tr')).map(row => ({
      cells: Array.from(row.cells).map(cell => cell.textContent)
    }))
  `, tab.id);
  
  console.log('Rows:', result.value.length);
  
  await client.closeTab(tab.id);
  client.close();
}

largeData().catch(console.error);
```

### Tab Navigation History

```javascript
const ChromeLinkClient = require('@aikeymouse/chromelink-client');

async function navigationExample() {
  const client = new ChromeLinkClient();
  await client.connect();
  
  // Open tab with first page
  const { tab } = await client.openTab('https://example.com/page1');
  const tabId = tab.id;
  
  // Navigate to second page
  await client.navigateTab(tabId, 'https://example.com/page2');
  
  // Navigate to third page
  await client.navigateTab(tabId, 'https://example.com/page3');
  
  // Go back twice
  await client.goBack(tabId);
  await client.wait(500);
  await client.goBack(tabId);
  
  // Go forward once
  await client.wait(500);
  await client.goForward(tabId);
  
  await client.closeTab(tabId);
  client.close();
}

navigationExample().catch(console.error);
```

### Taking Screenshots

```javascript
const ChromeLinkClient = require('@aikeymouse/chromelink-client');
const fs = require('fs');

async function screenshotExample() {
  const client = new ChromeLinkClient();
  await client.connect();
  
  const { tab } = await client.openTab('https://example.com');
  await client.waitForElement('body', 5000, tab.id);
  
  // Capture full page
  const { screenshot } = await client.captureScreenshot({ fullPage: true });
  
  // Extract base64 data and save
  const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync('screenshot.png', Buffer.from(base64Data, 'base64'));
  
  console.log('Screenshot saved!');
  
  await client.closeTab(tab.id);
  client.close();
}

screenshotExample().catch(console.error);
```

## Local Development

For local development and testing, use a file dependency in your `package.json`:

```json
{
  "dependencies": {
    "@aikeymouse/chromelink-client": "file:../clients/node"
  }
}
```

Then run:
```bash
npm install
```

This creates a symlink to your local client code for testing changes.

## Protocol Documentation

For complete protocol specification, see [PROTOCOL.md](https://github.com/aikeymouse/chrome-link/blob/main/docs/PROTOCOL.md).

## Prerequisites

- ChromeLink extension and native host installed
- ChromeLink server running on `ws://localhost:9000` (default)

## Troubleshooting

**Connection refused:**
- Ensure ChromeLink native host is installed
- Verify WebSocket server is running
- Check firewall settings

**Element not found errors:**
- Use `waitForElement()` before interacting with dynamic content
- Verify selector syntax is correct
- Check page is fully loaded

**CSP errors with executeJS:**
- Use `callHelper()` instead for CSP-restricted pages
- Helper functions are pre-injected and CSP-safe

## License

MIT License - see [LICENSE](./LICENSE) file for details.

**Note:** This client library is licensed under MIT. The ChromeLink browser extension and native host are licensed under CC BY-NC-ND 4.0.

## Repository

https://github.com/aikeymouse/chrome-link

## Issues

https://github.com/aikeymouse/chrome-link/issues
