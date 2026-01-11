/**
 * Unit tests for switchTab command
 */

const { expect } = require('chai');
const { createClient } = require('../helpers/hooks');
const { TEST_URLS } = require('../helpers/test-data');

describe('switchTab command', function() {
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
      url: TEST_URLS.EXAMPLE,
      focus: false
    });
    testTabId = result.tab.id;
  });

  afterEach(async function() {
    await client.cleanupTabs(initialTabIds);
  });

  it('should activate specified tab', async function() {
    const result = await client.sendRequest('switchTab', {
      tabId: testTabId
    });
    
    client.assertValidSuccessResponse(result);
    expect(result.tabId).to.equal(testTabId);
  });

  it('should make tab active after switch', async function() {
    await client.sendRequest('switchTab', {
      tabId: testTabId
    });
    
    const tabs = await client.listTabs();
    const tab = tabs.tabs.find(t => t.id === testTabId);
    
    expect(tab.active).to.be.true;
  });

  describe('error handling', function() {
    it('should handle TAB_NOT_FOUND error', async function() {
      try {
        await client.sendRequest('switchTab', {
          tabId: 999999
        });
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err.message).to.include('TAB_NOT_FOUND');
      }
    });
  });
});
