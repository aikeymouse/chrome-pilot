#!/usr/bin/env node
/**
 * ChromePilot Form Analyzer
 * Analyzes DOM tree to find form containers and extract all form elements with stable selectors
 * 
 * Usage:
 *   node analyze-form-client.js <url> [startSelector]
 * 
 * Examples:
 *   node analyze-form-client.js https://www.selenium.dev/selenium/web/web-form.html
 *   node analyze-form-client.js https://example.com "button.submit"
 */

const ChromePilotClient = require('./chromepilot-client');

class FormAnalyzer {
  constructor() {
    this.client = new ChromePilotClient();
    this.sessionId = null;
  }

  async connect() {
    await this.client.connect();
    this.sessionId = this.client.sessionId;
  }

  /**
   * Find semantic container from parent hierarchy
   */
  findSemanticContainer(parents) {
    // Priority order: form > [role] > [id] > semantic tags > class-based
    // Search from closest parent (index 0) outward
    for (let i = 0; i < parents.length; i++) {
      const parent = parents[i];
      
      // 1. Form elements (highest priority)
      if (parent.tagName === 'form') {
        console.log(`  ✓ Found FORM container: ${parent.selector}`);
        return parent;
      }
    }
    
    // Second pass for other semantic containers
    for (let i = 0; i < parents.length; i++) {
      const parent = parents[i];
      
      // 2. ARIA roles
      if (parent.attributes.role) {
        const role = parent.attributes.role;
        if (['form', 'dialog', 'main', 'region'].includes(role)) {
          console.log(`  ✓ Found container with role="${role}": ${parent.selector}`);
          return parent;
        }
      }
      
      // 3. ID-based containers
      if (parent.attributes.id) {
        const id = parent.attributes.id.toLowerCase();
        if (id.includes('form') || id.includes('dialog') || id.includes('modal') || id.includes('container')) {
          console.log(`  ✓ Found container with id: ${parent.selector}`);
          return parent;
        }
      }
      
      // 4. Semantic HTML tags
      if (['main', 'section', 'article', 'aside', 'dialog'].includes(parent.tagName)) {
        console.log(`  ✓ Found semantic container: <${parent.tagName}> ${parent.selector}`);
        return parent;
      }
      
      // 5. Meaningful class names
      const className = parent.attributes.class || '';
      if (className.match(/\b(form|dialog|modal|container|wrapper|panel)\b/i)) {
        console.log(`  ✓ Found container with class: ${parent.selector}`);
        return parent;
      }
    }
    
    // Fallback to first parent with ID
    const parentWithId = parents.find(p => p.attributes.id);
    if (parentWithId) {
      console.log(`  ⚠ Using fallback (first parent with ID): ${parentWithId.selector}`);
      return parentWithId;
    }
    
    // Last resort: outermost parent
    console.log(`  ⚠ Using fallback (outermost parent): ${parents[0].selector}`);
    return parents[0];
  }

  /**
   * Generate stable selector for an element (from executeJS result)
   */
  generateStableSelector(element) {
    const { tagName, id, name, type, placeholder, className, dataAttributes, value } = element;
    
    // Priority: id > name (with value for radio/checkbox) > data-testid > data-test > type+placeholder > unique class
    
    if (id) {
      return `#${id}`;
    }
    
    // For radio/checkbox groups, use name + value to differentiate
    if (name && (type === 'radio' || type === 'checkbox') && value) {
      return `input[name="${name}"][value="${value}"]`;
    }
    
    if (name) {
      return `${tagName}[name="${name}"]`;
    }
    
    if (dataAttributes['data-testid']) {
      return `[data-testid="${dataAttributes['data-testid']}"]`;
    }
    
    if (dataAttributes['data-test']) {
      return `[data-test="${dataAttributes['data-test']}"]`;
    }
    
    // For inputs, use type + placeholder combination
    if (tagName === 'input' && type && placeholder) {
      return `input[type="${type}"][placeholder="${placeholder}"]`;
    }
    
    // Check for unique class
    if (className) {
      const classes = className.split(' ').filter(Boolean);
      for (const cls of classes) {
        // Skip generic utility classes
        if (!cls.match(/^(btn|button|input|form|text|label|field|mb|mt|ml|mr|p-|m-|w-|h-)\d*$/)) {
          // Would need to check uniqueness in real DOM, for now just use it
          return `.${cls}`;
        }
      }
    }
    
    // Fallback to tagName with type
    if (type) {
      return `${tagName}[type="${type}"]`;
    }
    
    return tagName;
  }

  /**
   * Find label for form element (from executeJS result)
   */
  findLabel(element) {
    const { id, placeholder, name } = element;
    
    // Check for explicit label association
    if (id) {
      return `label[for="${id}"]`;
    }
    
    // Check for placeholder
    if (placeholder) {
      return placeholder;
    }
    
    // For inputs, the name attribute might be descriptive
    if (name) {
      return name;
    }
    
    return null;
  }

