/**
 * ChromeLink - Inspector Mode Module
 */

// Inspector state
let isInspectorMode = false;
let inspectorTabId = null;
let inspectedElement = null;
let selectedTreeElement = null; // Currently selected element in tree
let inspectedFrameId = 0; // Frame ID where the last click occurred (0 = main frame)
let xrayMode = true; // X-ray mode active by default

/**
 * Start inspector mode
 */
async function startInspectorMode() {
  try {
    // Get active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      console.error('No active tab found');
      return;
    }
    
    inspectorTabId = activeTab.id;
    isInspectorMode = true;
    
    // Add inspector mode class to body
    document.body.classList.add('inspector-mode');
    
    // Hide other sections
    document.getElementById('clients-section').style.display = 'none';
    document.getElementById('logs-section').style.display = 'none';
    
    // Update UI
    const tabsSectionTitle = document.getElementById('tabs-section-title');
    const inspectBtn = document.getElementById('inspect-btn');
    const exitInspectorBtn = document.getElementById('exit-inspector-btn');
    const inspectedElementContainer = document.getElementById('inspected-element-container');
    
    tabsSectionTitle.innerHTML = 'Page Inspector <span class="beta-badge">BETA</span>';
    inspectBtn.style.display = 'none';
    exitInspectorBtn.style.display = 'inline-flex';
    inspectedElementContainer.style.display = 'flex';
    inspectedElement = null;
    renderInspectedElement();
    
    // Filter tabs to show only current tab
    renderTabs();
    
    // Send message to background to enable inspector
    if (typeof port !== 'undefined' && port) {
      port.postMessage({
        action: 'enableInspector',
        tabId: inspectorTabId
      });
    }
    
    console.log('Inspector mode started for tab:', inspectorTabId);
  } catch (error) {
    console.error('Failed to start inspector mode:', error);
  }
}

/**
 * Exit inspector mode
 */
async function exitInspectorMode() {
  if (!isInspectorMode) return;
  
  // Hide X-ray overlays in all frames
  if (inspectorTabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: inspectorTabId, allFrames: true },
        func: () => window.__chromeLinkHelper._internal_hideXrayOverlays(),
        world: 'MAIN'
      });
    } catch (error) {
      console.warn('Failed to hide x-ray overlays:', error);
    }
  }
  
  // Send message to background to disable inspector
  if (inspectorTabId && typeof port !== 'undefined' && port) {
    port.postMessage({
      action: 'disableInspector',
      tabId: inspectorTabId
    });
  }
  
  // Reset state
  isInspectorMode = false;
  inspectorTabId = null;
  inspectedElement = null;
  selectedTreeElement = null;
  
  // Remove inspector mode class from body
  document.body.classList.remove('inspector-mode');
  
  // Show other sections
  document.getElementById('clients-section').style.display = '';
  document.getElementById('logs-section').style.display = '';
  
  // Update UI
  const tabsSectionTitle = document.getElementById('tabs-section-title');
  const inspectBtn = document.getElementById('inspect-btn');
  const exitInspectorBtn = document.getElementById('exit-inspector-btn');
  const inspectedElementContainer = document.getElementById('inspected-element-container');
  
  tabsSectionTitle.innerHTML = 'Current Window Tabs';
  inspectBtn.style.display = 'inline-flex';
  exitInspectorBtn.style.display = 'none';
  inspectedElementContainer.style.display = 'none';
  
  // Restore full tabs list
  renderTabs();
  
  console.log('Inspector mode exited');
}

/**
 * Handle element clicked message from background
 */
function handleElementClicked(message) {
  console.log('Element clicked received:', message);
  if (!isInspectorMode) {
    console.warn('Not in inspector mode, ignoring element click');
    return;
  }
  
  inspectedElement = message.element;
  inspectedFrameId = message.frameId || 0; // Store frame ID (0 = main frame)
  selectedTreeElement = inspectedElement.clickedElement; // Default to clicked element
  console.log('Inspected element set:', inspectedElement, 'frameId:', inspectedFrameId);
  renderInspectedElement();
  
  // Auto-scroll to bottom after new element is clicked
  const inspectedElementContent = document.getElementById('inspected-element-content');
  if (inspectedElementContent) {
    setTimeout(() => {
      inspectedElementContent.scrollTop = inspectedElementContent.scrollHeight;
    }, 0);
  }
}

/**
 * Render inspected element tree and details
 */
