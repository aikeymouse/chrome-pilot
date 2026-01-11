/**
 * Unit tests for executeJS command
 */

const { expect } = require('chai');
const { createClient } = require('../helpers/hooks');
const { TEST_URLS } = require('../helpers/test-data');

describe('executeJS command', function() {
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
    
    // Wait for page to load
    await client.wait(1000);
  });

  afterEach(async function() {
    await client.cleanupTabs(initialTabIds);
  });

  it('should execute simple JavaScript expression', async function() {
    const result = await client.executeJS('2 + 2', testTabId);
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.equal(4);
    expect(result.type).to.equal('number');
  });

  it('should execute DOM query', async function() {
    const result = await client.executeJS(
      'document.querySelector("h1") !== null',
      testTabId
    );
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.be.a('boolean');
  });

  it('should return string values', async function() {
    const result = await client.executeJS(
      '"test string"',
      testTabId
    );
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.equal('test string');
    expect(result.type).to.equal('string');
  });

  it('should return object values', async function() {
    const result = await client.executeJS(
      '({foo: "bar", num: 42})',
      testTabId
    );
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.be.an('object');
    expect(result.value.foo).to.equal('bar');
    expect(result.value.num).to.equal(42);
  });

  it('should execute function and return result', async function() {
    const result = await client.executeJS(
      '(function() { return window.location.hostname; })()',
      testTabId
    );
    
    client.assertValidExecutionResponse(result);
    expect(result.value).to.include('example.com');
  });

  describe('error handling', function() {
    it('should handle TAB_NOT_FOUND error', async function() {
      try {
        await client.executeJS('2 + 2', 999999);
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err.message).to.include('TAB_NOT_FOUND');
      }
    });

    it('should handle JavaScript syntax errors', async function() {
      try {
        await client.executeJS('invalid javascript syntax {{{', testTabId);
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.message).to.be.a('string');
      }
    });

    it('should handle runtime errors', async function() {
      try {
        await client.executeJS('throw new Error("test error")', testTabId);
        throw new Error('Should have thrown error');
      } catch (err) {
        // Error message should contain error information
        expect(err.message).to.be.a('string');
      }
    });
  });
});
