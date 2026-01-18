#!/usr/bin/env node

/**
 * Prepare package.json for publishing to npm
 * 
 * This script runs before `npm publish` to:
 * 1. Backup the current package.json
 * 2. Replace local file dependency with npm version dependency
 * 
 * The local dependency "@aikeymouse/chromelink-client": "file:../clients/node"
 * is replaced with "@aikeymouse/chromelink-client": "^{VERSION}"
 * where VERSION comes from the VERSION file in the project root.
 */

const fs = require('fs');
const path = require('path');

const PACKAGE_JSON = path.join(__dirname, '..', 'package.json');
const BACKUP_FILE = PACKAGE_JSON + '.bak';
const VERSION_FILE = path.join(__dirname, '..', '..', 'VERSION');

try {
  // Read VERSION file
  if (!fs.existsSync(VERSION_FILE)) {
    console.error('ERROR: VERSION file not found at', VERSION_FILE);
    process.exit(1);
  }

  const version = fs.readFileSync(VERSION_FILE, 'utf8').trim();
  if (!version.match(/^\d+\.\d+\.\d+$/)) {
    console.error('ERROR: Invalid version format in VERSION file:', version);
    process.exit(1);
  }

  console.log(`Preparing package.json for npm publish (version: ${version})`);

  // Read package.json
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));

  // Backup original package.json
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(packageJson, null, 2) + '\n');
  console.log('✓ Backed up package.json');

  // Replace file dependency with npm version
  if (packageJson.dependencies && packageJson.dependencies['@aikeymouse/chromelink-client']) {
    const oldDep = packageJson.dependencies['@aikeymouse/chromelink-client'];
    packageJson.dependencies['@aikeymouse/chromelink-client'] = `^${version}`;
    console.log(`✓ Updated dependency: ${oldDep} → ^${version}`);
  }

  // Write updated package.json
  fs.writeFileSync(PACKAGE_JSON, JSON.stringify(packageJson, null, 2) + '\n');
  console.log('✓ Package.json ready for publishing');

} catch (error) {
  console.error('ERROR preparing package.json:', error.message);
  
  // Try to restore from backup if it exists
  if (fs.existsSync(BACKUP_FILE)) {
    try {
      fs.copyFileSync(BACKUP_FILE, PACKAGE_JSON);
      fs.unlinkSync(BACKUP_FILE);
      console.log('✓ Restored package.json from backup');
    } catch (restoreError) {
      console.error('ERROR restoring backup:', restoreError.message);
    }
  }
  
  process.exit(1);
}
