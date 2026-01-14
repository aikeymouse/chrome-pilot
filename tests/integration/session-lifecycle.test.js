/**
 * Integration tests for session lifecycle
 */

const { expect } = require('chai');
const ChromePilotClient = require('../helpers/chromepilot-client');

describe('Session Lifecycle', function() {
  it('should create session on connection', async function() {
    const client = new ChromePilotClient();
    await client.connect();
    await client.waitForConnection();
    
    client.assertValidResponse(client, {
      requiredFields: ['sessionId'],
      fieldTypes: { sessionId: 'string' }
    });
    expect(client.sessionId.length).to.be.at.least(1);
    
    client.close();
  });

  it('should handle multiple sequential connections', async function() {
    const client1 = new ChromePilotClient();
    await client1.connect();
    await client1.waitForConnection();
    const sessionId1 = client1.sessionId;
    client1.close();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const client2 = new ChromePilotClient();
    await client2.connect();
    await client2.waitForConnection();
    const sessionId2 = client2.sessionId;
    
    expect(sessionId1).to.not.equal(sessionId2);
    
    client2.close();
  });

  it('should maintain session across multiple commands', async function() {
    const client = new ChromePilotClient();
    await client.connect();
    await client.waitForConnection();
    
    const sessionId = client.sessionId;
    
    await client.listTabs();
    expect(client.sessionId).to.equal(sessionId);
    
    await client.listTabs();
    expect(client.sessionId).to.equal(sessionId);
    
    await client.listTabs();
    expect(client.sessionId).to.equal(sessionId);
    
    client.close();
  });

  it('should handle connection errors gracefully', async function() {
    const client = new ChromePilotClient();
    
    try {
      await client.connect('ws://localhost:9999'); // Wrong port
      expect.fail('Should have thrown error');
    } catch (err) {
      expect(err).to.be.an('error');
    }
  });

  it('should resume session when reconnecting with same session ID', async function() {
    // Create initial connection and get session ID
    const client1 = new ChromePilotClient();
    await client1.connect();
    await client1.waitForConnection();
    const originalSessionId = client1.sessionId;
    
    // Create a tab in the first session
    const tabResult = await client1.sendRequest('openTab', { 
      url: 'http://example.com' 
    });
    const tabId = tabResult.tab.id;
    
    // Close the connection (but session remains active on server)
    client1.close();
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Reconnect with the same session ID via query parameter
    const client2 = new ChromePilotClient();
    await client2.connect(`ws://localhost:9000?sessionId=${originalSessionId}`);
    
    // Wait for session resumed message
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Should have resumed the same session
    expect(client2.sessionId).to.equal(originalSessionId);
    
    // Should still be able to access the tab from the previous session
    const tabs = await client2.listTabs();
    const foundTab = tabs.tabs.find(t => t.id === tabId);
    expect(foundTab).to.exist;
    
    // Cleanup
    await client2.closeTab(tabId);
    client2.close();
  });

  it('should expire session after timeout period', async function() {
    this.timeout(15000); // Test needs 10+ seconds to run
    
    // Create session with very short timeout (5 seconds)
    const client1 = new ChromePilotClient();
    await client1.connect('ws://localhost:9000', 5000);
    await client1.waitForConnection();
    const sessionId = client1.sessionId;
    
    // Create a tab to verify tabs persist beyond session lifetime
    const tabResult = await client1.sendRequest('openTab', { 
      url: 'http://example.com' 
    });
    const tabId = tabResult.tab.id;
    
    // Close connection
    client1.close();
    
    // Wait for session to expire (5 seconds + 1 second buffer)
    console.log('⏳ Waiting for session to expire...');
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Try to reconnect with expired session ID - should fail
    const client2 = new ChromePilotClient();
    let connectionError = null;
    try {
      await client2.connect(`ws://localhost:9000?sessionId=${sessionId}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      connectionError = err;
    }
    
    // Should get error because session expired
    expect(connectionError).to.exist;
    expect(connectionError.message).to.include('Session not found or expired');
    
    // Create a new session (without sessionId) to clean up the tab
    const client3 = new ChromePilotClient();
    await client3.connect('ws://localhost:9000');
    await client3.waitForConnection();
    
    // New session should have different ID
    expect(client3.sessionId).to.not.equal(sessionId);
    
    // Tab created during expired session should still exist in browser
    // (tabs are browser resources, not session resources)
    const tabs = await client3.listTabs();
    const foundTab = tabs.tabs.find(t => t.id === tabId);
    expect(foundTab).to.exist;
    expect(foundTab.url).to.include('example.com');
    
    // New session should be able to close the tab from the expired session
    await client3.closeTab(tabId);
    
    client3.close();
  });

  it('should reject connection with non-existent session ID', async function() {
    this.timeout(5000);
    
    // Try to connect with a fake session ID that never existed
    const fakeSessionId = '00000000-0000-0000-0000-000000000000';
    const client = new ChromePilotClient();
    
    let connectionError = null;
    try {
      await client.connect(`ws://localhost:9000?sessionId=${fakeSessionId}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      connectionError = err;
    }
    
    // Should get error because session doesn't exist
    expect(connectionError).to.exist;
    expect(connectionError.message).to.include('Session not found or expired');
  });
});
