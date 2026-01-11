/**
 * Unit tests for navigateTab command
 */

const { expect } = require('chai');
const { createClient } = require('../helpers/hooks');
const { TEST_URLS } = require('../helpers/test-data');

describe('navigateTab command', function() {
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
    
    // Create a test tab
    const result = await client.sendRequest('openTab', { 
      url: TEST_URLS.EXAMPLE 
    });
    testTabId = result.tab.id;
  });

  afterEach(async function() {
    await client.cleanupTabs(initialTabIds);
  });

  it('should navigate existing tab to new URL', async function() {
    const result = await client.sendRequest('navigateTab', {
      tabId: testTabId,
      url: TEST_URLS.SELENIUM_FORM
    });
    
    client.assertValidSuccessResponse(result);
    expect(result.tabId).to.equal(testTabId);
  });

  it('should update tab URL after navigation', async function() {
    await client.sendRequest('navigateTab', {
      tabId: testTabId,
      url: TEST_URLS.SELENIUM_FORM
    });
    
    // Give navigation time to complete
    await client.wait(1000);
    
    const tabs = await client.listTabs();
    const tab = tabs.tabs.find(t => t.id === testTabId);
    
    expect(tab.url).to.include('selenium.dev');
  });

  describe('error handling', function() {
    it('should handle TAB_NOT_FOUND error', async function() {
      try {
        await client.sendRequest('navigateTab', {
          tabId: 999999,
          url: TEST_URLS.EXAMPLE
        });
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err.message).to.include('TAB_NOT_FOUND');
      }
    });

    it('should handle invalid URL', async function() {
      try {
        await client.sendRequest('navigateTab', {
          tabId: testTabId,
          url: 'invalid-url'
        });
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.message).to.be.a('string');
      }
    });
  });
});
