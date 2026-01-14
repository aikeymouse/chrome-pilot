/**
 * ChromePilot Sidepanel UI Tests
 * Tests the sidepanel user interface with the extension loaded
 */

const { test, expect } = require('../fixtures/ui-fixtures');
const { TEST_URLS } = require('../helpers/test-data');
const fs = require('fs');
const path = require('path');

// Read version from manifest
const manifestPath = path.join(__dirname, '../../extension/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const EXPECTED_VERSION = manifest.version;

test.describe('ChromePilot Sidepanel UI', () => {
  
  test('should load sidepanel HTML correctly', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/sidepanel/panel.html`);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check title
    await expect(page).toHaveTitle('ChromePilot Panel');
    
    // Check main container exists
    const container = page.locator('.container');
    await expect(container).toBeVisible();
    
    // Check header elements
    const header = page.locator('header.header');
    await expect(header).toBeVisible();
    await expect(header.locator('h1')).toHaveText(`ChromePilot v${EXPECTED_VERSION}`);
    
    // Check status badge
    const statusBadge = page.locator('#status-badge');
    await expect(statusBadge).toBeVisible();
    await expect(page.locator('#status-dot')).toBeVisible();
    await expect(page.locator('#status-text')).toBeVisible();
    
    // Check Connected Clients section
    const clientsSection = page.locator('.section').first();
    await expect(clientsSection.locator('h2')).toHaveText('Connected Clients');
    await expect(page.locator('#remove-expired-sessions')).toBeVisible();
    await expect(page.locator('#client-count')).toBeVisible();
    await expect(page.locator('#client-count')).toHaveText('0');
    
    // Check session selector
    const sessionSelector = page.locator('#session-selector-wrapper');
    await expect(sessionSelector).toBeVisible();
    await expect(page.locator('#session-selector-trigger')).toBeVisible();
    await expect(page.locator('.session-name')).toHaveText('No active sessions');
    
    // Check session details grid - should be empty when no sessions
    const sessionDetails = page.locator('#session-details');
    await expect(sessionDetails).toBeVisible();
    await expect(page.locator('#session-id')).toBeEmpty();
    await expect(page.locator('#session-timeout')).toBeEmpty();
    
    // Check Current Window Tabs section
    const tabsSection = page.locator('.section').nth(1);
    await expect(tabsSection.locator('h2')).toHaveText('Current Window Tabs');
    await expect(page.locator('#tabs-header')).toHaveClass(/collapsible/);
    await expect(page.locator('#refresh-tabs')).toBeVisible();
    await expect(page.locator('#tabs-count')).toBeVisible();
    await expect(page.locator('#tabs-count')).toHaveText('1'); // Extension tab itself
    
    // Check tabs list - collapsed by default with 1 tab
    const tabsList = page.locator('#tabs-list');
    await expect(tabsList).toHaveClass(/collapsed/);
    
    // Check Session Logs section
    const logsSection = page.locator('.section').nth(2);
    await expect(logsSection.locator('h2')).toHaveText('Session Logs');
    
    // Check log controls
    await expect(page.locator('#log-retention')).toBeVisible();
    await expect(page.locator('#log-retention')).toHaveValue('100');
    await expect(page.locator('#clear-logs')).toBeVisible();
    await expect(page.locator('#clear-logs')).toHaveText('Clear');
    
    // Check logs container
    const logsContainer = page.locator('#logs-container');
    await expect(logsContainer).toBeVisible();
    await expect(logsContainer.locator('.empty-state')).toHaveText('No logs yet');
    
    // Check Material Symbols icons are loaded
    const materialIcons = page.locator('.material-symbols-outlined');
    await expect(materialIcons.first()).toBeVisible();
    
    // Check collapse icon
    const collapseIcon = page.locator('.collapse-icon');
    await expect(collapseIcon).toBeVisible();
    await expect(collapseIcon).toHaveText('▼');
    
    // Test log retention input constraints
    const logRetention = page.locator('#log-retention');
    await expect(logRetention).toHaveAttribute('min', '10');
    await expect(logRetention).toHaveAttribute('max', '1000');
    await expect(logRetention).toHaveAttribute('step', '10');
  });
  
  test('should expand and collapse tabs section', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/sidepanel/panel.html`);
    await page.waitForLoadState('networkidle');
    
    const tabsList = page.locator('#tabs-list');
    
    // Initially collapsed
    await expect(tabsList).toHaveClass(/collapsed/);
    await expect(tabsList).not.toBeVisible();
    
    // Expand tabs section
    await page.locator('#tabs-header').click();
    await expect(tabsList).not.toHaveClass(/collapsed/);
    await expect(tabsList).toBeVisible();
    
    // Verify tab content
    const tabItems = tabsList.locator('.tab-item');
    await expect(tabItems).toHaveCount(1); // Extension tab
    
    // Verify tab item structure and values
    const firstTab = tabItems.first();
    await expect(firstTab).toBeVisible();
    
    // Check tab header elements
    const tabHeader = firstTab.locator('.tab-header');
    await expect(tabHeader).toBeVisible();
    
    // Get actual tab info from the page for verification
    const currentTab = await page.evaluate(() => {
      return {
        id: chrome.devtools ? null : window.location.href.match(/\/\/([^\/]+)/)?.[1],
        title: document.title,
        url: window.location.href
      };
    });
    
    // Get tab values from the UI
    const tabIdText = await tabHeader.locator('.tab-id').textContent();
    const tabTitleText = await tabHeader.locator('.tab-title').textContent();
    const tabUrlText = await firstTab.locator('.tab-url').textContent();
    
    // Verify tab ID format (should be #<number>)
    await expect(tabHeader.locator('.tab-id')).toBeVisible();
    expect(tabIdText).toMatch(/^#\d+$/);
    
    // Verify tab title matches panel title
    await expect(tabHeader.locator('.tab-title')).toBeVisible();
    expect(tabTitleText).toBe('ChromePilot Panel');
    
    // Verify tab URL contains extension ID
    await expect(firstTab.locator('.tab-url')).toBeVisible();
    expect(tabUrlText).toContain(`chrome-extension://${extensionId}/sidepanel/panel.html`);
    
    // Collapse it back
    await page.locator('#tabs-header').click();
    await expect(tabsList).toHaveClass(/collapsed/);
    await expect(tabsList).not.toBeVisible();
  });

  test('should track new tab opening and closing', async ({ page, extensionId, context }) => {
    await page.goto(`chrome-extension://${extensionId}/sidepanel/panel.html`);
    await page.waitForLoadState('networkidle');
    
    const tabsList = page.locator('#tabs-list');
    const tabsCount = page.locator('#tabs-count');
    
    // Initial state: 1 tab (extension tab)
    await expect(tabsCount).toHaveText('1');
    
    // Open new tab with example.com
    const newTab = await context.newPage();
    await newTab.goto(TEST_URLS.EXAMPLE);
    await newTab.waitForLoadState('networkidle');
    
    // Wait for UI to update
    await page.waitForTimeout(1000);
    
    // Verify counter changed to 2
    await expect(tabsCount).toHaveText('2');
    
    // Expand tabs list
    await page.locator('#tabs-header').click();
    await expect(tabsList).not.toHaveClass(/collapsed/);
    
    // Verify 2 tab items exist
    const tabItems = tabsList.locator('.tab-item');
    await expect(tabItems).toHaveCount(2);
    
    // Find the example.com tab (should be second item)
    const exampleTab = tabItems.nth(1);
    await expect(exampleTab).toBeVisible();
    
    // Verify example.com tab details
    const exampleTabHeader = exampleTab.locator('.tab-header');
    const exampleTabId = await exampleTabHeader.locator('.tab-id').textContent();
    const exampleTabTitle = await exampleTabHeader.locator('.tab-title').textContent();
    const exampleTabUrl = await exampleTab.locator('.tab-url').textContent();
    
    // Verify tab ID format
    expect(exampleTabId).toMatch(/^#\d+$/);
    
    // Verify tab title
    expect(exampleTabTitle).toBe('Example Domain');
    
    // Verify tab URL (browser adds trailing slash)
    expect(exampleTabUrl).toBe(TEST_URLS.EXAMPLE + '/');
    
    // Close the example.com tab
    await newTab.close();
    
    // Wait for UI to update
    await page.waitForTimeout(1000);
    
    // Verify counter changed back to 1
    await expect(tabsCount).toHaveText('1');
    
    // Verify only 1 tab item remains
    await expect(tabItems).toHaveCount(1);
    
    // Verify remaining tab is the extension tab
    const remainingTab = tabItems.first();
    const remainingTabTitle = await remainingTab.locator('.tab-header .tab-title').textContent();
    expect(remainingTabTitle).toBe('ChromePilot Panel');
  });
});
