#!/usr/bin/env node
/**
 * ChromePilot Full Analysis Tool
 * Runs page analysis and generates markdown report in a single command
 * 
 * Usage:
 *   node full-analysis-client.js --url <url> [--selector <selector>] [--output-dir <dir>]
 * 
 * Examples:
 *   node full-analysis-client.js --url https://www.selenium.dev/selenium/web/web-form.html
 *   node full-analysis-client.js --url https://github.com/login --output-dir custom-output
 *   node full-analysis-client.js --url https://example.com --selector "form" --output-dir results
 * 
 * This tool runs both analyze-page-client.js and generate-md-client.js sequentially,
 * ensuring all outputs (JSON, markdown, screenshots) are placed in the same directory.
 */

const { spawn } = require('child_process');
const path = require('path');
const c = require('./console-utils');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    url: null,
    selector: null,
    outputDir: 'output'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
    
    if (arg === '--url' && i + 1 < args.length) {
      params.url = args[++i];
    } else if (arg === '--selector' && i + 1 < args.length) {
      params.selector = args[++i];
    } else if (arg === '--output-dir' && i + 1 < args.length) {
      params.outputDir = args[++i];
    }
  }

  return params;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
${c.bold('ChromePilot Full Analysis Tool')}

${c.cyan('Usage:')}
  node full-analysis-client.js --url <url> [options]

${c.cyan('Required:')}
  --url <url>              URL to analyze

${c.cyan('Options:')}
  --selector <selector>    CSS selector to start analysis from
                          ${c.dim('(default: "form input, form button, form select, form textarea")')}
  --output-dir <dir>       Directory for all output files
                          ${c.dim('(default: "output")')}
  -h, --help              Show this help message

${c.cyan('Examples:')}
  ${c.dim('# Analyze Selenium demo form')}
  node full-analysis-client.js --url https://www.selenium.dev/selenium/web/web-form.html

  ${c.dim('# Analyze with custom selector')}
  node full-analysis-client.js --url https://github.com/login --selector "form"

  ${c.dim('# Save to custom directory')}
  node full-analysis-client.js --url https://example.com --output-dir results

${c.cyan('Output Files:')}
  ${c.dim('<output-dir>/page-analysis.json')}   - Structured analysis data (for AI agents)
  ${c.dim('<output-dir>/page-report.md')}       - Human-readable report
  ${c.dim('<output-dir>/screenshots/*.png')}    - Element screenshots
`);
}

/**
 * Run a child process and wait for completion
 */
function runCommand(command, args, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n${c.bold(description)}\n`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: __dirname
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${description} failed with exit code ${code}`));
      } else {
        resolve();
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start ${description}: ${err.message}`));
    });
  });
}

/**
 * Main execution
 */
async function main() {
  const params = parseArgs();

  // Validate required parameters
  if (!params.url) {
    console.error(c.error('\n✗ Error: --url parameter is required\n'));
    showHelp();
    process.exit(1);
  }

  console.log(c.bold('\n🚀 ChromePilot Full Analysis'));
  console.log(c.dim('═'.repeat(50)));
  console.log(`${c.cyan('URL:')}        ${params.url}`);
  console.log(`${c.cyan('Output Dir:')} ${params.outputDir}`);
  if (params.selector) {
    console.log(`${c.cyan('Selector:')}   ${params.selector}`);
  }
  console.log(c.dim('═'.repeat(50)));

  const jsonOutput = path.join(params.outputDir, 'page-analysis.json');
  const mdOutput = path.join(params.outputDir, 'page-report.md');

  try {
    // Step 1: Run analyze-page-client.js
    const analyzeArgs = [
      path.join(__dirname, 'analyze-page-client.js'),
      params.url,
      '--output',
      jsonOutput
    ];
    
    if (params.selector) {
      analyzeArgs.splice(2, 0, params.selector);
    }

    await runCommand(
      'node',
      analyzeArgs,
      '📊 Step 1/2: Analyzing page structure...'
    );

    // Step 2: Run generate-md-client.js
    const generateArgs = [
      path.join(__dirname, 'generate-md-client.js'),
      params.url,
      '--input',
      jsonOutput,
      '--markdown-output',
      mdOutput
    ];

    await runCommand(
      'node',
      generateArgs,
      '📝 Step 2/2: Generating markdown report...'
    );

    // Success message
    console.log(`\n${c.success('✓')} ${c.bold('Full analysis complete!')}`);
    console.log(c.dim('\nGenerated files:'));
    console.log(`  ${c.cyan('•')} ${jsonOutput}`);
    console.log(`  ${c.cyan('•')} ${mdOutput}`);
    console.log(`  ${c.cyan('•')} ${path.join(params.outputDir, 'screenshots')}/*.png\n`);

  } catch (error) {
    console.error(`\n${c.error('✗')} ${c.bold('Analysis failed:')}`);
    console.error(c.error(error.message));
    console.error();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(c.error(`\nFatal error: ${error.message}\n`));
    process.exit(1);
  });
}

module.exports = { main, parseArgs };
