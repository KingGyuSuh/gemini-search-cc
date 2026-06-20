import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Exercises the real subprocess-execution path of agySearch() (runAgy ->
 * spawnSync) against a FAKE `agy` binary, with AGY_NO_PTY=1 so the result logic
 * is tested deterministically and cross-platform (no dependency on `script`).
 *
 * agySearch reads AGY_BIN / AGY_NO_PTY at module load, so each scenario runs in
 * a fresh `node` subprocess with the env preset (same pattern as companion.test).
 */

const MODULE_URL = pathToFileURL(
  fileURLToPath(new URL('../plugins/gemini/scripts/lib/gemini.mjs', import.meta.url)),
).href;

let dir;
let counter = 0;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'agy-exec-'));
});
after(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Write an executable fake `agy` shell script and return its path. */
function makeFakeAgy(body) {
  const p = join(dir, `fake-agy-${counter++}.sh`);
  writeFileSync(p, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  chmodSync(p, 0o755);
  return p;
}

/** Run agySearch() in a subprocess with AGY_BIN pointed at `fakeBin`. */
function runAgySearch(fakeBin, { query = 'test query', extraEnv = {} } = {}) {
  const runner =
    `import(${JSON.stringify(MODULE_URL)}).then(async (m) => {` +
    `const r = await m.agySearch(${JSON.stringify(query)}, { timeout: 10000, searchHint: false });` +
    `process.stdout.write(JSON.stringify(r));` +
    `}).catch((e) => process.stdout.write(JSON.stringify({ THREW: String(e && e.message) })));`;
  const res = spawnSync(process.execPath, ['-e', runner], {
    encoding: 'utf-8',
    env: { ...process.env, AGY_BIN: fakeBin, AGY_NO_PTY: '1', ...extraEnv },
  });
  try {
    return JSON.parse(res.stdout);
  } catch {
    throw new Error(`runner returned non-JSON.\nstdout=${res.stdout}\nstderr=${res.stderr}`);
  }
}

/** Run healthCheck() in a subprocess with AGY_BIN pointed at `fakeBin`. */
function runHealthCheck(fakeBin) {
  const runner =
    `import(${JSON.stringify(MODULE_URL)}).then((m) => {` +
    `process.stdout.write(JSON.stringify(m.healthCheck()));` +
    `}).catch((e) => process.stdout.write(JSON.stringify({ THREW: String(e && e.message) })));`;
  const res = spawnSync(process.execPath, ['-e', runner], {
    encoding: 'utf-8',
    env: { ...process.env, AGY_BIN: fakeBin },
  });
  try {
    return JSON.parse(res.stdout);
  } catch {
    throw new Error(`runner returned non-JSON.\nstdout=${res.stdout}\nstderr=${res.stderr}`);
  }
}

describe('healthCheck', () => {
  it('reports not-installed deterministically without spawning agy', () => {
    const r = runHealthCheck(join(dir, 'no-such-agy-binary'));
    assert.deepEqual(r, { installed: false, version: null, loggedIn: false });
  });
});

describe('agySearch subprocess execution path', () => {
  it('promotes a clean exit-0 stdout answer to ok:true', () => {
    const bin = makeFakeAgy(`echo 'The answer is 42.'\nexit 0`);
    const r = runAgySearch(bin);
    assert.equal(r.ok, true);
    assert.equal(r.output, 'The answer is 42.');
  });

  it('does NOT promote a non-zero-exit error dump to ok:true (regression: fake-success bug)', () => {
    // Simulates agy rejecting a bad flag: usage/error dump on stdout (as the
    // `script` PTY wrapper would merge agy's stderr into stdout) plus a non-zero
    // exit. This MUST surface as an error, never as a fake successful answer.
    const bin = makeFakeAgy(
      `echo 'flags provided but not defined: -output-format'\necho 'Usage of agy:'\nexit 2`,
    );
    const r = runAgySearch(bin);
    assert.equal(r.ok, false);
    assert.equal(r.exitCode, 2);
    assert.match(r.error, /flags provided but not defined/);
  });

  it('reports diagnostics on a non-zero exit with empty stdout', () => {
    const bin = makeFakeAgy(`echo 'agy: internal failure' 1>&2\nexit 3`);
    const r = runAgySearch(bin);
    assert.equal(r.ok, false);
    assert.equal(r.exitCode, 3);
    assert.match(r.error, /internal failure|exited with code 3/);
  });

  it('treats exit-0-but-empty output as an error and flags AGY_NO_PTY', () => {
    const bin = makeFakeAgy(`exit 0`);
    const r = runAgySearch(bin);
    assert.equal(r.ok, false);
    // AGY_NO_PTY=1 disabled the workaround, so the message should say so.
    assert.match(r.error, /AGY_NO_PTY/);
  });

  it('returns a clear "not installed" error when the agy binary is missing (ENOENT)', () => {
    const r = runAgySearch(join(dir, 'this-agy-does-not-exist'));
    assert.equal(r.ok, false);
    assert.match(r.error, /installed|PATH|setup/i);
  });

  it('surfaces a structured JSON error field even on exit 0 (forward-compat)', () => {
    const bin = makeFakeAgy(`echo '{"error":"quota exceeded"}'\nexit 0`);
    const r = runAgySearch(bin);
    assert.equal(r.ok, false);
    assert.equal(r.error, 'quota exceeded');
  });
});
