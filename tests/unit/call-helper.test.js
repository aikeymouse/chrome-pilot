/**
 * Unit tests for callHelper command
 */

const { expect } = require('chai');
const { createClient } = require('../helpers/hooks');
const { TEST_URLS } = require('../helpers/test-data');

describe('callHelper command', function() {
  let client;
  let initialTabIds;
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
    initialTabIds = await client.getInitialTabIds();
    
    const result = await client.sendRequest('openTab', { 
      url: TEST_URLS.SELENIUM_FORM 
    });
    testTabId = result.tab.id;
    
    await client.wait(2000); // Wait for form to load
  });

  afterEach(async function() {
    await client.cleanupTabs(initialTabIds);
  });

  it('should call clickElement helper', async function() {
    const result = await client.callHelper(
      'clickElement',
      ['button[type="submit"]'],
      testTabId
    );
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.be.true;
  });

  it('should call getText helper', async function() {
    const result = await client.callHelper(
      'getText',
      ['h1'],
      testTabId
    );
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.be.a('string');
    expect(result.value).to.include('Web form');
  });

  it('should call getHTML helper', async function() {
    const result = await client.callHelper(
      'getHTML',
      ['h1'],
      testTabId
    );
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.be.a('string');
  });

  it('should call elementExists helper', async function() {
    const result = await client.callHelper(
      'elementExists',
      ['h1'],
      testTabId
    );
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.be.true;
  });

  it('should call isVisible helper', async function() {
    const result = await client.callHelper(
      'isVisible',
      ['h1'],
      testTabId
    );
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.be.a('boolean');
  });

  it('should call typeText helper', async function() {
    const result = await client.callHelper(
      'typeText',
      ['#my-text-id', 'Hello World'],
      testTabId
    );
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.be.true;
    
    // Verify the text was typed
    const valueResult = await client.executeJS(
      'document.querySelector("#my-text-id").value',
      testTabId
    );
    expect(valueResult.value).to.equal('Hello World');
  });

  it('should call getLastHTML helper', async function() {
    // The Selenium form has multiple labels with class 'form-label'
    // Get the HTML of the last label on the page
    const result = await client.callHelper(
      'getLastHTML',
      ['label.form-label'],
      testTabId
    );
    
    expect(result).to.be.an('object');
    expect(result.value).to.be.a('string');
    // Should contain text like "Example range" or an input element
    expect(result.value.length).to.be.greaterThan(0);
  });

  it('should call clearContentEditable helper', async function() {
    // First, add some content to the textarea
    await client.callHelper(
      'typeText',
      ['textarea[name="my-textarea"]', 'Test content', false],
      testTabId
    );
    await client.wait(100);
    
    // Now clear it using clearContentEditable
    const result = await client.callHelper(
      'clearContentEditable',
      ['textarea[name="my-textarea"]'],
      testTabId
    );
    
    expect(result).to.be.an('object');
    expect(result.value).to.be.true;
    
    // Verify it was cleared - clearContentEditable sets innerHTML to '<p><br></p>'
    // Note: getHTML returns escaped content for textareas
    const htmlResult = await client.callHelper(
      'getHTML',
      ['textarea[name="my-textarea"]'],
      testTabId
    );
    expect(htmlResult.value).to.equal('&lt;p&gt;&lt;br&gt;&lt;/p&gt;');
  });

  it('should call appendChar helper', async function() {
    // Note: appendChar is designed for contenteditable elements with <p> tags
    // Since Selenium form textarea is not contenteditable and has no <p>,
    // it should throw an error
    
    try {
      await client.callHelper(
        'appendChar',
        ['textarea[name="my-textarea"]', '!'],
        testTabId
      );
      expect.fail('Should have thrown error');
    } catch (err) {
      expect(err.message).to.include('Paragraph element not found');
    }
  });

  it('should call waitForElement helper', async function() {
    // Test waiting for an element that already exists
    // The submit button is already on the page
    const result = await client.callHelper(
      'waitForElement',
      ['button[type="submit"]', 3000],
      testTabId
    );
    
    expect(result).to.be.an('object');
    expect(result.value).to.be.true;
  });

  it('should call highlightElement helper on single element', async function() {
    const result = await client.callHelper(
      'highlightElement',
      ['h1'],
      testTabId
    );
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.equal(1);
    expect(result.type).to.equal('number');
    
    // Verify element is highlighted
    const bgResult = await client.executeJS(
      'document.querySelector("h1").style.background',
      testTabId
    );
    expect(bgResult.value).to.equal('rgba(255, 255, 0, 0.5)');
  });

  it('should call highlightElement helper on multiple elements', async function() {
    // The form has multiple labels
    const result = await client.callHelper(
      'highlightElement',
      ['label.form-label'],
      testTabId
    );
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.be.greaterThan(1);
    expect(result.type).to.equal('number');
    
    // Verify first element is highlighted
    const bgResult = await client.executeJS(
      'document.querySelector("label.form-label").style.background',
      testTabId
    );
    expect(bgResult.value).to.equal('rgba(255, 255, 0, 0.5)');
  });

  it('should call removeHighlights helper', async function() {
    // First highlight some elements
    const highlightResult = await client.callHelper(
      'highlightElement',
      ['label.form-label'],
      testTabId
    );
    const highlightedCount = highlightResult.value;
    expect(highlightedCount).to.be.greaterThan(0);
    
    // Now remove highlights
    const result = await client.callHelper(
      'removeHighlights',
      [],
      testTabId
    );
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.equal(highlightedCount);
    expect(result.type).to.equal('number');
    
    // Verify highlights are removed (background should be empty or not yellow)
    const bgResult = await client.executeJS(
      'document.querySelector("label.form-label").style.background',
      testTabId
    );
    expect(bgResult.value).to.not.equal('yellow');
  });

  it('should not duplicate highlights when called twice', async function() {
    // First highlight
    const result1 = await client.callHelper(
      'highlightElement',
      ['h1'],
      testTabId
    );
    expect(result1.value).to.equal(1);
    
    // Call again - should not add duplicate
    const result2 = await client.callHelper(
      'highlightElement',
      ['h1'],
      testTabId
    );
    expect(result2.value).to.equal(0); // No new highlights added
  });

  it('should return 0 when highlighting non-existent elements', async function() {
    const result = await client.callHelper(
      'highlightElement',
      ['#totally-nonexistent-element-12345'],
      testTabId
    );
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.equal(0);
    expect(result.type).to.equal('number');
  });

  describe('error handling', function() {
    it('should handle TAB_NOT_FOUND error', async function() {
      try {
        await client.callHelper('getText', ['h1'], 999999);
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err.message).to.include('TAB_NOT_FOUND');
      }
    });

    it('should handle unknown helper function', async function() {
      try {
        await client.callHelper('nonExistentHelper', [], testTabId);
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.message).to.be.a('string');
      }
    });

    it('should handle element not found', async function() {
      const result = await client.callHelper(
        'elementExists',
        ['#nonexistent-element'],
        testTabId
      );
      
      client.assertValidExecutionResponse(result);
      expect(result.value).to.be.false;
    });

    it('should block calls to _internal_ prefixed functions', async function() {
      try {
        await client.callHelper('_internal_enableClickTracking', [], testTabId);
        expect.fail('Should have thrown PERMISSION_DENIED error');
      } catch (err) {
        expect(err.message).to.include('PERMISSION_DENIED');
        expect(err.message).to.include('_internal_enableClickTracking');
        expect(err.message).to.include('restricted to internal use only');
      }
    });

    it('should block calls to _internal_disableClickTracking', async function() {
      try {
        await client.callHelper('_internal_disableClickTracking', [], testTabId);
        expect.fail('Should have thrown PERMISSION_DENIED error');
      } catch (err) {
        expect(err.message).to.include('PERMISSION_DENIED');
        expect(err.message).to.include('_internal_disableClickTracking');
      }
    });

    it('should block calls to _internal_cropScreenshotToElements', async function() {
      try {
        await client.callHelper('_internal_cropScreenshotToElements', ['data:image/png;base64,fake', []], testTabId);
        expect.fail('Should have thrown PERMISSION_DENIED error');
      } catch (err) {
        expect(err.message).to.include('PERMISSION_DENIED');
        expect(err.message).to.include('_internal_cropScreenshotToElements');
      }
    });

    it('should block calls to _internal_generateSelector', async function() {
      try {
        await client.callHelper('_internal_generateSelector', [null], testTabId);
        expect.fail('Should have thrown PERMISSION_DENIED error');
      } catch (err) {
        expect(err.message).to.include('PERMISSION_DENIED');
        expect(err.message).to.include('_internal_generateSelector');
      }
    });
  });
});
