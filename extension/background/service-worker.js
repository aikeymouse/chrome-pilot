/**
 * ChromeLink - Background Service Worker
 * Bridges native messaging host with Chrome APIs
 */

// Native messaging host name
const NATIVE_HOST_NAME = 'com.chromelink.extension';

// State
let nativePort = null;
let reconnectTimer = null;
let keepaliveTimer = null;
let currentWindowId = null;
let tabCache = new Map();
const activeSessions = new Set(); // Track active session IDs
let inspectorTabId = null; // Track which tab has inspector mode enabled

/**
 * Send keepalive ping to native host
 */
function sendKeepalivePing() {
  if (nativePort) {
    try {
      nativePort.postMessage({
        type: 'ping',
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('Failed to send keepalive ping:', err);
    }
  }
}

/**
 * Start keepalive timer
 */
function startKeepalive() {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
  }
  // Send ping every 5 seconds (server timeout is 10 seconds)
  keepaliveTimer = setInterval(sendKeepalivePing, 5000);
}

/**
 * Stop keepalive timer
 */
function stopKeepalive() {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
}

/**
 * Connect to native messaging host
 */
function connectNativeHost() {
  console.log('Connecting to native host...');
  
  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    
    nativePort.onMessage.addListener(handleNativeMessage);
    
    nativePort.onDisconnect.addListener(() => {
      console.error('Native host disconnected:', chrome.runtime.lastError);
      nativePort = null;
      
      // Stop keepalive
      stopKeepalive();
      
      // Broadcast error to side panel
      broadcastToSidePanel({
        type: 'nativeHostDisconnected',
        error: chrome.runtime.lastError?.message || 'Connection lost'
      });
      
      // Attempt reconnection
      scheduleReconnect();
    });
    
    console.log('Connected to native host');
    
    // Start keepalive pings
    startKeepalive();
    
    // Broadcast connection status
    broadcastToSidePanel({
      type: 'nativeHostConnected'
    });
    
  } catch (err) {
    console.error('Failed to connect to native host:', err);
    scheduleReconnect();
  }
}

/**
 * Schedule reconnection attempt
 */
function scheduleReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  
  reconnectTimer = setTimeout(() => {
    connectNativeHost();
  }, 5000); // Retry every 5 seconds
}

/**
 * Handle messages from native host
 */
async function handleNativeMessage(message) {
  console.log('Message from native host:', message);
  
  if (message.type === 'ready') {
    console.log('Native host ready on port', message.port);
    
    // Send acknowledgment back to native host
    if (nativePort) {
      nativePort.postMessage({
        type: 'extensionReady',
        extensionId: chrome.runtime.id
      });
    }
    return;
  }
  
  if (message.type === 'sessionCreated') {
    // New session created, add to tracking
    if (!activeSessions.has(message.sessionId)) {
      activeSessions.add(message.sessionId);
      broadcastSessionUpdate();
    }
    
    // Broadcast session details to side panel
    broadcastToSidePanel({
      type: 'sessionDetails',
      session: {
        id: message.sessionId,
        timeout: message.timeout,
        expiresAt: message.expiresAt
      }
    });
    return;
  }
  
  if (message.type === 'sessionUpdated') {
    // Session activity updated, refresh expiration time in UI
    broadcastToSidePanel({
      type: 'sessionDetails',
      session: {
        id: message.sessionId,
        timeout: message.timeout,
        expiresAt: message.expiresAt
      }
    });
    return;
  }
  
  if (message.type === 'sessionExpired') {
    // Session expired, remove from tracking
    activeSessions.delete(message.sessionId);
    broadcastSessionUpdate();
    
    // Clean up all injections associated with this session
    cleanupSessionInjections(message.sessionId);
    
    // Notify side panel
    broadcastToSidePanel({
      type: 'sessionExpired',
      sessionId: message.sessionId
    });
    return;
  }
  
  if (message.type === 'command') {
    await handleCommand(message.sessionId, message.command);
  }
}

/**
 * Handle commands from WebSocket clients (via native host)
 */
