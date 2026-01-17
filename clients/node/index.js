/**
 * ChromeLink WebSocket Client
 * Official Node.js client for ChromeLink browser automation
 * 
 * @license MIT
 * @see https://github.com/aikeymouse/chrome-link
 */

const WebSocket = require('ws');

class ChromeLinkClient {
  /**
   * Create a new ChromeLink client
   * @param {Object} options - Client options
   * @param {boolean} [options.verbose=true] - Enable verbose logging
   */
  constructor(options = {}) {
    this.verbose = options.verbose !== false;
    this.ws = null;
    this.sessionId = null;
    this.pendingRequests = new Map();
    this.requestCounter = 0;
    this.chunks = new Map(); // For chunked response assembly
  }

  /**
   * Internal logging method
   * @private
   */
  log(...args) {
    if (this.verbose) {
      console.log(...args);
    }
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
        this.log('✓ Connected to WebSocket server');
      });

      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        // Handle sessionCreated message
        if (message.type === 'sessionCreated') {
          this.sessionId = message.sessionId;
          this.log(`✓ Session created: ${this.sessionId}`);
          resolve();
          return;
        }
        
        // Handle sessionResumed message
        if (message.type === 'sessionResumed') {
          this.sessionId = message.sessionId;
          this.log(`✓ Session resumed: ${this.sessionId}`);
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
        this.log('✓ WebSocket connection closed');
      });
    });
  }

  /**
   * Handle incoming messages
   * @private
   */
  handleMessage(message) {
    this.log('← Received:', JSON.stringify(message, null, 2));

    // Handle chunked responses (for results >1MB)
    if (message.chunk !== undefined) {
      if (!this.chunks.has(message.requestId)) {
        this.chunks.set(message.requestId, new Array(message.totalChunks));
      }
      
      const chunksArray = this.chunks.get(message.requestId);
      chunksArray[message.chunkIndex] = message.chunk;
      
      // Check if all chunks received
      if (chunksArray.every(c => c !== undefined)) {
        // Assemble chunks
        const combined = chunksArray.join('');
        const decoded = Buffer.from(combined, 'base64').toString();
        const result = JSON.parse(decoded);
        this.chunks.delete(message.requestId);
        
        // Resolve the pending request
        const resolver = this.pendingRequests.get(message.requestId);
        if (resolver) {
          if (result.error) {
            resolver.reject(result.error);
          } else {
            resolver.resolve(result.result);
          }
          this.pendingRequests.delete(message.requestId);
        }
      }
      return;
    }

    // Handle response messages (either with type='response' or with requestId)
    if (message.type === 'response' || (message.requestId && message.hasOwnProperty('result'))) {
      const { requestId, result, error } = message;

      if (this.pendingRequests.has(requestId)) {
        const { resolve, reject } = this.pendingRequests.get(requestId);
        this.pendingRequests.delete(requestId);

        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    }
  }

  /**
   * Send request and wait for response
   * @private
   */
  sendRequest(action, params = {}) {
    return new Promise((resolve, reject) => {
      const requestId = `req-${Date.now()}-${++this.requestCounter}`;

      const message = {
        action,
        params,
        requestId
      };

      this.log('→ Sending:', JSON.stringify(message, null, 2));

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
    this.log(`✓ Using existing session: ${this.sessionId}`);
    return { sessionId: this.sessionId };
  }

  /**
   * Execute JavaScript in a tab
   * @param {string} code - JavaScript code to execute
   * @param {number} tabId - Tab ID to execute in
   * @returns {Promise<{value: any, type: string}>}
   * @example
   * const result = await client.executeJS('document.title', tabId);
   * console.log('Title:', result.value);
   */
  async executeJS(code, tabId) {
    const targetTabId = tabId;
    this.log(`→ Executing JS in tab ${targetTabId}: ${code.substring(0, 50)}...`);
    const result = await this.sendRequest('executeJS', { code, tabId: targetTabId });
    this.log(`✓ Result: ${JSON.stringify(result.value)}`);
    return result;
  }

  /**
   * Call a predefined helper function (for CSP-restricted pages)
   * @param {string} functionName - Helper function name
   * @param {Array} [args=[]] - Function arguments
   * @param {number} tabId - Tab ID to execute in
   * @returns {Promise<{value: any, type: string}>}
   * @example
   * await client.callHelper('clickElement', ['button.submit'], tabId);
   */
  async callHelper(functionName, args = [], tabId) {
    const targetTabId = tabId;
    this.log(`→ Calling helper: ${functionName}(${args.join(', ')})`);
    const result = await this.sendRequest('callHelper', { 
      functionName, 
      args, 
      tabId: targetTabId 
    });
    this.log(`✓ Result: ${JSON.stringify(result.value)}`);
    return result;
  }

  /**
   * Wait for element to appear in DOM
   * @param {string} selector - CSS selector
   * @param {number} [timeout=10000] - Max wait time in ms
   * @param {number} tabId - Tab ID to check in
   * @returns {Promise<{found: boolean}>}
   * @example
   * await client.waitForElement('div.loaded', 5000, tabId);
   */
  async waitForElement(selector, timeout = 10000, tabId) {
    this.log(`→ Waiting for element: ${selector}`);
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        const escapedSelector = selector.replace(/'/g, "\\'");
        const result = await this.executeJS(`document.querySelector('${escapedSelector}') !== null`, tabId);
        if (result.value === true) {
          this.log('✓ Element found');
          return { found: true };
        }
      } catch (err) {
        this.log(`  Retrying... (${err.message})`);
      }
      await this.wait(500);
    }
    
    throw new Error(`Element ${selector} not found within ${timeout}ms`);
  }

  /**
   * Click an element
   * @param {string} selector - CSS selector
   * @param {number} tabId - Tab ID to execute in
   * @returns {Promise<{value: boolean}>}
   * @example
   * await client.click('button.submit', tabId);
   */
  async click(selector, tabId) {
    this.log(`→ Clicking element: ${selector}`);
    const escapedSelector = selector.replace(/'/g, "\\'");
    const code = `(function() {
      const el = document.querySelector('${escapedSelector}');
      if (!el) throw new Error('Element not found: ${escapedSelector}');
      el.click();
      return true;
    })()`;
    const result = await this.executeJS(code, tabId);
    this.log('✓ Click complete');
    return result;
  }

  /**
   * Type text into element
   * @param {string} selector - CSS selector
   * @param {string} text - Text to type
   * @param {number} tabId - Tab ID to execute in
   * @returns {Promise<{value: boolean}>}
   * @example
   * await client.type('input[name="username"]', 'john_doe', tabId);
   */
  async type(selector, text, tabId) {
    this.log(`→ Typing "${text}" into: ${selector}`);
    const escapedSelector = selector.replace(/'/g, "\\'");
    const escapedText = text.replace(/'/g, "\\'");
    const code = `(function() {
      const el = document.querySelector('${escapedSelector}');
      if (!el) throw new Error('Element not found: ${escapedSelector}');
      el.value = '${escapedText}';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`;
    const result = await this.executeJS(code, tabId);
    this.log('✓ Type complete');
    return result;
  }

  /**
   * Get element text
   * @param {string} selector - CSS selector
   * @param {number} tabId - Tab ID to execute in
   * @returns {Promise<{value: string}>}
   * @example
   * const text = await client.getText('h1.title', tabId);
   */
  async getText(selector, tabId) {
    this.log(`→ Getting text from: ${selector}`);
    const escapedSelector = selector.replace(/'/g, "\\'");
    const code = `(function() {
      const el = document.querySelector('${escapedSelector}');
      if (!el) throw new Error('Element not found: ${escapedSelector}');
      return el.textContent;
    })()`;
    const result = await this.executeJS(code, tabId);
    this.log(`✓ Text: "${result.value}"`);
    return { text: result.value };
  }

  /**
   * List tabs
   */
  async listTabs() {
    this.log('→ Listing tabs');
    const result = await this.sendRequest('listTabs');
    this.log(`✓ Found ${result.tabs.length} tabs`);
    return result;
  }

  /**
   * Close a tab
   */
  async closeTab(tabId) {
    this.log(`→ Closing tab: ${tabId}`);
    const result = await this.sendRequest('closeTab', { tabId });
    this.log('✓ Tab closed');
    return result;
  }

  /**
   * Open a new tab with URL
   * @param {string} url - URL to open
   * @param {boolean} [focus=true] - Focus Chrome window before opening
   * @returns {Promise<{tab: Object}>} Tab object with id, url, title, etc.
   * @example
   * const result = await client.openTab('https://example.com');
   * console.log('Opened tab:', result.tab.id);
   */
  async openTab(url, focus = true) {
    this.log(`→ Opening new tab: ${url}`);
    const result = await this.sendRequest('openTab', { url, focus });
    this.log(`✓ Tab opened: ${result.tab.id}`);
    return result;
  }

  /**
   * Navigate an existing tab to a new URL
   * @param {number} tabId - Tab ID to navigate
   * @param {string} url - URL to navigate to
   * @param {boolean} [focus=true] - Focus Chrome window before navigating
   * @returns {Promise<{success: boolean, tabId: number}>}
   * @example
   * await client.navigateTab(123, 'https://github.com');
   */
  async navigateTab(tabId, url, focus = true) {
    this.log(`→ Navigating tab ${tabId} to: ${url}`);
    const result = await this.sendRequest('navigateTab', { tabId, url, focus });
    this.log('✓ Navigation complete');
    return result;
  }

  /**
   * Switch to (activate) a specific tab
   * @param {number} tabId - Tab ID to activate
   * @returns {Promise<{success: boolean, tabId: number}>}
   * @example
   * await client.switchTab(123);
   */
  async switchTab(tabId) {
    this.log(`→ Switching to tab: ${tabId}`);
    const result = await this.sendRequest('switchTab', { tabId });
    this.log('✓ Tab switched');
    return result;
  }

  /**
   * Go back in tab's browsing history
   * @param {number} tabId - Tab ID to navigate back
   * @returns {Promise<{success: boolean, tabId: number}>}
   * @example
   * await client.goBack(123);
   */
  async goBack(tabId) {
    this.log(`→ Going back in tab: ${tabId}`);
    const result = await this.sendRequest('goBack', { tabId });
    this.log('✓ Navigated back');
    return result;
  }

  /**
   * Go forward in tab's browsing history
   * @param {number} tabId - Tab ID to navigate forward
   * @returns {Promise<{success: boolean, tabId: number}>}
   * @example
   * await client.goForward(123);
   */
  async goForward(tabId) {
    this.log(`→ Going forward in tab: ${tabId}`);
    const result = await this.sendRequest('goForward', { tabId });
    this.log('✓ Navigated forward');
    return result;
  }

  /**
   * Capture screenshot of viewport or specific elements
   * @param {Object} [options={}] - Screenshot options
   * @param {number} [options.tabId] - Tab ID (uses active tab if omitted)
   * @param {string} [options.format='png'] - Image format: 'png' or 'jpeg'
   * @param {number} [options.quality=90] - JPEG quality 0-100
   * @param {string|string[]} [options.selectors] - CSS selector(s) for element screenshots
   * @returns {Promise<{dataUrl: string, bounds?: Object, elementCount?: number}>}
   * @example
   * // Viewport screenshot
   * const screenshot = await client.captureScreenshot({ tabId: 123 });
   * 
   * // Element screenshot
   * const elementShot = await client.captureScreenshot({ 
   *   tabId: 123, 
   *   selectors: ['h1', 'button.submit'] 
   * });
   */
  async captureScreenshot(options = {}) {
    const { tabId, format = 'png', quality = 90, selectors } = options;
    this.log(`→ Capturing screenshot${selectors ? ' of elements' : ''}`);
    const result = await this.sendRequest('captureScreenshot', {
      ...(tabId && { tabId }),
      format,
      quality,
      ...(selectors && { selectors })
    });
    this.log('✓ Screenshot captured');
    return result;
  }

  /**
   * Register script injection for URL patterns
   * @param {string} id - Unique identifier for this injection
   * @param {string} code - JavaScript code to inject
   * @param {string[]} [matches=['<all_urls>']] - URL patterns to inject on
   * @param {string} [runAt='document_start'] - When to inject: 'document_start', 'document_end', 'document_idle'
   * @returns {Promise<{registered: boolean, id: string}>}
   * @example
   * // Mock WebView2 API
   * await client.registerInjection(
   *   'webview2-mock',
   *   'window.chrome = window.chrome || {}; window.chrome.webview = { postMessage: () => {} };',
   *   ['https://my-app.com/*'],
   *   'document_start'
   * );
   */
  async registerInjection(id, code, matches = ['<all_urls>'], runAt = 'document_start') {
    this.log(`→ Registering injection: ${id}`);
    const result = await this.sendRequest('registerInjection', {
      id,
      code,
      matches,
      runAt
    });
    this.log('✓ Injection registered');
    return result;
  }

  /**
   * Unregister a previously registered script injection
   * @param {string} id - ID of the injection to remove
   * @returns {Promise<{unregistered: boolean, id: string}>}
   * @example
   * await client.unregisterInjection('webview2-mock');
   */
  async unregisterInjection(id) {
    this.log(`→ Unregistering injection: ${id}`);
    const result = await this.sendRequest('unregisterInjection', { id });
    this.log('✓ Injection unregistered');
    return result;
  }

  /**
   * Get the currently active tab
   * @returns {Promise<Object|null>} Active tab object or null if none active
   * @example
   * const activeTab = await client.getActiveTab();
   * if (activeTab) {
   *   console.log('Active tab:', activeTab.id, activeTab.url);
   * }
   */
  async getActiveTab() {
    this.log('→ Getting active tab');
    const { tabs } = await this.listTabs();
    const activeTab = tabs.find(tab => tab.active) || null;
    if (activeTab) {
      this.log(`✓ Active tab: ${activeTab.id}`);
    } else {
      this.log('✓ No active tab found');
    }
    return activeTab;
  }

  /**
   * Close session (note: sessions auto-close on timeout, this is optional)
   */
  async closeSession() {
    if (this.sessionId) {
      this.log(`→ Closing WebSocket connection (session will expire on timeout)`);
      this.sessionId = null;
      return { closed: true };
    }
  }

  /**
   * Wait for a period of time
   */
  async wait(ms) {
    this.log(`⏱  Waiting ${ms}ms...`);
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send a generic command to the extension
   * Allows calling any protocol command, including new ones not yet wrapped in the client
   * @param {string} command - Command name (e.g., 'callHelper', 'openTab', etc.)
   * @param {Object} params - Command parameters
   * @returns {Promise<Object>} Command response
   * @example
   * // Call a helper function
   * await client.sendCommand('callHelper', {
   *   tabId: 123,
   *   helperName: 'customHelper',
   *   args: ['arg1', 'arg2']
   * });
   * 
   * // Call any other command
   * await client.sendCommand('someNewCommand', {
   *   param1: 'value1',
   *   param2: 'value2'
   * });
   */
  async sendCommand(command, params = {}) {
    return this.sendRequest(command, params);
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

module.exports = ChromeLinkClient;
