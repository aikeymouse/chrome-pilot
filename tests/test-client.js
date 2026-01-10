const WebSocket = require('ws');

async function main() {
  console.log('🚀 ChromePilot Test Client\n');
  
  console.log('Connecting to ws://localhost:9000/session...');
  const ws = new WebSocket('ws://localhost:9000/session?timeout=60000');
  
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
  
  console.log('✓ Connected\n');
  
  // Helper to send command
  const send = (action, params = {}) => {
    return new Promise((resolve, reject) => {
      const requestId = `req-${Date.now()}`;
      const timeout = setTimeout(() => {
        ws.off('message', handler);
        reject(new Error(`Timeout waiting for ${action}`));
      }, 10000);
      
      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        
        // Handle session created message
        if (msg.type === 'sessionCreated') {
          console.log(`Session ID: ${msg.sessionId}\n`);
          return;
        }
        
        if (msg.requestId === requestId) {
          clearTimeout(timeout);
          ws.off('message', handler);
          
          if (msg.error) {
            reject(new Error(JSON.stringify(msg.error, null, 2)));
          } else {
            resolve(msg.result);
          }
        }
      };
      
      ws.on('message', handler);
      ws.send(JSON.stringify({ action, params, requestId }));
    });
  };
  
  try {
    // Test 1: List tabs
    console.log('Test 1: Listing tabs...');
    const tabs = await send('listTabs');
    console.log(`✓ Found ${tabs.tabs.length} tabs in current window`);
    tabs.tabs.forEach((tab, i) => {
      console.log(`  ${i + 1}. [${tab.id}] ${tab.title.substring(0, 50)}`);
    });
    console.log();
    
    // Test 2: Open new tab
    console.log('Test 2: Opening new tab...');
    const newTab = await send('openTab', { 
      url: 'https://example.com', 
      focus: true 
    });
    console.log(`✓ Opened tab ID: ${newTab.tab.id}`);
    console.log();
    
    // Wait for page to load
    console.log('Waiting 2 seconds for page to load...');
    await new Promise(r => setTimeout(r, 2000));
    console.log();
    
    // Test 3: Execute JavaScript
    console.log('Test 3: Getting page title...');
    const titleResult = await send('executeJS', { 
      code: 'document.title',
      tabId: newTab.tab.id
    });
    console.log(`✓ Page title: "${titleResult.value}"`);
    console.log();
    
    // Test 4: Get page URL
    console.log('Test 4: Getting page URL...');
    const urlResult = await send('executeJS', { 
      code: 'window.location.href',
      tabId: newTab.tab.id
    });
    console.log(`✓ Page URL: ${urlResult.value}`);
    console.log();
    
    // Test 5: Navigate tab
    console.log('Test 5: Navigating to Google...');
    await send('navigateTab', {
      tabId: newTab.tab.id,
      url: 'https://www.google.com',
      focus: true
    });
    console.log(`✓ Navigated tab ${newTab.tab.id}`);
    console.log();
    
    // Wait for navigation
    await new Promise(r => setTimeout(r, 2000));
    
    // Test 6: Verify navigation
    console.log('Test 6: Verifying navigation...');
    const newTitleResult = await send('executeJS', { 
      code: 'document.title',
      tabId: newTab.tab.id
    });
    console.log(`✓ New page title: "${newTitleResult.value}"`);
    console.log();
    
    // Test 7: List tabs again
    console.log('Test 7: Listing tabs again...');
    const updatedTabs = await send('listTabs');
    console.log(`✓ Now have ${updatedTabs.tabs.length} tabs`);
    console.log();
    
    console.log('🎉 All tests passed!\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error.message) console.error('Message:', error.message);
    if (error.stack) console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    ws.close();
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  if (error.message) console.error('Message:', error.message);
  console.error('\nMake sure:');
  console.error('1. Chrome extension is loaded');
  console.error('2. Extension side panel is open (click extension icon)');
  console.error('3. Native host is running (check side panel status)');
  process.exit(1);
});
