/**
 * ChromeLink Test Client - Updated to use websocket-client helper
 */

const ChromeLinkClient = require('@aikeymouse/chromelink-client');

async function main() {
  console.log('🚀 ChromeLink Test Client\n');
  
  const client = new ChromeLinkClient();
  const openedTabs = []; // Track tabs opened during tests
  
  try {
    // Connect to server (session auto-created)
    await client.connect();
    await client.wait(1000);
    
    // Test 1: List tabs
    console.log('\nTest 1: Listing tabs...');
    const tabs = await client.listTabs();
    tabs.tabs.forEach((tab, i) => {
      console.log(`  ${i + 1}. [${tab.id}] ${tab.title.substring(0, 50)}`);
    });
    await client.wait(1000);
    
    // Test 2: Open example.com in new tab
    console.log('\nTest 2: Opening example.com...');
    const exampleTab = await client.openTab('https://example.com');
    const exampleTabId = exampleTab.tab.id;
    openedTabs.push(exampleTabId);
    await client.wait(2000);
    
    // Test 3: Wait for h1 element
    console.log('\nTest 3: Waiting for h1 element...');
    await client.waitForElement('h1', 10000, exampleTabId);
    await client.wait(500);
    
    // Test 4: Get h1 text
    console.log('\nTest 4: Getting h1 text...');
    const h1Text = await client.getText('h1', exampleTabId);
    console.log(`  Text: ${h1Text.value}`);
    await client.wait(1000);
    
    // Test 5: Open Google in new tab
    console.log('\nTest 5: Opening Google...');
    const googleTab = await client.openTab('https://www.google.com');
    const googleTabId = googleTab.tab.id;
    openedTabs.push(googleTabId);
    await client.wait(2000);
    
    // Test 6: List tabs again
    console.log('\nTest 6: Listing tabs again...');
    const updatedTabs = await client.listTabs();
    console.log(`  Total tabs: ${updatedTabs.tabs.length}`);
    await client.wait(1000);
    
    // Test 7: Close all opened tabs
    console.log('\nTest 7: Closing all opened tabs...');
    for (const tabId of openedTabs) {
      await client.closeTab(tabId);
      console.log(`  ✓ Closed tab ${tabId}`);
    }
    await client.wait(1000);
    
    // Test 8: Close session
    console.log('\nTest 8: Closing session...');
    await client.closeSession();
    
    console.log('\n🎉 All tests passed!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error.message) console.error('Message:', error.message);
    if (error.stack) console.error('Stack:', error.stack);
  } finally {
    client.close();
    process.exit(0);
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
