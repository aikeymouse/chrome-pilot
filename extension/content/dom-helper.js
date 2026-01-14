/**
 * DOM Helper Content Script
 * Provides pre-defined DOM manipulation functions for CSP-restricted pages
 * Injected into MAIN world to access page JavaScript context
 */

// Make functions available globally
window.__chromePilotHelper = {
  /**
   * Click an element by selector
   */
  clickElement(selector) {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
    el.click();
    if (el.focus) el.focus();
    return true;
  },

  /**
   * Type text into an element
   */
  typeText(selector, text, clearFirst = true) {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
    
    if (clearFirst) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.value = '';
      } else if (el.contentEditable === 'true') {
        el.innerHTML = '<p><br></p>';
      }
    }
    
    // Type character by character
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (el.contentEditable === 'true') {
      const p = el.querySelector('p') || el;
      p.textContent = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    return true;
  },

  /**
   * Append single character to contenteditable element
   */
  appendChar(selector, char) {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
    
    const p = el.querySelector('p');
    if (!p) throw new Error('Paragraph element not found');
    
    const currentText = p.textContent;
    p.textContent = currentText + char;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    
    return true;
  },

  /**
   * Clear contenteditable element
   */
  clearContentEditable(selector) {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
    el.innerHTML = '<p><br></p>';
    return true;
  },

  /**
   * Get text content of an element
   */
  getText(selector) {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
    return el.textContent;
  },

  /**
   * Get innerHTML of an element
   */
  getHTML(selector) {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
    return el.innerHTML;
  },

  /**
   * Get the last element matching selector and return its innerHTML
   */
  getLastHTML(selector) {
    const els = document.querySelectorAll(selector);
    if (els.length === 0) throw new Error(`No elements found: ${selector}`);
    return els[els.length - 1].innerHTML;
  },

  /**
   * Check if element exists
   */
  elementExists(selector) {
    return !!document.querySelector(selector);
  },

  /**
   * Check if element is visible
   */
  isVisible(selector) {
    const el = document.querySelector(selector);
    if (!el) return false;
    
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
  },

  /**
   * Wait for element to appear
   */
  waitForElement(selector, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      
      const check = () => {
        if (document.querySelector(selector)) {
          resolve(true);
        } else if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for element: ${selector}`));
        } else {
          setTimeout(check, 100);
        }
      };
      
      check();
    });
  },

  /**
   * Highlight elements with yellow background
   * Highlights all elements matching the selector
   * Returns the number of elements highlighted (0 if none found)
   */
  highlightElement(selector) {
    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) {
      return 0;
    }

    // Store original styles if not already stored
    if (!window.__chromePilotHighlights) {
      window.__chromePilotHighlights = new Map();
    }

    let highlightedCount = 0;
    elements.forEach((el, index) => {
      const key = `${selector}[${index}]`;
      
      // Store original background and transition
      if (!window.__chromePilotHighlights.has(key)) {
        window.__chromePilotHighlights.set(key, {
          element: el,
          originalBackground: el.style.background,
          originalTransition: el.style.transition
        });
        
        // Apply highlight with smooth transition (semi-transparent yellow)
        el.style.transition = 'background 0.3s ease';
        el.style.background = 'rgba(255, 255, 0, 0.5)';
        highlightedCount++;
      }
    });

    return highlightedCount;
  },

  /**
   * Remove all highlights applied by highlightElement
   */
  removeHighlights() {
    if (!window.__chromePilotHighlights) {
      return 0;
    }

    let removedCount = 0;
    window.__chromePilotHighlights.forEach((data) => {
      const { element, originalBackground, originalTransition } = data;
      
      // Restore original styles
      element.style.background = originalBackground;
      element.style.transition = originalTransition;
      removedCount++;
    });

    // Clear the highlights map
    window.__chromePilotHighlights.clear();
    
    return removedCount;
  },

  /**
   * Get element bounds for all matching elements
   * Returns array of bounds objects (empty array if no elements found)
   */
  getElementBounds(selector) {
    const elements = document.querySelectorAll(selector);
    
    if (elements.length === 0) {
      return [];
    }
    
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    const boundsArray = [];
    elements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      boundsArray.push({
        index: index,
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        absoluteX: Math.round(rect.left + scrollX),
        absoluteY: Math.round(rect.top + scrollY)
      });
    });
    
    return boundsArray;
  },

  /**
   * Scroll specific element into view by selector and index
   * If index not provided or -1, scrolls first element (index 0)
   * Returns bounds array after scrolling (empty array if no elements found)
   */
  scrollElementIntoView(selector, index = 0) {
    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) {
      return [];
    }
    
    // Clamp index to valid range
    const targetIndex = Math.max(0, Math.min(index, elements.length - 1));
    const el = elements[targetIndex];
    
    el.scrollIntoView({ 
      behavior: 'instant',
      block: 'center',
      inline: 'center'
    });
    
    // Return bounds for all matching elements after scrolling
    return window.__chromePilotHelper.getElementBounds(selector);
  },

  /**
   * Crop screenshot to element bounds using Canvas API (internal helper)
   * Called by captureScreenshot command in service-worker
   * Returns array of cropped screenshots as base64 data URLs
   */
  async _internal_cropScreenshotToElements(fullScreenshotDataUrl, boundsArray) {
    if (!boundsArray || boundsArray.length === 0) {
      return [];
    }
    
    const results = [];
    const dpr = window.devicePixelRatio || 1;
    
    for (const bounds of boundsArray) {
      try {
        const croppedDataUrl = await new Promise((resolve, reject) => {
          const img = new Image();
          
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const padding = 10; // Add 10px padding on all sides
              
              // Account for device pixel ratio
              const x = Math.max(0, (bounds.x - padding) * dpr);
              const y = Math.max(0, (bounds.y - padding) * dpr);
              const width = Math.min((bounds.width + (padding * 2)) * dpr, img.width - x);
              const height = Math.min((bounds.height + (padding * 2)) * dpr, img.height - y);
              
              // Canvas uses CSS pixels
              canvas.width = width / dpr;
              canvas.height = height / dpr;
              
              const ctx = canvas.getContext('2d');
              // Scale context to account for device pixel ratio
              ctx.scale(1/dpr, 1/dpr);
              ctx.drawImage(
                img,
                x, y,
                width, height,
                0, 0,
                width, height
              );
              
              resolve(canvas.toDataURL('image/png'));
            } catch (err) {
              reject(new Error(`Crop failed: ${err.message}`));
            }
          };
          
          img.onerror = () => {
            reject(new Error('Failed to load screenshot image'));
          };
          
          img.src = fullScreenshotDataUrl;
        });
        
        results.push({
          index: bounds.index,
          dataUrl: croppedDataUrl,
          bounds: bounds,
          devicePixelRatio: dpr
        });
      } catch (err) {
        results.push({
          index: bounds.index,
          error: err.message,
          bounds: bounds
        });
      }
    }
    
    return results;
  },

  /**
   * Generate a unique CSS selector for an element (internal helper)
   * Priority order: id > radio/checkbox name+value > name > name+type > data-* > 
   * aria-label > type+placeholder > unique class > element-specific attrs > nth-child path
   */
  _internal_generateSelector(element) {
    // Helper to escape attribute values (only escape quotes, not the whole value)
    const escapeAttributeValue = (value) => {
      return value.replace(/"/g, '\\"');
    };
    
    // 1. Try ID first (highest priority)
    if (element.id) {
      const idSelector = `#${CSS.escape(element.id)}`;
      if (document.querySelectorAll(idSelector).length === 1) {
        return idSelector;
      }
    }
    
    // 2. For common semantic elements, try simple tag selector if unique
    const semanticTags = ['form', 'nav', 'header', 'footer', 'main', 'aside', 'article', 'section'];
    const tagLower = element.tagName.toLowerCase();
    if (semanticTags.includes(tagLower)) {
      const tagSelector = tagLower;
      if (document.querySelectorAll(tagSelector).length === 1) {
        return tagSelector;
      }
      
      // If not unique, try tag + common attributes for that element type
      if (tagLower === 'form') {
        // Try form with action or method attributes
        if (element.action) {
          const actionAttr = element.getAttribute('action'); // Get original attribute value
          if (actionAttr) {
            const formActionSelector = `form[action="${escapeAttributeValue(actionAttr)}"]`;
            if (document.querySelectorAll(formActionSelector).length === 1) {
              return formActionSelector;
            }
          }
        }
        if (element.method) {
          const formMethodSelector = `form[method="${escapeAttributeValue(element.method)}"]`;
          if (document.querySelectorAll(formMethodSelector).length === 1) {
            return formMethodSelector;
          }
        }
      }
    }
    
    // 3. For radio/checkbox groups, use name + value to differentiate
    if (element.tagName === 'INPUT' && element.name && element.value && 
        (element.type === 'radio' || element.type === 'checkbox')) {
      const radioCheckSelector = `input[name="${escapeAttributeValue(element.name)}"][value="${escapeAttributeValue(element.value)}"]`;
      if (document.querySelectorAll(radioCheckSelector).length === 1) {
        return radioCheckSelector;
      }
    }
    
    // 4. Try name attribute (common for form elements)
    if (element.name) {
      const nameSelector = `${element.tagName.toLowerCase()}[name="${escapeAttributeValue(element.name)}"]`;
      const matches = document.querySelectorAll(nameSelector);
      if (matches.length === 1) {
        return nameSelector;
      }
      // 5. If multiple matches and element has type attribute, try combining
      if (element.type) {
        const typeNameSelector = `${element.tagName.toLowerCase()}[type="${escapeAttributeValue(element.type)}"][name="${escapeAttributeValue(element.name)}"]`;
        if (document.querySelectorAll(typeNameSelector).length === 1) {
          return typeNameSelector;
        }
      }
    }
    
    // 6. Try any data-* attributes (common for test automation and component identification)
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-')) {
        const dataSelector = `[${attr.name}="${escapeAttributeValue(attr.value)}"]`;
        if (document.querySelectorAll(dataSelector).length === 1) {
          return dataSelector;
        }
      }
    }
    
    // 7. Try aria-label for accessibility-labeled elements
    if (element.hasAttribute('aria-label')) {
      const ariaSelector = `${element.tagName.toLowerCase()}[aria-label="${escapeAttributeValue(element.getAttribute('aria-label'))}"]`;
      if (document.querySelectorAll(ariaSelector).length === 1) {
        return ariaSelector;
      }
    }
    
    // 8. For input elements, try type + placeholder combination
    if (element.tagName === 'INPUT' && element.type && element.placeholder) {
      const typePlaceholderSelector = `input[type="${escapeAttributeValue(element.type)}"][placeholder="${escapeAttributeValue(element.placeholder)}"]`;
      if (document.querySelectorAll(typePlaceholderSelector).length === 1) {
        return typePlaceholderSelector;
      }
    }
    
    // 9. Try unique class (filter out common utility classes)
    const classes = Array.from(element.classList).filter(cls => {
      // Skip generic utility classes (Bootstrap, Tailwind-like patterns)
      // But be more lenient for divs since they often only have structural classes
      if (tagLower === 'div') {
        // For divs, only skip very generic utility classes like spacing/sizing
        return !cls.match(/^(mt|mb|ml|mr|pt|pb|pl|pr|m-|p-|w-|h-|flex|grid|d-|align|justify)(-|\d|$)/);
      }
      return !cls.match(/^(btn|button|input|form|text|label|field|container|wrapper|col|row|mt|mb|ml|mr|pt|pb|pl|pr|m-|p-|w-|h-|flex|grid|d-|align|justify)(-|\d|$)/);
    });
    
    if (classes.length > 0) {
      // Try single class first
      for (const cls of classes) {
        const singleClassSelector = `${tagLower}.${CSS.escape(cls)}`;
        if (document.querySelectorAll(singleClassSelector).length === 1) {
          return singleClassSelector;
        }
      }
      // Try class combination as fallback
      const classSelector = `${tagLower}.${classes.map(c => CSS.escape(c)).join('.')}`;
      if (document.querySelectorAll(classSelector).length === 1) {
        return classSelector;
      }
    }
    
    // Try unique attribute combinations for specific elements
    if (element.tagName === 'LABEL') {
      // First try 'for' attribute if it exists
      if (element.htmlFor) {
        const forSelector = `label[for="${escapeAttributeValue(element.htmlFor)}"]`;
        if (document.querySelectorAll(forSelector).length === 1) {
          return forSelector;
        }
      }
      // Otherwise, check if label wraps an input/textarea/select
      else {
        const wrappedInput = element.querySelector('input, textarea, select');
        if (wrappedInput) {
          let childSelector = '';
          if (wrappedInput.id) {
            childSelector = `#${CSS.escape(wrappedInput.id)}`;
          } else if (wrappedInput.name) {
            childSelector = `${wrappedInput.tagName.toLowerCase()}[name="${escapeAttributeValue(wrappedInput.name)}"]`;
          }
          
          if (childSelector) {
            const hasSelector = `label:has(${childSelector})`;
            try {
              if (document.querySelectorAll(hasSelector).length === 1) {
                return hasSelector;
              }
            } catch (e) {
              // :has() might not be supported in older browsers, skip
            }
          }
        }
      }
    }
    
    if (element.tagName === 'BUTTON') {
      // Try type attribute for buttons
      if (element.type) {
        const typeSelector = `button[type="${escapeAttributeValue(element.type)}"]`;
        if (document.querySelectorAll(typeSelector).length === 1) {
          return typeSelector;
        }
      }
      // Try text content if it's reasonably short and unique
      const text = element.textContent?.trim();
      if (text && text.length > 0 && text.length < 50) {
        // Find all buttons and check if text is unique
        const allButtons = Array.from(document.querySelectorAll('button'));
        const matchingButtons = allButtons.filter(btn => btn.textContent?.trim() === text);
        if (matchingButtons.length === 1) {
          // Use :is() with type to make it more specific, or fall back to filtering
          // Since we can't directly select by text in CSS, we'll skip this
          // and rely on other attributes or nth-child
        }
      }
    }
    
    if (element.tagName === 'A' && element.href) {
      const hrefSelector = `a[href="${escapeAttributeValue(element.getAttribute('href'))}"]`;
      if (document.querySelectorAll(hrefSelector).length === 1) {
        return hrefSelector;
      }
    }
    
    if (element.tagName === 'IMG' && element.src) {
      const srcSelector = `img[src="${escapeAttributeValue(element.getAttribute('src'))}"]`;
      if (document.querySelectorAll(srcSelector).length === 1) {
        return srcSelector;
      }
    }
    
    // For option elements, try value attribute combined with parent select
    if (element.tagName === 'OPTION' && element.value) {
      const parent = element.closest('select');
      if (parent) {
        let parentSelector = '';
        if (parent.id) {
          parentSelector = `#${CSS.escape(parent.id)}`;
        } else if (parent.name) {
          parentSelector = `select[name="${escapeAttributeValue(parent.name)}"]`;
        } else if (parent.classList.length > 0) {
          parentSelector = 'select.' + Array.from(parent.classList).map(c => CSS.escape(c)).join('.');
        }
        
        if (parentSelector) {
          const optionSelector = `${parentSelector} option[value="${escapeAttributeValue(element.value)}"]`;
          if (document.querySelectorAll(optionSelector).length === 1) {
            return optionSelector;
          }
        }
      }
    }
    
    // Build nth-child path as last resort
    const path = [];
    let current = element;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
      path.unshift(selector);
      current = parent;
    }
    return path.join(' > ');
  },

  /**
   * Inspect an element by selector and return its tree data
   * Returns element information including parents, clicked element, and children
   */
  inspectElement(selector) {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    
    return window.__chromePilotBuildElementTree(element, false);
  },

  /**
   * Get all elements within a container matching optional filter
   * Returns array of element data with attributes and visibility flag
   * @param {string} containerSelector - CSS selector for container element
   * @param {string} elementSelector - Optional CSS selector filter for elements (default: '*' for all descendants)
   * @returns {Array} Array of {tagName, selector, attributes, textContent, visible}
   */
  getContainerElements(containerSelector, elementSelector = '*') {
    const container = document.querySelector(containerSelector);
    if (!container) throw new Error(`Container not found: ${containerSelector}`);
    
    // Query all descendants matching the filter
    const elements = Array.from(container.querySelectorAll(elementSelector));
    
    // Map each element to structured data
    return elements.map(el => {
      // Collect all attributes
      const attributes = {};
      if (el.attributes) {
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          attributes[attr.name] = attr.value;
        }
      }
      
      // Check visibility
      const style = window.getComputedStyle(el);
      const visible = style.display !== 'none' && 
                     style.visibility !== 'hidden' && 
                     style.opacity !== '0';
      
      return {
        tagName: el.tagName.toLowerCase(),
        selector: window.__chromePilotHelper._internal_generateSelector(el),
        attributes: attributes,
        textContent: el.textContent ? el.textContent.trim() : '',
        visible: visible
      };
    });
  },

  /**
   * Enable click tracking for inspector mode (Internal UI only - not available via callHelper)
   */
  _internal_enableClickTracking() {
    // Click handler uses the globally stored buildElementTree
    const buildElementTree = window.__chromePilotBuildElementTree;
    
    // Store click handler so we can remove it later
    window.__chromePilotClickHandler = (event) => {

      // Don't prevent default to avoid breaking page functionality
      event.stopPropagation();
      
      const element = event.target;
      const elementData = buildElementTree(element, true);
      
      // Send message via custom event (since we're in MAIN world, chrome.runtime is not available)
      console.log('Dispatching element clicked event:', elementData);
      window.dispatchEvent(new CustomEvent('__chromepilot_element_clicked', {
        detail: elementData
      }));
    };
    
    // Add click listener to document
    document.addEventListener('click', window.__chromePilotClickHandler, true);
    
    // Add visual indicator that inspector is active
    const inspectorIndicator = document.createElement('div');
    inspectorIndicator.id = '__chromepilot-inspector-indicator';
    inspectorIndicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #1a73e8;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 2147483647;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      pointer-events: none;
    `;
    inspectorIndicator.textContent = '🔍 Inspector Mode Active';
    document.body.appendChild(inspectorIndicator);
    
    return { enabled: true };
  },

  /**
   * Disable click tracking for inspector mode (Internal UI only - not available via callHelper)
   */
  _internal_disableClickTracking() {
    // Remove click handler
    if (window.__chromePilotClickHandler) {
      document.removeEventListener('click', window.__chromePilotClickHandler, true);
      window.__chromePilotClickHandler = null;
    }
    
    // Remove visual indicator
    const indicator = document.getElementById('__chromepilot-inspector-indicator');
    if (indicator) {
      indicator.remove();
    }
    
    return { disabled: true };
  }
};

// Initialize helper functions for inspector mode
// These are available globally so inspectElement can work without enableClickTracking
(function() {
  // Helper function to build element info
  const buildElementInfo = (el, clickedElement = null, includeText = true) => {
    const info = {
      tagName: el.tagName.toLowerCase(),
      selector: window.__chromePilotHelper._internal_generateSelector(el),
      attributes: {},
      isClickedElement: el === clickedElement
    };
    
    // Only include text for parents, clicked element, and children
    if (includeText) {
      info.textContent = el.textContent ? el.textContent.trim() : '';
    }
    
    // Collect all attributes
    if (el.attributes) {
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        info.attributes[attr.name] = attr.value;
      }
    }
    
    return info;
  };
  
  // Helper function to calculate sibling count
  const calculateSiblingCount = (el) => {
    if (!el.parentElement) return 0;
    
    const siblings = Array.from(el.parentElement.children);
    const tagName = el.tagName.toLowerCase();
    const firstClass = el.classList.length > 0 ? el.classList[0] : null;
    
    // Count siblings with same tag and first class (exclude inspector indicator)
    return siblings.filter(sibling => {
      if (sibling.id === '__chromepilot-inspector-indicator') return false;
      if (sibling.tagName.toLowerCase() !== tagName) return false;
      if (firstClass) {
        return sibling.classList.contains(firstClass);
      }
      return sibling.classList.length === 0;
    }).length;
  };
  
  // Shared function to build element tree and optionally highlight
  const buildElementTree = (element, shouldHighlight = true) => {
    // Build element tree data
    const parents = [];
    let currentParent = element.parentElement;
    while (currentParent && currentParent !== document.body) {
      if (currentParent.id !== '__chromepilot-inspector-indicator') {
        const parentInfo = buildElementInfo(currentParent, element);
        parentInfo.siblingCount = calculateSiblingCount(currentParent);
        parents.unshift(parentInfo);
      }
      currentParent = currentParent.parentElement;
    }
    
    const clickedInfo = buildElementInfo(element, element);
    clickedInfo.siblingCount = calculateSiblingCount(element);
    
    const children = Array.from(element.children)
      .filter(child => child.id !== '__chromepilot-inspector-indicator')
      .map(child => {
        const childInfo = buildElementInfo(child, element);
        childInfo.siblingCount = calculateSiblingCount(child);
        return childInfo;
      });
    
    // Highlight element if requested
    if (shouldHighlight) {
      // Clear any existing highlight timeout for this element
      if (window.__chromePilotHighlightTimeout) {
        clearTimeout(window.__chromePilotHighlightTimeout);
      }
      
      // Clear any previously highlighted element
      if (window.__chromePilotHighlightedElement) {
        const prev = window.__chromePilotHighlightedElement;
        prev.element.style.outline = prev.originalOutline;
        prev.element.style.outlineOffset = prev.originalOutlineOffset;
        if (!prev.originalOutline) {
          prev.element.style.removeProperty('outline');
        }
        if (!prev.originalOutlineOffset) {
          prev.element.style.removeProperty('outline-offset');
        }
      }
      
      // Store original styles
      const originalStyles = {
        element: element,
        originalOutline: element.style.outline,
        originalOutlineOffset: element.style.outlineOffset
      };
      window.__chromePilotHighlightedElement = originalStyles;
      
      // Apply highlight
      element.style.setProperty('outline', '2px solid #1a73e8', 'important');
      element.style.setProperty('outline-offset', '2px', 'important');
      
      // Set timeout to remove highlight
      window.__chromePilotHighlightTimeout = setTimeout(() => {
        element.style.outline = originalStyles.originalOutline;
        element.style.outlineOffset = originalStyles.originalOutlineOffset;
        if (!originalStyles.originalOutline) {
          element.style.removeProperty('outline');
        }
        if (!originalStyles.originalOutlineOffset) {
          element.style.removeProperty('outline-offset');
        }
        window.__chromePilotHighlightedElement = null;
        window.__chromePilotHighlightTimeout = null;
      }, 3000);
    }
    
    return {
      clickedElement: clickedInfo,
      parents: parents,
      children: children,
      timestamp: Date.now()
    };
  };
  
  // Store helpers globally
  window.__chromePilotBuildElementInfo = buildElementInfo;
  window.__chromePilotCalculateSiblingCount = calculateSiblingCount;
  window.__chromePilotBuildElementTree = buildElementTree;
})();

// Listen for simulate click events from inspector bridge
window.addEventListener('__chromepilot_simulate_click', (event) => {
  const { selector } = event.detail;
  if (selector && window.__chromePilotBuildElementTree) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        const elementData = window.__chromePilotBuildElementTree(element, true);
        
        // Dispatch the element data
        window.dispatchEvent(new CustomEvent('__chromepilot_element_clicked', {
          detail: elementData
        }));
      }
    } catch (err) {
      console.error('Failed to simulate inspector click:', err);
    }
  }
});

console.log('ChromePilot DOM Helper loaded');

