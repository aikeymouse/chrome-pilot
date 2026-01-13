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
  async cropScreenshotToElements(fullScreenshotDataUrl, boundsArray) {
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
   * Generate a unique CSS selector for an element
   */
  generateSelector(element) {
    // Helper to escape attribute values (only escape quotes, not the whole value)
    const escapeAttributeValue = (value) => {
      return value.replace(/"/g, '\\"');
    };
    
    // Try ID first
    if (element.id) {
      const idSelector = `#${CSS.escape(element.id)}`;
      if (document.querySelectorAll(idSelector).length === 1) {
        return idSelector;
      }
    }
    
    // Try name attribute (common for form elements but can be on any element)
    if (element.name) {
      const nameSelector = `${element.tagName.toLowerCase()}[name="${escapeAttributeValue(element.name)}"]`;
      const matches = document.querySelectorAll(nameSelector);
      if (matches.length === 1) {
        return nameSelector;
      }
      // If multiple matches and element has type attribute, try combining
      if (element.type) {
        const typeNameSelector = `${element.tagName.toLowerCase()}[type="${escapeAttributeValue(element.type)}"][name="${escapeAttributeValue(element.name)}"]`;
        if (document.querySelectorAll(typeNameSelector).length === 1) {
          return typeNameSelector;
        }
      }
    }
    
    // Try any data-* attributes
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-')) {
        const dataSelector = `[${attr.name}="${escapeAttributeValue(attr.value)}"]`;
        if (document.querySelectorAll(dataSelector).length === 1) {
          return dataSelector;
        }
      }
    }
    
    // Try unique class combination
    const classes = Array.from(element.classList);
    if (classes.length > 0) {
      const classSelector = '.' + classes.map(c => CSS.escape(c)).join('.');
      if (document.querySelectorAll(classSelector).length === 1) {
        return classSelector;
      }
    }
    
    // Try unique attribute combinations for specific elements
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
   * Enable click tracking for inspector mode
   */
  enableClickTracking() {
    // Store click handler so we can remove it later
    window.__chromePilotClickHandler = (event) => {
      // Don't prevent default to avoid breaking page functionality
      event.stopPropagation();
      
      const element = event.target;
      
      // Generate selector
      const selector = window.__chromePilotHelper.generateSelector(element);
      
      // Build element tree: parents -> clicked element -> children
      const buildElementInfo = (el) => {
        const info = {
          tagName: el.tagName.toLowerCase(),
          selector: window.__chromePilotHelper.generateSelector(el),
          textContent: el.textContent ? el.textContent.trim() : '',
          attributes: {},
          isClickedElement: el === element
        };
        
        // Collect relevant attributes
        const relevantAttrs = ['id', 'class', 'name', 'type', 'href', 'src', 'data-test', 'data-testid', 'placeholder', 'value'];
        relevantAttrs.forEach(attr => {
          if (el.hasAttribute(attr)) {
            info.attributes[attr] = el.getAttribute(attr);
          }
        });
        
        return info;
      };
      
      // Calculate how many siblings match the same tag+firstClass selector
      const calculateSiblingCount = (el) => {
        if (!el.parentElement) return 0;
        
        const siblings = Array.from(el.parentElement.children);
        const tagName = el.tagName.toLowerCase();
        const firstClass = el.classList.length > 0 ? el.classList[0] : null;
        
        // Count siblings with same tag and first class (exclude inspector indicator)
        return siblings.filter(sibling => {
          if (sibling.id === '__chromepilot-inspector-indicator') return false;
          if (sibling.tagName.toLowerCase() !== tagName) return false;
          if (!firstClass) return sibling.classList.length === 0;
          return sibling.classList.contains(firstClass);
        }).length;
      };
      
      // Get parent chain (up to body)
      const parents = [];
      let currentParent = element.parentElement;
      while (currentParent && currentParent !== document.body) {
        // Skip inspector indicator
        if (currentParent.id === '__chromepilot-inspector-indicator') {
          currentParent = currentParent.parentElement;
          continue;
        }
        const parentInfo = buildElementInfo(currentParent);
        parentInfo.siblingCount = calculateSiblingCount(currentParent);
        parents.unshift(parentInfo);
        currentParent = currentParent.parentElement;
      }
      
      // Get clicked element info
      const clickedInfo = buildElementInfo(element);
      clickedInfo.siblingCount = calculateSiblingCount(element);
      
      // Get children (direct children only, exclude inspector indicator)
      const children = Array.from(element.children)
        .filter(child => child.id !== '__chromepilot-inspector-indicator')
        .map(child => {
          const childInfo = buildElementInfo(child);
          childInfo.siblingCount = calculateSiblingCount(child);
          return childInfo;
        });
      
      // Get element details
      const elementData = {
        clickedElement: clickedInfo,
        parents: parents,
        children: children,
        timestamp: Date.now()
      };
      
      // Highlight element for 3 seconds
      const originalStyles = {
        outline: element.style.outline,
        outlineOffset: element.style.outlineOffset
      };
      element.style.setProperty('outline', '2px solid #1a73e8', 'important');
      element.style.setProperty('outline-offset', '2px', 'important');
      setTimeout(() => {
        element.style.outline = originalStyles.outline;
        element.style.outlineOffset = originalStyles.outlineOffset;
        // Remove important flag by resetting
        if (!originalStyles.outline) {
          element.style.removeProperty('outline');
        }
        if (!originalStyles.outlineOffset) {
          element.style.removeProperty('outline-offset');
        }
      }, 3000);
      
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
   * Disable click tracking for inspector mode
   */
  disableClickTracking() {
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

console.log('ChromePilot DOM Helper loaded');