async function handleCommand(sessionId, command) {
  const { action, params, requestId } = command;
  
  console.log(`Executing command: ${action}`, params);
  
  // Track this session
  if (!activeSessions.has(sessionId)) {
    activeSessions.add(sessionId);
    broadcastSessionUpdate();
  }
  
  // Log to native host
  sendLog(sessionId, 'in', command);
  
  try {
    let result = null;
    
    switch (action) {
      case 'listTabs':
        result = await listTabs(params);
        break;
      case 'openTab':
        result = await openTab(params);
        break;
      case 'navigateTab':
        result = await navigateTab(params);
        break;
      case 'switchTab':
        result = await switchTab(params);
        break;
      case 'closeTab':
        result = await closeTab(params);
        break;
      case 'goBack':
        result = await goBack(params);
        break;
      case 'goForward':
        result = await goForward(params);
        break;
      case 'callHelper':
        result = await callHelper(params);
        break;
      case 'executeJS':
        result = await executeJS(params);
        break;
      case 'captureScreenshot':
        result = await captureScreenshot(params);
        break;
      case 'enableInspector':
        result = await enableInspector(params);
        break;
      case 'disableInspector':
        result = await disableInspector(params);
        break;
      case 'registerInjection':
        result = await registerInjection({ ...params, sessionId });
        break;
      case 'unregisterInjection':
        result = await unregisterInjection(params);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    // Send response
    const response = {
      type: 'response',
      sessionId,
      requestId,
      result,
      error: null
    };
    
    sendLog(sessionId, 'out', response);
    sendNativeMessage(response);
    
  } catch (err) {
    console.error('Command error:', err);
    
    const response = {
      type: 'response',
      sessionId,
      requestId,
      result: null,
      error: {
        code: err.code || 'EXECUTION_ERROR',
        message: err.message
      }
    };
    
    sendLog(sessionId, 'out', response);
    sendNativeMessage(response);
  }
}

/**
 * Command Implementations
 */

async function listTabs(params) {
  const windowId = await getCurrentWindowId();
  const tabs = await chrome.tabs.query({ windowId });
  
  return {
    tabs: tabs.map(tab => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active,
      index: tab.index
    })),
    windowId
  };
}

async function openTab(params) {
  const { url, focus = false } = params;
  
  if (!url) {
    throw { code: 'MISSING_PARAMS', message: 'Missing required parameter: url' };
  }
  
  const windowId = await getCurrentWindowId();
  
  if (focus) {
    await chrome.windows.update(windowId, { focused: true });
  }
  
  const tab = await chrome.tabs.create({
    url,
    windowId,
    active: focus
  });
  
  return {
    tab: {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active,
      index: tab.index
    }
  };
}

async function navigateTab(params) {
  const { tabId, url, focus = false } = params;
  
  if (!tabId || !url) {
    throw { code: 'MISSING_PARAMS', message: 'Missing required parameters: tabId, url' };
  }
  
  // Validate tab exists
  try {
    await chrome.tabs.get(tabId);
  } catch (err) {
    throw { code: 'TAB_NOT_FOUND', message: `Tab with ID ${tabId} not found or was closed` };
  }
  
  if (focus) {
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
  }
  
  await chrome.tabs.update(tabId, { url });
  
  return {
    success: true,
    tabId
  };
}

async function switchTab(params) {
  const { tabId } = params;
  
  if (!tabId) {
    throw { code: 'MISSING_PARAMS', message: 'Missing required parameter: tabId' };
  }
  
  // Validate tab exists
  try {
    await chrome.tabs.get(tabId);
  } catch (err) {
    throw { code: 'TAB_NOT_FOUND', message: `Tab with ID ${tabId} not found or was closed` };
  }
  
  await chrome.tabs.update(tabId, { active: true });
  
  return {
    success: true,
    tabId
  };
}

/**
 * Close a tab
 */
async function closeTab(params) {
  const { tabId } = params;
  
  if (!tabId) {
    throw { code: 'MISSING_PARAMS', message: 'Missing required parameter: tabId' };
  }
  
  // Validate tab exists
  try {
    await chrome.tabs.get(tabId);
  } catch (err) {
    throw { code: 'TAB_NOT_FOUND', message: `Tab with ID ${tabId} not found or was closed` };
  }
  
  await chrome.tabs.remove(tabId);
  
  return {
    success: true,
    tabId
  };
}

/**
 * Navigate back in tab history
 */
