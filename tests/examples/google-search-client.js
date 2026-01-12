/**
 * Google Search Test Client
 * Opens Google, searches for text, then closes the session
 */

const ChromePilotClient = require('./chromepilot-client');

/**
 * Run the test
 */
async function main() {
  const client = new ChromePilotClient();

  try {
    // Connect to server (session is created automatically)
    await client.connect();
    await client.wait(1000);

    // Navigate to Google (opens in new tab)
    await client.navigate('https://www.google.com');
    await client.wait(2000);

    // Wait for search textarea and click it
    const searchSelector = 'textarea[name="q"]';
    await client.waitForElement(searchSelector);
    await client.wait(500);
    
    await client.click(searchSelector);
    await client.wait(500);

    // Type search query
    await client.type(searchSelector, 'ChromePilot WebSocket automation');
    await client.wait(2000);

    // Highlight the Google Search button
    const searchButtonSelector = 'input[name="btnK"]';
    await client.callHelper('highlightElement', [searchButtonSelector]);
    await client.wait(10000);

    // Remove the highlight
    await client.callHelper('removeHighlights', []);
    await client.wait(2000);

    // Try to highlight a non-existent element (should return 0)
    console.log('\n→ Attempting to highlight non-existent element...');
    const result = await client.callHelper('highlightElement', ['#this-element-does-not-exist-12345']);
    if (result.value === 0) {
      console.log('✓ Correctly returned 0 for non-existent element');
    } else {
      console.log('✗ Expected 0 but got:', result.value);
    }
    await client.wait(1000);

    // Close session
    await client.closeSession();
    await client.wait(1000);

    console.log('\n✓ All operations completed successfully!');

  } catch (err) {
    console.error('\n✗ Error:', err.message);
    console.error(err.stack);
  } finally {
    client.close();
    process.exit(0);
  }
}

// Run the test
main();
