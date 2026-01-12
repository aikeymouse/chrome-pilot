/**
 * Screenshot Client Example
 * Demonstrates how to take screenshots of specific elements
 */

const ChromePilotClient = require('./chromepilot-client');
const fs = require('fs');
const path = require('path');

async function main() {
  const client = new ChromePilotClient();
  
  try {
    console.log('🔌 Connecting to ChromePilot...');
    await client.connect();
    
    // Wait for connection
    let attempts = 0;
    while (!client.sessionId && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!client.sessionId) {
      throw new Error('Failed to connect - no session established');
    }
    
    console.log('✅ Connected! Session:', client.sessionId);
    
    // Open test page
    console.log('\n📄 Opening test page...');
    const openResult = await client.sendRequest('openTab', {
      url: 'https://www.selenium.dev/selenium/web/web-form.html'
    });
    const tabId = openResult.tab.id;
    console.log('✅ Tab opened:', tabId);
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Example 1: Get bounds for a single element
    console.log('\n📏 Getting bounds for h1 element...');
    const boundsResult = await client.callHelper('getElementBounds', ['h1'], tabId);
    console.log('Bounds:', JSON.stringify(boundsResult.value, null, 2));
    
    // Example 2: Get bounds for multiple elements
    console.log('\n📏 Getting bounds for all labels...');
    const multiResult = await client.callHelper('getElementBounds', ['label.form-label'], tabId);
    console.log(`Found ${multiResult.value.length} labels`);
    console.log('First label bounds:', JSON.stringify(multiResult.value[0], null, 2));
    
    // Example 3: Scroll to specific element
    console.log('\n📜 Scrolling to second label (index 1)...');
    const scrollResult = await client.callHelper('scrollElementIntoView', ['label.form-label', 1], tabId);
    console.log(`Scrolled - returned ${scrollResult.value.length} bounds`);
    
    // Example 4: Highlight elements before screenshot
    console.log('\n🎨 Highlighting h1 element...');
    const highlightResult = await client.callHelper('highlightElement', ['h1'], tabId);
    console.log(`Highlighted ${highlightResult.value} element(s)`);
    
    // Wait a bit to see the highlight
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Example 5: Get bounds and prepare for screenshot
    console.log('\n📸 Preparing to take screenshot of h1...');
    const h1Bounds = await client.callHelper('getElementBounds', ['h1'], tabId);
    await client.callHelper('scrollElementIntoView', ['h1', 0], tabId);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('\n📸 In a real implementation, you would now:');
    console.log('1. Use chrome.tabs.captureVisibleTab to capture the viewport');
    console.log('2. Pass the dataUrl to cropScreenshotToElements');
    console.log('   Example: callHelper("cropScreenshotToElements", [dataUrl, h1Bounds.value], tabId)');
    console.log('3. Save the cropped screenshots');
    
    // Example 6: Capture viewport screenshot directly
    console.log('\n📸 Capturing full viewport screenshot...');
    const captureResult = await client.sendRequest('captureScreenshot', { tabId });
    console.log(`Screenshot captured, size: ${captureResult.dataUrl.length} characters`);
    
    // Save full viewport screenshot to file
    const viewportData = captureResult.dataUrl.replace(/^data:image\/png;base64,/, '');
    const viewportPath = path.join(__dirname, 'viewport-screenshot.png');
    fs.writeFileSync(viewportPath, Buffer.from(viewportData, 'base64'));
    console.log(`💾 Viewport screenshot saved to: ${viewportPath}`);
    
    // Example 7: Capture and crop element screenshots in one command
    console.log('\n📸 Capturing h1 element screenshot (with auto-crop)...');
    const elementCaptureResult = await client.sendRequest('captureScreenshot', { 
      tabId,
      selector: 'h1'
    });
    
    console.log(`Captured ${elementCaptureResult.screenshots.length} element screenshot(s)`);
    if (elementCaptureResult.screenshots.length > 0) {
      const screenshot = elementCaptureResult.screenshots[0];
      console.log('Element screenshot:');
      console.log('  - Index:', screenshot.index);
      console.log('  - DataURL length:', screenshot.dataUrl.length);
      console.log('  - Device Pixel Ratio:', screenshot.devicePixelRatio);
      console.log('  - Bounds:', JSON.stringify(screenshot.bounds, null, 2));
      
      // Save element screenshot to file
      const screenshotData = screenshot.dataUrl.replace(/^data:image\/png;base64,/, '');
      const screenshotPath = path.join(__dirname, 'h1-screenshot.png');
      fs.writeFileSync(screenshotPath, Buffer.from(screenshotData, 'base64'));
      console.log(`💾 Element screenshot saved to: ${screenshotPath}`);
    }
    
    // Example 8: Test with non-existent element
    console.log('\n🔍 Testing with non-existent element...');
    const emptyResult = await client.callHelper('getElementBounds', ['#does-not-exist'], tabId);
    console.log(`Empty result (expected []): ${JSON.stringify(emptyResult.value)}`);
    
    // Remove highlights
    console.log('\n🧹 Removing highlights...');
    const removeResult = await client.callHelper('removeHighlights', [], tabId);
    console.log(`Removed ${removeResult.value} highlight(s)`);
    
    // Close the tab
    console.log('\n🗑️  Closing tab...');
    await client.sendRequest('closeTab', { tabId });
    console.log('✅ Tab closed');
    
    console.log('\n✨ Screenshot test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message || error);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    client.close();
    console.log('\n👋 Disconnected');
    
    // Give time for cleanup
    setTimeout(() => {
      process.exit(0);
    }, 500);
  }
}

// Run the example
if (require.main === module) {
  main();
}

module.exports = main;
