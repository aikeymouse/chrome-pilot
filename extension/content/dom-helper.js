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
  }
};

console.log('ChromePilot DOM Helper loaded');
