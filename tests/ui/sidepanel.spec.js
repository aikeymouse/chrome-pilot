/**
 * ChromePilot Sidepanel UI Tests
 * Tests the sidepanel user interface with the extension loaded
 */

const { test, expect } = require('../fixtures/ui-fixtures');

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
  }); 
});