async function goBack(params) {
  const { tabId } = params;
  
  if (!tabId) {
    throw { code: 'MISSING_PARAMS', message: 'Missing required parameter: tabId' };
  }
  
  // Validate tab exists
  try {
    await chrome.tabs.get(tabId);
  } catch (err) {
    throw { code: 'TAB_NOT_FOUND', message: `Tab with ID ${tabId} not found or was closed` };
  }
  
  try {
    await chrome.tabs.goBack(tabId);
  } catch (err) {
    // Chrome throws error if no history to go back to
    // Return success: false instead of throwing
    return {
      success: false,
      tabId,
      message: 'No previous page in history'
    };
  }
  
  return {
    success: true,
    tabId
  };
}

/**
 * Navigate forward in tab history
 */
async function goForward(params) {
  const { tabId } = params;
  
  if (!tabId) {
    throw { code: 'MISSING_PARAMS', message: 'Missing required parameter: tabId' };
  }
  
  // Validate tab exists
  try {
    await chrome.tabs.get(tabId);
  } catch (err) {
    throw { code: 'TAB_NOT_FOUND', message: `Tab with ID ${tabId} not found or was closed` };
  }
  
  try {
    await chrome.tabs.goForward(tabId);
  } catch (err) {
    // Chrome throws error if no history to go forward to
    // Return success: false instead of throwing
    return {
      success: false,
      tabId,
      message: 'No next page in history'
    };
  }
  
  return {
    success: true,
    tabId
  };
}

/**
 * Call a predefined helper function (for CSP-restricted pages)
 */
async function callHelper(params) {
  let { tabId, functionName, args = [], timeout = 30000, focus = false, _internal = false } = params;
  
  if (!functionName) {
    throw { code: 'MISSING_PARAMS', message: 'Missing required parameter: functionName' };
  }
  
  // Prevent external clients from calling internal functions (prefixed with _internal_)
  // Internal service-worker code can bypass this check
  if (!_internal && functionName.startsWith('_internal_')) {
    throw { 
      code: 'PERMISSION_DENIED', 
      message: `Function '${functionName}' is restricted to internal use only. Use public API functions like 'inspectElement' instead.` 
    };
  }
  
  // If no tabId, use active tab
  if (!tabId) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      throw { code: 'TAB_NOT_FOUND', message: 'No active tab found' };
    }
    tabId = tabs[0].id;
  }
  
  // Validate tab exists
  try {
    await chrome.tabs.get(tabId);
  } catch (err) {
    throw { code: 'TAB_NOT_FOUND', message: `Tab with ID ${tabId} not found or was closed` };
  }
  
  if (focus) {
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
  }
  
  // First, ensure dom-helper.js is injected
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/dom-helper.js'],
      world: 'MAIN'
    });
  } catch (err) {
    // Might already be injected, that's okay
    console.log('dom-helper.js injection note:', err.message);
  }
  
  // Now call the helper function
  const result = await callHelperWithTimeout(tabId, functionName, args, timeout);
  return result;
}

async function executeJS(params) {
  let { tabId, code, timeout = 30000, focus = false } = params;
  
  if (!code) {
    throw { code: 'MISSING_PARAMS', message: 'Missing required parameter: code' };
  }
  
  // If no tabId, use active tab
  if (!tabId) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      throw { code: 'TAB_NOT_FOUND', message: 'No active tab found' };
    }
    tabId = tabs[0].id;
  }
  
  // Validate tab exists
  try {
    await chrome.tabs.get(tabId);
  } catch (err) {
    throw { code: 'TAB_NOT_FOUND', message: `Tab with ID ${tabId} not found or was closed` };
  }
  
  if (focus) {
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
  }
  
  // Execute with timeout
  const result = await executeScriptWithTimeout(tabId, code, timeout);
  
  return result;
}

