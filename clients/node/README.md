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
  
  // Navigate to a page
  await client.navigate('https://example.com');
  
  // Interact with elements
  await client.waitForElement('h1');
  const heading = await client.getText('h1');
  console.log('Page heading:', heading.text);
  
  // Clean up
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

#### `navigate(url)`
Open URL in new tab and focus it.

```javascript
const result = await client.navigate('https://github.com');
console.log('Tab ID:', result.tab.id);
```

**Parameters:**
- `url` (string): URL to navigate to

**Returns:** `Promise<{ tab: Tab }>`

---

### JavaScript Execution

#### `executeJS(code, tabId)`
Execute JavaScript code in a tab.

```javascript
const result = await client.executeJS('document.title');
console.log('Title:', result.value);
```

**Parameters:**
- `code` (string): JavaScript code to execute
- `tabId` (number, optional): Tab ID (uses current tab if omitted)

**Returns:** `Promise<{ value: any, type: string }>`

**Note:** For large results (>1MB), responses are automatically chunked and reassembled.

---

#### `callHelper(functionName, args, tabId)`
Call predefined DOM helper function (works on CSP-restricted pages).

```javascript
// Click element
await client.callHelper('clickElement', ['button.submit']);

// Type text
await client.callHelper('typeText', ['input[name="email"]', 'test@example.com']);

// Get element bounds
const bounds = await client.callHelper('getElementBounds', ['div.container']);
```

**Parameters:**
- `functionName` (string): Helper function name
- `args` (array, optional): Function arguments
- `tabId` (number, optional): Tab ID

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

#### `click(selector)`
Click an element.

```javascript
await client.click('button.submit');
```

**Parameters:**
- `selector` (string): CSS selector

**Returns:** `Promise<{ value: boolean }>`

**Throws:** Error if element not found

---

#### `type(selector, text)`
Type text into an element.

```javascript
await client.type('input[name="username"]', 'john@example.com');
```

**Parameters:**
- `selector` (string): CSS selector
- `text` (string): Text to type

**Returns:** `Promise<{ value: boolean }>`

---

#### `getText(selector)`
Get text content of an element.

```javascript
const result = await client.getText('h1');
console.log(result.text);
```

**Parameters:**
- `selector` (string): CSS selector

**Returns:** `Promise<{ text: string }>`

---

#### `waitForElement(selector, timeout)`
Wait for element to appear in DOM.

```javascript
await client.waitForElement('div.loaded', 5000);
```

**Parameters:**
- `selector` (string): CSS selector
- `timeout` (number): Max wait time in ms (default: `10000`)

**Returns:** `Promise<{ found: boolean }>`

**Throws:** Error if element not found within timeout

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

#### `closeTab(tabId)`
Close a tab.

```javascript
await client.closeTab(123);
```

**Parameters:**
- `tabId` (number): Tab ID to close

**Returns:** `Promise<{ success: boolean, tabId: number }>`

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
  
  await client.navigate('https://example.com/form');
  await client.waitForElement('form');
  
  await client.type('input[name="name"]', 'John Doe');
  await client.type('input[name="email"]', 'john@example.com');
  await client.click('button[type="submit"]');
  
  await client.wait(2000);
  const message = await client.getText('.success-message');
  console.log('Result:', message.text);
  
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
  await client.navigate('https://example.com');
  
  const title = await client.executeJS('document.title');
  
  if (title.value !== 'Expected Title') {
    throw new Error('Title mismatch');
  }
  
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
  
  await client.navigate('https://csp-protected-site.com');
  
  // Use callHelper instead of executeJS for CSP-restricted pages
  await client.callHelper('clickElement', ['button.action']);
  await client.callHelper('typeText', ['input.search', 'query text', true]);
  
  const text = await client.callHelper('getText', ['div.result']);
  console.log('Result:', text.value);
  
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
  
  await client.navigate('https://example.com/big-table');
  
  // If result >1MB, it will be automatically chunked and reassembled
  const result = await client.executeJS(`
    Array.from(document.querySelectorAll('table tr')).map(row => ({
      cells: Array.from(row.cells).map(cell => cell.textContent)
    }))
  `);
  
  console.log('Rows:', result.value.length);
  
  client.close();
}

largeData().catch(console.error);
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
