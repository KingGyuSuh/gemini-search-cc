import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAgyOutput,
  parseGeminiOutput,
  cleanAgyOutput,
  stripAnsi,
} from '../plugins/gemini/scripts/lib/gemini.mjs';

describe('parseAgyOutput', () => {
  it('returns plain text for non-JSON input (the normal agy case)', () => {
    const result = parseAgyOutput('React 19.1.0 was released in March 2026.');
    assert.equal(result.response, 'React 19.1.0 was released in March 2026.');
    assert.equal(result.error, null);
    assert.equal(result.stats, null);
  });

  it('parses valid JSON with response field (forward-compat)', () => {
    const input = JSON.stringify({ response: 'hello world' });
    const result = parseAgyOutput(input);
    assert.equal(result.response, 'hello world');
    assert.equal(result.error, null);
    assert.equal(result.stats, null);
  });

  it('parses all three fields', () => {
    const input = JSON.stringify({
      response: 'answer',
      error: null,
      stats: { tokens: 100, latency: 5.2 },
    });
    const result = parseAgyOutput(input);
    assert.equal(result.response, 'answer');
    assert.equal(result.error, null);
    assert.deepEqual(result.stats, { tokens: 100, latency: 5.2 });
  });

  it('accepts a "text" response field (agy-style)', () => {
    const result = parseAgyOutput(JSON.stringify({ text: 'from text field' }));
    assert.equal(result.response, 'from text field');
  });

  it('accepts an "output" response field', () => {
    const result = parseAgyOutput(JSON.stringify({ output: 'from output field' }));
    assert.equal(result.response, 'from output field');
  });

  it('extracts string error', () => {
    const input = JSON.stringify({ error: 'quota exceeded' });
    const result = parseAgyOutput(input);
    assert.equal(result.response, null);
    assert.equal(result.error, 'quota exceeded');
  });

  it('extracts object error with message', () => {
    const input = JSON.stringify({ error: { message: 'rate limited', code: 429 } });
    const result = parseAgyOutput(input);
    assert.equal(result.error, 'rate limited');
  });

  it('stringifies object error without message', () => {
    const input = JSON.stringify({ error: { code: 500, detail: 'internal' } });
    const result = parseAgyOutput(input);
    assert.equal(result.error, '{"code":500,"detail":"internal"}');
  });

  it('returns nulls for empty string', () => {
    const result = parseAgyOutput('');
    assert.deepEqual(result, { response: null, error: null, stats: null });
  });

  it('returns nulls for null input', () => {
    const result = parseAgyOutput(null);
    assert.deepEqual(result, { response: null, error: null, stats: null });
  });

  it('returns nulls for undefined input', () => {
    const result = parseAgyOutput(undefined);
    assert.deepEqual(result, { response: null, error: null, stats: null });
  });

  it('returns nulls for whitespace-only input', () => {
    const result = parseAgyOutput('   \n  ');
    assert.deepEqual(result, { response: null, error: null, stats: null });
  });

  it('returns null response for JSON with non-string response field', () => {
    const input = JSON.stringify({ response: 123 });
    const result = parseAgyOutput(input);
    assert.equal(result.response, null);
  });

  it('keeps a JSON object with no recognized field as plain text (not discarded)', () => {
    const result = parseAgyOutput('{"foo":"bar"}');
    assert.equal(result.response, '{"foo":"bar"}');
    assert.equal(result.error, null);
  });

  it('keeps a JSON array answer as plain text (not a structured envelope)', () => {
    const result = parseAgyOutput('["a","b","c"]');
    assert.equal(result.response, '["a","b","c"]');
    assert.equal(result.error, null);
  });

  it('keeps a fenced code block that starts with `{` as plain text', () => {
    const md = '{\n  "example": "this is the answer body, not an envelope"\n}\nplus prose';
    const result = parseAgyOutput(md);
    assert.equal(result.response, md);
  });

  it('handles JSON with extra whitespace', () => {
    const input = '  \n  ' + JSON.stringify({ response: 'trimmed' }) + '  \n';
    const result = parseAgyOutput(input);
    assert.equal(result.response, 'trimmed');
  });

  it('preserves stats as-is', () => {
    const stats = { models: [{ name: 'gemini-3-pro' }], calls: 5 };
    const input = JSON.stringify({ response: 'ok', stats });
    const result = parseAgyOutput(input);
    assert.deepEqual(result.stats, stats);
  });

  it('is aliased as parseGeminiOutput for backward compatibility', () => {
    assert.equal(parseGeminiOutput, parseAgyOutput);
  });
});