async function captureScreenshot(params) {
  let { tabId, format = 'png', quality = 90, selectors } = params;
  
  // If no tabId, use active tab
  if (!tabId) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      throw { code: 'TAB_NOT_FOUND', message: 'No active tab found' };
    }
    tabId = tabs[0].id;
  }
  
  // Validate tab exists and get window ID
  let windowId;
  try {
    const tab = await chrome.tabs.get(tabId);
    windowId = tab.windowId;
    
    // Make sure the tab is active and window is focused
    if (!tab.active) {
      await chrome.tabs.update(tabId, { active: true });
    }
    await chrome.windows.update(windowId, { focused: true });
    
    // Wait a bit for the tab to become visible
    await new Promise(resolve => setTimeout(resolve, 100));
    
  } catch (err) {
    throw { code: 'TAB_NOT_FOUND', message: `Tab with ID ${tabId} not found or was closed` };
  }
  
  // If selectors provided, get bounds and crop to combined area
  if (selectors) {
    // Normalize to array
    const selectorsArray = Array.isArray(selectors) ? selectors : [selectors];
    
    // Get element bounds for all selectors
    const allBounds = [];
    const notFoundSelectors = [];
    
    for (const sel of selectorsArray) {
      const boundsResult = await callHelper({
        tabId,
        functionName: 'getElementBounds',
        args: [sel]
      });
      
      if (boundsResult.value && boundsResult.value.length > 0) {
        allBounds.push(...boundsResult.value);
      } else {
        notFoundSelectors.push(sel);
      }
    }
    
    // Throw error if ANY selector was not found
    if (notFoundSelectors.length > 0) {
      throw {
        code: 'ELEMENTS_NOT_FOUND',
        message: `No elements found matching selectors: ${notFoundSelectors.join(', ')}`
      };
    }
    
    // Capture viewport
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: format === 'jpeg' ? 'jpeg' : 'png',
      quality: format === 'jpeg' ? quality : undefined
    });
    
    // Crop to combined bounding box
    const cropResult = await callHelper({
      tabId,
      functionName: '_internal_cropScreenshotToElements',
      args: [dataUrl, allBounds],
      _internal: true
    });
    
    return cropResult.value;
  }
  
  // No selector - return full viewport
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
    format: format === 'jpeg' ? 'jpeg' : 'png',
    quality: format === 'jpeg' ? quality : undefined
  });
  
  return { dataUrl };
}

/**
 * Execute script with timeout
 */
async function executeScriptWithTimeout(tabId, code, timeout) {
  return new Promise(async (resolve, reject) => {
    const timer = setTimeout(() => {
      reject({
        code: 'EXECUTION_TIMEOUT',
        message: `Script execution exceeded timeout of ${timeout}ms`
      });
    }, timeout);
    
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (code) => {
          try {
            // Use Function constructor instead of eval to avoid CSP issues
            const fn = new Function('return (' + code + ')');
            const result = fn();
            return {
              value: result,
              type: typeof result
            };
          } catch (err) {
            return {
              error: err.message,
              type: 'error'
            };
          }
        },
        args: [code],
        world: 'MAIN' // Execute in page context, not isolated world
      });
      
      clearTimeout(timer);
      
      if (!results || results.length === 0) {
        reject({
          code: 'EXECUTION_ERROR',
          message: 'No result returned from script'
        });
        return;
      }
      
      const result = results[0].result;
      resolve(result);
      
    } catch (err) {
      clearTimeout(timer);
      
      reject({
        code: 'EXECUTION_ERROR',
        message: err.message
      });
    }
  });
}

/**
 * Call helper function with timeout
 */
async function callHelperWithTimeout(tabId, functionName, args, timeout) {
  return new Promise(async (resolve, reject) => {
    const timer = setTimeout(() => {
      reject({
        code: 'EXECUTION_TIMEOUT',
        message: `Helper function execution exceeded timeout of ${timeout}ms`
      });
    }, timeout);
    
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: async (fnName, fnArgs) => {
          // Validate and call function inside try-catch
          try {
            if (!window.__chromeLinkHelper) {
              throw new Error('ChromeLink helper not loaded');
            }
            
            const fn = window.__chromeLinkHelper[fnName];
            if (!fn) {
              throw new Error(`Helper function not found: ${fnName}`);
            }
            
            const result = fn(...fnArgs);
            // Handle promises by checking for then method
            const value = (result && typeof result.then === 'function') 
              ? await result 
              : result;
            return { success: true, value };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        args: [functionName, args],
        world: 'MAIN'
      });
      
      clearTimeout(timer);
      
      if (!results || results.length === 0) {
        reject({
          code: 'EXECUTION_ERROR',
          message: 'No result returned from helper function'
        });
        return;
      }
      
      const result = results[0].result;
      
      // Check if the function execution failed
      if (result && result.success === false) {
        reject({
          code: 'EXECUTION_ERROR',
          message: result.error || 'Helper function execution failed'
        });
        return;
      }
      
      // Extract the actual value
      const actualValue = result && result.success ? result.value : result;
      
      resolve({
        value: actualValue,
        type: typeof actualValue
      });
      
    } catch (err) {
      clearTimeout(timer);
      
      reject({
        code: 'EXECUTION_ERROR',
        message: err.message
      });
    }
  });
}

