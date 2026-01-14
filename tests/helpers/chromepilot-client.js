/**
 * WebSocket Client Helper for ChromePilot
 */

const WebSocket = require('ws');

class ChromePilotClient {
  constructor() {
    this.ws = null;
    this.sessionId = null;
    this.pendingRequests = new Map();
  }

  /**
   * Connect to WebSocket server
   * The server automatically creates a session on connection
   * @param {string} url - WebSocket URL (default: ws://localhost:9000)
   * @param {number} timeout - Session timeout in milliseconds (default: 60000 = 1 minute)
   */
  connect(url = 'ws://localhost:9000', timeout = 60000) {
    return new Promise((resolve, reject) => {
      // Add timeout parameter to URL if not already present
      if (!url.includes('timeout=')) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}timeout=${timeout}`;
      }
      
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('✓ Connected to WebSocket server');
      });

      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        // Handle sessionCreated message
        if (message.type === 'sessionCreated') {
          this.sessionId = message.sessionId;
          console.log(`✓ Session created: ${this.sessionId}`);
          resolve();
          return;
        }
        
        // Handle sessionResumed message
        if (message.type === 'sessionResumed') {
          this.sessionId = message.sessionId;
          console.log(`✓ Session resumed: ${this.sessionId}`);
          resolve();
          return;
        }
        
        // Handle error message during connection
        if (message.type === 'error' && !this.sessionId) {
          console.error(`✗ Connection error: ${message.message}`);
          reject(new Error(message.message));
          return;
        }
        
        this.handleMessage(message);
      });

      this.ws.on('error', (err) => {
        console.error('✗ WebSocket error:', err.message);
        reject(err);
      });

      this.ws.on('close', () => {
        console.log('✓ WebSocket connection closed');
      });
    });
  }

  /**
   * Handle incoming messages
   */
  handleMessage(message) {
    console.log('← Received:', JSON.stringify(message, null, 2));

    // Handle response messages (either with type='response' or with requestId)
    if (message.type === 'response' || (message.requestId && message.hasOwnProperty('result'))) {
      const { requestId, result, error } = message;

      if (this.pendingRequests.has(requestId)) {
        const { resolve, reject } = this.pendingRequests.get(requestId);
        this.pendingRequests.delete(requestId);

        if (error) {
          const errorMsg = typeof error === 'object' ? JSON.stringify(error) : error;
          reject(new Error(errorMsg));
        } else {
          resolve(result);
        }
      }
    }
  }

  /**
   * Send request and wait for response
   */
  sendRequest(action, params = {}) {
    return new Promise((resolve, reject) => {
      const requestId = `req-${Date.now()}`;

      const message = {
        action,
        params,
        requestId
      };

      console.log('→ Sending:', JSON.stringify(message, null, 2));

      this.pendingRequests.set(requestId, { resolve, reject });
      this.ws.send(JSON.stringify(message));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Session is automatically created on connection - this method is a no-op
   */
  async createSession(timeout = 300000) {
    console.log(`✓ Using existing session: ${this.sessionId}`);
    return { sessionId: this.sessionId };
  }

  /**
   * Navigate to URL (opens in new tab and focuses it)
   */
  async navigate(url) {
    console.log(`→ Navigating to: ${url}`);
    const result = await this.sendRequest('openTab', { url, focus: true });
    console.log('✓ Navigation complete, result:', JSON.stringify(result, null, 2));
    this.currentTabId = result.tab.id;
    console.log(`✓ Current tab ID set to: ${this.currentTabId}`);
    return result;
  }

  /**
   * Execute JavaScript in the current tab
   */
  async executeJS(code, tabId = null) {
    const targetTabId = tabId || this.currentTabId;
    console.log(`→ Executing JS in tab ${targetTabId}: ${code.substring(0, 50)}...`);
    const result = await this.sendRequest('executeJS', { code, tabId: targetTabId });
    console.log(`✓ Result: ${JSON.stringify(result.value)}`);
    return result;
  }

  /**
   * Call a predefined helper function (for CSP-restricted pages)
   */
  async callHelper(functionName, args = [], tabId = null) {
    const targetTabId = tabId || this.currentTabId;
    console.log(`→ Calling helper: ${functionName}(${args.join(', ')})`);
    const result = await this.sendRequest('callHelper', { 
      functionName, 
      args, 
      tabId: targetTabId 
    });
    console.log(`✓ Result: ${JSON.stringify(result.value)}`);
    return result;
  }

  /**
   * Wait for element (using polling with executeJS)
   */
  async waitForElement(selector, timeout = 10000) {
    console.log(`→ Waiting for element: ${selector}`);
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        const escapedSelector = selector.replace(/'/g, "\\'");
        const result = await this.executeJS(`document.querySelector('${escapedSelector}') !== null`);
        if (result.value === true) {
          console.log('✓ Element found');
          return { found: true };
        }
      } catch (err) {
        console.log(`  Retrying... (${err.message})`);
      }
      await this.wait(500);
    }
    
    throw new Error(`Element ${selector} not found within ${timeout}ms`);
  }

  /**
   * Click element
   */
  async click(selector) {
    console.log(`→ Clicking element: ${selector}`);
    const escapedSelector = selector.replace(/'/g, "\\'");
    const code = `(function() { document.querySelector('${escapedSelector}').click(); return true; })()`;
    const result = await this.executeJS(code);
    console.log('✓ Click complete');
    return result;
  }

  /**
   * Type text into element
   */
  async type(selector, text) {
    console.log(`→ Typing "${text}" into: ${selector}`);
    const escapedSelector = selector.replace(/'/g, "\\'");
    const escapedText = text.replace(/'/g, "\\'");
    const code = `(function() {
      const el = document.querySelector('${escapedSelector}');
      el.value = '${escapedText}';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`;
    const result = await this.executeJS(code);
    console.log('✓ Type complete');
    return result;
  }

  /**
   * Get element text
   */
  async getText(selector) {
    console.log(`→ Getting text from: ${selector}`);
    const code = `document.querySelector('${selector}').textContent`;
    const result = await this.executeJS(code);
    console.log(`✓ Text: "${result.value}"`);
    return { text: result.value };
  }

  /**
   * List tabs
   */
  async listTabs() {
    console.log('→ Listing tabs');
    const result = await this.sendRequest('listTabs');
    console.log(`✓ Found ${result.tabs.length} tabs`);
    return result;
  }

  /**
   * Close a tab
   */
  async closeTab(tabId) {
    console.log(`→ Closing tab: ${tabId}`);
    const result = await this.sendRequest('closeTab', { tabId });
    console.log('✓ Tab closed');
    return result;
  }

  /**
   * Close session (note: sessions auto-close on timeout, this is optional)
   */
  async closeSession() {
    if (this.sessionId) {
      console.log(`→ Closing WebSocket connection (session will expire on timeout)`);
      this.sessionId = null;
      return { closed: true };
    }
  }

  /**
   * Wait for a period of time
   */
  async wait(ms) {
    console.log(`⏱  Waiting ${ms}ms...`);
    await new Promise(resolve => setTimeout(resolve, ms));
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

  /**
   * Close WebSocket connection
   */
  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

module.exports = ChromePilotClient;
