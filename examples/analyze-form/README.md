# ChromePilot Form Analyzer

Analyze web pages to extract form elements with stable CSS selectors and generate comprehensive reports.

## Quick Start

```bash
# Full analysis (JSON + Markdown + Screenshots)
node full-analysis-client.js --url https://www.selenium.dev/selenium/web/web-form.html

# Custom output directory
node full-analysis-client.js --url https://example.com --output-dir results
```

## Tools

### 1. Full Analysis (Recommended)
Runs complete analysis and generates all outputs in one command.

```bash
node full-analysis-client.js --url <url> [--selector <selector>] [--output-dir <dir>]
```

**Output:**
- `page-analysis.json` - Structured data for AI agents (~20KB)
- `page-report.md` - Human-readable report with details
- `screenshots/*.png` - Visual screenshots of elements

### 2. Analyze Page Only
Generate JSON analysis without markdown report.

```bash
node analyze-page-client.js <url> [selector] [--output <file>]
```

**Example:**
```bash
node analyze-page-client.js https://github.com/login "input[type=text]" --output login.json
```

### 3. Generate Report Only
Create markdown report from existing JSON analysis.

```bash
node generate-md-client.js <url> [--input <json>] [--markdown-output <md>]
```

**Example:**
```bash
node generate-md-client.js https://github.com/login --input login.json --markdown-output login-report.md
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--url` | URL to analyze | Required |
| `--selector` | Starting CSS selector | `form input, form button, form select, form textarea` |
| `--output-dir` | Output directory for all files | `output/` |
| `--output` | JSON output file path | `output/page-analysis.json` |
| `--input` | JSON input file path | `output/page-analysis.json` |
| `--markdown-output` | Markdown output file path | `output/page-report.md` |

## Use Cases

### For AI Agents
Use the JSON output (`page-analysis.json`) for automated testing or page object generation:
- Compact format optimized for token efficiency
- Structured element data with selectors
- Container hierarchy information

### For Humans
Review the markdown report (`page-report.md`) with screenshots:
- Visual element identification
- Complete element properties
- Table of contents for easy navigation

### For CI/CD
Generate reports in custom directories:
```bash
node full-analysis-client.js \
  --url https://staging.example.com/checkout \
  --output-dir test-results/checkout-$(date +%Y%m%d)
```

## npm Scripts

```bash
# From examples/analyze-form/
npm run analyze              # Run analyze-page-client.js
npm run generate-report      # Run generate-md-client.js  
npm run full-analysis        # Run full-analysis-client.js

# From examples/
npm run analyze              # Run analyze-page-client.js
npm run generate-report      # Run generate-md-client.js
npm run full-analysis        # Run full-analysis-client.js
```

## Requirements

- ChromePilot extension installed and running
- Node.js 14+
- WebSocket connection to ChromePilot (default: ws://localhost:8080)

## Architecture

- **analyze-page-client.js** - DOM analyzer with stable selector generation
- **generate-md-client.js** - Markdown report generator with screenshots
- **full-analysis-client.js** - Orchestrator running both tools sequentially
- **console-utils.js** - Shared ANSI color utilities for consistent output
- **chromepilot-client.js** - WebSocket client for ChromePilot API

## License

CC-BY-NC-ND-4.0