  /**
   * Analyze form starting from a specific element
   */
  async analyzeForm(tabId, startSelector = 'form input, form button, form select, form textarea') {
    console.log('\n🔍 Starting form analysis...\n');
    console.log(`📍 Start selector: ${startSelector}\n`);
    
    // Step 1: Inspect starting element to get tree structure
    console.log('Step 1: Inspecting element tree...');
    const inspectResult = await this.client.sendRequest('callHelper', {
      tabId,
      functionName: 'inspectElement',
      args: [startSelector]
    });
    
    if (!inspectResult.value) {
      throw new Error('Failed to inspect element');
    }
    
    const tree = inspectResult.value;
    console.log(`  ✓ Clicked element: <${tree.clickedElement.tagName}> ${tree.clickedElement.selector}`);
    console.log(`  ✓ Found ${tree.parents.length} parent(s)`);
    console.log(`  ✓ Found ${tree.children.length} child(ren)\n`);
    
    // Step 2: Find semantic container
    console.log('Step 2: Finding semantic container...');
    const container = this.findSemanticContainer(tree.parents);
    console.log('');
    
    // Step 3: Query all form elements within container
    console.log('Step 3: Extracting form elements...');
    const code = `(function() { const container = document.querySelector('${container.selector}'); if (!container) return []; const elements = Array.from(container.querySelectorAll('input, button, select, textarea')); return elements.map(el => { const rect = el.getBoundingClientRect(); return { tagName: el.tagName.toLowerCase(), type: el.type || '', name: el.name || '', id: el.id || '', value: el.value || '', placeholder: el.placeholder || '', required: el.required || false, disabled: el.disabled || false, className: el.className || '', textContent: el.textContent ? el.textContent.trim() : '', visible: rect.width > 0 && rect.height > 0, dataAttributes: Object.fromEntries(Array.from(el.attributes).filter(attr => attr.name.startsWith('data-')).map(attr => [attr.name, attr.value])) }; }); })()`;
    
    const elementsResult = await this.client.sendRequest('executeJS', {
      tabId,
      code
    });
    
    if (!elementsResult || !elementsResult.value) {
      throw new Error('Failed to extract form elements');
    }
    
    const elements = elementsResult.value;
    console.log(`  ✓ Found ${elements.length} form element(s)\n`);
    
    // Step 4: Generate stable selectors and organize by type
    console.log('Step 4: Generating stable selectors...\n');
    
    const analyzed = {
      container: {
        selector: container.selector,
        tagName: container.tagName,
        id: container.attributes.id || null,
        class: container.attributes.class || null
      },
      elements: elements.map(el => {
        const stableSelector = this.generateStableSelector(el);
        const label = this.findLabel(el, container.selector);
        
        return {
          selector: stableSelector,
          tagName: el.tagName,
          type: el.type,
          name: el.name,
          id: el.id,
          label: label,
          placeholder: el.placeholder,
          required: el.required,
          disabled: el.disabled,
          visible: el.visible,
          value: el.value?.substring(0, 50) + (el.value?.length > 50 ? '...' : ''),
          textContent: el.textContent?.substring(0, 50) + (el.textContent?.length > 50 ? '...' : '')
        };
      })
    };
    
    // Step 5: Validate selectors by testing with highlightElement
    console.log('Step 5: Validating selectors...');
    const validationResults = [];
    
    for (const [index, element] of analyzed.elements.entries()) {
      const result = await this.client.sendRequest('callHelper', {
        tabId,
        functionName: 'highlightElement',
        args: [element.selector]
      });
      
      const matchCount = result.value;
      const isValid = matchCount === 1;
      
      validationResults.push({
        selector: element.selector,
        matchCount,
        isValid,
        tagName: element.tagName,
        type: element.type
      });
      
      if (!isValid) {
        console.log(`  ⚠ ${element.selector} matches ${matchCount} elements (expected 1)`);
      }
    }
    
    const validCount = validationResults.filter(r => r.isValid).length;
    const totalCount = validationResults.length;
    console.log(`  ✓ Validated ${totalCount} selectors: ${validCount} unique, ${totalCount - validCount} ambiguous`);
    console.log(`  ⏳ Keeping highlights visible for 5 seconds...\n`);
    
    // Wait 5 seconds before clearing highlights
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Clear highlights
    await this.client.sendRequest('callHelper', {
      tabId,
      functionName: 'removeHighlights',
      args: []
    });
    
    analyzed.validation = {
      total: totalCount,
      unique: validCount,
      ambiguous: totalCount - validCount,
      results: validationResults
    };
    
    return analyzed;
  }

