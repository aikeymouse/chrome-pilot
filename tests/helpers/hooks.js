/**
 * Global test hooks and utilities
 */

const ChromePilotClient = require('./chromepilot-client');

/**
 * Create a test client instance
 */
function createClient() {
  return new ChromePilotClient();
}

module.exports = {
  createClient
};
