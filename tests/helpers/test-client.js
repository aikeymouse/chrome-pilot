/**
 * Enhanced test client with helper methods
 * Extends the ChromeLink client with test-specific utilities
 */

// Use local file dependency (linked via package.json)
const ChromeLinkClient = require('@aikeymouse/chromelink-client');

class TestClient extends ChromeLinkClient {
  /**
   * Create test client with verbose logging disabled by default
   */
  constructor(options = {}) {
    super({
      verbose: false,
      ...options
    });
  }

  /**
   * Wait for connection with timeout
   */
  async waitForConnection(timeout = 5000) {
    const start = Date.now();
    while (!this.sessionId && Date.now() - start < timeout) {
      await this.wait(100);
    }
    if (!this.sessionId) {
      throw new Error('Connection timeout - session not created');
    }
    return true;
  }

  /**
   * Get initial tab IDs for cleanup tracking
   */
  async getInitialTabIds() {
    const result = await this.listTabs();
    return result.tabs.map(tab => tab.id);
  }

  /**
   * Cleanup tabs created during test
   */
  async cleanupTabs(initialTabIds) {
    const currentResult = await this.listTabs();
    const currentTabIds = currentResult.tabs.map(tab => tab.id);
    
    // Close tabs that weren't there initially
    for (const tabId of currentTabIds) {
      if (!initialTabIds.includes(tabId)) {
        try {
          await this.closeTab(tabId);
        } catch (err) {
          // Tab may already be closed
          console.log(`Could not close tab ${tabId}: ${err.message}`);
        }
      }
    }
  }

  /**
   * Assert response is valid according to protocol
   * @param {Object} response - The response object
   * @param {Object} options - Validation options
   * @param {Array<string>} options.requiredFields - Fields that must exist
   * @param {Object} options.fieldTypes - Map of field names to expected types
   * @param {Function} options.customValidator - Custom validation function
   */
  assertValidResponse(response, options = {}) {
    const { requiredFields = [], fieldTypes = {}, customValidator } = options;
    
    if (!response) {
      throw new Error('Response is null or undefined');
    }
    
    // Check required fields exist
    for (const field of requiredFields) {
      if (!(field in response)) {
        throw new Error(`Response missing required field: ${field}`);
      }
    }
    
    // Check field types
    for (const [field, expectedType] of Object.entries(fieldTypes)) {
      if (field in response) {
        const actualType = Array.isArray(response[field]) ? 'array' : typeof response[field];
        if (actualType !== expectedType) {
          throw new Error(`Field '${field}' has type '${actualType}', expected '${expectedType}'`);
        }
      }
    }
    
    // Run custom validator if provided
    if (customValidator && typeof customValidator === 'function') {
      customValidator(response);
    }
    
    return true;
  }

  /**
   * Validate tab object structure
   */
  assertValidTab(tab) {
    return this.assertValidResponse(tab, {
      requiredFields: ['id', 'url', 'title'],
      fieldTypes: {
        id: 'number',
        url: 'string',
        title: 'string',
        active: 'boolean'
      }
    });
  }

  /**
   * Validate success response
   */
  assertValidSuccessResponse(response) {
    return this.assertValidResponse(response, {
      requiredFields: ['success'],
      fieldTypes: { success: 'boolean' },
      customValidator: (res) => {
        if (res.success !== true) {
          throw new Error('Response success field is not true');
        }
      }
    });
  }

  /**
   * Validate executeJS/callHelper response
   */
  assertValidExecutionResponse(response) {
    return this.assertValidResponse(response, {
      requiredFields: ['value'],
      customValidator: (res) => {
        // Value can be any type
        if (!('value' in res)) {
          throw new Error('Response missing value field');
        }
      }
    });
  }

  /**
   * Wait for tab to be ready
   */
  async waitForTabReady(tabId, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const result = await this.executeJS('document.readyState', tabId);
        if (result.value === 'complete' || result.value === 'interactive') {
          return true;
        }
      } catch (err) {
        // Tab might not be ready yet
      }
      await this.wait(100);
    }
    throw new Error(`Tab ${tabId} not ready within ${timeout}ms`);
  }
}

module.exports = TestClient;
