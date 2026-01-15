/**
 * ChromePilot - Injection Modal
 */

// State: Map of sessionId -> array of injections
const sessionInjections = new Map();

// DOM Elements (will be initialized after DOM loads)
let injectionModalOverlay = null;
let injectionModalBody = null;
let injectionModalClose = null;
let currentModalSessionId = null;

/**
 * Initialize injection modal
 */
function setupInjectionModal() {
  injectionModalOverlay = document.getElementById('injection-modal-overlay');
  injectionModalBody = document.getElementById('injection-modal-body');
  injectionModalClose = document.getElementById('injection-modal-close');
  
  if (injectionModalClose) {
    injectionModalClose.addEventListener('click', closeInjectionModal);
  }
  
  if (injectionModalOverlay) {
    injectionModalOverlay.addEventListener('click', (e) => {
      if (e.target === injectionModalOverlay) {
        closeInjectionModal();
      }
    });
  }
}

/**
 * Handle injection registered event
 */
function handleInjectionRegistered(message) {
  const { sessionId, injection } = message;
  
  if (!sessionId) return;
  
  if (!sessionInjections.has(sessionId)) {
    sessionInjections.set(sessionId, []);
  }
  
  const injections = sessionInjections.get(sessionId);
  const existing = injections.find(inj => inj.id === injection.id);
  
  if (!existing) {
    injections.push({
      id: injection.id,
      code: injection.code,
      matches: injection.matches,
      runAt: injection.runAt,
      triggerCount: injection.triggerCount || 0
    });
    
    // Sort by ID alphabetically
    injections.sort((a, b) => a.id.localeCompare(b.id));
  }
  
  // Update UI
  updateSessionsUI();
  
  // Update modal if open for this session
  if (currentModalSessionId === sessionId) {
    updateModalContent(sessionId);
  }
}

/**
 * Handle injection triggered event
 */
function handleInjectionTriggered(message) {
  const { sessionId, id, triggerCount } = message;
  
  if (!sessionId || !sessionInjections.has(sessionId)) return;
  
  const injections = sessionInjections.get(sessionId);
  const injection = injections.find(inj => inj.id === id);
  
  if (injection) {
    injection.triggerCount = triggerCount;
    
    // Update modal if open for this session
    if (currentModalSessionId === sessionId) {
      updateModalContent(sessionId);
    }
  }
}

/**
 * Handle injection unregistered event
 */
function handleInjectionUnregistered(message) {
  const { sessionId, id } = message;
  
  if (!sessionId || !sessionInjections.has(sessionId)) return;
  
  const injections = sessionInjections.get(sessionId);
  const index = injections.findIndex(inj => inj.id === id);
  
  if (index !== -1) {
    injections.splice(index, 1);
    
    // Update UI
    updateSessionsUI();
    
    // Update modal if open for this session
    if (currentModalSessionId === sessionId) {
      updateModalContent(sessionId);
    }
  }
}

/**
 * Get injection count for a session
 */
function getSessionInjectionCount(sessionId) {
  if (!sessionInjections.has(sessionId)) {
    return 0;
  }
  return sessionInjections.get(sessionId).length;
}

/**
 * Check if session has any injections
 */
function hasInjections(sessionId) {
  return getSessionInjectionCount(sessionId) > 0;
}

/**
 * Show injection modal for a session
 */
function showInjectionModal(sessionId) {
  const count = getSessionInjectionCount(sessionId);
  
  // Don't open if no injections
  if (count === 0) {
    return;
  }
  
  currentModalSessionId = sessionId;
  updateModalContent(sessionId);
  
  if (injectionModalOverlay) {
    injectionModalOverlay.classList.add('open');
  }
}

/**
 * Close injection modal
 */
function closeInjectionModal() {
  currentModalSessionId = null;
  
  if (injectionModalOverlay) {
    injectionModalOverlay.classList.remove('open');
  }
}

/**
 * Update modal content
 */
function updateModalContent(sessionId) {
  if (!injectionModalBody) return;
  
  const injections = sessionInjections.get(sessionId) || [];
  
  if (injections.length === 0) {
    injectionModalBody.innerHTML = '<div class="injection-empty-state">No active injections</div>';
    return;
  }
  
  injectionModalBody.innerHTML = injections.map(injection => `
    <div class="injection-item">
      <div class="injection-item-header">
        <span class="injection-item-id">${escapeHtml(injection.id)}</span>
        <span class="injection-item-count">${injection.triggerCount} trigger${injection.triggerCount !== 1 ? 's' : ''}</span>
      </div>
      <div class="injection-item-meta">
        <span class="injection-item-meta-label">URL Pattern:</span>
        <span class="injection-item-meta-value">${escapeHtml(injection.matches.join(', '))}</span>
        <span class="injection-item-meta-label">Run At:</span>
        <span class="injection-item-meta-value">${escapeHtml(injection.runAt)}</span>
      </div>
      <div class="injection-item-code">${escapeHtml(injection.code)}</div>
    </div>
  `).join('');
}

/**
 * Clean up injections for a session
 */
function cleanupSessionInjections(sessionId) {
  sessionInjections.delete(sessionId);
  
  // Close modal if it was open for this session
  if (currentModalSessionId === sessionId) {
    closeInjectionModal();
  }
  
  // Update UI
  updateSessionsUI();
}

/**
 * Create injection indicator button
 */
function createInjectionIndicator(sessionId) {
  const count = getSessionInjectionCount(sessionId);
  const isActive = count > 0;
  
  const button = document.createElement('button');
  button.className = `injection-indicator ${isActive ? 'active' : 'disabled'}`;
  button.textContent = count.toString();
  
  // Create tooltip
  const tooltip = document.createElement('span');
  tooltip.className = 'injection-tooltip';
  tooltip.textContent = `${count} injection${count !== 1 ? 's' : ''}`;
  button.appendChild(tooltip);
  
  // Only allow click if active
  if (isActive) {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      showInjectionModal(sessionId);
    });
  }
  
  return button;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