/**
 * Helper: Get current window ID
 */
async function getCurrentWindowId() {
  if (currentWindowId) {
    try {
      await chrome.windows.get(currentWindowId);
      return currentWindowId;
    } catch (err) {
      // Window no longer exists
      currentWindowId = null;
    }
  }
  
  const window = await chrome.windows.getCurrent();
  currentWindowId = window.id;
  return currentWindowId;
}

/**
 * Send message to native host
 */
function sendNativeMessage(message) {
  if (nativePort) {
    nativePort.postMessage(message);
  } else {
    console.error('Cannot send message: not connected to native host');
  }
}

/**
 * Send log event to native host
 */
function sendLog(sessionId, direction, data) {
  const logEntry = {
    type: 'log',
    sessionId,
    timestamp: Date.now(),
    direction,
    data
  };
  
  // Send to native host
  sendNativeMessage(logEntry);
  
  // Also broadcast to side panel
  broadcastToSidePanel({
    type: 'logEntry',
    log: {
      timestamp: Date.now(),
      direction: direction, // 'in' or 'out'
      data: data,
      sessionId
    }
  });
}

/**
 * Broadcast to side panel
 */
const sidePanelPorts = new Set();

function broadcastToSidePanel(message) {
  sidePanelPorts.forEach(port => {
    try {
      port.postMessage(message);
    } catch (err) {
      console.error('Error broadcasting to side panel:', err);
      sidePanelPorts.delete(port);
    }
  });
}

function broadcastSessionUpdate() {
  broadcastToSidePanel({
    type: 'sessionsUpdate',
    sessions: Array.from(activeSessions)
  });
}

function broadcastSessionUpdate() {
  broadcastToSidePanel({
    type: 'sessionsUpdate',
    sessions: Array.from(activeSessions)
  });
}

/**
 * Inspector Mode Functions
 */

/**
 * Enable inspector mode on a tab
 */
async function enableInspector(params) {
  let { tabId } = params;
  
  // If no tabId, use active tab
  if (!tabId) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      throw { code: 'TAB_NOT_FOUND', message: 'No active tab found' };
    }
    tabId = tabs[0].id;
  }
  
  try {
    // Inject inspector bridge (ISOLATED world) to relay messages - in all frames
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content/inspector-bridge.js'],
      world: 'ISOLATED'
    });
    
    // Inject dom-helper.js (MAIN world) if not already injected - in all frames
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content/dom-helper.js'],
      world: 'MAIN'
    });
    
    // Enable click tracking - in all frames
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => window.__chromeLinkHelper._internal_enableClickTracking(),
      world: 'MAIN'
    });
    
    // Track inspector state
    inspectorTabId = tabId;
    
    console.log('Inspector enabled on tab:', tabId);
    return { enabled: true, tabId };
  } catch (error) {
    console.error('Failed to enable inspector:', error);
    throw { code: 'INSPECTOR_ERROR', message: `Failed to enable inspector: ${error.message}` };
  }
}

/**
 * Disable inspector mode on a tab
 */
async function disableInspector(params) {
  let { tabId } = params;
  
  // If no tabId, use active tab
  if (!tabId) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      throw { code: 'TAB_NOT_FOUND', message: 'No active tab found' };
    }
    tabId = tabs[0].id;
  }
  
  try {
    // Disable click tracking - in all frames
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => window.__chromeLinkHelper._internal_disableClickTracking(),
      world: 'MAIN'
    });
    
    // Clear inspector state if this was the inspector tab
    if (inspectorTabId === tabId) {
      inspectorTabId = null;
    }
    
    return { disabled: true, tabId };
  } catch (error) {
    // Ignore errors if script not injected or tab closed
    console.warn('Failed to disable inspector:', error);
    return { disabled: true, tabId };
  }
}

