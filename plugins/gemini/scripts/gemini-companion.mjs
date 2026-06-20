#!/usr/bin/env node

/**
 * gemini-companion.mjs — Main CLI entry point bridging Claude Code to the
 * Antigravity CLI (`agy`), the successor to the now-sunset Gemini CLI.
 *
 * Subcommands:
 *   search <query>      — Quick grounded Google Search
 *   research <query>    — Deep multi-step research
 *   audit <query>       — Security & dependency audit search
 *   factcheck <claim>   — Fact-check a technical claim
 *   changelog <package> — Latest release notes
 *   compare <a> vs <b>  — Technology comparison
 *   setup               — Health check for the Antigravity CLI (agy)
 */

import {
  agySearch, agyResearch, agyFactCheck,
  agyChangelog, agyCompare, healthCheck,
} from './lib/gemini.mjs';
import { renderReport, renderError, renderHealthCheck } from './lib/render.mjs';
import { getWorkspaceContext } from './lib/workspace.mjs';

const [subcommand, ...rest] = process.argv.slice(2);
const query = rest.join(' ');

async function main() {
  switch (subcommand) {
    case 'search': {
      if (!query) {
        console.error('Usage: gemini-companion.mjs search <query>');
        process.exit(1);
      }
      const result = await agySearch(query);
      if (result.ok) {
        console.log(renderReport({ query, output: result.output, mode: 'search', stats: result.stats }));
      } else {
        console.error(renderError(result.error, {
          mode: 'search',
          exitCode: result.exitCode,
          suggestion: 'Check that the Antigravity CLI (agy) is installed and authenticated — run `/gemini:setup` or see https://antigravity.google/docs/cli-using.',
        }));
        process.exit(1);
      }
      break;
    }

    case 'research': {
      if (!query) {
        console.error('Usage: gemini-companion.mjs research <query>');
        process.exit(1);
      }
      const result = await agyResearch(query);
      if (result.ok) {
        console.log(renderReport({ query, output: result.output, mode: 'research', stats: result.stats }));
      } else {
        console.error(renderError(result.error, {
          mode: 'research',
          exitCode: result.exitCode,
          suggestion: 'Deep research requires a stable connection. Try again or use `search` for a quicker lookup.',
        }));
        process.exit(1);
      }
      break;
    }

    case 'audit': {
      if (!query) {
        console.error('Usage: gemini-companion.mjs audit <query>');
        process.exit(1);
      }
      const ctx = getWorkspaceContext();
      const ecosystemHint = ctx.ecosystems.length
        ? `\nProject ecosystem: ${ctx.ecosystems.join(', ')}`
        : '';
      const auditPrompt = [
        'Perform a security and compatibility audit for the following:',
        '',
        query,
        ecosystemHint,
        '',
        'Check for:',
        '1. Known CVEs and security vulnerabilities',
        '2. Deprecated APIs or packages',
        '3. Breaking changes in recent versions',
        '4. Recommended secure alternatives',
        '5. License compatibility concerns',
        '',
        'Provide a structured report with severity levels (Critical/High/Medium/Low).',
      ].join('\n');

      const result = await agySearch(auditPrompt, { timeout: 300_000 });
      if (result.ok) {
        console.log(renderReport({ query, output: result.output, mode: 'audit', stats: result.stats }));
      } else {
        console.error(renderError(result.error, { mode: 'audit', exitCode: result.exitCode }));
        process.exit(1);
      }
      break;
    }

    case 'factcheck': {
      if (!query) {
        console.error('Usage: gemini-companion.mjs factcheck <claim>');
        process.exit(1);
      }
      const result = await agyFactCheck(query);
      if (result.ok) {
        console.log(renderReport({ query, output: result.output, mode: 'factcheck', stats: result.stats }));
      } else {
        console.error(renderError(result.error, {
          mode: 'factcheck',
          exitCode: result.exitCode,
          suggestion: 'Try rephrasing the claim as a specific, verifiable statement.',
        }));
        process.exit(1);
      }
      break;
    }

    case 'changelog': {
      if (!query) {
        console.error('Usage: gemini-companion.mjs changelog <package[@version]>');
        process.exit(1);
      }
      const result = await agyChangelog(query);
      if (result.ok) {
        console.log(renderReport({ query, output: result.output, mode: 'changelog', stats: result.stats }));
      } else {
        console.error(renderError(result.error, {
          mode: 'changelog',
          exitCode: result.exitCode,
          suggestion: 'Check the package name spelling or try searching on npm/PyPI directly.',
        }));
        process.exit(1);
      }
      break;
    }

    case 'compare': {
      if (!query) {
        console.error('Usage: gemini-companion.mjs compare <tech-a> vs <tech-b>');
        process.exit(1);
      }
      const result = await agyCompare(query);
      if (result.ok) {
        console.log(renderReport({ query, output: result.output, mode: 'compare', stats: result.stats }));
      } else {
        console.error(renderError(result.error, {
          mode: 'compare',
          exitCode: result.exitCode,
          suggestion: 'Try a more specific comparison, e.g., "Bun vs Deno for CLI tools".',
        }));
        process.exit(1);
      }
      break;
    }

    case 'setup': {
      const jsonMode = rest.includes('--json');
      const status = healthCheck();
      if (jsonMode) {
        console.log(JSON.stringify(status));
      } else {
        console.log(renderHealthCheck(status));
      }
      if (!status.installed || !status.loggedIn) process.exit(1);
      break;
    }

    default:
      console.error(
        'Unknown subcommand. Usage:\n' +
        '  gemini-companion.mjs search <query>\n' +
        '  gemini-companion.mjs research <query>\n' +
        '  gemini-companion.mjs audit <query>\n' +
        '  gemini-companion.mjs factcheck <claim>\n' +
        '  gemini-companion.mjs changelog <package[@version]>\n' +
        '  gemini-companion.mjs compare <tech-a> vs <tech-b>\n' +
        '  gemini-companion.mjs setup [--json]'
      );
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(renderError(err.message));
  process.exit(1);
});
