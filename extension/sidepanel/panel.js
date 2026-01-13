/**
 * ChromePilot - Side Panel UI
 */

// State
let port = null;
let sessions = new Map();
let currentSessionId = null;
let tabs = [];
let allLogs = new Map(); // Store logs per session: sessionId -> logs array
let logRetention = 100;
let countdownInterval = null;

// DOM Elements
const statusBadge = document.getElementById('status-badge');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const clientCount = document.getElementById('client-count');
const removeExpiredBtn = document.getElementById('remove-expired-sessions');
const sessionSelectorWrapper = document.getElementById('session-selector-wrapper');
const sessionSelectorTrigger = document.getElementById('session-selector-trigger');
const sessionSelectorOptions = document.getElementById('session-selector-options');
const sessionDetails = document.getElementById('session-details');
const sessionId = document.getElementById('session-id');
const sessionTimeout = document.getElementById('session-timeout');
const tabsHeader = document.getElementById('tabs-header');
const tabsSectionTitle = document.getElementById('tabs-section-title');
const tabsCount = document.getElementById('tabs-count');
const refreshTabsBtn = document.getElementById('refresh-tabs');
const tabsList = document.getElementById('tabs-list');
const inspectBtn = document.getElementById('inspect-btn');
const exitInspectorBtn = document.getElementById('exit-inspector-btn');
const inspectedElementContainer = document.getElementById('inspected-element-container');
const inspectedElementContent = document.getElementById('inspected-element-content');
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
  sessionSelectorTrigger.addEventListener('click', toggleSessionSelector);
  removeExpiredBtn.addEventListener('click', removeExpiredSessions);
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!sessionSelectorWrapper.contains(e.target)) {
      sessionSelectorWrapper.classList.remove('open');
    }
  });
  tabsHeader.addEventListener('click', toggleTabsList);
  refreshTabsBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent collapse toggle
    refreshTabs();
  });
  inspectBtn.addEventListener('click', startInspectorMode);
  exitInspectorBtn.addEventListener('click', exitInspectorMode);
  logRetentionInput.addEventListener('change', onLogRetentionChange);
  clearLogsBtn.addEventListener('click', clearLogs);
  
  // Event delegation for log entry expand/collapse
  logsContainer.addEventListener('click', (e) => {
    const logHeader = e.target.closest('.log-header');
    if (logHeader) {
      logHeader.parentElement.classList.toggle('expanded');
    }
  });
  
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
      console.log('⏰ Received sessionDetails, expiresAt:', message.session.expiresAt, 'now:', Date.now());
      handleSessionDetails(message);
      break;
      
    case 'sessionExpired':
      handleSessionExpired(message);
      break;
      
    case 'logEntry':
      handleLogEntry(message);
      break;
      
    case 'elementClicked':
      console.log('📍 Element clicked message received!', message);
      handleElementClicked(message);
      break;
      
    default:
      console.warn('Unknown message type:', message.type);
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
  
  console.log('Updating session details:', session);
  
  // Update or create session with full details
  sessions.set(session.id, session);
  
  // Auto-select this session when it receives messages
  currentSessionId = session.id;
  
  // Force immediate UI update
  updateSessionsUI();
  updateSessionDetails();
}

/**
 * Handle session expired notification
 */
