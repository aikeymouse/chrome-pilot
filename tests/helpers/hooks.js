/**
 * Global test hooks and utilities
 */

const TestClient = require('./test-client');

/**
 * Create a test client instance
 */
function createClient() {
  return new TestClient();
}

module.exports = {
  createClient
};
