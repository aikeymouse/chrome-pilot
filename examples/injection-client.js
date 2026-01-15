#!/usr/bin/env node
/**
 * ChromePilot Script Injection Example
 * Demonstrates registerInjection API for WebView2 testing
 * 
 * This example injects a badge on Google pages to show the injection is working.
 */

const fs = require('fs');
const path = require('path');
const ChromePilotClient = require('./chromepilot-client');

async function main() {
  const client = new ChromePilotClient();
  
  try {
    // Connect to ChromePilot
    console.log('Connecting to ChromePilot...');
    await client.connect('ws://localhost:9000', 120000); // 2 minutes timeout
    
    // Register injection for Selenium pages
    console.log('\nRegistering script injection for Selenium...');
    
    // Load injection code from external file
    const injectionCodePath = path.join(__dirname, 'injection-code.js');
    const injectionCode = fs.readFileSync(injectionCodePath, 'utf8');
    
    const result = await client.sendRequest('registerInjection', {
      id: 'selenium-badge',
      code: injectionCode,
      matches: ['https://www.selenium.dev/*'],
      runAt: 'document_start'
    });
    
    console.log('✓ Injection registered:', result);
    console.log('\n📌 Instructions:');
    console.log('   1. Navigate to https://www.selenium.dev in Chrome');
    console.log('   2. You should see a "🚀 ChromePilot Injected" badge in the top-right');
    console.log('   3. Click the badge to toggle the text');
    console.log('   4. The badge will appear on all Selenium pages automatically');
    console.log('\n⏸  Press Ctrl+C to unregister injection and exit\n');
    
    // Handle graceful shutdown
    const cleanup = async () => {
      console.log('\n\nCleaning up...');
      try {
        const unregisterResult = await client.sendRequest('unregisterInjection', {
          id: 'selenium-badge'
        });
        console.log('✓ Injection unregistered:', unregisterResult);
        console.log('   Note: Already loaded pages will keep the badge until refreshed');
      } catch (err) {
        console.error('Failed to unregister:', err.message);
      }
      await client.close();
      process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
  } catch (error) {
    console.error('Error:', error.message);
    await client.close();
    process.exit(1);
  }
}

main();
