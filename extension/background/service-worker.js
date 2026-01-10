/**
 * ChromePilot - Background Service Worker
 * Bridges native messaging host with Chrome APIs
 */

// Native messaging host name
const NATIVE_HOST_NAME = 'com.chromepilot.extension';

// State
let nativePort = null;
let reconnectTimer = null;
let currentWindowId = null;
let tabCache = new Map();

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
      
      // Broadcast error to side panel
      broadcastToSidePanel({
        type: 'nativeHostDisconnected',
        error: chrome.runtime.lastError?.message || 'Connection lost'
      });
      
      // Attempt reconnection
      scheduleReconnect();
    });
    
    console.log('Connected to native host');
    
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
      case 'executeJS':
        result = await executeJS(params);
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
            // Execute code and return result
            const result = eval(code);
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
        args: [code]
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
      
      if (result.type === 'error') {
        reject({
          code: 'SCRIPT_ERROR',
          message: result.error
        });
        return;
      }
      
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
  sendNativeMessage({
    type: 'log',
    sessionId,
    timestamp: Date.now(),
    direction,
    data
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  tabCache.set(tabId, tab);
  
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
      }
    });
  }
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
