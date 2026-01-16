# Changelog

All notable changes to the ChromeLink Node.js client will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-16

### Added
- Initial release of `@aikeymouse/chromelink-client`
- WebSocket client for ChromeLink browser automation
- Core methods: `connect()`, `navigate()`, `executeJS()`, `callHelper()`
- Tab management: `listTabs()`, `closeTab()`
- DOM interaction: `click()`, `type()`, `getText()`, `waitForElement()`
- Session management with automatic creation on connect
- Configurable verbose logging via constructor option
- Chunked response handling for results >1MB
- TypeScript type definitions
- MIT license for npm ecosystem compatibility
- Null-safe element operations with helpful error messages
- Unique request ID generation using counter

### Features
- **Verbose Logging**: Control console output with `{ verbose: false }` option
- **Chunked Responses**: Automatic assembly of large results (>1MB)
- **Session Management**: Auto-created sessions with configurable timeout
- **DOM Helpers**: CSP-compatible helper functions via `callHelper()`
- **Element Safety**: Null checks with descriptive error messages
- **Request Tracking**: Unique request IDs for debugging

[0.1.0]: https://github.com/aikeymouse/chrome-link/releases/tag/v0.1.0