function handleSessionExpired(message) {
  const { sessionId } = message;
  
  console.log('Session expired:', sessionId);
  
  // Mark session as expired
  if (sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    session.active = false;
    session.expiresAt = Date.now(); // Already expired
    sessions.set(sessionId, session);
    
    // Update UI
    updateSessionsUI();
    
    // If this was the current session, clear selection
    if (currentSessionId === sessionId) {
      updateSessionDetails();
    }
  }
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
  // console.log('📊 Updating sessions UI, sessions:', Array.from(sessions.entries()));
  clientCount.textContent = sessions.size;
  
  // Clear options
  sessionSelectorOptions.innerHTML = '';
  
  if (sessions.size === 0) {
    sessionSelectorTrigger.querySelector('.session-name').textContent = 'No active sessions';
    sessionSelectorTrigger.querySelector('.session-status').textContent = '';
    sessionSelectorTrigger.classList.add('disabled');
    updateSessionDetails();
  } else {
    sessionSelectorTrigger.classList.remove('disabled');
    
    sessions.forEach((data, id) => {
      const option = document.createElement('div');
      option.className = 'custom-select-option';
      option.dataset.sessionId = id;
      
      const sessionName = document.createElement('span');
      sessionName.className = 'session-name';
      sessionName.textContent = `Session ${id}`;
      
      const sessionStatus = document.createElement('span');
      sessionStatus.className = 'session-status';
      
      // Format status/remaining time
      if (data.expiresAt) {
        const remaining = data.expiresAt - Date.now();
        if (remaining > 0) {
          console.log(`⏱️ Session ${id} remaining: ${remaining}ms (${formatDuration(remaining)})`);
          sessionStatus.textContent = formatDuration(remaining);
          if (remaining < 60000) {
            sessionStatus.classList.add('warning');
          }
        } else {
          sessionStatus.textContent = 'Expired';
          sessionStatus.classList.add('error');
        }
      } else if (data.active === false) {
        sessionStatus.textContent = 'Closed';
        sessionStatus.classList.add('error');
      }
      
      option.appendChild(sessionName);
      option.appendChild(sessionStatus);
      
      if (id === currentSessionId) {
        option.classList.add('selected');
        // Update trigger display
        sessionSelectorTrigger.querySelector('.session-name').textContent = sessionName.textContent;
        sessionSelectorTrigger.querySelector('.session-status').textContent = sessionStatus.textContent;
        sessionSelectorTrigger.querySelector('.session-status').className = 'session-status ' + sessionStatus.className.replace('session-status', '').trim();
      }
      
      option.addEventListener('click', () => selectSession(id));
      sessionSelectorOptions.appendChild(option);
    });
    
    if (!currentSessionId && sessions.size > 0) {
      const firstSessionId = sessions.keys().next().value;
      selectSession(firstSessionId);
    } else {
      updateSessionDetails();
    }
  }
}

/**
 * Update session details
 */
function updateSessionDetails() {
  if (!currentSessionId || !sessions.has(currentSessionId)) {
    sessionId.textContent = '';
    sessionId.style.background = 'transparent';
    sessionId.style.padding = '0';
    sessionTimeout.textContent = '';
    return;
  }
  
  const session = sessions.get(currentSessionId);
  
  sessionId.textContent = currentSessionId;
  sessionId.style.background = '';
  sessionId.style.padding = '';
  sessionTimeout.textContent = formatDuration(session.timeout);
}

/**
 * Update remaining time countdown
 */
