#!/usr/bin/env node

/**
 * ChromeLink MCP Server
 * 
 * Model Context Protocol (MCP) server that exposes Chrome browser automation
 * capabilities to AI agents like Claude, GPT, etc.
 * 
 * This server acts as a thin wrapper around the ChromeLink WebSocket client,
 * exposing browser automation as MCP tools that AI agents can discover and use.
 * 
 * Architecture:
 *   AI Agent (Claude/GPT) <-> MCP Server (this file) <-> browser-link-server <-> Chrome Extension
 *   
 * Communication:
 *   - AI Agent ↔ MCP Server: stdio (MCP protocol)
 *   - MCP Server ↔ browser-link-server: WebSocket (ws://localhost:9000)
 *   
 * Usage:
 *   node mcp-server.js
 *   
 * Configuration (Claude Desktop):
 *   Add to ~/Library/Application Support/Claude/claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "chrome-link": {
 *         "command": "node",
 *         "args": ["/path/to/chrome-driver-extension/native-host/mcp-server.js"]
 *       }
 *     }
 *   }
 */

const ChromeLinkClient = require('../clients/node/index.js');

// MCP Protocol Implementation
class MCPServer {
  constructor() {
    this.client = null;
    this.requestId = 1;
  }

  /**
   * Log to stderr (stdout is reserved for MCP protocol)
   */
  log(message, ...args) {
    console.error(`[MCP Server] ${message}`, ...args);
  }

  /**
   * Send MCP response to stdout
   */
  sendResponse(response) {
    const message = JSON.stringify(response);
    process.stdout.write(message + '\n');
  }

