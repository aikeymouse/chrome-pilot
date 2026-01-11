const { test: base, chromium } = require('@playwright/test');
const path = require('path');

/**
 * Custom fixture that loads the Chrome extension
 */
exports.test = base.extend({
  context: async ({ }, use) => {
    const pathToExtension = path.join(__dirname, '..', '..', 'extension');
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    
    // Wait for extension to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await use(context);
    await context.close();
  },
  
  page: async ({ context }, use) => {
    // Use the first existing page (the blank tab that Chrome opens)
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();
    await use(page);
  },
  
  extensionId: async ({ context }, use) => {
    const [background] = context.serviceWorkers();
    if (!background) {
      throw new Error('Extension service worker did not start');
    }
    
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});

exports.expect = require('@playwright/test').expect;