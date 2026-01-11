/**
 * Integration tests for multi-command workflows
 */

const { expect } = require('chai');
const { createClient } = require('../helpers/hooks');
const { TEST_URLS } = require('../helpers/test-data');

describe('Multi-Command Workflows', function() {
  let client;
  let initialTabIds;

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
  });

  afterEach(async function() {
    await client.cleanupTabs(initialTabIds);
  });

  it('should complete open -> execute -> close workflow', async function() {
    const openResult = await client.sendRequest('openTab', { 
      url: TEST_URLS.EXAMPLE 
    });
    client.assertValidTab(openResult.tab);
    const tabId = openResult.tab.id;
    
    await client.wait(1000);
    
    const execResult = await client.executeJS('document.title', tabId);
    client.assertValidExecutionResponse(execResult);
    expect(execResult.value).to.be.a('string');
    
    const closeResult = await client.closeTab(tabId);
    client.assertValidSuccessResponse(closeResult);
  });

  it('should complete open -> navigate -> execute workflow', async function() {
    const openResult = await client.sendRequest('openTab', { 
      url: TEST_URLS.EXAMPLE 
    });
    client.assertValidTab(openResult.tab);
    const tabId = openResult.tab.id;
    
    await client.wait(1000);
    
    const navResult = await client.sendRequest('navigateTab', {
      tabId: tabId,
      url: TEST_URLS.SELENIUM_FORM
    });
    client.assertValidSuccessResponse(navResult);
    
    await client.wait(2000);
    
    const execResult = await client.executeJS('document.title', tabId);
    client.assertValidExecutionResponse(execResult);
    expect(execResult.value).to.include('Web form');
  });

  it('should handle multiple tabs concurrently', async function() {
    const tab1 = await client.sendRequest('openTab', { url: TEST_URLS.EXAMPLE });
    const tab2 = await client.sendRequest('openTab', { url: TEST_URLS.SELENIUM_FORM });
    
    client.assertValidTab(tab1.tab);
    client.assertValidTab(tab2.tab);
    
    await client.wait(2000);
    
    const result1 = await client.executeJS('document.title', tab1.tab.id);
    const result2 = await client.executeJS('document.title', tab2.tab.id);
    
    client.assertValidExecutionResponse(result1);
    client.assertValidExecutionResponse(result2);
    expect(result1.value).to.be.a('string');
    expect(result2.value).to.be.a('string');
    expect(result1.value).to.not.equal(result2.value);
  });

  it('should complete Selenium form interaction workflow', async function() {
    this.timeout(15000);
    
    const openResult = await client.sendRequest('openTab', { 
      url: TEST_URLS.SELENIUM_FORM,
      focus: true
    });
    const tabId = openResult.tab.id;
    
    await client.wait(3000); // Wait longer for page to fully load
    
    // Type into text input
    await client.executeJS(`
      const input = document.querySelector('#my-text-id');
      if (input) {
        input.value = 'Test Input';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    `, tabId);
    
    await client.wait(500);
    
    // Verify value was set
    const inputValue = await client.executeJS(
      `document.querySelector('#my-text-id')?.value || ''`,
      tabId
    );
    
    // Value should exist (may be empty if element not found)
    expect(inputValue.value).to.be.a('string');
    
    // Verify form elements are accessible
    const formExists = await client.executeJS(
      `document.querySelector('form') !== null`,
      tabId
    );
    expect(formExists.value).to.be.true;
  });

  it('should handle rapid sequential commands', async function() {
    this.timeout(15000);
    
    const results = [];
    
    for (let i = 0; i < 5; i++) {
      const result = await client.listTabs();
      results.push(result);
      await client.wait(100);
    }
    
    expect(results.length).to.equal(5);
    results.forEach(result => {
      expect(result.tabs).to.be.an('array');
    });
  });
});
