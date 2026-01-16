/**
 * Type definitions for @aikeymouse/chromelink-client
 * Official Node.js client for ChromeLink browser automation
 */

declare module '@aikeymouse/chromelink-client' {
  
  /**
   * Client configuration options
   */
  export interface ChromeLinkClientOptions {
    /**
     * Enable verbose logging to console
     * @default true
     */
    verbose?: boolean;
  }

  /**
   * Tab information object
   */
  export interface Tab {
    id: number;
    url: string;
    title: string;
    active: boolean;
    index?: number;
  }

  /**
   * List tabs result
   */
  export interface ListTabsResult {
    tabs: Tab[];
    windowId: number;
  }

  /**
   * Open/navigate tab result
   */
  export interface TabResult {
    tab: Tab;
  }

  /**
   * Success response
   */
  export interface SuccessResult {
    success: boolean;
    tabId?: number;
  }

  /**
   * Execute JavaScript result
   */
  export interface ExecuteResult {
    value: any;
    type: string;
  }

  /**
   * Session information
   */
  export interface SessionInfo {
    sessionId: string;
  }

  /**
   * Close session result
   */
  export interface CloseResult {
    closed: boolean;
  }

  /**
   * Element found result
   */
  export interface ElementFoundResult {
    found: boolean;
  }

  /**
   * Text content result
   */
  export interface TextResult {
    text: string;
  }

  /**
   * ChromeLink WebSocket Client
   */
  export default class ChromeLinkClient {
    /**
     * Current WebSocket connection
     */
    ws: any;

    /**
     * Current session ID
     */
    sessionId: string | null;

    /**
     * Current active tab ID
     */
    currentTabId: number | null;

    /**
     * Verbose logging enabled
     */
    verbose: boolean;

    /**
     * Create a new ChromeLink client
     * @param options - Client configuration options
     */
    constructor(options?: ChromeLinkClientOptions);

    /**
     * Connect to WebSocket server and create/resume session
     * @param url - WebSocket URL (default: ws://localhost:9000)
     * @param timeout - Session timeout in milliseconds (default: 60000)
     */
    connect(url?: string, timeout?: number): Promise<void>;

    /**
     * Get current session info (session is created automatically on connect)
     * @param timeout - Unused parameter for compatibility
     */
    createSession(timeout?: number): Promise<SessionInfo>;

    /**
     * Navigate to URL (opens new tab and focuses it)
     * @param url - URL to navigate to
     */
    navigate(url: string): Promise<TabResult>;

    /**
     * Execute JavaScript code in a tab
     * @param code - JavaScript code to execute
     * @param tabId - Tab ID (uses current tab if not specified)
     */
    executeJS(code: string, tabId?: number | null): Promise<ExecuteResult>;

    /**
     * Call a predefined DOM helper function (for CSP-restricted pages)
     * @param functionName - Name of the helper function
     * @param args - Arguments to pass to the function
     * @param tabId - Tab ID (uses current tab if not specified)
     */
    callHelper(functionName: string, args?: any[], tabId?: number | null): Promise<ExecuteResult>;

    /**
     * Wait for element to exist in DOM
     * @param selector - CSS selector
     * @param timeout - Maximum wait time in milliseconds (default: 10000)
     */
    waitForElement(selector: string, timeout?: number): Promise<ElementFoundResult>;

    /**
     * Click an element
     * @param selector - CSS selector
     */
    click(selector: string): Promise<ExecuteResult>;

    /**
     * Type text into an element
     * @param selector - CSS selector
     * @param text - Text to type
     */
    type(selector: string, text: string): Promise<ExecuteResult>;

    /**
     * Get text content of an element
     * @param selector - CSS selector
     */
    getText(selector: string): Promise<TextResult>;

    /**
     * List all tabs in the current window
     */
    listTabs(): Promise<ListTabsResult>;

    /**
     * Close a tab
     * @param tabId - Tab ID to close
     */
    closeTab(tabId: number): Promise<SuccessResult>;

    /**
     * Close the current session
     */
    closeSession(): Promise<CloseResult | undefined>;

    /**
     * Wait for a period of time
     * @param ms - Milliseconds to wait
     */
    wait(ms: number): Promise<void>;

    /**
     * Close the WebSocket connection
     */
    close(): void;
  }
}
