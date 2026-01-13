/**
 * Inspector Bridge Content Script
 * Runs in ISOLATED world to bridge messages from MAIN world to background
 */

// Listen for custom events from MAIN world
window.addEventListener('__chromepilot_element_clicked', (event) => {
  console.log('Inspector bridge: Element clicked event received', event.detail);
  
  // Forward to background script
  chrome.runtime.sendMessage({
    type: 'elementClicked',
    element: event.detail
  });
});

// Listen for messages from panel to simulate clicks
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'simulateInspectorClick' && message.selector) {
    // Dispatch event to MAIN world to trigger inspector click
    window.dispatchEvent(new CustomEvent('__chromepilot_simulate_click', {
      detail: { selector: message.selector }
    }));
    sendResponse({ success: true });
  }
  return true;
});

console.log('ChromePilot Inspector Bridge loaded');
