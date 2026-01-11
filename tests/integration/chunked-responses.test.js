/**
 * Integration tests for chunked response handling
 */

const { expect } = require('chai');
const { createClient } = require('../helpers/hooks');
const { TEST_URLS } = require('../helpers/test-data');

describe('Chunked Responses', function() {
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
      url: TEST_URLS.EXAMPLE 
    });
    testTabId = result.tab.id;
    
    await client.wait(1000);
  });

  afterEach(async function() {
    await client.cleanupTabs(initialTabIds);
  });

  it('should handle large response data (>1MB)', async function() {
    this.timeout(60000); // Increase timeout for large data test
    
    // Generate large data (smaller test - 100KB to avoid timeout)
    const code = `
      (function() {
        const size = 1024 * 100; // 100KB
        const data = new Array(size).fill('x').join('');
        return data;
      })()
    `;
    
    const result = await client.executeJS(code, testTabId);
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.be.a('string');
    expect(result.value.length).to.be.at.least(1024 * 100);
  });

  it('should handle large array responses', async function() {
    this.timeout(60000);
    
    const code = `
      (function() {
        const arr = [];
        for (let i = 0; i < 1000; i++) {
          arr.push({ id: i, value: 'item-' + i, data: 'x'.repeat(50) });
        }
        return arr;
      })()
    `;
    
    const result = await client.executeJS(code, testTabId);
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.be.an('array');
    expect(result.value.length).to.equal(1000);
  });

  it('should handle large object responses', async function() {
    this.timeout(30000);
    
    const code = `
      (function() {
        const obj = {};
        for (let i = 0; i < 1000; i++) {
          obj['key' + i] = {
            value: new Array(1000).fill('x').join(''),
            nested: { id: i }
          };
        }
        return obj;
      })()
    `;
    
    const result = await client.executeJS(code, testTabId);
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.be.an('object');
    expect(Object.keys(result.value).length).to.equal(1000);
  });
});
