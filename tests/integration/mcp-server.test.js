/**
 * Integration tests for MCP Server
 * Tests MCP protocol implementation and tool execution
 */

const { spawn } = require('child_process');
const { expect } = require('chai');
const path = require('path');

// Test URLs
const TEST_URLS = {
  EXAMPLE: 'https://example.com',
  GITHUB: 'https://github.com',
  SELENIUM_FORM: 'https://www.selenium.dev/selenium/web/web-form.html'
};

describe('MCP Server Integration Tests', function() {
  this.timeout(30000);

  let mcpServer;
  let mcpStdin;
  let mcpStdout;
  let requestId = 0;
  let responseHandlers = new Map();
  let chunkBuffers = new Map();

  // Helper to generate unique request ID
  function getRequestId() {
    return ++requestId;
  }

  // Helper to send MCP request and wait for response
  function sendMCPRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = getRequestId();
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      responseHandlers.set(id, { resolve, reject });

      // Set timeout
      const timeout = setTimeout(() => {
        if (responseHandlers.has(id)) {
          responseHandlers.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 25000);

      // Store timeout to clear it later
      responseHandlers.get(id).timeout = timeout;

      mcpStdin.write(JSON.stringify(request) + '\n');
    });
  }

  // Helper to parse tool result
  function parseToolResult(result) {
    if (result && result.content && result.content[0] && result.content[0].text) {
      try {
        return JSON.parse(result.content[0].text);
      } catch (e) {
        return result.content[0].text;
      }
    }
    return result;
  }

  before(async function() {
    this.timeout(10000);

    // Start MCP server
    const mcpServerPath = path.join(__dirname, '../../native-host/mcp-server.js');
    mcpServer = spawn('node', [mcpServerPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    mcpStdin = mcpServer.stdin;
    mcpStdout = mcpServer.stdout;

    // Handle MCP server output
    let buffer = '';
    mcpStdout.on('data', (chunk) => {
      buffer += chunk.toString();
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() && line.startsWith('{')) {
          try {
            const response = JSON.parse(line);
            
            if (response.id && responseHandlers.has(response.id)) {
              const handler = responseHandlers.get(response.id);
              clearTimeout(handler.timeout);
              responseHandlers.delete(response.id);
              
              if (response.error) {
                handler.reject(new Error(response.error.message));
              } else {
                handler.resolve(response.result);
              }
            }
          } catch (e) {
            console.error('Failed to parse MCP response:', e.message);
          }
        }
      }
    });

    // Handle MCP server errors
    mcpServer.stderr.on('data', (data) => {
      const output = data.toString();
      // Only log errors, not info messages
      if (output.includes('Error') || output.includes('Failed')) {
        console.error('MCP Server Error:', output);
      }
    });

    mcpServer.on('error', (error) => {
      console.error('MCP Server process error:', error);
    });

    // Initialize MCP server
    const initResult = await sendMCPRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'mcp-test-client',
        version: '1.0.0'
      }
    });

    expect(initResult).to.have.property('protocolVersion');
    expect(initResult).to.have.property('serverInfo');
    expect(initResult.serverInfo.name).to.equal('chrome-link');
  });

  after(function(done) {
    if (mcpServer) {
      mcpServer.on('exit', () => {
        done();
      });
      mcpServer.kill();
    } else {
      done();
    }
  });

  describe('MCP Protocol', function() {
    it('should list available tools', async function() {
      const result = await sendMCPRequest('tools/list');
      
      expect(result).to.have.property('tools');
      expect(result.tools).to.be.an('array');
      expect(result.tools.length).to.be.greaterThan(0);

      // Check for expected tools
      const toolNames = result.tools.map(t => t.name);
      expect(toolNames).to.include('chrome_list_tabs');
      expect(toolNames).to.include('chrome_open_tab');
      expect(toolNames).to.include('chrome_execute_js');
      expect(toolNames).to.include('chrome_capture_screenshot');
    });

    it('should have correct tool schemas', async function() {
      const result = await sendMCPRequest('tools/list');
      
      const listTabsTool = result.tools.find(t => t.name === 'chrome_list_tabs');
      expect(listTabsTool).to.exist;
      expect(listTabsTool.description).to.be.a('string');
      expect(listTabsTool.inputSchema).to.be.an('object');
      
      const openTabTool = result.tools.find(t => t.name === 'chrome_open_tab');
      expect(openTabTool).to.exist;
      expect(openTabTool.inputSchema.properties).to.have.property('url');
      expect(openTabTool.inputSchema.required).to.include('url');
    });
  });

  describe('Tab Management Tools', function() {
    let testTabId;

    it('should list tabs using chrome_list_tabs', async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_list_tabs',
        arguments: {}
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('tabs');
      expect(data.tabs).to.be.an('array');
      expect(data).to.have.property('windowId');
    });

    it('should open tab using chrome_open_tab', async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_open_tab',
        arguments: {
          url: TEST_URLS.EXAMPLE,
          focus: true
        }
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('tab');
      expect(data.tab).to.have.property('id');
      expect(data.tab.id).to.be.a('number');

      testTabId = data.tab.id;
    });

    it('should navigate tab using chrome_navigate_tab', async function() {
      expect(testTabId).to.exist;

      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_navigate_tab',
        arguments: {
          tabId: testTabId,
          url: TEST_URLS.GITHUB,
          focus: true
        }
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('success', true);
      expect(data).to.have.property('tabId', testTabId);
    });

    it('should switch tab using chrome_switch_tab', async function() {
      expect(testTabId).to.exist;

      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_switch_tab',
        arguments: {
          tabId: testTabId
        }
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('success', true);
      expect(data).to.have.property('tabId', testTabId);
    });

    it('should get active tab using chrome_get_active_tab', async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_get_active_tab',
        arguments: {}
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('id');
      expect(data).to.have.property('active', true);
    });

    it('should close tab using chrome_close_tab', async function() {
      expect(testTabId).to.exist;

      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_close_tab',
        arguments: {
          tabId: testTabId
        }
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('success', true);
      expect(data).to.have.property('tabId', testTabId);
    });
  });

  describe('JavaScript Execution Tools', function() {
    let testTabId;

    before(async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_open_tab',
        arguments: {
          url: TEST_URLS.EXAMPLE,
          focus: true
        }
      });
      testTabId = parseToolResult(result).tab.id;
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    after(async function() {
      if (testTabId) {
        await sendMCPRequest('tools/call', {
          name: 'chrome_close_tab',
          arguments: { tabId: testTabId }
        });
      }
    });

    it('should execute JavaScript using chrome_execute_js', async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_execute_js',
        arguments: {
          code: 'document.title',
          tabId: testTabId
        }
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('value');
      expect(data.value).to.be.a('string');
    });

    it('should call helper using chrome_call_helper', async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_call_helper',
        arguments: {
          functionName: 'getText',
          args: ['h1'],
          tabId: testTabId
        }
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('value');
      expect(data.value).to.be.a('string');
    });
  });

  describe('DOM Interaction Tools', function() {
    let testTabId;

    before(async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_open_tab',
        arguments: {
          url: TEST_URLS.SELENIUM_FORM,
          focus: true
        }
      });
      testTabId = parseToolResult(result).tab.id;
      await new Promise(resolve => setTimeout(resolve, 1500));
    });

    after(async function() {
      if (testTabId) {
        await sendMCPRequest('tools/call', {
          name: 'chrome_close_tab',
          arguments: { tabId: testTabId }
        });
      }
    });

    it('should wait for element using chrome_wait_for_element', async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_wait_for_element',
        arguments: {
          selector: 'input[name="my-text"]',
          tabId: testTabId,
          timeout: 5000
        }
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('found', true);
    });

    it('should get text using chrome_get_text', async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_get_text',
        arguments: {
          selector: 'h1',
          tabId: testTabId
        }
      });

      const data = parseToolResult(result);
      expect(data).to.be.a('string');
      expect(data.length).to.be.greaterThan(0);
    });

    it('should type text using chrome_type', async function() {
      const testText = 'MCP Test Input';
      
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_type',
        arguments: {
          selector: 'input[name="my-text"]',
          text: testText,
          tabId: testTabId
        }
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('value', true);

      // Verify text was typed
      await new Promise(resolve => setTimeout(resolve, 300));
      const verifyResult = await sendMCPRequest('tools/call', {
        name: 'chrome_execute_js',
        arguments: {
          code: 'document.querySelector(\'input[name="my-text"]\').value',
          tabId: testTabId
        }
      });
      const verifyData = parseToolResult(verifyResult);
      expect(verifyData.value).to.equal(testText);
    });

    it('should click element using chrome_click', async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_click',
        arguments: {
          selector: 'input[name="my-text"]',
          tabId: testTabId
        }
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('value', true);
    });
  });

  describe('Screenshot Tools', function() {
    let testTabId;

    before(async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_open_tab',
        arguments: {
          url: TEST_URLS.EXAMPLE,
          focus: true
        }
      });
      testTabId = parseToolResult(result).tab.id;
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    after(async function() {
      if (testTabId) {
        await sendMCPRequest('tools/call', {
          name: 'chrome_close_tab',
          arguments: { tabId: testTabId }
        });
      }
    });

    it('should capture screenshot in PNG format', async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_capture_screenshot',
        arguments: {
          format: 'png'
        }
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('dataUrl');
      expect(data.dataUrl).to.include('data:image/png;base64,');
    });

    it('should capture screenshot in JPEG format', async function() {
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
      
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_capture_screenshot',
        arguments: {
          format: 'jpeg',
          quality: 85
        }
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('dataUrl');
      expect(data.dataUrl).to.include('data:image/jpeg;base64,');
    });
  });

  describe('Script Injection Tools', function() {
    let testTabId;
    const injectionId = 'mcp-test-injection-' + Date.now();

    before(async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_open_tab',
        arguments: {
          url: TEST_URLS.EXAMPLE,
          focus: true
        }
      });
      testTabId = parseToolResult(result).tab.id;
    });

    after(async function() {
      // Clean up injection
      try {
        await sendMCPRequest('tools/call', {
          name: 'chrome_unregister_injection',
          arguments: { id: injectionId }
        });
      } catch (e) {
        // Ignore if already unregistered
      }

      if (testTabId) {
        await sendMCPRequest('tools/call', {
          name: 'chrome_close_tab',
          arguments: { tabId: testTabId }
        });
      }
    });

    it('should register script injection', async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_register_injection',
        arguments: {
          id: injectionId,
          code: 'window.__MCP_TEST__ = true;',
          matches: ['https://example.com/*'],
          runAt: 'document_idle'
        }
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('registered', true);
      expect(data).to.have.property('id', injectionId);
    });

    it('should unregister script injection', async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_unregister_injection',
        arguments: {
          id: injectionId
        }
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('unregistered', true);
      expect(data).to.have.property('id', injectionId);
    });
  });

  describe('Navigation History Tools', function() {
    let testTabId;

    before(async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_open_tab',
        arguments: {
          url: TEST_URLS.EXAMPLE,
          focus: true
        }
      });
      testTabId = parseToolResult(result).tab.id;
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    after(async function() {
      if (testTabId) {
        await sendMCPRequest('tools/call', {
          name: 'chrome_close_tab',
          arguments: { tabId: testTabId }
        });
      }
    });

    it.skip('should execute go back command (Chrome limitation: only works after user navigation)', async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_go_back',
        arguments: {
          tabId: testTabId
        }
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('success', true);
      expect(data).to.have.property('tabId', testTabId);
    });

    it.skip('should execute go forward command (Chrome limitation: only works after user navigation)', async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_go_forward',
        arguments: {
          tabId: testTabId
        }
      });

      const data = parseToolResult(result);
      expect(data).to.have.property('success', true);
      expect(data).to.have.property('tabId', testTabId);
    });
  });

  describe('DOM Helper Functions', function() {
    let testTabId;

    before(async function() {
      const result = await sendMCPRequest('tools/call', {
        name: 'chrome_open_tab',
        arguments: {
          url: TEST_URLS.SELENIUM_FORM,
          focus: true
        }
      });
      testTabId = parseToolResult(result).tab.id;
      await new Promise(resolve => setTimeout(resolve, 1500));
    });

    after(async function() {
      if (testTabId) {
        await sendMCPRequest('tools/call', {
          name: 'chrome_close_tab',
          arguments: { tabId: testTabId }
        });
      }
    });

    describe('Element Query Helpers', function() {
      it('should check element existence using elementExists', async function() {
        const result = await sendMCPRequest('tools/call', {
          name: 'chrome_call_helper',
          arguments: {
            functionName: 'elementExists',
            args: ['input[name="my-text"]'],
            tabId: testTabId
          }
        });

        const data = parseToolResult(result);
        expect(data.value).to.equal(true);
      });

      it('should check element visibility using isVisible', async function() {
        const result = await sendMCPRequest('tools/call', {
          name: 'chrome_call_helper',
          arguments: {
            functionName: 'isVisible',
            args: ['h1'],
            tabId: testTabId
          }
        });

        const data = parseToolResult(result);
        expect(data.value).to.equal(true);
      });

      it('should get HTML using getHTML', async function() {
        const result = await sendMCPRequest('tools/call', {
          name: 'chrome_call_helper',
          arguments: {
            functionName: 'getHTML',
            args: ['h1'],
            tabId: testTabId
          }
        });

        const data = parseToolResult(result);
        expect(data.value).to.be.a('string');
        expect(data.value.length).to.be.greaterThan(0);
      });
    });

    describe('Element Interaction Helpers', function() {
      it('should click element using clickElement', async function() {
        const result = await sendMCPRequest('tools/call', {
          name: 'chrome_call_helper',
          arguments: {
            functionName: 'clickElement',
            args: ['input[name="my-text"]'],
            tabId: testTabId
          }
        });

        const data = parseToolResult(result);
        expect(data.value).to.equal(true);
      });

      it('should type text using typeText', async function() {
        const result = await sendMCPRequest('tools/call', {
          name: 'chrome_call_helper',
          arguments: {
            functionName: 'typeText',
            args: ['input[name="my-text"]', 'Helper Test', true],
            tabId: testTabId
          }
        });

        const data = parseToolResult(result);
        expect(data.value).to.equal(true);

        // Verify text was typed
        await new Promise(resolve => setTimeout(resolve, 200));
        const verifyResult = await sendMCPRequest('tools/call', {
          name: 'chrome_execute_js',
          arguments: {
            code: 'document.querySelector(\'input[name="my-text"]\').value',
            tabId: testTabId
          }
        });
        const verifyData = parseToolResult(verifyResult);
        expect(verifyData.value).to.equal('Helper Test');
      });
    });

    describe('Element Positioning Helpers', function() {
      it('should get element bounds using getElementBounds', async function() {
        const result = await sendMCPRequest('tools/call', {
          name: 'chrome_call_helper',
          arguments: {
            functionName: 'getElementBounds',
            args: ['h1'],
            tabId: testTabId
          }
        });

        const data = parseToolResult(result);
        expect(data.value).to.be.an('array');
        expect(data.value.length).to.be.greaterThan(0);
        expect(data.value[0]).to.have.property('x');
        expect(data.value[0]).to.have.property('y');
        expect(data.value[0]).to.have.property('width');
        expect(data.value[0]).to.have.property('height');
      });

      it('should scroll element into view using scrollElementIntoView', async function() {
        const result = await sendMCPRequest('tools/call', {
          name: 'chrome_call_helper',
          arguments: {
            functionName: 'scrollElementIntoView',
            args: ['h1', 0],
            tabId: testTabId
          }
        });

        const data = parseToolResult(result);
        expect(data.value).to.be.an('array');
      });
    });

    describe('Element Highlighting Helpers', function() {
      it('should highlight elements using highlightElement', async function() {
        const result = await sendMCPRequest('tools/call', {
          name: 'chrome_call_helper',
          arguments: {
            functionName: 'highlightElement',
            args: ['input'],
            tabId: testTabId
          }
        });

        const data = parseToolResult(result);
        expect(data.value).to.be.a('number');
        expect(data.value).to.be.greaterThan(0);
      });

      it('should remove highlights using removeHighlights', async function() {
        const result = await sendMCPRequest('tools/call', {
          name: 'chrome_call_helper',
          arguments: {
            functionName: 'removeHighlights',
            args: [],
            tabId: testTabId
          }
        });

        const data = parseToolResult(result);
        expect(data.value).to.be.a('number');
      });
    });

    describe('Element Inspection Helpers', function() {
      it('should inspect element using inspectElement', async function() {
        const result = await sendMCPRequest('tools/call', {
          name: 'chrome_call_helper',
          arguments: {
            functionName: 'inspectElement',
            args: ['h1'],
            tabId: testTabId
          }
        });

        const data = parseToolResult(result);
        expect(data.value).to.be.an('object');
        expect(data.value).to.have.property('clickedElement');
        expect(data.value).to.have.property('parents');
        expect(data.value).to.have.property('children');
        expect(data.value.clickedElement).to.have.property('tagName', 'h1');
      });

      it('should get container elements using getContainerElements', async function() {
        const result = await sendMCPRequest('tools/call', {
          name: 'chrome_call_helper',
          arguments: {
            functionName: 'getContainerElements',
            args: ['form', 'input, button, label'],
            tabId: testTabId
          }
        });

        const data = parseToolResult(result);
        expect(data.value).to.be.an('array');
        expect(data.value.length).to.be.greaterThan(0);
        expect(data.value[0]).to.have.property('tagName');
        expect(data.value[0]).to.have.property('selector');
        expect(data.value[0]).to.have.property('attributes');
        expect(data.value[0]).to.have.property('visible');
      });
    });
  });

  describe('Error Handling', function() {
    it('should handle invalid tool name', async function() {
      try {
        await sendMCPRequest('tools/call', {
          name: 'chrome_invalid_tool',
          arguments: {}
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Unknown tool');
      }
    });

    it('should handle missing required arguments', async function() {
      try {
        await sendMCPRequest('tools/call', {
          name: 'chrome_open_tab',
          arguments: {} // Missing required 'url'
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should handle invalid tab ID', async function() {
      try {
        await sendMCPRequest('tools/call', {
          name: 'chrome_navigate_tab',
          arguments: {
            tabId: 999999999,
            url: TEST_URLS.EXAMPLE
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.match(/not found|was closed/i);
      }
    });
  });

  describe('Complex Workflows', function() {
    it('should handle multi-step tab workflow', async function() {
      // Open tab
      const openResult = await sendMCPRequest('tools/call', {
        name: 'chrome_open_tab',
        arguments: {
          url: TEST_URLS.SELENIUM_FORM,
          focus: true
        }
      });
      const tabId = parseToolResult(openResult).tab.id;
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Wait for form
      await sendMCPRequest('tools/call', {
        name: 'chrome_wait_for_element',
        arguments: {
          selector: 'input[name="my-text"]',
          tabId,
          timeout: 5000
        }
      });

      // Fill form
      await sendMCPRequest('tools/call', {
        name: 'chrome_type',
        arguments: {
          selector: 'input[name="my-text"]',
          text: 'MCP Workflow Test',
          tabId
        }
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      // Get input value to verify (getText gets textContent, not input value)
      const valueResult = await sendMCPRequest('tools/call', {
        name: 'chrome_execute_js',
        arguments: {
          code: 'document.querySelector(\'input[name="my-text"]\').value',
          tabId
        }
      });
      const valueData = parseToolResult(valueResult);
      expect(valueData.value).to.equal('MCP Workflow Test');

      // Clean up
      await sendMCPRequest('tools/call', {
        name: 'chrome_close_tab',
        arguments: { tabId }
      });
    });
  });
});
