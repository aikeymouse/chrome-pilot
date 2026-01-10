/**
 * ChromePilot - Side Panel UI
 */

// State
let port = null;
let sessions = new Map();
let currentSessionId = null;
let tabs = [];
let logs = [];
let logRetention = 100;
let countdownInterval = null;

// DOM Elements
const statusBadge = document.getElementById('status-badge');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const clientCount = document.getElementById('client-count');
const sessionSelector = document.getElementById('session-selector');
const sessionDetails = document.getElementById('session-details');
const sessionId = document.getElementById('session-id');
const sessionTimeout = document.getElementById('session-timeout');
const sessionRemaining = document.getElementById('session-remaining');
const tabsHeader = document.getElementById('tabs-header');
const tabsCount = document.getElementById('tabs-count');
const refreshTabsBtn = document.getElementById('refresh-tabs');
const tabsList = document.getElementById('tabs-list');
const logRetentionInput = document.getElementById('log-retention');
const clearLogsBtn = document.getElementById('clear-logs');
const logsContainer = document.getElementById('logs-container');

/**
 * Initialize
 */
function init() {
  // Load saved log retention
  chrome.storage.local.get(['logRetention'], (result) => {
    if (result.logRetention) {
      logRetention = result.logRetention;
      logRetentionInput.value = logRetention;
    }
  });
  
  // Connect to background worker
  connectToBackground();
  
  // Event listeners
  sessionSelector.addEventListener('change', onSessionChange);
  tabsHeader.addEventListener('click', toggleTabsList);
  refreshTabsBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent collapse toggle
    refreshTabs();
  });
  logRetentionInput.addEventListener('change', onLogRetentionChange);
  clearLogsBtn.addEventListener('click', clearLogs);
  
  // Start countdown timer
  startCountdownTimer();
}

/**
 * Connect to background service worker
 */
function connectToBackground() {
  try {
    port = chrome.runtime.connect({ name: 'sidepanel' });
    
    port.onMessage.addListener(handleBackgroundMessage);
    
    port.onDisconnect.addListener(() => {
      console.log('Disconnected from background');
      port = null;
      updateConnectionStatus(false);
      
      // Try to reconnect
      setTimeout(connectToBackground, 2000);
    });
    
    console.log('Connected to background worker');
    
    // Request current status
    port.postMessage({ action: 'getStatus' });
    
  } catch (err) {
    console.error('Failed to connect to background:', err);
    updateConnectionStatus(false);
    setTimeout(connectToBackground, 2000);
  }
}

/**
 * Handle messages from background worker
 */
function handleBackgroundMessage(message) {
  console.log('Message from background:', message);
  
  switch (message.type) {
    case 'nativeHostConnected':
      updateConnectionStatus(true);
      break;
      
    case 'nativeHostDisconnected':
      updateConnectionStatus(false, message.error);
      break;
      
    case 'status':
      updateConnectionStatus(message.connected);
      break;
      
    case 'tabUpdate':
      handleTabUpdate(message);
      break;
      
    case 'sessionsUpdate':
      handleSessionsUpdate(message);
      break;
      
    case 'sessionDetails':
      handleSessionDetails(message);
      break;
      
    case 'logEntry':
      handleLogEntry(message);
      break;
  }
}

/**
 * Update connection status
 */
function updateConnectionStatus(connected, error = null) {
  if (connected) {
    statusDot.className = 'status-dot connected';
    statusText.textContent = 'Connected';
    statusBadge.className = 'status-badge connected';
  } else {
    statusDot.className = 'status-dot disconnected';
    statusText.textContent = error || 'Disconnected';
    statusBadge.className = 'status-badge disconnected';
  }
}

/**
 * Handle tab updates
 */
function handleTabUpdate(message) {
  const { event, tab } = message;
  
  switch (event) {
    case 'created':
      tabs.push(tab);
      break;
      
    case 'updated':
      const updateIndex = tabs.findIndex(t => t.id === tab.id);
      if (updateIndex !== -1) {
        tabs[updateIndex] = tab;
      }
      break;
      
    case 'removed':
      tabs = tabs.filter(t => t.id !== tab.id);
      break;
      
    case 'activated':
      tabs.forEach(t => t.active = false);
      const activeIndex = tabs.findIndex(t => t.id === tab.id);
      if (activeIndex !== -1) {
        tabs[activeIndex].active = true;
      }
      break;
  }
  
  renderTabs();
}

/**
 * Handle session updates
 */
/**
 * Handle sessions update from background
 */
function handleSessionsUpdate(message) {
  console.log('Received sessionsUpdate:', message);
  const { sessions: sessionIds } = message;
  
  // Update connected clients count
  clientCount.textContent = sessionIds.length;
  
  // Update sessions display (but keep existing session details)
  sessionIds.forEach(id => {
    if (!sessions.has(id)) {
      sessions.set(id, { id, active: true });
    }
  });
  
  updateSessionsUI();
}

/**
 * Handle session details from background
 */
function handleSessionDetails(message) {
  const { session } = message;
  
  // Update or create session with full details
  sessions.set(session.id, session);
  
  // If this is the first or current session, select it
  if (!currentSessionId || currentSessionId === session.id) {
    currentSessionId = session.id;
    sessionSelector.value = session.id;
  }
  
  updateSessionsUI();
}

/**
 * Handle log entry from background
 */