function renderInspectedElement() {
  console.log('Rendering inspected element:', inspectedElement);
  const inspectedElementContent = document.getElementById('inspected-element-content');
  
  if (!inspectedElement) {
    inspectedElementContent.innerHTML = '<div class="empty-state">Click an element on the page to inspect it</div>';
    return;
  }
  
  // Save scroll positions
  const treeContainer = inspectedElementContent.querySelector('.element-tree');
  const scrollTop = treeContainer ? treeContainer.scrollTop : 0;
  const scrollLeft = treeContainer ? treeContainer.scrollLeft : 0;
  
  // Build tree HTML
  const treeHTML = buildElementTree();
  
  // Build details HTML for selected element
  const detailsHTML = buildElementDetails(selectedTreeElement);
  
  inspectedElementContent.innerHTML = `
    <div class="element-tree-container">
      <div class="element-tree">
        ${treeHTML}
      </div>
      <div class="element-details-divider"></div>
      <div class="element-details-panel">
        ${detailsHTML}
      </div>
    </div>
  `;
  
  // Restore scroll positions
  const newTreeContainer = inspectedElementContent.querySelector('.element-tree');
  if (newTreeContainer) {
    newTreeContainer.scrollTop = scrollTop;
    newTreeContainer.scrollLeft = scrollLeft;
  }
  
  // Update x-ray toggle state
  const xrayToggle = document.getElementById('xray-mode-toggle');
  if (xrayToggle) {
    xrayToggle.checked = xrayMode;
    // Remove old listener to avoid duplicates
    const newToggle = xrayToggle.cloneNode(true);
    xrayToggle.parentNode.replaceChild(newToggle, xrayToggle);
    
    newToggle.addEventListener('change', (e) => {
      xrayMode = e.target.checked;
      updateXrayOverlays();
    });
  }
  
  // Initialize x-ray overlays
  updateXrayOverlays();

  // Add click and double-click handlers to tree badge items
  const treeBadges = inspectedElementContent.querySelectorAll('.tree-badge-item');
  treeBadges.forEach(badge => {
    // Single click - select element
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      const elementType = badge.dataset.elementType;
      const elementIndex = parseInt(badge.dataset.elementIndex);
      
      // Update selected element based on type
      if (elementType === 'parent') {
        selectedTreeElement = inspectedElement.parents[elementIndex];
      } else if (elementType === 'clicked') {
        selectedTreeElement = inspectedElement.clickedElement;
      } else if (elementType === 'child') {
        selectedTreeElement = inspectedElement.children[elementIndex];
      }
      
      // Re-render to update selection and details
      renderInspectedElement();
    });
    
    // Double click - set as new clicked element and get fresh data from DOM
    badge.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const elementType = badge.dataset.elementType;
      const elementIndex = parseInt(badge.dataset.elementIndex);
      
      let targetElement;
      if (elementType === 'parent') {
        targetElement = inspectedElement.parents[elementIndex];
      } else if (elementType === 'clicked') {
        targetElement = inspectedElement.clickedElement;
      } else if (elementType === 'child') {
        targetElement = inspectedElement.children[elementIndex];
      }
      
      // Send message to content script to simulate a click on this element
      if (targetElement && targetElement.selector && inspectorTabId) {
        chrome.tabs.sendMessage(inspectorTabId, {
          action: 'simulateInspectorClick',
          selector: targetElement.selector
        }).catch(err => {
          console.error('Failed to simulate click:', err);
        });
      }
    });
  });
  
  // Add click handlers to copy buttons
  const copyButtons = inspectedElementContent.querySelectorAll('.copy-btn');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const textToCopy = btn.dataset.copy;
      
      try {
        await navigator.clipboard.writeText(textToCopy);
        
        // Visual feedback
        btn.classList.add('copied');
        const icon = btn.querySelector('.material-symbols-outlined');
        const originalIcon = icon.textContent;
        icon.textContent = 'check';
        
        setTimeout(() => {
          btn.classList.remove('copied');
          icon.textContent = originalIcon;
        }, 1500);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });
  });

  console.log('Element rendered to DOM');
}/**
 * Update x-ray mode overlays on the page
 */
async function updateXrayOverlays() {
  if (!inspectorTabId || !inspectedElement) return;
  
  try {
    // First, clear x-ray overlays from ALL frames to avoid leftovers
    await chrome.scripting.executeScript({
      target: { tabId: inspectorTabId, allFrames: true },
      func: () => window.__chromeLinkHelper._internal_hideXrayOverlays(),
      world: 'MAIN'
    });
    
    if (xrayMode) {
      // Then show overlays only in the specific frame where the element was clicked
      await chrome.scripting.executeScript({
        target: { tabId: inspectorTabId, frameIds: [inspectedFrameId] },
        func: (elementData) => window.__chromeLinkHelper._internal_showXrayOverlays(elementData),
        args: [inspectedElement],
        world: 'MAIN'
      });
    }
  } catch (error) {
    console.error('Failed to update x-ray overlays:', error);
  }
}

/**
 * Build element tree HTML
 */