// Track registered injections
const registeredInjections = new Map();

/**
 * Register early script injection for WebView2 testing and page mocking
 * 
 * IMPORTANT: Due to Chrome Manifest V3 limitations, registerContentScripts only
 * accepts file paths, not inline code. We use executeScript with injectImmediately
 * which provides "best effort" early injection but cannot guarantee execution
 * before inline <script> tags in the page HTML.
 * 
 * For WebView2 auth scenarios requiring guaranteed timing, use chrome.webRequest
 * API to inject auth headers instead of mocking the bridge function.
 */
async function registerInjection(params) {
  const { id, code, matches = ['<all_urls>'], runAt = 'document_start', sessionId } = params;
  
  if (!id || !code) {
    throw { code: 'MISSING_PARAMS', message: 'Missing required parameters: id, code' };
  }
  
  try {
    // Store injection metadata
    registeredInjections.set(id, {
      code,
      matches,
      runAt,
      active: true,
      sessionId: sessionId || null
    });
    
    // Listen for tab updates to inject at earliest possible moment
    const listener = async (tabId, changeInfo, tab) => {
      const injection = registeredInjections.get(id);
      if (!injection || !injection.active) return;
      
      // Check if URL matches
      const urlMatches = injection.matches.some(pattern => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$');
        return regex.test(tab.url || '');
      });
      
      // Inject on URL change (earlier than status='loading') or at appropriate runAt timing
      const shouldInject = urlMatches && (
        (changeInfo.url && injection.runAt === 'document_start') ||
        (changeInfo.status === 'loading' && injection.runAt === 'document_end') ||
        (changeInfo.status === 'complete' && injection.runAt === 'document_idle')
      );
      
      if (shouldInject) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId, allFrames: true },
            world: 'MAIN',
            injectImmediately: true,
            func: (codeToRun) => {
              // Use indirect eval to run in global scope
              (1, eval)(codeToRun);
            },
            args: [injection.code]
          });
          console.log('Injected script into tab', tabId, tab.url, 'at', injection.runAt);
        } catch (err) {
          console.warn('Injection failed for tab', tabId, err.message);
        }
      }
    };
    
    // Store listener reference for cleanup
    registeredInjections.get(id).listener = listener;
    chrome.tabs.onUpdated.addListener(listener);
    
    console.log('Registered script injection:', id, 'matches:', matches, 'runAt:', runAt);
    
    // Broadcast to side panel
    if (sessionId) {
      broadcastToSidePanel({
        type: 'injectionRegistered',
        sessionId: sessionId,
        injection: {
          id,
          code,
          matches,
          runAt
        }
      });
    }
    
    return { registered: true, id };
  } catch (error) {
    console.error('Failed to register injection:', error);
    throw { code: 'INJECTION_ERROR', message: `Failed to register injection: ${error.message}` };
  }
}

/**
 * Unregister script injection
 */
async function unregisterInjection(params) {
  const { id } = params;
  
  if (!id) {
    throw { code: 'MISSING_PARAMS', message: 'Missing required parameter: id' };
  }
  
  try {
    const injection = registeredInjections.get(id);
    if (!injection) {
      throw new Error(`Content script with ID '${id}' not found`);
    }
    
    // Mark as inactive and remove listener
    injection.active = false;
    if (injection.listener) {
      chrome.tabs.onUpdated.removeListener(injection.listener);
    }
    registeredInjections.delete(id);
    
    // Broadcast to side panel
    if (injection.sessionId) {
      broadcastToSidePanel({
        type: 'injectionUnregistered',
        sessionId: injection.sessionId,
        id: id
      });
    }
    
    console.log('Unregistered script injection:', id);
    return { unregistered: true, id };
  } catch (error) {
    console.error('Failed to unregister injection:', error);
    throw { code: 'INJECTION_ERROR', message: `Failed to unregister injection: ${error.message}` };
  }
}

/**
 * Clean up all injections associated with a session
 */
