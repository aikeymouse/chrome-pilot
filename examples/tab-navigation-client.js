const ChromeLinkClient = require('@aikeymouse/chromelink-client');

/**
 * Tab Navigation Example
 * Demonstrates: openTab, goBack, goForward
 * 
 * Uses ChromeLinkClient.openTab() for navigation.
 * This avoids the address bar focus issue that happens with navigateTab.
 */
async function main() {
  console.log('🚀 Tab Navigation Example\n');
  
  const client = new ChromeLinkClient();
  
  try {
    // Connect to server (session auto-created)
    await client.connect();
    
    // 1. Open example.com in a new tab
    console.log('1️⃣  Opening example.com...');
    const exampleTab = await client.openTab('https://example.com');
    const tabId = exampleTab.tab.id;
    console.log(`✓ Opened tab ${tabId} with example.com\n`);
    
    // Wait for page to load
    await client.wait(3000);
    
    // Check URL after example.com navigation
    const exampleUrl = await client.executeJS('window.location.href', tabId);
    if (!exampleUrl.value.includes('example.com')) {
      console.log(`⚠️  WARNING: Expected example.com, but got: ${exampleUrl.value}\n`);
    }
    
    // 2. Open httpbin.org in a new tab
    console.log('2️⃣  Navigating to httpbin.org...');
    const httpbinTab = await client.navigateTab(tabId, 'https://httpbin.org');
    const httpbinTabId = httpbinTab.tabId;
    console.log(`✓ Opened tab ${httpbinTabId} with httpbin.org\n`);
    
    // Wait for navigation to complete
    await client.wait(3000);
    
    // Check what URL we actually navigated to
    console.log('🔍 Checking actual URL after navigation...');
    const afterNavUrl = await client.executeJS('window.location.href', httpbinTabId);
    console.log(`Actual URL: ${afterNavUrl.value}`);
    if (!afterNavUrl.value.includes('httpbin.org')) {
      console.log(`⚠️  WARNING: Expected httpbin.org, but got: ${afterNavUrl.value}`);
    }
    console.log();
    
    // 3. Go back on httpbin tab
    console.log('3️⃣  Going back on httpbin tab...');
    const backResult = await client.goBack(httpbinTabId);
    if (backResult.success) {
      console.log('✓ Went back\n');
    } else {
      console.log(`⚠️  ${backResult.message}\n`);
    }
    
    // Wait for navigation
    await client.wait(2000);
    
    // 4. Verify we're at the previous page
    console.log('4️⃣  Verifying current URL...');
    const backUrl = await client.executeJS('window.location.href', httpbinTabId);
    console.log(`Current URL: ${backUrl.value}`);
    if (backUrl.value.includes('httpbin.org')) {
      console.log(`⚠️  WARNING: Expected to navigate back from httpbin.org, but still at: ${backUrl.value}`);
    }
    console.log();
    
    // 5. Go forward
    console.log('5️⃣  Going forward...');
    const forwardResult = await client.goForward(httpbinTabId);
    if (forwardResult.success) {
      console.log('✓ Went forward\n');
    } else {
      console.log(`⚠️  ${forwardResult.message}\n`);
    }
    
    // Wait for navigation
    await client.wait(2000);
    
    // 6. Verify final URL
    console.log('6️⃣  Verifying final URL...');
    const forwardUrl = await client.executeJS('window.location.href', httpbinTabId);
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
