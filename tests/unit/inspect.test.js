/**
 * Unit tests for inspectElement helper function
 */

const { expect } = require('chai');
const { createClient } = require('../helpers/hooks');
const { TEST_URLS, TEST_SELECTORS } = require('../helpers/test-data');

describe('inspectElement helper', function() {
  let client;
  let testTabId;

  before(async function() {
    client = createClient();
    await client.connect();
    await client.waitForConnection();
  });

  after(function() {
    if (client) {
      client.close();
    }
  });

  beforeEach(async function() {
    // Create a test tab
    const result = await client.sendRequest('openTab', { 
      url: TEST_URLS.SELENIUM_FORM 
    });
    testTabId = result.tab.id;
    
    // Wait for page to load
    await client.wait(1000);
  });

  afterEach(async function() {
    // Close test tab
    if (testTabId) {
      try {
        await client.closeTab(testTabId);
      } catch (err) {
        // Tab may already be closed
      }
      testTabId = null;
    }
  });

  describe('basic functionality', function() {
    it('should inspect text input element', async function() {
      const selector = TEST_SELECTORS.SELENIUM_TEXT_INPUT; // #my-text-id
      
      const response = await client.callHelper('inspectElement', [selector], testTabId);
      const result = response.value;
      
      // Validate response structure
      expect(result).to.be.an('object');
      expect(result.clickedElement).to.be.an('object');
      expect(result.parents).to.be.an('array');
      expect(result.children).to.be.an('array');
      expect(result.timestamp).to.be.a('number');
      
      // Validate clicked element (text input)
      const element = result.clickedElement;
      expect(element.tagName).to.equal('input');
      expect(element.attributes).to.be.an('object');
      expect(element.attributes.id).to.equal('my-text-id');
      expect(element.attributes.type).to.equal('text');
      expect(element.attributes.name).to.equal('my-text');
      expect(element.attributes.class).to.equal('form-control');
      expect(element.attributes.myprop).to.equal('myvalue');
      expect(element.selector).to.be.a('string');
      expect(element.textContent).to.be.a('string');
      expect(element.isClickedElement).to.equal(true);
      expect(element.siblingCount).to.be.a('number');
      
      // Validate parents array (outermost parent first)
      expect(result.parents.length).to.be.greaterThan(0);
      const firstParent = result.parents[0];
      expect(firstParent.tagName).to.equal('main');
      
      // Should have label as one of the parents (immediate parent)
      const labelParent = result.parents.find(p => p.tagName === 'label');
      expect(labelParent).to.exist;
      expect(labelParent.attributes.class).to.equal('form-label w-100');
      
      // Input element should have no children
      expect(result.children).to.have.lengthOf(0);
    });

    it('should inspect submit button', async function() {
      const selector = TEST_SELECTORS.SELENIUM_SUBMIT_BUTTON; // button[type="submit"]
      
      const response = await client.callHelper('inspectElement', [selector], testTabId);
      const result = response.value;
      
      // Validate clicked element (button)
      const element = result.clickedElement;
      expect(element.tagName).to.equal('button');
      expect(element.attributes).to.be.an('object');
      expect(element.attributes.type).to.equal('submit');
      expect(element.attributes.class).to.equal('btn btn-outline-primary mt-3');
      expect(element.textContent).to.include('Submit');
      
      // Button children (may be empty or have text nodes)
      expect(result.children).to.be.an('array');
      if (result.children.length > 0) {
        const textNode = result.children.find(child => child.nodeType === 3);
        if (textNode) {
          expect(textNode.textContent).to.include('Submit');
        }
      }
      
      // Validate parents
      expect(result.parents.length).to.be.greaterThan(0);
    });

    it('should inspect form element with children', async function() {
      const selector = 'form';
      
      const response = await client.callHelper('inspectElement', [selector], testTabId);
      const result = response.value;
      
      // Validate clicked element (form)
      const element = result.clickedElement;
      expect(element.tagName).to.equal('form');
      expect(element.attributes.method).to.equal('get');
      expect(element.attributes.action).to.equal('submitted-form.html');
      
      // Form should have children (only element children, not text nodes)
      expect(result.children).to.be.an('array');
      expect(result.children.length).to.be.greaterThan(0);
      
      // Verify some expected children exist
      const divChildren = result.children.filter(child => child.tagName === 'div');
      expect(divChildren.length).to.be.greaterThan(0);
      
      // Validate parents
      expect(result.parents.length).to.be.at.least(2);
      const containerParent = result.parents.find(p => p.attributes?.class?.includes('container'));
      expect(containerParent).to.exist;
    });

    it('should inspect checkbox element', async function() {
      const selector = '#my-check-1';
      
      const response = await client.callHelper('inspectElement', [selector], testTabId);
      const result = response.value;
      
      const element = result.clickedElement;
      expect(element.tagName).to.equal('input');
      expect(element.attributes.id).to.equal('my-check-1');
      expect(element.attributes.type).to.equal('checkbox');
      expect(element.attributes.name).to.equal('my-check');
      expect(element.attributes.checked).to.equal('');
      expect(element.attributes.class).to.equal('form-check-input');
    });

    it('should inspect select dropdown element', async function() {
      const selector = 'select[name="my-select"]';
      
      const response = await client.callHelper('inspectElement', [selector], testTabId);
      const result = response.value;
      
      const element = result.clickedElement;
      expect(element.tagName).to.equal('select');
      expect(element.attributes.name).to.equal('my-select');
      expect(element.attributes.class).to.equal('form-select');
      
      // Select should have option children
      const optionChildren = result.children.filter(child => child.tagName === 'option');
      expect(optionChildren.length).to.equal(4);
      
      // Verify first option
      const firstOption = optionChildren[0];
      expect(firstOption.attributes.selected).to.equal('');
      expect(firstOption.textContent).to.include('Open this select menu');
      
      // Verify option with value
      const secondOption = optionChildren[1];
      expect(secondOption.attributes.value).to.equal('1');
      expect(secondOption.textContent).to.include('One');
    });

    it('should inspect disabled input element', async function() {
      const selector = 'input[name="my-disabled"]';
      
      const response = await client.callHelper('inspectElement', [selector], testTabId);
      const result = response.value;
      
      const element = result.clickedElement;
      expect(element.tagName).to.equal('input');
      expect(element.attributes.name).to.equal('my-disabled');
      expect(element.attributes.disabled).to.equal('');
      expect(element.attributes.placeholder).to.equal('Disabled input');
    });

    it('should inspect readonly input element', async function() {
      const selector = 'input[name="my-readonly"]';
      
      const response = await client.callHelper('inspectElement', [selector], testTabId);
      const result = response.value;
      
      const element = result.clickedElement;
      expect(element.tagName).to.equal('input');
      expect(element.attributes.name).to.equal('my-readonly');
      expect(element.attributes.readonly).to.equal('');
      expect(element.attributes.value).to.equal('Readonly input');
    });

    it('should inspect textarea element', async function() {
      const selector = 'textarea[name="my-textarea"]';
      
      const response = await client.callHelper('inspectElement', [selector], testTabId);
      const result = response.value;
      
      const element = result.clickedElement;
      expect(element.tagName).to.equal('textarea');
      expect(element.attributes.name).to.equal('my-textarea');
      expect(element.attributes.class).to.equal('form-control');
      expect(element.attributes.rows).to.equal('3');
    });
  });

  describe('response validation', function() {
    it('should include valid CSS selector', async function() {
      const response = await client.callHelper('inspectElement', ['#my-text-id'], testTabId);
      const result = response.value;
      
      expect(result.clickedElement.selector).to.be.a('string');
      expect(result.clickedElement.selector.length).to.be.greaterThan(0);
      
      // Selector should be usable to find the element
      expect(result.clickedElement.selector).to.match(/input|#my-text-id/i);
    });

    it('should include textContent', async function() {
      const response = await client.callHelper('inspectElement', ['#my-text-id'], testTabId);
      const result = response.value;
      
      expect(result.clickedElement.textContent).to.be.a('string');
    });    it('should include current timestamp', async function() {
      const before = Date.now();
      const response = await client.callHelper('inspectElement', ['#my-text-id'], testTabId);
      const result = response.value;
      const after = Date.now();
      
      expect(result.timestamp).to.be.at.least(before);
      expect(result.timestamp).to.be.at.most(after);
    });

    it('should include all element attributes', async function() {
      const response = await client.callHelper('inspectElement', ['#my-text-id'], testTabId);
      const result = response.value;
      
      const attrs = result.clickedElement.attributes;
      expect(attrs).to.have.property('type');
      expect(attrs).to.have.property('class');
      expect(attrs).to.have.property('name');
      expect(attrs).to.have.property('id');
      expect(attrs).to.have.property('myprop');
    });

    it('should properly represent parent hierarchy', async function() {
      const response = await client.callHelper('inspectElement', ['#my-text-id'], testTabId);
      const result = response.value;
      
      // Parents should be ordered from outermost inward
      expect(result.parents[0].tagName).to.equal('main');
      
      // Should have label and form as parents
      const labelParent = result.parents.find(p => p.tagName === 'label');
      const formParent = result.parents.find(p => p.tagName === 'form');
      expect(labelParent).to.exist;
      expect(formParent).to.exist;
    });

    it('should include text content for elements with text', async function() {
      const response = await client.callHelper('inspectElement', ['button[type="submit"]'], testTabId);
      const result = response.value;
      
      expect(result.clickedElement.textContent).to.be.a('string');
      expect(result.clickedElement.textContent).to.include('Submit');
    });
  });

  describe('edge cases', function() {
    it('should handle element with no children', async function() {
      const response = await client.callHelper('inspectElement', ['input[type="hidden"]'], testTabId);
      const result = response.value;
      
      expect(result.children).to.be.an('array');
      expect(result.children).to.have.lengthOf(0);
    });

    it('should handle elements with many children', async function() {
      const response = await client.callHelper('inspectElement', ['form'], testTabId);
      const result = response.value;
      
      expect(result.children).to.be.an('array');
      expect(result.children.length).to.be.greaterThan(0);
      
      // Should include element nodes
      const elementNodes = result.children.filter(c => c.tagName);
      expect(elementNodes.length).to.be.greaterThan(0);
      // Text nodes may or may not be included depending on implementation
    });

    it('should throw error for invalid selector', async function() {
      try {
        await client.callHelper('inspectElement', ['#nonexistent-element-12345'], testTabId);
        expect.fail('Should have thrown error for invalid selector');
      } catch (err) {
        expect(err.message).to.exist;
        expect(err.message).to.match(/not found|null|invalid/i);
      }
    });

    it('should handle elements with special characters in attributes', async function() {
      // Color input has value with #
      const response = await client.callHelper('inspectElement', ['input[type="color"]'], testTabId);
      const result = response.value;
      
      const element = result.clickedElement;
      expect(element.attributes.value).to.equal('#563d7c');
    });

    it('should handle datalist element', async function() {
      const response = await client.callHelper('inspectElement', ['#my-options'], testTabId);
      const result = response.value;
      
      const element = result.clickedElement;
      expect(element.tagName).to.equal('datalist');
      expect(element.attributes.id).to.equal('my-options');
      
      // Should have option children
      const options = result.children.filter(c => c.tagName === 'option');
      expect(options.length).to.equal(5);
      expect(options[0].attributes.value).to.equal('San Francisco');
    });
  });
});