describe('stripAnsi', () => {
  it('removes SGR color codes', () => {
    assert.equal(stripAnsi('\x1B[1;31mred\x1B[0m'), 'red');
  });

  it('removes cursor-movement CSI sequences', () => {
    assert.equal(stripAnsi('a\x1B[2Kb\x1B[1Gc'), 'abc');
  });

  it('preserves newlines and tabs', () => {
    assert.equal(stripAnsi('line1\n\tline2'), 'line1\n\tline2');
  });

  it('a backspace deletes a whole surrogate-pair character (no mojibake)', () => {
    // "a" + 😀 (U+1F600, a surrogate pair) + BS + "X" -> the emoji is fully removed.
    assert.equal(stripAnsi('a\u{1F600}\x08X'), 'aX');
  });

  it('strips 8-bit C1 CSI sequences', () => {
    assert.equal(stripAnsi('a\x9B31mb'), 'ab');
  });

  it('strips C1 control characters (0x80-0x9F)', () => {
    assert.equal(stripAnsi('a\x85b\x9Fc'), 'abc');
  });

  it('preserves Latin-1 letters above the C1 range', () => {
    assert.equal(stripAnsi('café résumé'), 'café résumé');
  });

  it('returns empty string for falsy input', () => {
    assert.equal(stripAnsi(''), '');
    assert.equal(stripAnsi(null), '');
    assert.equal(stripAnsi(undefined), '');
  });
});

describe('cleanAgyOutput', () => {
  it('strips ANSI escape codes', () => {
    assert.equal(cleanAgyOutput('\x1B[32mhello world\x1B[0m'), 'hello world');
  });

  it('removes carriage returns', () => {
    assert.equal(cleanAgyOutput('line1\r\nline2'), 'line1\nline2');
  });

  it('erases the BSD `script` "^D\\b\\b" EOT artifact via backspace replay', () => {
    assert.equal(cleanAgyOutput('^D\b\b## Title\r\nbody'), '## Title\nbody');
  });

  it('removes `script` banner lines (quiet-mode fallback)', () => {
    const raw = [
      'Script started, output file is /dev/null',
      'the real answer',
      'Script done, output file is /dev/null',
    ].join('\n');
    assert.equal(cleanAgyOutput(raw), 'the real answer');
  });

  it('preserves a legit line that starts with "Script started" but is not the banner', () => {
    const raw = 'Script started running at line 5, then crashed.\nhere is the explanation';
    const out = cleanAgyOutput(raw);
    assert.match(out, /Script started running at line 5/);
    assert.match(out, /here is the explanation/);
  });

  it('trims surrounding whitespace', () => {
    assert.equal(cleanAgyOutput('\n\n  answer  \n\n'), 'answer');
  });

  it('returns empty string for falsy input', () => {
    assert.equal(cleanAgyOutput(''), '');
    assert.equal(cleanAgyOutput(null), '');
  });

  it('round-trips through parseAgyOutput for a typical plain-text reply', () => {
    const raw = '\x1B[36m## Results\x1B[0m\r\nSome grounded answer.\r\n';
    const cleaned = cleanAgyOutput(raw);
    const parsed = parseAgyOutput(cleaned);
    assert.equal(parsed.response, '## Results\nSome grounded answer.');
    assert.equal(parsed.error, null);
  });
});