function updateRemainingTime() {
  // Update session selector to show current remaining times
  updateSessionsUI();
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
 * Toggle session selector dropdown
 */
function toggleSessionSelector() {
  if (!sessionSelectorTrigger.classList.contains('disabled')) {
    sessionSelectorWrapper.classList.toggle('open');
  }
}

/**
 * Remove expired sessions
 */
function removeExpiredSessions() {
  const now = Date.now();
  let removedCount = 0;
  
  // Find and remove expired sessions
  for (const [sessionId, sessionData] of sessions.entries()) {
    const isExpired = sessionData.expiresAt && sessionData.expiresAt <= now;
    const isClosed = sessionData.active === false;
    
    if (isExpired || isClosed) {
      sessions.delete(sessionId);
      
      // Remove logs for this session
      if (allLogs.has(sessionId)) {
        allLogs.delete(sessionId);
      }
      
      removedCount++;
    }
  }
  
  if (removedCount > 0) {
    console.log(`Removed ${removedCount} expired session(s)`);
    
    // If current session was removed, clear selection
    if (!sessions.has(currentSessionId)) {
      currentSessionId = null;
    }
    
    // Update UI
    updateSessionsUI();
    updateSessionDetails();
    
    // If current session was removed, also clear logs display
    if (currentSessionId === null) {
      renderLogs();
    }
  } else {
    console.log('No expired sessions to remove');
  }
}

/**
 * Select a session
 */
function selectSession(sessionId) {
  currentSessionId = sessionId;
  sessionSelectorWrapper.classList.remove('open');
  
  // Render logs for the selected session
  renderLogs();
  
  updateSessionsUI();
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
  const { isInspectorMode, inspectorTabId } = getInspectorState();
  
  // In inspector mode, show only the current inspected tab
  let displayTabs = tabs;
  if (isInspectorMode && inspectorTabId) {
    displayTabs = tabs.filter(tab => tab.id === inspectorTabId);
    if (displayTabs.length === 0) {
      // Tab was closed, exit inspector mode
      exitInspectorMode();
      return;
    }
  }
  
  // Update tab count
  tabsCount.textContent = displayTabs.length;
  
  if (displayTabs.length === 0) {
    tabsList.innerHTML = '<div class="empty-state">No tabs in current window</div>';
    return;
  }
  
  const sortedTabs = [...displayTabs].sort((a, b) => a.index - b.index);
  
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
 * Truncate long dataUrl fields to prevent memory/display issues
 */
function truncateDataUrls(obj, maxLength = 50) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => truncateDataUrls(item, maxLength));
  }
  
  // Handle objects
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'dataUrl' && typeof value === 'string' && value.startsWith('data:image/')) {
      // Truncate dataUrl to first maxLength characters + '...'
      result[key] = value.substring(0, maxLength) + '...';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = truncateDataUrls(value, maxLength);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Add log entry
 */
function addLog(log) {
  // Get or create logs array for this session
  if (!allLogs.has(log.sessionId)) {
    allLogs.set(log.sessionId, []);
  }
  
  // Truncate dataUrl fields in the log data before storing
  const truncatedLog = {
    ...log,
    timestamp: Date.now(),
    data: truncateDataUrls(log.data)
  };
  
  const sessionLogs = allLogs.get(log.sessionId);
  sessionLogs.push(truncatedLog);
  
  // Enforce retention limit (FIFO) per session
  if (sessionLogs.length > logRetention) {
    allLogs.set(log.sessionId, sessionLogs.slice(sessionLogs.length - logRetention));
  }
  
  // Only render if this log is for the current session
  if (log.sessionId === currentSessionId) {
    renderLogs();
  }
}

/**
 * Render logs
 */
function renderLogs() {
  // Get logs for current session
  const logs = currentSessionId && allLogs.has(currentSessionId) ? allLogs.get(currentSessionId) : [];
  
  if (logs.length === 0) {
    logsContainer.innerHTML = '<div class="empty-state">No logs yet</div>';
    return;
  }
  
  logsContainer.innerHTML = logs.map((log, index) => {
    const time = new Date(log.timestamp).toLocaleTimeString();
    const direction = log.direction === 'in' ? 'request' : 'response';
    const data = typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2);
    
    // Parse data to extract action and requestId
    let parsedData = null;
    let actionBadge = '';
    let requestIdBadge = '';
    let hasError = false;
    
    try {
      parsedData = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
      
      if (direction === 'request' && parsedData.action) {
        actionBadge = `<span class="log-badge log-badge-action">${escapeHtml(parsedData.action)}</span>`;
      }
      
      if (parsedData.requestId) {
        requestIdBadge = `<span class="log-badge log-badge-requestid">${escapeHtml(parsedData.requestId)}</span>`;
      }
      
      // Check if response has error
      if (direction === 'response' && parsedData.error) {
        hasError = true;
      }
    } catch (e) {
      // If parsing fails, just show the raw data
    }
    
    return `
      <div class="log-entry ${direction} ${hasError ? 'error' : ''}">
        <div class="log-header">
          <span class="log-time">${time}</span>
          <span class="log-direction">${direction.toUpperCase()}</span>
          ${requestIdBadge}
          ${actionBadge}
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
  
  // Apply to current session logs
  if (currentSessionId && allLogs.has(currentSessionId)) {
    const logs = allLogs.get(currentSessionId);
    if (logs.length > logRetention) {
      allLogs.set(currentSessionId, logs.slice(logs.length - logRetention));
      renderLogs();
    }
  }
}

/**
 * Clear logs
 */
function clearLogs() {
  if (currentSessionId) {
    allLogs.set(currentSessionId, []);
  }
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

