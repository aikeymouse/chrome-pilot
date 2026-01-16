# chromelink-client

[![npm version](https://img.shields.io/npm/v/chromelink-client.svg)](https://www.npmjs.com/package/chromelink-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Note:** This package is a convenience wrapper that re-exports [`@aikeymouse/chromelink-client`](https://www.npmjs.com/package/@aikeymouse/chromelink-client).

For documentation, examples, and API reference, please visit the main package:

## 📦 Main Package

**[@aikeymouse/chromelink-client](https://www.npmjs.com/package/@aikeymouse/chromelink-client)**

## Installation

You can install either package - they're identical:

```bash
# Unscoped (this package)
npm install chromelink-client

# OR scoped (main package)
npm install @aikeymouse/chromelink-client
```

## Quick Start

```javascript
const ChromeLinkClient = require('chromelink-client');

async function example() {
  const client = new ChromeLinkClient();
  await client.connect('ws://localhost:9000');
  
  await client.navigate('https://example.com');
  const title = await client.getText('h1');
  console.log('Title:', title.text);
  
  client.close();
}

example().catch(console.error);
```

## Documentation

For complete documentation, see:
- **[Main Package README](https://www.npmjs.com/package/@aikeymouse/chromelink-client)**
- **[GitHub Repository](https://github.com/aikeymouse/chrome-link)**
- **[Protocol Documentation](https://github.com/aikeymouse/chrome-link/blob/main/docs/PROTOCOL.md)**

## Why Two Packages?

- **`chromelink-client`** (this package): Unscoped, easier to type, reserves the name
- **`@aikeymouse/chromelink-client`**: Scoped, official package with full implementation

Both packages provide the exact same functionality.

## License

MIT
