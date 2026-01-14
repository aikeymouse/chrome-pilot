/**
 * Console Output Utilities
 * Provides consistent ANSI color formatting for terminal output
 */

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

/**
 * Color utility functions
 */
const success = (str) => `${colors.green}${str}${colors.reset}`;
const error = (str) => `${colors.red}${str}${colors.reset}`;
const warning = (str) => `${colors.yellow}${str}${colors.reset}`;
const info = (str) => `${colors.cyan}${str}${colors.reset}`;
const dim = (str) => `${colors.gray}${str}${colors.reset}`;
const bold = (str) => `${colors.bright}${str}${colors.reset}`;
const code = (str) => `${colors.magenta}${str}${colors.reset}`;
const highlight = (str) => `${colors.bgBlue}${colors.white}${str}${colors.reset}`;
const cyan = (str) => `${colors.cyan}${str}${colors.reset}`;
const green = (str) => `${colors.green}${str}${colors.reset}`;
const red = (str) => `${colors.red}${str}${colors.reset}`;
const yellow = (str) => `${colors.yellow}${str}${colors.reset}`;
const gray = (str) => `${colors.gray}${str}${colors.reset}`;
const magenta = (str) => `${colors.magenta}${str}${colors.reset}`;

module.exports = {
  colors,
  success,
  error,
  warning,
  info,
  dim,
  bold,
  code,
  highlight,
  cyan,
  green,
  red,
  yellow,
  gray,
  magenta
};
