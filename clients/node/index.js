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
    this.currentTabId = null;
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
   * Navigate to URL (opens in new tab and focuses it)
   */
  async navigate(url) {
    this.log(`→ Navigating to: ${url}`);
    const result = await this.sendRequest('openTab', { url, focus: true });
    this.log('✓ Navigation complete, result:', JSON.stringify(result, null, 2));
    this.currentTabId = result.tab.id;
    this.log(`✓ Current tab ID set to: ${this.currentTabId}`);
    return result;
  }

  /**
   * Execute JavaScript in the current tab
   */
  async executeJS(code, tabId = null) {
    const targetTabId = tabId || this.currentTabId;
    this.log(`→ Executing JS in tab ${targetTabId}: ${code.substring(0, 50)}...`);
    const result = await this.sendRequest('executeJS', { code, tabId: targetTabId });
    this.log(`✓ Result: ${JSON.stringify(result.value)}`);
    return result;
  }

  /**
   * Call a predefined helper function (for CSP-restricted pages)
   */
  async callHelper(functionName, args = [], tabId = null) {
    const targetTabId = tabId || this.currentTabId;
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
   * Wait for element (using polling with executeJS)
   */
  async waitForElement(selector, timeout = 10000) {
    this.log(`→ Waiting for element: ${selector}`);
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        const escapedSelector = selector.replace(/'/g, "\\'");
        const result = await this.executeJS(`document.querySelector('${escapedSelector}') !== null`);
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
   * Click element
   */
  async click(selector) {
    this.log(`→ Clicking element: ${selector}`);
    const escapedSelector = selector.replace(/'/g, "\\'");
    const code = `(function() {
      const el = document.querySelector('${escapedSelector}');
      if (!el) throw new Error('Element not found: ${escapedSelector}');
      el.click();
      return true;
    })()`;
    const result = await this.executeJS(code);
    this.log('✓ Click complete');
    return result;
  }

  /**
   * Type text into element
   */
  async type(selector, text) {
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
    const result = await this.executeJS(code);
    this.log('✓ Type complete');
    return result;
  }

  /**
   * Get element text
   */
  async getText(selector) {
    this.log(`→ Getting text from: ${selector}`);
    const escapedSelector = selector.replace(/'/g, "\\'");
    const code = `(function() {
      const el = document.querySelector('${escapedSelector}');
      if (!el) throw new Error('Element not found: ${escapedSelector}');
      return el.textContent;
    })()`;
    const result = await this.executeJS(code);
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
