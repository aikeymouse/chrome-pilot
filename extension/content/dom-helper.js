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
  }
};

console.log('ChromePilot DOM Helper loaded');
