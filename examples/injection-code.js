// Create a badge to show injection is active
(function() {
  const badge = document.createElement('div');
  badge.id = 'chromepilot-injection-badge';
  badge.textContent = '🚀 ChromePilot Injected';
  badge.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999999;
    cursor: pointer;
    transition: transform 0.2s ease;
  `;
  
  badge.onmouseenter = () => {
    badge.style.transform = 'scale(1.05)';
  };
  
  badge.onmouseleave = () => {
    badge.style.transform = 'scale(1)';
  };
  
  badge.onclick = () => {
    badge.textContent = badge.textContent === '🚀 ChromePilot Injected' 
      ? '✓ Injection Active' 
      : '🚀 ChromePilot Injected';
  };
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(badge);
    });
  } else {
    document.body.appendChild(badge);
  }
  
  console.log('%c[ChromePilot] Script injection active', 'color: #667eea; font-weight: bold;');
})();
