/**
 * Unit tests for screenshot functionality
 */

const { expect } = require('chai');
const { createClient } = require('../helpers/hooks');
const { TEST_URLS } = require('../helpers/test-data');

describe('Screenshot functionality', function() {
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
    await client.wait(2000);
  });

  afterEach(async function() {
    await client.cleanupTabs(initialTabIds);
  });

  describe('captureScreenshot - viewport mode', function() {
    it('should capture full viewport screenshot', async function() {
      const result = await client.sendRequest('captureScreenshot', {
        tabId: testTabId
      });
      
      expect(result).to.have.property('dataUrl');
      expect(result.dataUrl).to.match(/^data:image\/png;base64,/);
      expect(result.dataUrl.length).to.be.greaterThan(1000);
    });

    it('should capture JPEG format', async function() {
      const result = await client.sendRequest('captureScreenshot', {
        tabId: testTabId,
        format: 'jpeg',
        quality: 80
      });
      
      expect(result).to.have.property('dataUrl');
      expect(result.dataUrl).to.match(/^data:image\/jpeg;base64,/);
    });

    it('should use active tab when tabId not provided', async function() {
      await client.sendRequest('switchTab', { tabId: testTabId });
      await client.wait(200);
      
      const result = await client.sendRequest('captureScreenshot', {});
      
      expect(result).to.have.property('dataUrl');
      expect(result.dataUrl).to.match(/^data:image\/png;base64,/);
    });
  });

  describe('captureScreenshot - element mode', function() {
    it('should capture single element screenshot', async function() {
      const result = await client.sendRequest('captureScreenshot', {
        tabId: testTabId,
        selector: 'h1'
      });
      
      expect(result).to.have.property('dataUrl');
      expect(result.dataUrl).to.match(/^data:image\/png;base64,/);
      expect(result).to.have.property('bounds');
      expect(result.bounds).to.have.property('x');
      expect(result.bounds).to.have.property('y');
      expect(result.bounds).to.have.property('width').greaterThan(0);
      expect(result.bounds).to.have.property('height').greaterThan(0);
      expect(result).to.have.property('elementCount', 1);
      expect(result).to.have.property('devicePixelRatio');
    });

    it('should capture combined screenshot for multiple elements', async function() {
      const result = await client.sendRequest('captureScreenshot', {
        tabId: testTabId,
        selector: 'label.form-label'
      });
      
      expect(result).to.have.property('dataUrl');
      expect(result.dataUrl).to.match(/^data:image\/png;base64,/);
      expect(result.dataUrl.length).to.be.greaterThan(100);
      expect(result).to.have.property('bounds');
      expect(result.bounds).to.be.an('object');
      expect(result).to.have.property('elementCount').greaterThan(1);
      expect(result).to.have.property('devicePixelRatio').to.be.a('number');
    });

    it('should capture combined screenshot using array of selectors', async function() {
      const result = await client.sendRequest('captureScreenshot', {
        tabId: testTabId,
        selector: ['h1', 'label.form-label']
      });
      
      expect(result).to.have.property('dataUrl');
      expect(result.dataUrl).to.match(/^data:image\/png;base64,/);
      expect(result.dataUrl.length).to.be.greaterThan(100);
      expect(result).to.have.property('bounds');
      expect(result.bounds).to.be.an('object');
      expect(result).to.have.property('elementCount').greaterThan(1);
      expect(result).to.have.property('devicePixelRatio').to.be.a('number');
    });

    it('should throw error for non-existent element', async function() {
      try {
        await client.sendRequest('captureScreenshot', {
          tabId: testTabId,
          selector: '#nonexistent-element-12345'
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).to.have.property('code', 'ELEMENTS_NOT_FOUND');
        expect(error).to.have.property('message').that.includes('#nonexistent-element-12345');
        expect(error).to.have.property('selectors');
      }
    });

    it('should throw error when all selectors in array find no elements', async function() {
      try {
        await client.sendRequest('captureScreenshot', {
          tabId: testTabId,
          selector: ['#nonexistent-1', '#nonexistent-2']
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).to.have.property('code', 'ELEMENTS_NOT_FOUND');
        expect(error).to.have.property('selectors').that.is.an('array');
        expect(error.selectors).to.include('#nonexistent-1');
        expect(error.selectors).to.include('#nonexistent-2');
      }
    });
  });

  describe('Helper functions for screenshot support', function() {
    describe('getElementBounds', function() {
      it('should get bounds for single element', async function() {
        const result = await client.callHelper(
          'getElementBounds',
          ['h1'],
          testTabId
        );
        
        client.assertValidExecutionResponse(result);
        expect(result.value).to.be.an('array');
        expect(result.value).to.have.lengthOf(1);
        expect(result.value[0]).to.have.property('index', 0);
        expect(result.value[0]).to.have.property('x');
        expect(result.value[0]).to.have.property('y');
        expect(result.value[0]).to.have.property('width').greaterThan(0);
        expect(result.value[0]).to.have.property('height').greaterThan(0);
        expect(result.value[0]).to.have.property('absoluteX');
        expect(result.value[0]).to.have.property('absoluteY');
      });

      it('should return empty array for non-existent element', async function() {
        const result = await client.callHelper(
          'getElementBounds',
          ['#nonexistent-element-12345'],
          testTabId
        );
        
        client.assertValidExecutionResponse(result);
        expect(result.value).to.be.an('array');
        expect(result.value).to.have.lengthOf(0);
      });
    });

    describe('scrollElementIntoView', function() {
      it('should scroll element into view', async function() {
        const result = await client.callHelper(
          'scrollElementIntoView',
          ['h1'],
          testTabId
        );
        
        client.assertValidExecutionResponse(result);
        expect(result.value).to.be.an('array');
        expect(result.value).to.have.lengthOf(1);
      });

      it('should return empty array for non-existent element', async function() {
        const result = await client.callHelper(
          'scrollElementIntoView',
          ['#nonexistent-element-12345'],
          testTabId
        );
        
        client.assertValidExecutionResponse(result);
        expect(result.value).to.be.an('array');
        expect(result.value).to.have.lengthOf(0);
      });
    });
  });
});
