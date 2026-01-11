/**
 * Unit tests for closeTab command
 */

const { expect } = require('chai');
const { createClient } = require('../helpers/hooks');
const { TEST_URLS } = require('../helpers/test-data');

describe('closeTab command', function() {
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
    // Close any remaining test tabs
    await client.cleanupTabs(initialTabIds);
  });

  it('should close specified tab', async function() {
    // Create a tab to close
    const openResult = await client.sendRequest('openTab', { 
      url: TEST_URLS.EXAMPLE 
    });
    const tabId = openResult.tab.id;
    
    const closeResult = await client.closeTab(tabId);
    
    client.assertValidSuccessResponse(closeResult);
    expect(closeResult.tabId).to.equal(tabId);
  });

  it('should remove tab from tab list', async function() {
    const openResult = await client.sendRequest('openTab', { 
      url: TEST_URLS.EXAMPLE 
    });
    const tabId = openResult.tab.id;
    
    await client.closeTab(tabId);
    
    const tabs = await client.listTabs();
    const closedTab = tabs.tabs.find(t => t.id === tabId);
    
    expect(closedTab).to.be.undefined;
  });

  describe('error handling', function() {
    it('should handle TAB_NOT_FOUND error', async function() {
      try {
        await client.closeTab(999999);
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err.message).to.include('TAB_NOT_FOUND');
      }
    });

    it('should handle already closed tab', async function() {
      const openResult = await client.sendRequest('openTab', { 
        url: TEST_URLS.EXAMPLE 
      });
      const tabId = openResult.tab.id;
      
      await client.closeTab(tabId);
      
      try {
        await client.closeTab(tabId);
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err.message).to.include('TAB_NOT_FOUND');
      }
    });
  });
});
