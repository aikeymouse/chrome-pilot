/**
 * DOM Helper Content Script
 * Provides pre-defined DOM manipulation functions for CSP-restricted pages
 * Injected into MAIN world to access page JavaScript context
 */

// Make functions available globally
window.__chromeLinkHelper = {
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
    if (!window.__chromeLinkHighlights) {
      window.__chromeLinkHighlights = new Map();
    }

    let highlightedCount = 0;
    elements.forEach((el, index) => {
      const key = `${selector}[${index}]`;
      
      // Store original background and transition
      if (!window.__chromeLinkHighlights.has(key)) {
        window.__chromeLinkHighlights.set(key, {
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
    if (!window.__chromeLinkHighlights) {
      return 0;
    }

    let removedCount = 0;
    window.__chromeLinkHighlights.forEach((data) => {
      const { element, originalBackground, originalTransition } = data;
      
      // Restore original styles
      element.style.background = originalBackground;
      element.style.transition = originalTransition;
      removedCount++;
    });

    // Clear the highlights map
    window.__chromeLinkHighlights.clear();
    
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
    return window.__chromeLinkHelper.getElementBounds(selector);
  },

  /**
   * Crop screenshot to combined bounding box encompassing all elements
   * Called by captureScreenshot command in service-worker
   * Returns single screenshot with combined bounds and element count
   */
  async _internal_cropScreenshotToElements(fullScreenshotDataUrl, boundsArray) {
    if (!boundsArray || boundsArray.length === 0) {
      throw new Error('No bounds provided for cropping');
    }
    
    const dpr = window.devicePixelRatio || 1;
    
    // Calculate combined bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    for (const bounds of boundsArray) {
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }
    
    const combinedBounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      absoluteX: boundsArray[0].absoluteX + (minX - boundsArray[0].x),
      absoluteY: boundsArray[0].absoluteY + (minY - boundsArray[0].y)
    };
    
    // Crop to combined area
    const croppedDataUrl = await new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const padding = 10; // Add 10px padding on all sides
          
          // Account for device pixel ratio
          const x = Math.max(0, (combinedBounds.x - padding) * dpr);
          const y = Math.max(0, (combinedBounds.y - padding) * dpr);
          const width = Math.min((combinedBounds.width + (padding * 2)) * dpr, img.width - x);
          const height = Math.min((combinedBounds.height + (padding * 2)) * dpr, img.height - y);
          
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
    
    return {
      dataUrl: croppedDataUrl,
      bounds: combinedBounds,
      elementCount: boundsArray.length,
      devicePixelRatio: dpr
    };
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
   * Generate XPath for an element with validation
   * Uses priority: id → name+value → name → data-* → aria-label → type+placeholder → ancestor-relative positional
   * @param {Element} element - DOM element to generate XPath for
   * @returns {string} XPath expression
   */
  _internal_generateXPath(element) {
    // Helper to escape attribute values for XPath
    const escapeXPath = (value) => {
      if (!value.includes("'")) {
        return `'${value}'`;
      } else if (!value.includes('"')) {
        return `"${value}"`;
      } else {
        // Contains both single and double quotes - use concat
        return `concat('${value.replace(/'/g, "', \"'\", '")}')`;
      }
    };

    let xpath = '';
    const tag = element.tagName.toLowerCase();

    // 1. Try id attribute (most specific)
    if (element.id) {
      xpath = `//*[@id=${escapeXPath(element.id)}]`;
    }
    // 2. Try semantic HTML5 tags if unique on page
    else if (['form', 'nav', 'header', 'footer', 'main', 'aside', 'article', 'section'].includes(tag)) {
      const sameTagElements = document.querySelectorAll(tag);
      if (sameTagElements.length === 1) {
        xpath = `//${tag}`;
      }
    }
    // 3. For radio/checkbox, try name + value combination
    else if ((element.tagName === 'INPUT' && (element.type === 'radio' || element.type === 'checkbox')) && element.name && element.value) {
      xpath = `//input[@name=${escapeXPath(element.name)}][@value=${escapeXPath(element.value)}]`;
    }
    // 4. Try name attribute alone
    else if (element.name) {
      xpath = `//${tag}[@name=${escapeXPath(element.name)}]`;
    }
    // 5. Try data-* attributes
    else {
      for (const attr of element.attributes) {
        if (attr.name.startsWith('data-')) {
          xpath = `//*[@${attr.name}=${escapeXPath(attr.value)}]`;
          break;
        }
      }
    }
    // 6. Try aria-label
    if (!xpath && element.hasAttribute('aria-label')) {
      xpath = `//${tag}[@aria-label=${escapeXPath(element.getAttribute('aria-label'))}]`;
    }
    // 7. Try type + placeholder for inputs
    if (!xpath && element.tagName === 'INPUT' && element.type && element.placeholder) {
      xpath = `//input[@type=${escapeXPath(element.type)}][@placeholder=${escapeXPath(element.placeholder)}]`;
    }

    // 8. Positional fallback - find nearest ancestor with id
    if (!xpath) {
      let ancestor = element.parentElement;
      while (ancestor && ancestor !== document.body) {
        if (ancestor.id) {
          // Build relative XPath from id ancestor
          const path = [];
          let current = element;
          while (current && current !== ancestor) {
            const parent = current.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children).filter(el => el.tagName === current.tagName);
              const index = siblings.indexOf(current) + 1;
              path.unshift(`${current.tagName.toLowerCase()}[${index}]`);
            }
            current = parent;
          }
          xpath = `//*[@id=${escapeXPath(ancestor.id)}]//${path.join('/')}`;
          break;
        }
        ancestor = ancestor.parentElement;
      }
    }

    // 9. Absolute positional path from body as last resort
    if (!xpath) {
      const path = [];
      let current = element;
      while (current && current !== document.body && current.parentElement) {
        const parent = current.parentElement;
        const siblings = Array.from(parent.children).filter(el => el.tagName === current.tagName);
        const index = siblings.indexOf(current) + 1;
        path.unshift(`${current.tagName.toLowerCase()}[${index}]`);
        current = parent;
      }
      
      // Build XPath from the path we collected
      if (path.length > 0) {
        xpath = `//body/${path.join('/')}`;
      } else {
        // Element is body itself
        xpath = '//body';
      }
    }

    // Validate XPath resolves to the same element
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (result !== element) {
        console.warn(`XPath validation failed for ${element.tagName}, generated: ${xpath}`);
        return xpath; // Return best-effort even if validation fails
      }
    } catch (err) {
      console.warn(`XPath evaluation failed: ${err.message}, xpath: ${xpath}`);
      return xpath;
    }

    return xpath;
  },

  /**
   * Infer semantic element type with ARIA role hierarchy
   * @param {Element} element - DOM element to classify
   * @returns {{type: string, baseType: string|null}} Type information with optional base type
   */
  _internal_inferElementType(element) {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    const type = element.getAttribute('type');

    // 1. ARIA role with hierarchy mapping
    if (role) {
      const roleMap = {
        // Roles with textbox base
        'searchbox': { type: 'searchbox', baseType: 'textbox' },
        'spinbutton': { type: 'spinbutton', baseType: 'textbox' },
        'combobox': { type: 'combobox', baseType: 'textbox' },
        // Roles with checkbox base
        'menuitemcheckbox': { type: 'menuitemcheckbox', baseType: 'checkbox' },
        'switch': { type: 'switch', baseType: 'checkbox' },
        // Roles with radio base
        'menuitemradio': { type: 'menuitemradio', baseType: 'radio' },
        // Roles with button base
        'tab': { type: 'tab', baseType: 'button' },
        'treeitem': { type: 'treeitem', baseType: 'button' },
        'menuitem': { type: 'menuitem', baseType: 'button' },
        // Standalone roles
        'navigation': { type: 'navigation', baseType: null },
        'dialog': { type: 'dialog', baseType: null },
        'alert': { type: 'alert', baseType: null },
        'banner': { type: 'banner', baseType: null },
        'complementary': { type: 'complementary', baseType: null },
        'contentinfo': { type: 'contentinfo', baseType: null },
        'main': { type: 'main', baseType: null },
        'region': { type: 'region', baseType: null },
        'article': { type: 'article', baseType: null },
        'progressbar': { type: 'progressbar', baseType: null },
        'slider': { type: 'slider', baseType: null },
        'button': { type: 'button', baseType: null },
        'checkbox': { type: 'checkbox', baseType: null },
        'radio': { type: 'radio', baseType: null },
        'textbox': { type: 'textbox', baseType: null },
        'link': { type: 'link', baseType: null }
      };
      if (roleMap[role]) {
        return roleMap[role];
      }
      // Unknown role - return as-is
      return { type: role, baseType: null };
    }

    // 2. HTML5 semantic tags
    const semanticMap = {
      'nav': { type: 'navigation', baseType: null },
      'aside': { type: 'complementary', baseType: null },
      'header': { type: 'banner', baseType: null },
      'footer': { type: 'contentinfo', baseType: null },
      'main': { type: 'main', baseType: null },
      'article': { type: 'article', baseType: null },
      'section': { type: 'region', baseType: null }
    };
    if (semanticMap[tag]) {
      return semanticMap[tag];
    }

    // 3. Input element type classification
    if (tag === 'input') {
      const inputTypeMap = {
        'text': { type: 'text-input', baseType: 'input' },
        'email': { type: 'text-input', baseType: 'input' },
        'url': { type: 'text-input', baseType: 'input' },
        'tel': { type: 'text-input', baseType: 'input' },
        'number': { type: 'text-input', baseType: 'input' },
        'search': { type: 'text-input', baseType: 'input' },
        'password': { type: 'password-input', baseType: 'input' },
        'checkbox': { type: 'checkbox', baseType: 'input' },
        'radio': { type: 'radio', baseType: 'input' },
        'submit': { type: 'submit-button', baseType: 'button' },
        'image': { type: 'submit-button', baseType: 'button' },
        'button': { type: 'button', baseType: 'button' },
        'file': { type: 'file-input', baseType: 'input' },
        'date': { type: 'date-input', baseType: 'input' },
        'time': { type: 'time-input', baseType: 'input' },
        'datetime-local': { type: 'datetime-input', baseType: 'input' },
        'month': { type: 'month-input', baseType: 'input' },
        'week': { type: 'week-input', baseType: 'input' },
        'color': { type: 'color-input', baseType: 'input' },
        'range': { type: 'range-input', baseType: 'input' }
      };
      return inputTypeMap[type] || { type: 'text-input', baseType: 'input' };
    }

    // 4. Button element
    if (tag === 'button') {
      if (type === 'submit') {
        return { type: 'submit-button', baseType: 'button' };
      }
      return { type: 'button', baseType: null };
    }

    // 5. Other interactive elements
    const interactiveMap = {
      'a': { type: 'link', baseType: null },
      'select': { type: 'select', baseType: null },
      'textarea': { type: 'textarea', baseType: null }
    };
    if (interactiveMap[tag]) {
      return interactiveMap[tag];
    }

    // 6. Media elements
    const mediaMap = {
      'img': { type: 'image', baseType: null },
      'video': { type: 'video', baseType: null },
      'audio': { type: 'audio', baseType: null }
    };
    if (mediaMap[tag]) {
      return mediaMap[tag];
    }

    // 7. Heading elements
    if (/^h[1-6]$/.test(tag)) {
      return { type: 'heading', baseType: null };
    }

    // 8. Content elements
    const contentMap = {
      'label': { type: 'label', baseType: null },
      'span': { type: 'text', baseType: null },
      'div': { type: 'text', baseType: null },
      'p': { type: 'text', baseType: null }
    };
    if (contentMap[tag]) {
      return contentMap[tag];
    }

    // 9. Fallback to tag name
    return { type: tag, baseType: null };
  },

  /**
   * Extract only direct child text nodes from an element (excludes nested element text)
   * @param {Element} el - DOM element to extract text from
   * @returns {string} Combined text from direct child text nodes only
   */
  _internal_getDirectText(el) {
    return Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent.trim())
      .filter(t => t.length > 0)
      .join(' ');
  },

  /**
   * Inspect an element by selector and return its tree data
   * Returns element information including parents, clicked element, and children
   */
  inspectElement(selector) {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    
    return window.__chromeLinkBuildElementTree(element, false);
  },

  /**
   * Get all elements within a container matching optional filter
   * Returns array of element data with attributes and visibility flag
   * @param {string} containerSelector - CSS selector for container element
   * @param {string} elementSelector - Optional CSS selector filter for elements (default: '*' for all descendants)
   * @param {boolean} includeHidden - Whether to include hidden elements (default: false)
   * @returns {Array} Array of {tagName, selector, attributes, textContent, visible}
   */
  getContainerElements(containerSelector, elementSelector = '*', includeHidden = false) {
    const container = document.querySelector(containerSelector);
    if (!container) throw new Error(`Container not found: ${containerSelector}`);
    
    // Query all descendants matching the filter
    const elements = Array.from(container.querySelectorAll(elementSelector));
    
    // Map each element to structured data
    let results = elements.map(el => {
      // Collect all attributes
      const attributes = {};
      if (el.attributes) {
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          attributes[attr.name] = attr.value;
        }
      }
      
      // Check visibility (enhanced check including position:fixed)
      const style = window.getComputedStyle(el);
      const visible = style.display !== 'none' && 
                     style.visibility !== 'hidden' && 
                     style.opacity !== '0' &&
                     (el.offsetParent !== null || style.position === 'fixed');
      
      return {
        tagName: el.tagName.toLowerCase(),
        selector: window.__chromeLinkHelper._internal_generateSelector(el),
        attributes: attributes,
        textContent: window.__chromeLinkHelper._internal_getDirectText(el),
        visible: visible
      };
    });

    // Filter hidden elements if requested
    if (!includeHidden) {
      results = results.filter(e => e.visible);
    }

    return results;
  },

  /**
   * Extract all interactive elements from a container with rich metadata
   * Returns container info and array of elements with CSS/XPath selectors and semantic types
   * @param {string} containerSelector - CSS selector for container element
   * @param {boolean} includeHidden - Whether to include hidden elements (default: false)
   * @returns {Object} {container, elements, url, title, timestamp}
   */
  extractPageElements(containerSelector, includeHidden = false) {
    // Validate container exists
    const containerEl = document.querySelector(containerSelector);
    if (!containerEl) throw new Error(`Container not found: ${containerSelector}`);

    // Build container metadata
    const containerStyle = window.getComputedStyle(containerEl);
    const containerVisible = containerStyle.display !== 'none' && 
                            containerStyle.visibility !== 'hidden' && 
                            containerStyle.opacity !== '0' &&
                            (containerEl.offsetParent !== null || containerStyle.position === 'fixed');
    
    const containerAttributes = {};
    if (containerEl.attributes) {
      for (let i = 0; i < containerEl.attributes.length; i++) {
        const attr = containerEl.attributes[i];
        containerAttributes[attr.name] = attr.value;
      }
    }

    // Get container type classification
    const containerTypeInfo = window.__chromeLinkHelper._internal_inferElementType(containerEl);

    const containerMetadata = {
      tagName: containerEl.tagName.toLowerCase(),
      cssSelector: window.__chromeLinkHelper._internal_generateSelector(containerEl),
      xpathSelector: window.__chromeLinkHelper._internal_generateXPath(containerEl),
      attributes: containerAttributes,
      textContent: window.__chromeLinkHelper._internal_getDirectText(containerEl),
      visible: containerVisible,
      type: containerTypeInfo.type,
      ...(containerTypeInfo.baseType && { baseType: containerTypeInfo.baseType })
    };

    // Get all descendant elements using modified getContainerElements
    const rawElements = window.__chromeLinkHelper.getContainerElements(
      containerSelector, 
      '*', 
      includeHidden
    );

    // Enrich each element with XPath and type information
    const enrichedElements = rawElements.map(elData => {
      // Re-query the element to generate XPath (need element reference)
      const el = document.querySelector(elData.selector);
      if (!el) return null; // Skip if element can't be re-queried
      
      // Get type classification
      const typeInfo = window.__chromeLinkHelper._internal_inferElementType(el);
      
      return {
        ...elData,
        xpathSelector: window.__chromeLinkHelper._internal_generateXPath(el),
        type: typeInfo.type,
        ...(typeInfo.baseType && { baseType: typeInfo.baseType })
      };
    }).filter(el => el !== null); // Remove any elements that failed re-query

    return {
      container: containerMetadata,
      elements: enrichedElements,
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString()
    };
  },

  /**
   * Enable click tracking for inspector mode (Internal UI only - not available via callHelper)
   */
  _internal_enableClickTracking() {
    // Click handler uses the globally stored buildElementTree
    const buildElementTree = window.__chromeLinkBuildElementTree;
    
    // Store click handler so we can remove it later
    window.__chromeLinkClickHandler = (event) => {

      // Don't prevent default to avoid breaking page functionality
      event.stopPropagation();
      
      const element = event.target;
      const elementData = buildElementTree(element, true);
      
      // Send message via custom event (since we're in MAIN world, chrome.runtime is not available)
      console.log('Dispatching element clicked event:', elementData);
      window.dispatchEvent(new CustomEvent('__chromelink_element_clicked', {
        detail: elementData
      }));
    };
    
    // Add click listener to document
    document.addEventListener('click', window.__chromeLinkClickHandler, true);
    
    // Add visual indicator that inspector is active
    const inspectorIndicator = document.createElement('div');
    inspectorIndicator.id = '__chromelink-inspector-indicator';
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
    if (window.__chromeLinkClickHandler) {
      document.removeEventListener('click', window.__chromeLinkClickHandler, true);
      window.__chromeLinkClickHandler = null;
    }
    
    // Remove visual indicator
    const indicator = document.getElementById('__chromelink-inspector-indicator');
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
      selector: window.__chromeLinkHelper._internal_generateSelector(el),
      attributes: {},
      isClickedElement: el === clickedElement
    };
    
    // Try to generate XPath (may fail for some edge cases)
    try {
      info.xpathSelector = window.__chromeLinkHelper._internal_generateXPath(el);
    } catch (err) {
      console.warn('Failed to generate XPath for element:', el, err);
      info.xpathSelector = null;
    }
    
    // Only include text for parents, clicked element, and children
    if (includeText) {
      info.textContent = window.__chromeLinkHelper._internal_getDirectText(el);
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
      if (sibling.id === '__chromelink-inspector-indicator') return false;
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
      if (currentParent.id !== '__chromelink-inspector-indicator') {
        const parentInfo = buildElementInfo(currentParent, element);
        parentInfo.siblingCount = calculateSiblingCount(currentParent);
        parents.unshift(parentInfo);
      }
      currentParent = currentParent.parentElement;
    }
    
    const clickedInfo = buildElementInfo(element, element);
    clickedInfo.siblingCount = calculateSiblingCount(element);
    
    const children = Array.from(element.children)
      .filter(child => child.id !== '__chromelink-inspector-indicator')
      .map(child => {
        const childInfo = buildElementInfo(child, element);
        childInfo.siblingCount = calculateSiblingCount(child);
        return childInfo;
      });
    
    // Highlight element if requested
    if (shouldHighlight) {
      // Clear any existing highlight timeout for this element
      if (window.__chromeLinkHighlightTimeout) {
        clearTimeout(window.__chromeLinkHighlightTimeout);
      }
      
      // Clear any previously highlighted element
      if (window.__chromeLinkHighlightedElement) {
        const prev = window.__chromeLinkHighlightedElement;
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
      window.__chromeLinkHighlightedElement = originalStyles;
      
      // Apply highlight
      element.style.setProperty('outline', '2px solid #1a73e8', 'important');
      element.style.setProperty('outline-offset', '2px', 'important');
      
      // Set timeout to remove highlight
      window.__chromeLinkHighlightTimeout = setTimeout(() => {
        element.style.outline = originalStyles.originalOutline;
        element.style.outlineOffset = originalStyles.originalOutlineOffset;
        if (!originalStyles.originalOutline) {
          element.style.removeProperty('outline');
        }
        if (!originalStyles.originalOutlineOffset) {
          element.style.removeProperty('outline-offset');
        }
        window.__chromeLinkHighlightedElement = null;
        window.__chromeLinkHighlightTimeout = null;
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
  window.__chromeLinkBuildElementInfo = buildElementInfo;
  window.__chromeLinkCalculateSiblingCount = calculateSiblingCount;
  window.__chromeLinkBuildElementTree = buildElementTree;
})();

// Listen for simulate click events from inspector bridge
window.addEventListener('__chromelink_simulate_click', (event) => {
  const { selector } = event.detail;
  if (selector && window.__chromeLinkBuildElementTree) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        const elementData = window.__chromeLinkBuildElementTree(element, true);
        
        // Dispatch the element data
        window.dispatchEvent(new CustomEvent('__chromelink_element_clicked', {
          detail: elementData
        }));
      }
    } catch (err) {
      console.error('Failed to simulate inspector click:', err);
    }
  }
});

console.log('ChromeLink DOM Helper loaded');

