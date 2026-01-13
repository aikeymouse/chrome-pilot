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

console.log('ChromePilot Inspector Bridge loaded');
