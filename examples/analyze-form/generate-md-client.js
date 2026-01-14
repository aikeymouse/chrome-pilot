#!/usr/bin/env node
/**
 * ChromePilot Markdown Report Generator
 * Generates a markdown report with screenshots from page-analysis.json
 * 
 * Usage:
 *   node generate-md-client.js <url> [--input <json-file>] [--output <md-file>]
 * 
 * Examples:
 *   node generate-md-client.js https://www.selenium.dev/selenium/web/web-form.html
 *   node generate-md-client.js https://github.com/login --input login-analysis.json
 *   node generate-md-client.js https://example.com --output custom-report.md
 */

const ChromePilotClient = require('./chromepilot-client');
const c = require('./console-utils');
const fs = require('fs');
const path = require('path');

class MarkdownReportGenerator {
  constructor() {
    this.client = new ChromePilotClient();
    this.sessionId = null;
    this.screenshotDir = path.join(__dirname, 'output', 'screenshots');
  }

  async connect() {
    await this.client.connect();
    this.sessionId = this.client.sessionId;
  }

  /**
   * Ensure screenshots directory exists
   */
  ensureScreenshotDir() {
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
      console.log(`  ${c.success('✓')} Created screenshots directory: ${c.dim(this.screenshotDir)}`);
    }
  }

  /**
   * Save base64 screenshot to file
   */
  saveScreenshot(dataUrl, filename) {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const filepath = path.join(this.screenshotDir, filename);
    fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
    return filepath;
  }

  /**
   * Capture screenshot of element with highlighting
   */
  async captureElementScreenshot(tabId, selector, filename) {
    try {
      // Highlight the element
      await this.client.sendRequest('callHelper', {
        tabId,
        functionName: 'highlightElement',
        args: [selector]
      });

      // Wait for highlight animation
      await new Promise(resolve => setTimeout(resolve, 300));

      // Capture screenshot of the specific element
      const captureResult = await this.client.sendRequest('captureScreenshot', {
        tabId,
        selector: selector
      });

      // Remove highlight
      await this.client.sendRequest('callHelper', {
        tabId,
        functionName: 'removeHighlights',
        args: []
      });

      // Save screenshot
      if (captureResult.screenshots && captureResult.screenshots.length > 0) {
        const screenshot = captureResult.screenshots[0];
        const filepath = this.saveScreenshot(screenshot.dataUrl, filename);
        console.log(`  ${c.success('✓')} Saved screenshot: ${c.dim(filename)}`);
        return path.relative(path.join(__dirname, 'output'), filepath);
      } else {
        console.log(`  ${c.warning('⚠')} No screenshot captured for: ${c.dim(selector)}`);
        return null;
      }
    } catch (error) {
      console.log(`  ${c.warning('⚠')} Failed to capture screenshot for ${c.dim(selector)}: ${error.message}`);
      return null;
    }
  }

  /**
   * Capture full page screenshot with container highlighted
   */
  async captureContainerScreenshot(tabId, containerSelector, filename) {
    try {
      // Highlight container
      await this.client.sendRequest('callHelper', {
        tabId,
        functionName: 'highlightElement',
        args: [containerSelector]
      });

      // Wait for highlight animation
      await new Promise(resolve => setTimeout(resolve, 300));

      // Capture full viewport
      const captureResult = await this.client.sendRequest('captureScreenshot', { tabId });

      // Remove highlight
      await this.client.sendRequest('callHelper', {
        tabId,
        functionName: 'removeHighlights',
        args: []
      });

      // Save screenshot
      const filepath = this.saveScreenshot(captureResult.dataUrl, filename);
      console.log(`  ${c.success('✓')} Saved container screenshot: ${c.dim(filename)}`);
      return path.relative(path.join(__dirname, 'output'), filepath);
    } catch (error) {
      console.log(`  ${c.warning('⚠')} Failed to capture container screenshot: ${error.message}`);
      return null;
    }
  }

  /**
   * Group labels with their related fields
   */
  groupLabeledFields(elements) {
    const groups = new Map();
    const processedIndices = new Set();

    // First pass: identify label+field pairs
    for (let i = 0; i < elements.length; i++) {
      if (processedIndices.has(i)) continue;
      
      const element = elements[i];
      
      // Check if this is a label followed by a field
      if (element.tagName === 'label' && i + 1 < elements.length) {
        const nextElement = elements[i + 1];
        
        // Check if next element is a field (input, select, textarea)
        if (['input', 'select', 'textarea'].includes(nextElement.tagName)) {
          // Create a field group
          let groupKey;
          if (nextElement.tagName === 'input' && nextElement.type) {
            groupKey = `INPUT-${nextElement.type.toUpperCase()}`;
          } else if (nextElement.tagName === 'select') {
            groupKey = 'SELECT';
          } else if (nextElement.tagName === 'textarea') {
            groupKey = 'TEXTAREA';
          } else {
            groupKey = nextElement.tagName.toUpperCase();
          }

          if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
          }
          
          // Add as a pair
          groups.get(groupKey).push({
            type: 'pair',
            label: element,
            field: nextElement
          });
          
          processedIndices.add(i);
          processedIndices.add(i + 1);
          continue;
        }
      }
      
      // Handle unpaired elements
      let groupKey;
      if (element.tagName === 'input' && element.type) {
        groupKey = `INPUT-${element.type.toUpperCase()}`;
      } else if (element.tagName === 'button') {
        groupKey = 'BUTTON';
      } else if (element.tagName === 'select') {
        groupKey = 'SELECT';
      } else if (element.tagName === 'textarea') {
        groupKey = 'TEXTAREA';
      } else if (element.tagName === 'a') {
        groupKey = 'LINK';
      } else if (element.tagName === 'label') {
        groupKey = 'LABEL';
      } else {
        groupKey = element.tagName.toUpperCase();
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push({
        type: 'single',
        element: element
      });
      processedIndices.add(i);
    }

    return groups;
  }

  /**
   * Capture screenshot of label+field pair with highlighting
   * If label wraps field (uses :has()), captures only label (which includes field)
   * If label doesn't wrap (uses [for=]), captures both separately
   */
  async capturePairScreenshot(tabId, labelSelector, fieldSelector, filename) {
    try {
      // Check if label wraps the field (contains :has())
      const labelWrapsField = labelSelector.includes(':has(');
      
      // Highlight both elements
      await this.client.sendRequest('callHelper', {
        tabId,
        functionName: 'highlightElement',
        args: [labelSelector]
      });
      await this.client.sendRequest('callHelper', {
        tabId,
        functionName: 'highlightElement',
        args: [fieldSelector]
      });

      // Wait for highlight animation
      await new Promise(resolve => setTimeout(resolve, 300));

      let captureResult;
      if (labelWrapsField) {
        // Label wraps field - only capture label (which includes field visually)
        captureResult = await this.client.sendRequest('captureScreenshot', {
          tabId,
          selector: labelSelector
        });
      } else {
        // Label doesn't wrap - capture both separately
        const combinedSelector = `${labelSelector}, ${fieldSelector}`;
        captureResult = await this.client.sendRequest('captureScreenshot', {
          tabId,
          selector: combinedSelector
        });
      }

      // Remove highlights
      await this.client.sendRequest('callHelper', {
        tabId,
        functionName: 'removeHighlights',
        args: []
      });

      // Handle the result
      if (captureResult.screenshots && captureResult.screenshots.length > 0) {
        if (captureResult.screenshots.length === 1) {
          // Single screenshot
          const screenshot = captureResult.screenshots[0];
          const filepath = this.saveScreenshot(screenshot.dataUrl, filename);
          console.log(`  ${c.success('✓')} Saved screenshot: ${c.dim(filename)}`);
          return path.relative(path.join(__dirname, 'output'), filepath);
        } else {
          // Multiple screenshots - save all and return array
          const paths = [];
          for (let i = 0; i < captureResult.screenshots.length; i++) {
            const screenshot = captureResult.screenshots[i];
            const filenamePart = filename.replace('.png', `-${i}.png`);
            const filepath = this.saveScreenshot(screenshot.dataUrl, filenamePart);
            paths.push(path.relative(path.join(__dirname, 'output'), filepath));
          }
          console.log(`  ${c.success('✓')} Saved ${paths.length} screenshots: ${c.dim(filename)}`);
          return paths;
        }
      } else {
        console.log(`  ${c.warning('⚠')} No screenshot captured for pair`);
        return null;
      }
    } catch (error) {
      console.log(`  ${c.warning('⚠')} Failed to capture pair screenshot: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate markdown content
   */
  async generateMarkdown(analysisData, url, tabId) {
    const lines = [];
    const { container, elements, validation } = analysisData;

    // Title and metadata
    lines.push('# Form Analysis Report\n\n');
    lines.push(`**URL:** ${url}\n\n`);
    lines.push(`**Container:** \`${container.selector}\`\n\n`);
    lines.push(`**Total Elements:** ${elements.length}\n\n`);
    
    if (validation) {
      lines.push(`**Validation:** ${validation.unique} unique selectors, ${validation.ambiguous} ambiguous\n\n`);
    }

    // Capture container screenshot
    console.log(`\n${c.info('📸 Capturing container screenshot...')}`);
    const containerScreenshot = await this.captureContainerScreenshot(
      tabId,
      container.selector,
      'container-full-page.png'
    );
    
    if (containerScreenshot) {
      lines.push(`\n## Full Page View\n`);
      lines.push(`![Container highlighted](${containerScreenshot})\n`);
    }

    // Table of contents
    lines.push('\n## Table of Contents\n');
    const groups = this.groupLabeledFields(elements);
    for (const [groupKey] of groups) {
      const anchor = groupKey.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      lines.push(`- [${groupKey}](#${anchor})\n`);
    }

    // Generate sections for each element type
    console.log(`\n${c.info('📸 Capturing element screenshots...')}`);
    let elementIndex = 0;

    for (const [groupKey, groupItems] of groups) {
      lines.push(`\n## ${groupKey}\n`);
      lines.push(`Found ${groupItems.length} item(s)\n`);

      for (const item of groupItems) {
        elementIndex++;
        const screenshotFilename = `element-${elementIndex.toString().padStart(3, '0')}.png`;
        
        if (item.type === 'pair') {
          // Handle label+field pair
          const { label, field } = item;
          console.log(`  ${c.dim(`[${elementIndex}]`)} ${label.selector} + ${field.selector}`);
          
          // Capture combined screenshot
          const screenshotPath = await this.capturePairScreenshot(
            tabId,
            label.selector,
            field.selector,
            screenshotFilename
          );

          // Element heading
          const elementTitle = label.textContent || field.name || field.id || `Field ${elementIndex}`;
          lines.push(`\n### ${elementTitle.substring(0, 50)}\n`);

          // Screenshot(s) - may be single combined or multiple
          if (screenshotPath) {
            if (Array.isArray(screenshotPath)) {
              // Multiple screenshots
              for (const path of screenshotPath) {
                lines.push(`![${field.selector}](${path})\n`);
              }
            } else {
              // Single screenshot
              lines.push(`![${field.selector}](${screenshotPath})\n`);
            }
          }

          // Label Selector
          lines.push('\n**Label Selector:**\n');
          lines.push('```css\n');
          lines.push(label.selector + '\n');
          lines.push('```\n');

          // Field Selector
          lines.push('\n**Field Selector:**\n');
          lines.push('```css\n');
          lines.push(field.selector + '\n');
          lines.push('```\n');

          // Key properties for automation
          lines.push('\n**Field Details:**\n\n');
          lines.push(`- **Label:** ${label.textContent}\n`);
          lines.push(`- **Type:** \`${field.tagName}\``);
          if (field.type) {
            lines.push(` (\`${field.type}\`)`);
          }
          lines.push('\n');
          
          if (field.name) {
            lines.push(`- **Name:** \`${field.name}\`\n`);
          }
          if (field.id) {
            lines.push(`- **ID:** \`${field.id}\`\n`);
          }
          if (field.placeholder) {
            lines.push(`- **Placeholder:** "${field.placeholder}"\n`);
          }
          if (field.value) {
            lines.push(`- **Default Value:** "${field.value}"\n`);
          }
          if (field.required) {
            lines.push(`- **Required:** Yes\n`);
          }
          if (field.disabled) {
            lines.push(`- **Disabled:** Yes\n`);
          }

        } else {
          // Handle single element
          const element = item.element;
          console.log(`  ${c.dim(`[${elementIndex}]`)} ${element.selector}`);
          
          // Capture element screenshot
          const screenshotPath = await this.captureElementScreenshot(
            tabId,
            element.selector,
            screenshotFilename
          );

          // Element heading
          const elementTitle = element.textContent || element.name || element.id || `Element ${elementIndex}`;
          lines.push(`\n### ${elementTitle.substring(0, 50)}\n`);

          // Screenshot
          if (screenshotPath) {
            lines.push(`![${element.selector}](${screenshotPath})\n`);
          }

          // Selector
          lines.push('\n**Selector:**\n');
          lines.push('```css\n');
          lines.push(element.selector + '\n');
          lines.push('```\n');

          // Key properties for automation
          lines.push('\n**Element Details:**\n\n');
          lines.push(`- **Type:** \`${element.tagName}\``);
          if (element.type) {
            lines.push(` (\`${element.type}\`)`);
          }
          lines.push('\n');
          
          if (element.name) {
            lines.push(`- **Name:** \`${element.name}\`\n`);
          }
          if (element.id) {
            lines.push(`- **ID:** \`${element.id}\`\n`);
          }
          if (element.textContent) {
            lines.push(`- **Text:** "${element.textContent}"\n`);
          }
          if (element.placeholder) {
            lines.push(`- **Placeholder:** "${element.placeholder}"\n`);
          }
          if (element.value) {
            lines.push(`- **Value:** "${element.value}"\n`);
          }
          if (element.label) {
            lines.push(`- **Label Selector:** \`${element.label}\`\n`);
          }
          if (element.required) {
            lines.push(`- **Required:** Yes\n`);
          }
          if (element.disabled) {
            lines.push(`- **Disabled:** Yes\n`);
          }
        }

        lines.push('\n---\n');
      }
    }

    // Footer
    lines.push('\n---\n');
    lines.push(`\n*Generated on ${new Date().toLocaleString()}*\n`);

    return lines.join('');
  }

  /**
   * Clean up old output files before generating new report
   */
  cleanupOldOutput(outputFile) {
    // Remove old markdown report
    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
      console.log(`  ${c.success('✓')} Removed old report: ${c.dim(outputFile)}`);
    }

    // Remove old screenshots directory if exists
    if (fs.existsSync(this.screenshotDir)) {
      const files = fs.readdirSync(this.screenshotDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.screenshotDir, file));
      }
      fs.rmdirSync(this.screenshotDir);
      console.log(`  ✓ Removed old screenshots: ${this.screenshotDir}`);
    }
  }

  /**
   * Generate report
   */
  async generateReport(url, inputFile, outputFile) {
    console.log(`\n${c.bold('🔍 Starting markdown report generation...')}\n`);
    
    // Cleanup old output
    console.log(c.info('🧹 Cleaning up old output...'));
    this.cleanupOldOutput(outputFile);
    console.log(`  ${c.success('✓')} Cleanup complete\n`);
    
    // Load analysis data
    console.log(`${c.info('📄')} Loading analysis from: ${c.dim(inputFile)}`);
    const analysisData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    console.log(`  ${c.success('✓')} Loaded ${c.bold(analysisData.elements.length)} elements\n`);

    // Ensure screenshot directory exists
    this.ensureScreenshotDir();

    // Open the URL
    console.log(`🌐 Opening URL: ${url}`);
    const openResult = await this.client.sendRequest('openTab', {
      url,
      focus: true
    });
    const tabId = openResult.tab.id;
    console.log(`  ✓ Tab opened: ${tabId}\n`);

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate markdown
    const markdown = await this.generateMarkdown(analysisData, url, tabId);

    // Save markdown file
    console.log(`\n💾 Saving markdown report to: ${outputFile}`);
    fs.writeFileSync(outputFile, markdown, 'utf8');
    console.log(`  ✓ Report saved successfully\n`);

    // Cleanup
    console.log('🧹 Cleaning up...');
    await this.client.sendRequest('callHelper', {
      tabId,
      functionName: 'removeHighlights',
      args: []
    });
    await this.client.closeTab(tabId);
    console.log('  ✓ Cleanup complete\n');

    console.log('✅ Markdown report generation complete!\n');
    console.log(`📄 Report: ${outputFile}`);
    console.log(`📁 Screenshots: ${this.screenshotDir}\n`);
  }

  close() {
    this.client.close();
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
ChromePilot Markdown Report Generator

Usage:
  node generate-md-client.js <url> [--input <json-file>] [--output <md-file>]

Arguments:
  url                    The URL to open and screenshot

Options:
  --input <file>         Input JSON file (default: output/page-analysis.json)
  --output <file>        Output markdown file (default: output/page-report.md)
  -h, --help            Show this help message

Examples:
  node generate-md-client.js https://www.selenium.dev/selenium/web/web-form.html
  node generate-md-client.js https://github.com/login --input login-analysis.json
  node generate-md-client.js https://example.com --output custom-report.md
    `);
    process.exit(0);
  }

  const url = args[0];
  let inputFile = path.join(__dirname, 'output', 'page-analysis.json');
  let outputFile = path.join(__dirname, 'output', 'page-report.md');

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      inputFile = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputFile = path.resolve(args[i + 1]);
      i++;
    }
  }

  return { url, inputFile, outputFile };
}

// Main execution
async function main() {
  const { url, inputFile, outputFile } = parseArgs();

  // Validate input file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Error: Input file not found: ${inputFile}`);
    console.error(`\nRun analyze-page-client.js first to generate the analysis file.`);
    process.exit(1);
  }

  const generator = new MarkdownReportGenerator();

  try {
    await generator.connect();
    await generator.generateReport(url, inputFile, outputFile);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    generator.close();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = MarkdownReportGenerator;
