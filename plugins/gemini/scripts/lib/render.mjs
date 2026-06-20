/**
 * Output rendering utilities for grounded search/research results
 * (produced by the Antigravity CLI, `agy`).
 */

/**
 * Format a grounding report as Markdown.
 * @param {object} report
 * @param {string} report.query - Original query
 * @param {string} report.output - Raw agy output
 * @param {'search'|'research'|'audit'|'factcheck'|'changelog'|'compare'} report.mode
 * @param {object} [report.stats]
 * @returns {string}
 */
export function renderReport(report) {
  const { query, output, mode, stats } = report;

  const modeLabel = {
    search: 'Grounded Search',
    research: 'Deep Research',
    audit: 'Security Audit',
    factcheck: 'Fact Check',
    changelog: 'Changelog',
    compare: 'Comparison',
  }[mode] || 'Search';

  const lines = [
    `## Gemini ${modeLabel} Results`,
    '',
    `**Query:** ${query}`,
    '',
    '---',
    '',
    output,
    '',
    '---',
    `*Powered by Antigravity CLI (agy) \u00b7 google_search*`,
  ];

  if (stats) {
    lines.push(
      '',
      '<details>',
      '<summary>Stats</summary>',
      '',
      '```json',
      JSON.stringify(stats, null, 2),
      '```',
      '</details>',
    );
  }

  return lines.join('\n');
}

/**
 * Format an error message for display.
 * @param {string} error
 * @param {object} [context]
 * @param {'search'|'research'|'audit'|'factcheck'|'changelog'|'compare'} [context.mode]
 * @param {number} [context.exitCode]
 * @param {string} [context.suggestion]
 * @returns {string}
 */
export function renderError(error, context = {}) {
  const label = {
    search: 'Grounded Search',
    research: 'Deep Research',
    audit: 'Security Audit',
    factcheck: 'Fact Check',
    changelog: 'Changelog',
    compare: 'Comparison',
  }[context.mode] || 'Search';

  const lines = [`## Gemini ${label} Error`, '', `**Error:** ${error}`];

  // `!= null` so a genuine exit code of 0 is still shown (a truthy check hid it).
  if (context.exitCode != null) {
    lines.push(`**Exit Code:** ${context.exitCode}`);
  }
  if (context.suggestion) {
    lines.push('', `**Suggestion:** ${context.suggestion}`);
  }

  return lines.join('\n');
}

/**
 * Format a health check result for display.
 * @param {{ installed: boolean, version: string|null, loggedIn: boolean }} status
 * @returns {string}
 */
export function renderHealthCheck(status) {
  const lines = ['## Antigravity CLI (agy) Status', ''];

  if (!status.installed) {
    lines.push(
      '| Item | Status |',
      '|------|--------|',
      '| Installed | No |',
      '',
      'Antigravity CLI (agy) is not installed. Install it:',
      '```bash',
      '# macOS / Linux',
      'curl -fsSL https://antigravity.google/cli/install.sh | bash',
      '# macOS (Homebrew)',
      'brew install --cask antigravity-cli',
      '# docs: https://antigravity.google/docs/cli-using',
      '```',
    );
    return lines.join('\n');
  }

  lines.push(
    '| Item | Status |',
    '|------|--------|',
    `| Installed | Yes |`,
    `| Version | ${status.version || 'unknown'} |`,
    `| Logged In | ${status.loggedIn ? 'Yes' : 'No'} |`,
  );

  if (!status.loggedIn) {
    lines.push(
      '',
      'Run `agy` once to sign in (browser OAuth), or set `ANTIGRAVITY_API_KEY` / `GEMINI_API_KEY` for headless use. Existing Gemini CLI config can be imported with `agy plugin import gemini`.',
    );
  }

  return lines.join('\n');
}
