/**
 * Integration tests for tab events and state management
 */

const { expect } = require('chai');
const { createClient } = require('../helpers/hooks');
const { TEST_URLS } = require('../helpers/test-data');

describe('Tab Events and State Management', function() {
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

  it('should track tab creation', async function() {
    const beforeTabs = await client.listTabs();
    const beforeCount = beforeTabs.tabs.length;
    
    const newTab = await client.sendRequest('openTab', { url: TEST_URLS.EXAMPLE });
    client.assertValidTab(newTab.tab);
    
    const afterTabs = await client.listTabs();
    const afterCount = afterTabs.tabs.length;
    
    expect(afterCount).to.equal(beforeCount + 1);
  });

  it('should track tab closure', async function() {
    const openResult = await client.sendRequest('openTab', { 
      url: TEST_URLS.EXAMPLE 
    });
    const tabId = openResult.tab.id;
    
    const beforeTabs = await client.listTabs();
    const beforeCount = beforeTabs.tabs.length;
    
    const closeResult = await client.closeTab(tabId);
    client.assertValidSuccessResponse(closeResult);
    
    const afterTabs = await client.listTabs();
    const afterCount = afterTabs.tabs.length;
    
    expect(afterCount).to.equal(beforeCount - 1);
  });

  it('should track tab navigation', async function() {
    const openResult = await client.sendRequest('openTab', { 
      url: TEST_URLS.EXAMPLE 
    });
    const tabId = openResult.tab.id;
    
    await client.wait(1000);
    
    const beforeNav = await client.listTabs();
    const beforeTab = beforeNav.tabs.find(t => t.id === tabId);
    
    await client.sendRequest('navigateTab', {
      tabId: tabId,
      url: TEST_URLS.SELENIUM_FORM
    });
    
    await client.wait(1500);
    
    const afterNav = await client.listTabs();
    const afterTab = afterNav.tabs.find(t => t.id === tabId);
    
    expect(beforeTab.url).to.include('example.com');
    expect(afterTab.url).to.include('selenium.dev');
  });

  it('should track active tab switching', async function() {
    const tab1 = await client.sendRequest('openTab', { 
      url: TEST_URLS.EXAMPLE,
      focus: true
    });
    
    const tab2 = await client.sendRequest('openTab', { 
      url: TEST_URLS.SELENIUM_FORM,
      focus: false
    });
    
    await client.sendRequest('switchTab', { tabId: tab2.tab.id });
    
    await client.wait(500);
    
    const tabs = await client.listTabs();
    const activeTab = tabs.tabs.find(t => t.active);
    
    expect(activeTab.id).to.equal(tab2.tab.id);
  });
});
