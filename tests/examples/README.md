# ChromePilot Examples

WebSocket client examples for ChromePilot browser automation.

## Quick Start

```bash
cd tests/examples
npm install
npm test
```

## Available Examples

- **test-client.js** - Comprehensive test suite for all ChromePilot features
- **google-search-client.js** - Google search automation example
- **screenshot-client.js** - Screenshot capture example

## Running Examples

```bash
# Install dependencies
npm install

# Run test client
npm test
# or
node test-client.js

# Run Google search example
npm run google

# Run screenshot example
npm run screenshot
```

## Prerequisites

- ChromePilot extension loaded in Chrome
- Extension side panel open (click extension icon)
- Native host running (automatically starts when side panel opens)

### Test Coverage

The test client verifies:
1. **WebSocket Connection** - Connects to localhost:9000
2. **List Tabs** - Retrieves all tabs in current window
3. **Open Tab** - Opens new tab with specified URL
4. **Execute JavaScript** - Runs code in tab context
5. **Navigate Tab** - Changes tab URL
6. **Session Management** - Tracks session ID and activity

### Expected Output

```
🚀 ChromePilot Test Client

Connecting to ws://localhost:9000/session...
✓ Connected

Test 1: Listing tabs...
Session ID: <uuid>
✓ Found X tabs in current window
  1. [123] Tab Title...

Test 2: Opening new tab...
✓ Opened tab ID: 456

Test 3: Getting page title...
✓ Page title: "Example Domain"

Test 4: Getting page URL...
✓ Page URL: https://example.com

Test 5: Navigating to Google...
✓ Navigated tab 456

Test 6: Verifying navigation...
✓ New page title: "Google"

Test 7: Listing tabs again...
✓ Now have X tabs

🎉 All tests passed!
```

### Troubleshooting

If tests fail:

1. **Connection timeout** - Make sure side panel is open
2. **Not connected to Chrome extension** - Reload the extension
3. **Tab not found** - Check if tab was closed during test
4. **Script errors** - Check Chrome console for CSP issues
