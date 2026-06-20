import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const companion = join(__dirname, '..', 'plugins', 'gemini', 'scripts', 'gemini-companion.mjs');

function run(...args) {
  return runWithEnv({}, ...args);
}

function runWithEnv(env, ...args) {
  return spawnSync('node', [companion, ...args], {
    encoding: 'utf-8',
    timeout: 5000,
    env: { ...process.env, ...env },
  });
}

describe('gemini-companion subcommand routing', () => {
  it('prints usage on unknown subcommand', () => {
    const result = run('unknown');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unknown subcommand/);
  });

  it('prints usage when no subcommand given', () => {
    const result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unknown subcommand/);
  });

  it('lists all subcommands in usage', () => {
    const result = run('unknown');
    const usage = result.stderr;
    assert.match(usage, /search/);
    assert.match(usage, /research/);
    assert.match(usage, /audit/);
    assert.match(usage, /factcheck/);
    assert.match(usage, /changelog/);
    assert.match(usage, /compare/);
    assert.match(usage, /setup/);
  });

  it('search requires a query', () => {
    const result = run('search');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage:.*search/);
  });

  it('research requires a query', () => {
    const result = run('research');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage:.*research/);
  });

  it('audit requires a query', () => {
    const result = run('audit');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage:.*audit/);
  });

  it('factcheck requires a claim', () => {
    const result = run('factcheck');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage:.*factcheck/);
  });

  it('changelog requires a package', () => {
    const result = run('changelog');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage:.*changelog/);
  });

  it('compare requires a query', () => {
    const result = run('compare');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage:.*compare/);
  });
});

describe('gemini-companion setup health check', () => {
  const MISSING_AGY = { AGY_BIN: '/nonexistent/agy-binary-xyz' };

  it('setup --json emits valid JSON and exits non-zero when agy is missing', () => {
    const result = runWithEnv(MISSING_AGY, 'setup', '--json');
    assert.notEqual(result.status, 0);
    const status = JSON.parse(result.stdout.trim());
    assert.equal(status.installed, false);
    assert.equal(status.loggedIn, false);
  });

  it('setup (non-json) renders the status table when agy is missing', () => {
    const result = runWithEnv(MISSING_AGY, 'setup');
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /Installed \| No/);
  });
});
