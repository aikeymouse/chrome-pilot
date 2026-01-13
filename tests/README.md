# ChromePilot Test Suite

Complete test suite for ChromePilot extension with unit, integration, and UI tests.

## Prerequisites

1. **ChromePilot Server Running** (or tests will start it)
   ```bash
   # Server must be running on ws://localhost:9000
   # Check DEVELOPMENT.md for installation instructions
   ```

2. **Chrome Extension Loaded**
   - Extension must be installed and active
   - Side panel should show "Connected" status

3. **Node.js Dependencies**
   ```bash
   cd tests
   npm install
   
   # Install Playwright browsers (first time only)
   npx playwright install chromium
   ```

## Installation

Install test dependencies:

```bash
npm install
```

This installs:
- `mocha` - Test framework
- `chai` - Assertion library
- `chai-as-promised` - Promise assertions
- `ws` - WebSocket client
- `@playwright/test` - Browser automation for UI tests

## Running Tests

### Run All Tests (Sequential)
```bash
npm test
```

This runs all test suites in sequence:
1. Unit tests
2. Integration tests
3. UI tests

### Run Unit Tests Only
```bash
npm run test:unit
```

### Run Integration Tests Only
```bash
npm run test:integration
```

### Run UI Tests Only
```bash
npm run test:ui
```

### Watch Mode
```bash
npm run test:unit:watch
npm run test:integration:watch
```

### Run Specific Test File
```bash
npx mocha unit/list-tabs.test.js
npx mocha integration/session-lifecycle.test.js
npx playwright test ui/sidepanel.spec.js
```

## Test Structure

```
tests/
├── unit/                      # Unit tests for individual commands
│   ├── list-tabs.test.js     # List tabs command
│   ├── open-tab.test.js      # Open tab command
│   ├── navigate-tab.test.js  # Navigate tab command
│   ├── switch-tab.test.js    # Switch tab command
│   ├── close-tab.test.js     # Close tab command
│   ├── execute-js.test.js    # Execute JavaScript command
│   ├── call-helper.test.js   # Call helper function command
│   ├── inspect.test.js       # inspectElement helper function tests
│   └── screenshot.test.js    # Screenshot capture tests
├── integration/               # Integration tests
│   ├── session-lifecycle.test.js   # Session creation/management
│   ├── chunked-responses.test.js   # Large data handling
│   ├── tab-events.test.js          # Tab state tracking
│   └── multi-command-flow.test.js  # Complex workflows
├── ui/                        # UI tests (Playwright)
│   └── sidepanel.spec.js     # Sidepanel UI tests
├── fixtures/                  # Test fixtures
│   └── ui-fixtures.js        # Playwright custom fixtures
├── helpers/                   # Test utilities
│   ├── hooks.js              # Global hooks and client factory
│   ├── test-client.js        # Enhanced test client
│   ├── test-data.js          # Test URLs and selectors
│   ├── server-helper.js      # Server lifecycle management
│   └── session-helper.js     # Session utilities
├── examples/                  # Example client scripts
│   ├── chromepilot-client.js # Base WebSocket client
│   ├── google-search-client.js
│   └── test-client.js
├── .mocharc.json             # Mocha configuration
└── playwright.config.js      # Playwright configuration
```

## Test Features

### Unit Tests
- Test individual commands in isolation
- Validate request/response format
- Error handling and edge cases
- Tab cleanup after each test
- TAB_NOT_FOUND error validation
- Timeout handling
- inspectElement validation with detailed element tree inspection
- Custom attribute collection for CSS selector generation

**Duration:** ~2-3 minutes (includes inspect.test.js which opens/closes test pages)

### Integration Tests
- Session lifecycle management
- Multi-command workflows
- Chunked response handling (>1MB data)
- Tab event tracking
- Complex user scenarios
- DOM helper functions

**Duration:** ~20-30 seconds

### UI Tests
- Browser-based tests with extension loaded
- Sidepanel rendering
- Material Symbols icons
- Interactive elements (buttons, inputs)
- Section toggling
- Empty states

**Duration:** ~15-25 seconds

### Test Helpers
- `TestClient` - Enhanced client with helper methods
- `createClient()` - Factory for test clients
- `test-data.js` - Test URLs and selectors
- `ui-fixtures.js` - Playwright custom fixtures
- Automatic tab cleanup
- Connection verification
- **Response validation helpers** - Standardized validation methods

### Response Validation

The `TestClient` provides validation helpers to ensure responses match protocol specifications:

#### `assertValidResponse(response, options)`
Comprehensive validation with configurable options:

```javascript
// Basic required field check
client.assertValidResponse(result, {
  requiredFields: ['tabs']
});

// Type validation
client.assertValidResponse(result, {
  requiredFields: ['tabs'],
  fieldTypes: { tabs: 'array' }
});

// Custom validation
client.assertValidResponse(result, {
  requiredFields: ['value'],
  customValidator: (response) => {
    if (response.value < 0) throw new Error('Value must be positive');
  }
});
```

**Options:**
- `requiredFields: Array<string>` - Fields that must exist in response
- `fieldTypes: Object` - Map of field names to expected types ('string', 'number', 'boolean', 'array', 'object')
- `customValidator: Function` - Custom validation function

#### Specialized Validators

**`assertValidTab(tab)`** - Validates tab object structure:
```javascript
const result = await client.sendRequest('openTab', { url: TEST_URLS.EXAMPLE });
client.assertValidTab(result.tab);
// Validates: id (number), url (string), title (string), active (boolean)
```