  /**
   * Display analysis results
   */
  displayResults(analysis) {
    console.log('═'.repeat(80));
    console.log('📋 FORM ANALYSIS RESULTS');
    console.log('═'.repeat(80));
    console.log('');
    
    console.log('📦 Container:');
    console.log(`   Tag:      <${analysis.container.tagName}>`);
    console.log(`   Selector: ${analysis.container.selector}`);
    if (analysis.container.id) console.log(`   ID:       ${analysis.container.id}`);
    if (analysis.container.class) console.log(`   Class:    ${analysis.container.class}`);
    console.log('');
    
    // Display validation summary
    if (analysis.validation) {
      const { total, unique, ambiguous } = analysis.validation;
      const percentage = ((unique / total) * 100).toFixed(1);
      console.log('✅ Selector Validation:');
      console.log(`   Total:     ${total}`);
      console.log(`   Unique:    ${unique} (${percentage}%)`);
      if (ambiguous > 0) {
        console.log(`   Ambiguous: ${ambiguous}`);
      }
      console.log('');
    }
    
    console.log('📝 Form Elements:');
    console.log('');
    
    // Group by type
    const grouped = {};
    for (const el of analysis.elements) {
      const key = el.type || el.tagName;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(el);
    }
    
    for (const [type, elements] of Object.entries(grouped)) {
      console.log(`  ${type.toUpperCase()} (${elements.length}):`);
      for (const el of elements) {
        // Check if selector is validated
        const validation = analysis.validation?.results.find(r => r.selector === el.selector);
        const validationMark = validation ? (validation.isValid ? '✓' : `⚠(${validation.matchCount})`) : '';
        
        console.log(`    ${validationMark ? validationMark + ' ' : ''}• ${el.selector}`);
        if (el.label) console.log(`      Label: ${el.label}`);
        if (el.name) console.log(`      Name: ${el.name}`);
        if (el.placeholder) console.log(`      Placeholder: ${el.placeholder}`);
        if (el.required) console.log(`      ⚠ Required`);
        if (el.disabled) console.log(`      🚫 Disabled`);
        if (!el.visible) console.log(`      👁️ Hidden`);
        if (el.value) console.log(`      Value: ${el.value}`);
        if (el.textContent && el.tagName === 'button') console.log(`      Text: ${el.textContent}`);
        console.log('');
      }
    }
    
    console.log('═'.repeat(80));
    console.log('');
    console.log('💡 Usage Example:');
    console.log('');
    console.log('```javascript');
    console.log('// Fill form using stable selectors:');
    for (const el of analysis.elements.slice(0, 5)) {
      if (el.tagName === 'input' && el.type !== 'submit' && el.type !== 'button') {
        console.log(`await client.callHelper('typeText', ['${el.selector}', 'value', true]);`);
      } else if (el.tagName === 'button' || el.type === 'submit') {
        console.log(`await client.callHelper('clickElement', ['${el.selector}']);`);
      }
    }
    console.log('```');
    console.log('');
  }

  async close() {
    if (this.client) {
      this.client.close();
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('');
    console.log('ChromePilot Form Analyzer');
    console.log('═'.repeat(80));
    console.log('');
    console.log('Analyzes web page forms and generates stable CSS selectors for automation.');
    console.log('');
    console.log('Usage:');
    console.log('  node analyze-form-client.js <url> [startSelector]');
    console.log('');
    console.log('Arguments:');
    console.log('  url            URL to analyze');
    console.log('  startSelector  CSS selector to start analysis from (optional)');
    console.log('                 Default: "form input, form button, form select, form textarea"');
    console.log('');
    console.log('Examples:');
    console.log('  node analyze-form-client.js https://www.selenium.dev/selenium/web/web-form.html');
    console.log('  node analyze-form-client.js https://example.com "button.submit"');
    console.log('  node analyze-form-client.js https://example.com "input[type=email]"');
    console.log('');
    process.exit(0);
  }
  
  const url = args[0];
  const startSelector = args[1] || 'form input, form button, form select, form textarea';
  
  const analyzer = new FormAnalyzer();
  
  try {
    console.log('');
    console.log('🚀 ChromePilot Form Analyzer');
    console.log('═'.repeat(80));
    
    // Connect to ChromePilot
    console.log('\n📡 Connecting to ChromePilot...');
    await analyzer.connect();
    console.log('✓ Connected\n');
    
    // Open tab
    console.log(`🌐 Opening URL: ${url}`);
    const openResult = await analyzer.client.sendRequest('openTab', {
      url,
      focus: true
    });
    const tabId = openResult.tab.id;
    console.log(`✓ Tab opened (ID: ${tabId})\n`);
    
    // Wait for page to load
    console.log('⏳ Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✓ Page loaded\n');
    
    // Analyze form
    const analysis = await analyzer.analyzeForm(tabId, startSelector);
    
    // Display results
    analyzer.displayResults(analysis);
    
    // Output JSON for programmatic use
    console.log('📄 JSON Output:');
    console.log(JSON.stringify(analysis, null, 2));
    console.log('');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    analyzer.close();
    // Force exit immediately after closing
    process.exit(0);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = FormAnalyzer;