function handleLogEntry(message) {
  const { log } = message;
  
  // Add log entry
  addLog(log);
}

/**
 * Update sessions UI
 */
function updateSessionsUI() {
  clientCount.textContent = sessions.size;
  
  // Update selector
  sessionSelector.innerHTML = '';
  
  if (sessions.size === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No active sessions';
    sessionSelector.appendChild(option);
    sessionSelector.disabled = true;
    sessionDetails.style.display = 'none';
  } else {
    sessionSelector.disabled = false;
    
    sessions.forEach((data, id) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = `Session ${id.substring(0, 8)}...`;
      if (id === currentSessionId) {
        option.selected = true;
      }
      sessionSelector.appendChild(option);
    });
    
    if (!currentSessionId && sessions.size > 0) {
      currentSessionId = sessions.keys().next().value;
      sessionSelector.value = currentSessionId;
    }
    
    updateSessionDetails();
  }
}

/**
 * Update session details
 */
function updateSessionDetails() {
  if (!currentSessionId || !sessions.has(currentSessionId)) {
    sessionDetails.style.display = 'none';
    return;
  }
  
  const session = sessions.get(currentSessionId);
  
  sessionDetails.style.display = 'block';
  sessionId.textContent = currentSessionId;
  sessionTimeout.textContent = formatDuration(session.timeout);
  
  updateRemainingTime();
}

/**
 * Update remaining time countdown
 */
function updateRemainingTime() {
  if (!currentSessionId || !sessions.has(currentSessionId)) {
    return;
  }
  
  const session = sessions.get(currentSessionId);
  const remaining = session.expiresAt - Date.now();
  
  if (remaining > 0) {
    sessionRemaining.textContent = formatDuration(remaining);
    sessionRemaining.className = remaining < 60000 ? 'warning' : '';
  } else {
    sessionRemaining.textContent = 'Expired';
    sessionRemaining.className = 'error';
  }
}

/**
 * Start countdown timer
 */
function startCountdownTimer() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  
  countdownInterval = setInterval(() => {
    updateRemainingTime();
  }, 1000);
}

/**
 * Session selector change
 */
function onSessionChange(e) {
  currentSessionId = e.target.value;
  updateSessionDetails();
  
  // Clear logs when switching sessions
  logs = [];
  renderLogs();
}

/**
 * Toggle tabs list collapse
 */
function toggleTabsList() {
  tabsList.classList.toggle('collapsed');
  tabsHeader.classList.toggle('collapsed');
}

/**
 * Refresh tabs
 */
async function refreshTabs() {
  try {
    const currentTabs = await chrome.tabs.query({ currentWindow: true });
    tabs = currentTabs.map(tab => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active,
      index: tab.index
    }));
    renderTabs();
  } catch (err) {
    console.error('Failed to refresh tabs:', err);
  }
}

/**
 * Render tabs list
 */
function renderTabs() {
  // Update tab count
  tabsCount.textContent = tabs.length;
  
  if (tabs.length === 0) {
    tabsList.innerHTML = '<div class="empty-state">No tabs in current window</div>';
    return;
  }
  
  const sortedTabs = [...tabs].sort((a, b) => a.index - b.index);
  
  tabsList.innerHTML = sortedTabs.map(tab => `
    <div class="tab-item ${tab.active ? 'active' : ''}">
      <div class="tab-header">
        <span class="tab-id">#${tab.id}</span>
        <span class="tab-title">${escapeHtml(tab.title || 'Untitled')}</span>
      </div>
      <div class="tab-url">${escapeHtml(tab.url || 'about:blank')}</div>
    </div>
  `).join('');
}

/**
 * Add log entry
 */
function addLog(log) {
  logs.push({
    ...log,
    timestamp: Date.now()
  });
  
  // Enforce retention limit (FIFO)
  if (logs.length > logRetention) {
    logs = logs.slice(logs.length - logRetention);
  }
  
  renderLogs();
}

/**
 * Render logs
 */
function renderLogs() {
  if (logs.length === 0) {
    logsContainer.innerHTML = '<div class="empty-state">No logs yet</div>';
    return;
  }
  
  logsContainer.innerHTML = logs.map((log, index) => {
    const time = new Date(log.timestamp).toLocaleTimeString();
    const direction = log.direction === 'in' ? 'request' : 'response';
    const data = typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2);
    
    return `
      <div class="log-entry ${direction}">
        <div class="log-header">
          <span class="log-time">${time}</span>
          <span class="log-direction">${direction.toUpperCase()}</span>
          <span class="log-index">#${index + 1}</span>
        </div>
        <pre class="log-data">${escapeHtml(data)}</pre>
      </div>
    `;
  }).join('');
  
  // Scroll to bottom
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

/**
 * Log retention change
 */
function onLogRetentionChange(e) {
  logRetention = parseInt(e.target.value);
  
  // Save to storage
  chrome.storage.local.set({ logRetention });
  
  // Apply to current logs
  if (logs.length > logRetention) {
    logs = logs.slice(logs.length - logRetention);
    renderLogs();
  }
}

/**
 * Clear logs
 */
function clearLogs() {
  logs = [];
  renderLogs();
}

/**
 * Utility: Format duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Utility: Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Initialize on load
 */
document.addEventListener('DOMContentLoaded', init);

// Initial refresh of tabs
setTimeout(refreshTabs, 500);
