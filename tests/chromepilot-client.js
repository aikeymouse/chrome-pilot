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
   */
  connect(url = 'ws://localhost:9000') {
    return new Promise((resolve, reject) => {
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
   * Close WebSocket connection
   */
  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = ChromePilotClient;
