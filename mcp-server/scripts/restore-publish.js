#!/usr/bin/env node

/**
 * Restore package.json after publishing to npm
 * 
 * This script runs after `npm publish` to:
 * 1. Restore package.json from backup
 * 2. Clean up backup file
 * 
 * This ensures the local file dependency is restored for development.
 */

const fs = require('fs');
const path = require('path');

const PACKAGE_JSON = path.join(__dirname, '..', 'package.json');
const BACKUP_FILE = PACKAGE_JSON + '.bak';

try {
  if (!fs.existsSync(BACKUP_FILE)) {
    console.log('No backup file found, skipping restore');
    process.exit(0);
  }

  console.log('Restoring package.json from backup');

  // Restore from backup
  const backup = fs.readFileSync(BACKUP_FILE, 'utf8');
  fs.writeFileSync(PACKAGE_JSON, backup);
  console.log('✓ Restored package.json');

  // Clean up backup file
  fs.unlinkSync(BACKUP_FILE);
  console.log('✓ Removed backup file');

  console.log('✓ Package.json restored to development state');

} catch (error) {
  console.error('ERROR restoring package.json:', error.message);
  console.error('You may need to manually restore from', BACKUP_FILE);
  process.exit(1);
}