function cleanupSessionInjections(sessionId) {
  for (const [id, injection] of registeredInjections.entries()) {
    if (injection.sessionId === sessionId) {
      injection.active = false;
      if (injection.listener) {
        chrome.tabs.onUpdated.removeListener(injection.listener);
      }
      registeredInjections.delete(id);
      console.log('Cleaned up injection:', id, 'for expired session:', sessionId);
    }
  }
}
/**
 * Tab event listeners
 */
chrome.tabs.onCreated.addListener((tab) => {
  tabCache.set(tab.id, tab);
  
  sendNativeMessage({
    type: 'tabUpdate',
    event: 'created',
    tab: {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active
    }
  });
  
  broadcastToSidePanel({
    type: 'tabUpdate',
    event: 'created',
    tab: {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active
    }
  });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  tabCache.set(tabId, tab);
  
  // Re-inject inspector if this tab has inspector mode enabled and page has loaded
  if (inspectorTabId === tabId && changeInfo.status === 'complete') {
    try {
      await enableInspector({ tabId });
      console.log('Re-injected inspector scripts on tab navigation:', tabId);
    } catch (error) {
      console.error('Failed to re-inject inspector:', error);
    }
  }
  
  sendNativeMessage({
    type: 'tabUpdate',
    event: 'updated',
    tab: {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active
    }
  });
  
  broadcastToSidePanel({
    type: 'tabUpdate',
    event: 'updated',
    tab: {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active
    }
  });
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  const tab = tabCache.get(tabId);
  tabCache.delete(tabId);
  
  // Clear inspector state if this was the inspector tab
  if (inspectorTabId === tabId) {
    inspectorTabId = null;
  }
  
  sendNativeMessage({
    type: 'tabUpdate',
    event: 'removed',
    tab: {
      id: tabId,
      url: tab?.url,
      title: tab?.title,
      active: false
    }
  });
  
  broadcastToSidePanel({
    type: 'tabUpdate',
    event: 'removed',
    tab: {
      id: tabId,
      url: tab?.url,
      title: tab?.title,
      active: false
    }
  });
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  
  sendNativeMessage({
    type: 'tabUpdate',
    event: 'activated',
    tab: {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active
    }
  });
  
  broadcastToSidePanel({
    type: 'tabUpdate',
    event: 'activated',
    tab: {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active
    }
  });
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    currentWindowId = windowId;
  }
});

/**
 * Side panel communication
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    console.log('Side panel connected');
    sidePanelPorts.add(port);
    
    // Send current connection status
    port.postMessage({
      type: nativePort ? 'nativeHostConnected' : 'nativeHostDisconnected'
    });
    
    // Send current sessions
    port.postMessage({
      type: 'sessionsUpdate',
      sessions: Array.from(activeSessions)
    });
    
    port.onDisconnect.addListener(() => {
      console.log('Side panel disconnected');
      sidePanelPorts.delete(port);
    });
    
    port.onMessage.addListener(async (message) => {
      // Handle messages from side panel if needed
      if (message.action === 'getStatus') {
        port.postMessage({
          type: 'status',
          connected: !!nativePort
        });
      } else if (message.action === 'enableInspector') {
        try {
          await enableInspector({ tabId: message.tabId });
        } catch (error) {
          console.error('Failed to enable inspector:', error);
        }
      } else if (message.action === 'disableInspector') {
        try {
          await disableInspector({ tabId: message.tabId });
        } catch (error) {
          console.error('Failed to disable inspector:', error);
        }
      }
    });
  }
});

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message from content script:', message, 'sender:', sender);
  if (message.type === 'elementClicked') {
    console.log('Element clicked, forwarding to side panel');
    // Forward element clicked event to side panel
    broadcastToSidePanel({
      type: 'elementClicked',
      element: message.element,
      tabId: sender.tab?.id
    });
  }
  return false;
});

/**
 * Extension lifecycle
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  connectNativeHost();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
  connectNativeHost();
});

// Handle extension updates
chrome.runtime.onUpdateAvailable.addListener((details) => {
  console.log('Update available:', details.version);
  
  // Notify native host to prepare for restart
  sendNativeMessage({
    type: 'extensionUpdating',
    version: details.version
  });
});

/**
 * Initialize
 */
connectNativeHost();