**`assertValidSuccessResponse(response)`** - Validates success responses:
```javascript
const result = await client.closeTab(tabId);
client.assertValidSuccessResponse(result);
// Validates: success field exists and equals true
```

**`assertValidExecutionResponse(response)`** - Validates execution results:
```javascript
const result = await client.executeJS('2 + 2', tabId);
client.assertValidExecutionResponse(result);
// Validates: value field exists (any type)
expect(result.value).to.equal(4);
```

## Writing Tests

### Basic Unit Test Template

```javascript
const { expect } = require('chai');
const { createClient } = require('../helpers/hooks');

describe('Command Name', function() {
  let client;
  let initialTabIds;

  before(async function() {
    client = createClient();
    await client.connect();
    await client.waitForConnection();
  });

  after(function() {
    if (client) {
      client.close();
    }
  });

  beforeEach(async function() {
    initialTabIds = await client.getInitialTabIds();
  });

  afterEach(async function() {
    await client.cleanupTabs(initialTabIds);
  });

  it('should do something', async function() {
    const result = await client.sendRequest('commandName', { params });
    
    // Validate response structure
    client.assertValidResponse(result, {
      requiredFields: ['field1', 'field2'],
      fieldTypes: { field1: 'string', field2: 'number' }
    });
    
    // Additional assertions
    expect(result.field1).to.equal('expected value');
  });
    const result = await client.sendRequest('action', { params });
    expect(result).to.have.property('expectedField');
  });
});
```

### Integration Test Template

```javascript
const { expect } = require('chai');
const { createClient } = require('../helpers/hooks');
const { TEST_URLS } = require('../helpers/test-data');

describe('Workflow Name', function() {
  let client;
  let initialTabIds;

  before(async function() {
    client = createClient();
    await client.connect();
    await client.waitForConnection();
  });

  after(function() {
    if (client) {
      client.close();
    }
  });

  beforeEach(async function() {
    initialTabIds = await client.getInitialTabIds();
  });

  afterEach(async function() {
    await client.cleanupTabs(initialTabIds);
  });

  it('should complete workflow', async function() {
    // Multi-step test
  });
});
```

### UI Test Template

```javascript
const { test, expect } = require('../fixtures/ui-fixtures');

test.describe('Component Name', () => {
  test('should display element', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/page.html`);
    const element = page.locator('#my-element');
    await expect(element).toBeVisible();
  });
});
```

## Test Data

Test URLs defined in `helpers/test-data.js`:
- `TEST_URLS.EXAMPLE` - http://example.com
- `TEST_URLS.SELENIUM_FORM` - Selenium web form for interaction tests
- `TEST_URLS.HTTPBIN` - HTTP testing service

## Test Configuration

### Mocha (.mocharc.json)
- Timeout: 60 seconds
- Reporter: spec
- Require: chai-as-promised

### Playwright (playwright.config.js)
- Workers: 1 (sequential execution)
- Retries: 0 (local), 2 (CI)
- Screenshots: on failure
- Video: on failure
- Timeout: 60 seconds per test

## Troubleshooting

### Tests Hang or Timeout
- Verify ChromePilot server is running on ws://localhost:9000
- Check Chrome extension is loaded and connected
- Increase timeout in `.mocharc.json` or `playwright.config.js` if needed

### Connection Errors
- Ensure no firewall blocking localhost:9000
- Check server logs in `native-host/logs/`
- Verify extension ID matches in native-host manifest

### Tab Cleanup Issues
- Tests automatically clean up created tabs
- If tabs persist, manually close them before re-running
- Check afterEach hooks are executing

### UI Tests Can't Find Extension
- Build extension first: `cd extension && npm run build`
- Ensure extension path is correct in `fixtures/ui-fixtures.js`
- Verify Chrome/Chromium is installed
- Check service worker started correctly

### Random Failures
- Some tests depend on page load timing
- Increase wait times in test if pages load slowly
- Check network connectivity for external URLs

## CI/CD Integration

Run tests in CI with validation script:

```bash
# From tests directory
./run-tests.sh
```

This script:
1. Validates server is running
2. Checks extension is loaded
3. Runs complete test suite
4. Reports results

Tests run sequentially in CI to prevent:
- Port conflicts
- Resource contention
- Race conditions

Example GitHub Actions:
```yaml
- run: npm run test:unit
- run: npm run test:integration
- run: npm run test:ui
```

## Coverage

Current test coverage:
- **Unit Tests:** 9 files, ~180+ assertions
- **Integration Tests:** 4 files, ~50 assertions
- **UI Tests:** 1 file, ~10 assertions

**Total:** 14 test files, ~240+ assertions

## Contributing

When adding new tests:
1. Place unit tests in `unit/`
2. Place integration tests in `integration/`
3. Place UI tests in `ui/`
4. Follow existing naming: `command-name.test.js` or `feature.spec.js`
5. Use shared helpers from `helpers/` and `fixtures/`
6. Include error handling tests
7. Clean up resources in afterEach
8. Add JSDoc comments
9. Update this README with new test descriptions

## TODO

### Future Enhancements

1. **CSP Test Server**
   - Create local test server serving pages with various CSP headers
   - Validate helper injection works on CSP-restricted pages
   - Test different CSP policy combinations

2. **Performance Benchmarks**
   - Add `tests/performance/` directory
   - Measure command latency
   - Analyze chunking overhead
   - Track session creation time
   - Test concurrent connection limits
