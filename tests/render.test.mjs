import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderReport, renderError, renderHealthCheck } from '../plugins/gemini/scripts/lib/render.mjs';

describe('renderReport', () => {
  it('renders search mode with correct header', () => {
    const out = renderReport({ query: 'test', output: 'result', mode: 'search' });
    assert.match(out, /## Gemini Grounded Search Results/);
    assert.match(out, /\*\*Query:\*\* test/);
    assert.match(out, /result/);
    assert.match(out, /Powered by Antigravity CLI \(agy\)/);
  });

  it('renders all mode labels correctly', () => {
    const modes = {
      search: 'Grounded Search',
      research: 'Deep Research',
      audit: 'Security Audit',
      factcheck: 'Fact Check',
      changelog: 'Changelog',
      compare: 'Comparison',
    };
    for (const [mode, label] of Object.entries(modes)) {
      const out = renderReport({ query: 'q', output: 'o', mode });
      assert.match(out, new RegExp(`Gemini ${label} Results`), `mode "${mode}" should produce label "${label}"`);
    }
  });

  it('includes stats when provided', () => {
    const out = renderReport({
      query: 'q', output: 'o', mode: 'search',
      stats: { tokens: 42 },
    });
    assert.match(out, /<details>/);
    assert.match(out, /<summary>Stats<\/summary>/);
    assert.match(out, /"tokens": 42/);
  });

  it('omits stats section when stats is null', () => {
    const out = renderReport({ query: 'q', output: 'o', mode: 'search', stats: null });
    assert.ok(!out.includes('<details>'));
  });

  it('omits stats section when stats is undefined', () => {
    const out = renderReport({ query: 'q', output: 'o', mode: 'search' });
    assert.ok(!out.includes('<details>'));
  });
});

describe('renderError', () => {
  it('renders error message', () => {
    const out = renderError('something broke');
    assert.match(out, /## Gemini Search Error/);
    assert.match(out, /\*\*Error:\*\* something broke/);
  });

  it('includes exit code when provided', () => {
    const out = renderError('fail', { exitCode: 42 });
    assert.match(out, /\*\*Exit Code:\*\* 42/);
  });

  it('shows a genuine exit code of 0 (not hidden by a truthy check)', () => {
    const out = renderError('fail', { exitCode: 0 });
    assert.match(out, /\*\*Exit Code:\*\* 0/);
  });

  it('includes suggestion when provided', () => {
    const out = renderError('fail', { suggestion: 'try again' });
    assert.match(out, /\*\*Suggestion:\*\* try again/);
  });

  it('omits exit code when not provided', () => {
    const out = renderError('fail', {});
    assert.ok(!out.includes('Exit Code'));
  });

  it('labels the error header by mode', () => {
    assert.match(renderError('x', { mode: 'audit' }), /## Gemini Security Audit Error/);
    assert.match(renderError('x', { mode: 'research' }), /## Gemini Deep Research Error/);
    assert.match(renderError('x', { mode: 'compare' }), /## Gemini Comparison Error/);
  });

  it('falls back to the generic "Search" header when no mode is given', () => {
    assert.match(renderError('x'), /## Gemini Search Error/);
  });
});

describe('renderHealthCheck', () => {
  it('renders not-installed state', () => {
    const out = renderHealthCheck({ installed: false, version: null, loggedIn: false });
    assert.match(out, /Installed \| No/);
    assert.match(out, /antigravity\.google\/cli\/install\.sh/);
    assert.match(out, /brew install --cask antigravity-cli/);
  });

  it('renders installed and logged-in state', () => {
    const out = renderHealthCheck({ installed: true, version: '0.36.0', loggedIn: true });
    assert.match(out, /Installed \| Yes/);
    assert.match(out, /Version \| 0\.36\.0/);
    assert.match(out, /Logged In \| Yes/);
  });

  it('renders installed but not logged-in state', () => {
    const out = renderHealthCheck({ installed: true, version: '1.0.0', loggedIn: false });
    assert.match(out, /Logged In \| No/);
    assert.match(out, /ANTIGRAVITY_API_KEY/);
  });

  it('handles unknown version', () => {
    const out = renderHealthCheck({ installed: true, version: null, loggedIn: true });
    assert.match(out, /Version \| unknown/);
  });
});
