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
  }
};

console.log('ChromePilot DOM Helper loaded');