function buildElementTree() {
  const { parents, clickedElement, children } = inspectedElement;
  
  let html = '<div class="tree-breadcrumb">';
  
  // Render parents as badges
  parents.forEach((parent, index) => {
    const isSelected = selectedTreeElement === parent;
    const firstClass = parent.attributes?.class ? parent.attributes.class.split(' ')[0] : '';
    const count = parent.siblingCount || 0;
    
    html += `
      <div class="tree-badge-item ${isSelected ? 'selected' : ''}" 
           data-element-type="parent" 
           data-element-index="${index}">
        <span class="badge-tag">&lt;${escapeHtml(parent.tagName)}&gt;</span>
        ${firstClass ? `<span class="badge-attrs">.${escapeHtml(firstClass)}</span>` : ''}
        ${count > 1 ? `<span class="badge-count">${count}</span>` : ''}
      </div>
      <span class="badge-separator">›</span>
    `;
  });
  
  // Render clicked element (highlighted)
  const isClickedSelected = selectedTreeElement === clickedElement;
  const clickedFirstClass = clickedElement.attributes?.class ? clickedElement.attributes.class.split(' ')[0] : '';
  const clickedCount = clickedElement.siblingCount || 0;
  
  html += `
    <div class="tree-badge-item clicked ${isClickedSelected ? 'selected' : ''}" 
         data-element-type="clicked" 
         data-element-index="0">
      <span class="badge-tag">&lt;${escapeHtml(clickedElement.tagName)}&gt;</span>
      ${clickedFirstClass ? `<span class="badge-attrs">.${escapeHtml(clickedFirstClass)}</span>` : ''}
      ${clickedCount > 1 ? `<span class="badge-count">${clickedCount}</span>` : ''}
      <span class="badge-label">CLICKED</span>
    </div>
  `;
  
  // Render children section if there are any
  if (children.length > 0) {
    html += '<span class="badge-separator">›</span>';
    html += '<div class="children-badges">';
    children.forEach((child, index) => {
      const isSelected = selectedTreeElement === child;
      const childFirstClass = child.attributes?.class ? child.attributes.class.split(' ')[0] : '';
      const childCount = child.siblingCount || 0;
      
      html += `
        <div class="tree-badge-item child ${isSelected ? 'selected' : ''}" 
             data-element-type="child" 
             data-element-index="${index}">
          <span class="badge-tag">&lt;${escapeHtml(child.tagName)}&gt;</span>
          ${childFirstClass ? `<span class="badge-attrs">.${escapeHtml(childFirstClass)}</span>` : ''}
          ${childCount > 1 ? `<span class="badge-count">${childCount}</span>` : ''}
        </div>
      `;
    });
    html += '</div>';
  }
  
  html += '</div>';
  return html;
}

/**
 * Build element details HTML
 */
function buildElementDetails(element) {
  if (!element) return '<div class="empty-state">No element selected</div>';
  
  const { tagName, selector, xpathSelector, textContent, attributes } = element;
  
  return `
    <div class="element-detail">
      <div class="element-row">
        <label>Tag:</label>
        <span class="element-tag">${escapeHtml(tagName)}</span>
      </div>
      <div class="element-row">
        <label>CSS Selector:</label>
        <div class="copyable-field">
          <code class="element-selector">${escapeHtml(selector)}</code>
          <button class="copy-btn" data-copy="${escapeHtml(selector)}" title="Copy CSS selector">
            <span class="material-symbols-outlined">content_copy</span>
          </button>
        </div>
      </div>
      ${xpathSelector ? `
        <div class="element-row">
          <label>XPath:</label>
          <div class="copyable-field">
            <code class="element-selector">${escapeHtml(xpathSelector)}</code>
            <button class="copy-btn" data-copy="${escapeHtml(xpathSelector)}" title="Copy XPath">
              <span class="material-symbols-outlined">content_copy</span>
            </button>
          </div>
        </div>
      ` : ''}
      ${textContent ? `
        <div class="element-row">
          <label>Text:</label>
          <div class="copyable-field">
            <code class="element-text" title="${escapeHtml(textContent)}">${escapeHtml(textContent)}</code>
            <button class="copy-btn" data-copy="${escapeHtml(textContent)}" title="Copy text content">
              <span class="material-symbols-outlined">content_copy</span>
            </button>
          </div>
        </div>
      ` : ''}
      ${attributes && Object.keys(attributes).length > 0 ? `
        <div class="element-row">
          <label>Attributes:</label>
          <div class="element-attributes">
            ${Object.entries(attributes).map(([key, value]) => 
              `<div class="attribute-item"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</div>`
            ).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Get inspector state
 */
function getInspectorState() {
  return {
    isInspectorMode,
    inspectorTabId,
    inspectedElement,
    selectedTreeElement
  };
}