  /**
   * Send error response
   */
  sendError(id, code, message) {
    this.sendResponse({
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message
      }
    });
  }

  /**
   * Initialize connection to browser-link-server
   */
  async initialize() {
    try {
      this.client = new ChromeLinkClient('ws://localhost:9000');
      await this.client.connect();
      this.log('Connected to browser-link-server');
    } catch (error) {
      this.log('Failed to connect to browser-link-server:', error.message);
      throw error;
    }
  }

  /**
   * Get list of available MCP tools
   */
  getTools() {
    return {
      tools: [
        // Tab Management
        {
          name: 'chrome_list_tabs',
          description: 'List all open tabs in the browser',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'chrome_open_tab',
          description: 'Open a new tab with the specified URL',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to open in the new tab'
              },
              focus: {
                type: 'boolean',
                description: 'Whether to focus the new tab (default: true)',
                default: true
              }
            },
            required: ['url']
          }
        },
        {
          name: 'chrome_navigate_tab',
          description: 'Navigate an existing tab to a new URL',
          inputSchema: {
            type: 'object',
            properties: {
              tabId: {
                type: 'number',
                description: 'ID of the tab to navigate'
              },
              url: {
                type: 'string',
                description: 'URL to navigate to'
              },
              focus: {
                type: 'boolean',
                description: 'Whether to focus the tab (default: true)',
                default: true
              }
            },
            required: ['tabId', 'url']
          }
        },
        {
          name: 'chrome_switch_tab',
          description: 'Switch to (focus) a specific tab',
          inputSchema: {
            type: 'object',
            properties: {
              tabId: {
                type: 'number',
                description: 'ID of the tab to switch to'
              }
            },
            required: ['tabId']
          }
        },
        {
          name: 'chrome_close_tab',
          description: 'Close a specific tab',
          inputSchema: {
            type: 'object',
            properties: {
              tabId: {
                type: 'number',
                description: 'ID of the tab to close'
              }
            },
            required: ['tabId']
          }
        },
        {
          name: 'chrome_get_active_tab',
          description: 'Get information about the currently active tab',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },

        // Navigation History
        {
          name: 'chrome_go_back',
          description: 'Navigate back in tab history (only works after user navigation, not programmatic)',
          inputSchema: {
            type: 'object',
            properties: {
              tabId: {
                type: 'number',
                description: 'ID of the tab to navigate back'
              }
            },
            required: ['tabId']
          }
        },
        {
          name: 'chrome_go_forward',
          description: 'Navigate forward in tab history (only works after user navigation, not programmatic)',
          inputSchema: {
            type: 'object',
            properties: {
              tabId: {
                type: 'number',
                description: 'ID of the tab to navigate forward'
              }
            },
            required: ['tabId']
          }
        },

        // DOM Interaction
        {
          name: 'chrome_wait_for_element',
          description: 'Wait for an element matching the CSS selector to appear on the page',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the element'
              },
              tabId: {
                type: 'number',
                description: 'ID of the tab'
              },
              timeout: {
                type: 'number',
                description: 'Maximum time to wait in milliseconds (default: 5000)',
                default: 5000
              }
            },
            required: ['selector', 'tabId']
          }
        },
        {
          name: 'chrome_get_text',
          description: 'Get the text content of an element matching the CSS selector',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the element'
              },
              tabId: {
                type: 'number',
                description: 'ID of the tab'
              }
            },
            required: ['selector', 'tabId']
          }
        },
        {
          name: 'chrome_click',
          description: 'Click an element matching the CSS selector',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the element to click'
              },
              tabId: {
                type: 'number',
                description: 'ID of the tab'
              }
            },
            required: ['selector', 'tabId']
          }
        },
        {
          name: 'chrome_type',
          description: 'Type text into an element matching the CSS selector',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the input element'
              },
              text: {
                type: 'string',
                description: 'Text to type into the element'
              },
              tabId: {
                type: 'number',
                description: 'ID of the tab'
              }
            },
            required: ['selector', 'text', 'tabId']
          }
        },

        // JavaScript Execution
        {
          name: 'chrome_execute_js',
          description: 'Execute arbitrary JavaScript code in the page context',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'JavaScript code to execute'
              },
              tabId: {
                type: 'number',
                description: 'ID of the tab'
              }
            },
            required: ['code', 'tabId']
          }
        },
        {
          name: 'chrome_call_helper',
          description: 'Call a predefined DOM helper function for CSP-restricted pages. Available helpers: Element Interaction (clickElement, typeText, appendChar, clearContentEditable), Element Query (getText, getHTML, getLastHTML, elementExists, isVisible, waitForElement), Element Highlighting (highlightElement, removeHighlights), Element Positioning (getElementBounds, scrollElementIntoView), Element Inspection (inspectElement, getContainerElements)',
          inputSchema: {
            type: 'object',
            properties: {
              functionName: {
                type: 'string',
                description: 'Name of the helper function',
                enum: [
                  'clickElement', 
                  'typeText', 
                  'appendChar', 
                  'clearContentEditable',
                  'getText', 
                  'getHTML', 
                  'getLastHTML', 
                  'elementExists', 
                  'isVisible', 
                  'waitForElement',
                  'highlightElement', 
                  'removeHighlights',
                  'getElementBounds', 
                  'scrollElementIntoView',
                  'inspectElement', 
                  'getContainerElements'
                ]
              },
              args: {
                type: 'array',
                description: 'Arguments to pass to the helper function',
                items: {}
              },
              tabId: {
                type: 'number',
                description: 'ID of the tab'
              }
            },
            required: ['functionName', 'args', 'tabId']
          }
        },

        // Screenshots
        {
          name: 'chrome_capture_screenshot',
          description: 'Capture a screenshot of the current tab',
          inputSchema: {
            type: 'object',
            properties: {
              format: {
                type: 'string',
                description: 'Image format (png or jpeg)',
                enum: ['png', 'jpeg'],
                default: 'png'
              },
              quality: {
                type: 'number',
                description: 'JPEG quality (0-100, only for jpeg format)',
                minimum: 0,
                maximum: 100,
                default: 90
              }
            },
            required: []
          }
        },

        // Script Injection
        {
          name: 'chrome_register_injection',
          description: 'Register a content script to be injected into matching pages',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Unique identifier for this injection'
              },
              code: {
                type: 'string',
                description: 'JavaScript code to inject'
              },
              matches: {
                type: 'array',
                description: 'URL patterns to match (e.g., ["https://*.example.com/*"])',
                items: {
                  type: 'string'
                }
              },
              runAt: {
                type: 'string',
                description: 'When to inject the script',
                enum: ['document_start', 'document_end', 'document_idle'],
                default: 'document_idle'
              }
            },
            required: ['id', 'code', 'matches']
          }
        },
        {
          name: 'chrome_unregister_injection',
          description: 'Unregister a previously registered content script',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'ID of the injection to unregister'
              }
            },
            required: ['id']
          }
        }
      ]
    };
  }

  /**
   * Handle tool invocation
   */
  async handleToolCall(name, args) {
    this.log(`Tool call: ${name}`, args);

    try {
      let result;

      switch (name) {
        // Tab Management
        case 'chrome_list_tabs':
          result = await this.client.listTabs();
          break;

        case 'chrome_open_tab':
          result = await this.client.openTab(args.url, args.focus);
          break;

        case 'chrome_navigate_tab':
          result = await this.client.navigateTab(args.tabId, args.url, args.focus);
          break;

        case 'chrome_switch_tab':
          result = await this.client.switchTab(args.tabId);
          break;

        case 'chrome_close_tab':
          result = await this.client.closeTab(args.tabId);
          break;

        case 'chrome_get_active_tab':
          result = await this.client.getActiveTab();
          break;

        // Navigation History
        case 'chrome_go_back':
          result = await this.client.goBack(args.tabId);
          break;

        case 'chrome_go_forward':
          result = await this.client.goForward(args.tabId);
          break;

        // DOM Interaction
        case 'chrome_wait_for_element':
          result = await this.client.waitForElement(args.selector, args.timeout || 5000, args.tabId);
          break;

        case 'chrome_get_text':
          result = await this.client.getText(args.selector, args.tabId);
          break;

        case 'chrome_click':
          result = await this.client.click(args.selector, args.tabId);
          break;

        case 'chrome_type':
          result = await this.client.type(args.selector, args.text, args.tabId);
          break;

        // JavaScript Execution
        case 'chrome_execute_js':
          result = await this.client.executeJS(args.code, args.tabId);
          break;

        case 'chrome_call_helper':
          result = await this.client.callHelper(args.functionName, args.args, args.tabId);
          break;

        // Screenshots
        case 'chrome_capture_screenshot':
          result = await this.client.captureScreenshot({
            format: args.format || 'png',
            quality: args.quality || 90
          });
          break;

        // Script Injection
        case 'chrome_register_injection':
          result = await this.client.registerInjection(
            args.id,
            args.code,
            args.matches,
            args.runAt || 'document_idle'
          );
          break;

        case 'chrome_unregister_injection':
          result = await this.client.unregisterInjection(args.id);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      this.log(`Tool result for ${name}:`, result);
      return result;

    } catch (error) {
      this.log(`Tool error for ${name}:`, error.message);
      throw error;
    }
  }

  /**
   * Handle incoming MCP request
   */
  async handleRequest(request) {
    const { id, method, params } = request;

    try {
      switch (method) {
        case 'initialize':
          this.sendResponse({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: 'chrome-link',
                version: '1.0.0'
              }
            }
          });
          break;

        case 'tools/list':
          this.sendResponse({
            jsonrpc: '2.0',
            id,
            result: this.getTools()
          });
          break;

        case 'tools/call':
          const result = await this.handleToolCall(params.name, params.arguments || {});
          this.sendResponse({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            }
          });
          break;

        default:
          this.sendError(id, -32601, `Method not found: ${method}`);
      }
    } catch (error) {
      this.sendError(id, -32603, error.message);
    }
  }

  /**
   * Start the MCP server
   */
  async start() {
    this.log('Starting MCP server...');

    // Connect to browser-link-server
    await this.initialize();

    // Handle stdin for MCP protocol
    let buffer = '';
    process.stdin.on('data', (chunk) => {
      buffer += chunk.toString();
      
      // Process complete JSON-RPC messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const request = JSON.parse(line);
            this.handleRequest(request);
          } catch (error) {
            this.log('Failed to parse request:', error.message);
          }
        }
      }
    });

    process.stdin.on('end', () => {
      this.log('Stdin closed, shutting down...');
      this.shutdown();
    });

    // Handle process signals
    process.on('SIGINT', () => {
      this.log('Received SIGINT, shutting down...');
      this.shutdown();
    });

    process.on('SIGTERM', () => {
      this.log('Received SIGTERM, shutting down...');
      this.shutdown();
    });

    this.log('MCP server started successfully');
  }

  /**
   * Shutdown the server
   */
  shutdown() {
    if (this.client) {
      this.client.close();
    }
    process.exit(0);
  }
}

// Start the server
const server = new MCPServer();
server.start().catch((error) => {
  console.error('[MCP Server] Fatal error:', error);
  process.exit(1);
});
