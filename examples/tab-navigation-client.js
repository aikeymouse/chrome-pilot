const ChromeLinkClient = require('@aikeymouse/chromelink-client');

/**
 * Tab Navigation Example
 * Demonstrates: navigate (openTab), goBack, goForward
 * 
 * Uses ChromeLinkClient for navigation (which uses openTab internally).
 * This avoids the address bar focus issue that happens with navigateTab.
 */
async function main() {
  console.log('🚀 Tab Navigation Example\n');
  
  const client = new ChromeLinkClient();
  
  try {
    // Connect to server (session auto-created)
    await client.connect();
    
    // 1. Navigate to example.com (opens in new focused tab)
    console.log('1️⃣  Navigating to example.com...');
    const exampleTab = await client.navigate('https://example.com');
    const tabId = exampleTab.tab.id;
    console.log(`✓ Opened tab ${tabId} with example.com\n`);
    
    // Wait for page to load
    await client.wait(3000);
    
    // Check URL after example.com navigation
    const exampleUrl = await client.executeJS('window.location.href');
    if (!exampleUrl.value.includes('example.com')) {
      console.log(`⚠️  WARNING: Expected example.com, but got: ${exampleUrl.value}\n`);
    }
    
    // 2. Navigate to httpbin.org (opens in new focused tab)
    console.log('2️⃣  Navigating to httpbin.org...');
    const httpbinTab = await client.navigate('https://httpbin.org');
    const httpbinTabId = httpbinTab.tab.id;
    console.log(`✓ Opened tab ${httpbinTabId} with httpbin.org\n`);
    
    // Wait for navigation to complete
    await client.wait(3000);
    
    // Check what URL we actually navigated to
    console.log('🔍 Checking actual URL after navigation...');
    const afterNavUrl = await client.executeJS('window.location.href');
    console.log(`Actual URL: ${afterNavUrl.value}`);
    if (!afterNavUrl.value.includes('httpbin.org')) {
      console.log(`⚠️  WARNING: Expected httpbin.org, but got: ${afterNavUrl.value}`);
    }
    console.log();
    
    // 3. Go back to example.com tab
    console.log('3️⃣  Going back on httpbin tab...');
    const backResult = await client.sendCommand('goBack', { tabId: httpbinTabId });
    if (backResult.success) {
      console.log('✓ Went back\n');
    } else {
      console.log(`⚠️  ${backResult.message}\n`);
    }
    
    // Wait for navigation
    await client.wait(2000);
    
    // 4. Verify we're at the previous page
    console.log('4️⃣  Verifying current URL...');
    const backUrl = await client.sendCommand('executeJS', {
      tabId: httpbinTabId,
      code: 'window.location.href'
    });
    console.log(`Current URL: ${backUrl.value}`);
    if (backUrl.value.includes('httpbin.org')) {
      console.log(`⚠️  WARNING: Expected to navigate back from httpbin.org, but still at: ${backUrl.value}`);
    }
    console.log();
    
    // 5. Go forward
    console.log('5️⃣  Going forward...');
    const forwardResult = await client.sendCommand('goForward', { tabId: httpbinTabId });
    if (forwardResult.success) {
      console.log('✓ Went forward\n');
    } else {
      console.log(`⚠️  ${forwardResult.message}\n`);
    }
    
    // Wait for navigation
    await client.wait(2000);
    
    // 6. Verify final URL
    console.log('6️⃣  Verifying final URL...');
    const forwardUrl = await client.sendCommand('executeJS', {
      tabId: httpbinTabId,
      code: 'window.location.href'
    });
    console.log(`Final URL: ${forwardUrl.value}`);
    if (!forwardUrl.value.includes('httpbin.org')) {
      console.log(`⚠️  WARNING: Expected httpbin.org after goForward, but got: ${forwardUrl.value}`);
    }
    console.log();
    
    console.log('✅ Tab navigation test completed successfully!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

main().catch(console.error);
