/**
 * Antigravity CLI (`agy`) detection, health check, and execution utilities.
 *
 * Migrated from the Gemini CLI (sunset for individual users on 2026-06-18).
 * The Antigravity CLI replaces Gemini CLI as Google's terminal coding agent.
 * See https://antigravity.google/docs/cli-using.
 *
 * Three agy quirks shape this module (all differ from the old Gemini CLI):
 *
 *  1. Non-TTY stdout drop (antigravity-cli issue #76): `agy -p "..."` writes
 *     ZERO bytes to stdout when run from a pipe / subprocess / redirect and
 *     still exits 0. Since this plugin always invokes agy as a subprocess, we
 *     allocate a pseudo-TTY via `script` to force agy to emit its output.
 *
 *  2. The `script` PTY wrapper must be spawned SYNCHRONOUSLY. Node's async
 *     child_process wires the child's stdin to a socket, and BSD `script`
 *     (macOS) aborts with "tcgetattr/ioctl: Operation not supported on socket".
 *     `spawnSync` with stdin=/dev/null works correctly on macOS and Linux, so
 *     every agy invocation goes through spawnSync (the companion is a
 *     single-shot CLI, so blocking the event loop is fine).
 *
 *  3. No stable structured output: `--output-format json` is not yet a defined
 *     flag (`flags provided but not defined: -output-format`), so we parse the
 *     plain-text response and strip terminal escape codes. JSON parsing is kept
 *     as a forward-compatible path, opt-in via AGY_OUTPUT_FORMAT.
 *
 * Environment knobs (for adapting to agy's fast-moving releases):
 *   AGY_BIN            override the binary name/path (default "agy")
 *   AGY_NO_PTY=1       disable the `script` PTY wrapper (e.g. once agy fixes #76)
 *   AGY_OUTPUT_FORMAT  pass `--output-format <value>` (e.g. "json") when stable
 */

import { spawnSync, execSync, execFileSync } from 'node:child_process';

const AGY_BIN = process.env.AGY_BIN || 'agy';
const USE_PTY = process.env.AGY_NO_PTY !== '1';
const OUTPUT_FORMAT = process.env.AGY_OUTPUT_FORMAT || '';

/** POSIX single-quote a string for safe embedding in a `sh -c` command. */
function shQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/** Whether the `script` utility (used for the PTY workaround) is on PATH. */
let _scriptAvailable;
function scriptAvailable() {
  if (_scriptAvailable === undefined) {
    try {
      execSync('command -v script', { stdio: 'ignore' });
      _scriptAvailable = true;
    } catch {
      _scriptAvailable = false;
    }
  }
  return _scriptAvailable;
}

/** Whether to wrap agy in a PTY via `script` on this platform. */
function usePtyWrapper() {
  return USE_PTY && process.platform !== 'win32' && scriptAvailable();
}

/** Build the argv passed to the `agy` binary for a headless prompt. */
function buildAgyArgs(prompt, timeoutMs) {
  const args = ['-p', prompt, '--dangerously-skip-permissions'];
  // agy's print-mode wait defaults to only 5m0s; without this a long run (e.g.
  // /gemini:research's 10-min budget) would hit agy's own cap first. Match it to
  // our timeout. agy parses Go durations, so seconds ("600s") is valid.
  if (timeoutMs && Number.isFinite(timeoutMs)) {
    args.push('--print-timeout', `${Math.ceil(timeoutMs / 1000)}s`);
  }
  if (OUTPUT_FORMAT) args.push('--output-format', OUTPUT_FORMAT);
  return args;
}

/**
 * Resolve the actual command + argv to spawn, wrapping in `script` when needed.
 * @param {string} prompt
 * @param {number} [timeout] - ms, forwarded to agy as --print-timeout
 * @returns {{ file: string, args: string[], pty: boolean }}
 */
function resolveInvocation(prompt, timeout) {
  const agyArgs = buildAgyArgs(prompt, timeout);

  if (!usePtyWrapper()) {
    // Direct invocation (Windows, or PTY disabled). May hit issue #76.
    return { file: AGY_BIN, args: agyArgs, pty: false };
  }

  if (process.platform === 'darwin') {
    // BSD script: `script -q <file> <command> [args...]` — execs the command
    // directly (no shell), so argv is passed verbatim and needs no quoting.
    return { file: 'script', args: ['-q', '/dev/null', AGY_BIN, ...agyArgs], pty: true };
  }

  // util-linux script: `script -qec '<shell-command>' <file>` runs the command
  // via `sh -c`, so the inner command (binary AND args) must be shell-quoted.
  // `-e` returns the child's exit code instead of script's own.
  const inner = [shQuote(AGY_BIN), ...agyArgs.map(shQuote)].join(' ');
  return { file: 'script', args: ['-qec', inner, '/dev/null'], pty: true };
}

/**
 * Run agy once, synchronously, capturing output.
 * @param {string} prompt
 * @param {number} timeout - ms
 * @returns {{ stdout: string, stderr: string, status: number|null, signal: string|null, error: Error|undefined, pty: boolean }}
 */
function runAgy(prompt, timeout) {
  const { file, args, pty } = resolveInvocation(prompt, timeout);
  // agy is told to stop at `timeout` (--print-timeout); give spawnSync a small
  // grace so agy's own (graceful) timeout fires before our hard SIGKILL backstop.
  const hardTimeout = Number.isFinite(timeout) ? timeout + 15_000 : timeout;
  const res = spawnSync(file, args, {
    encoding: 'utf-8',
    timeout: hardTimeout,
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    killSignal: 'SIGKILL',
    // Force a stable C locale so `script`'s banner ("Script started…") is always
    // English and the banner filter in cleanAgyOutput matches it. agy (a Go
    // binary) emits UTF-8 regardless of locale, so this does not affect content.
    env: { ...process.env, LC_ALL: 'C' },
  });
  return {
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    status: res.status,
    signal: res.signal,
    error: res.error,
    pty,
  };
}

/**
 * Apply backspace (0x08) as a destructive delete of the preceding character.
 * BSD `script` (macOS) prefixes captured output with a literal "^D" followed by
 * two backspaces to visually erase its EOT marker; in a pipe the backspaces do
 * not erase, so we replay them here. e.g. "^D\b\b" → "".
 */
function collapseBackspaces(str) {
  const out = [];
  // Iterate by code POINT (for..of is surrogate-pair aware) so a backspace
  // deletes a whole character, never half of a surrogate pair. Single linear
  // pass — no quadratic re-scan of the (up to multi-MB) captured buffer.
  for (const ch of String(str)) {
    if (ch === '\x08') {
      if (out.length && out[out.length - 1] !== '\n') out.pop();
    } else {
      out.push(ch);
    }
  }
  return out.join('');
}

/** Strip ANSI/terminal escape sequences and stray control characters. */
export function stripAnsi(str) {
  if (!str) return '';
  return collapseBackspaces(str)
    // OSC sequences: ESC ] ... (BEL | ST)
    .replace(/\x1B\][\s\S]*?(?:\x07|\x1B\\)/g, '')
    // 8-bit C1 OSC: 0x9D ... (BEL | ST 0x9C)
    .replace(/\x9D[\s\S]*?(?:\x07|\x9C)/g, '')
    // CSI sequences: ESC [ ... final byte
    .replace(/\x1B\[[0-9;?]*[ -/]*[@-~]/g, '')
    // 8-bit C1 CSI: 0x9B ... final byte
    .replace(/\x9B[0-9;?]*[ -/]*[@-~]/g, '')
    // Other two-byte escapes: ESC <single char>
    .replace(/\x1B[@-Z\\-_]/g, '')
    // Remaining control chars except TAB (\x09) and LF (\x0A), incl. C1 (0x80-0x9F)
    .replace(/[\x00-\x08\x0B-\x1F\x7F-\x9F]/g, '');
}

/**
 * Clean raw captured agy output into a usable response string:
 * strip escape codes and any `script` banner lines, then trim.
 * @param {string} raw
 * @returns {string}
 */
export function cleanAgyOutput(raw) {
  if (!raw) return '';
  const cleaned = stripAnsi(raw)
    .split('\n')
    // Strip only the real `script` banner (always contains "output file"), so a
    // legitimate answer line that merely starts with "Script started/done…" survives.
    .filter((line) => !/^\s*Script (started|done).*output file/.test(line))
    .join('\n');
  return cleaned.trim();
}

/** Whether stderr looks like a `script`/shell diagnostic rather than real content. */
function looksLikeScriptDiagnostic(stderr) {
  if (!stderr) return false;
  return (
    /^\s*script:\s/m.test(stderr) ||
    /tcgetattr|ioctl: Operation not supported|illegal option|^usage:\s*script/im.test(stderr)
  );
}

/**
 * Interpret a cleaned agy output string.
 * Plain text is the normal case; JSON is parsed when present (forward-compat
 * with a future stable `--output-format json`).
 * @param {string} str - Already-cleaned output (see cleanAgyOutput).
 * @returns {{ response: string|null, error: string|null, stats: object|null }}
 */
export function parseAgyOutput(str) {
  if (!str || !str.trim()) return { response: null, error: null, stats: null };
  const trimmed = str.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      // Only treat JSON as a STRUCTURED envelope when it is a non-array object
      // carrying at least one recognized field. Otherwise (a JSON array, or an
      // object with none of our keys) the text IS the answer — e.g. a grounded
      // reply that happens to start with `[` or `{`, or a fenced code block — so
      // fall through and keep it rather than silently discarding it.
      const RECOGNIZED = ['response', 'text', 'output', 'error', 'stats'];
      const isStructured =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
        RECOGNIZED.some((k) => k in parsed);
      if (isStructured) {
        let error = null;
        if (typeof parsed.error === 'string') {
          error = parsed.error;
        } else if (parsed.error && typeof parsed.error === 'object') {
          error = parsed.error.message || JSON.stringify(parsed.error);
        }
        const response =
          typeof parsed.response === 'string' ? parsed.response
          : typeof parsed.text === 'string' ? parsed.text
          : typeof parsed.output === 'string' ? parsed.output
          : null;
        return { response, error, stats: parsed.stats ?? null };
      }
    } catch {
      // Not valid JSON — fall through and treat as plain text.
    }
  }

  return { response: trimmed, error: null, stats: null };
}

/** Diagnostic message for the "exit 0 but empty output" case. */
function emptyOutputMessage() {
  if (!USE_PTY) {
    return 'agy produced no output and AGY_NO_PTY=1 disabled the `script` PTY workaround. agy can drop stdout in non-interactive mode (antigravity-cli issue #76); unset AGY_NO_PTY to re-enable the workaround, or run /gemini:setup to verify auth.';
  }
  if (process.platform === 'win32') {
    return 'agy produced no output. On Windows, agy can drop stdout in non-interactive mode (antigravity-cli issue #76) and there is no `script` PTY workaround. Try WSL, or run /gemini:setup to verify auth.';
  }
  if (!scriptAvailable()) {
    return 'agy produced no output and the `script` utility (the PTY workaround for antigravity-cli issue #76) was not found. Install `script` (util-linux / bsdutils), or run /gemini:setup.';
  }
  return 'agy produced no output. This usually means agy is not authenticated or hit a quota limit. Run /gemini:setup to verify, or set ANTIGRAVITY_API_KEY / GEMINI_API_KEY.';
}

/** Message for when the `script` PTY wrapper itself failed to launch agy. */
function ptyWrapperFailureMessage() {
  return 'The `script` PTY wrapper (used to work around agy non-TTY issue #76) failed to launch agy. Set AGY_NO_PTY=1 to bypass it, or run /gemini:setup to diagnose.';
}

/** Check if the `agy` CLI is available on PATH. */
export function isGeminiInstalled() {
  try {
    execSync(`command -v ${shQuote(AGY_BIN)}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
export { isGeminiInstalled as isAgyInstalled };

/** Get the `agy` CLI version string, or null if unavailable. */
export function getGeminiVersion() {
  try {
    // execFileSync (no shell) so an AGY_BIN path with spaces/metacharacters is safe.
    return execFileSync(AGY_BIN, ['--version'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}
export { getGeminiVersion as getAgyVersion };

/**
 * Verify agy auth is actually valid by running a minimal headless probe through
 * the SAME execution path used for real queries (so the health check accurately
 * predicts query behaviour). agy cold starts can be slow, so we allow up to 60s.
 * An unauthenticated agy will block on the interactive sign-in flow and get
 * killed by the timeout (→ false).
 */
export function isGeminiAuthValid() {
  try {
    const res = runAgy('Reply with the single word PONG.', 60_000);
    if (res.error || res.signal) return false;
    if (res.pty && looksLikeScriptDiagnostic(res.stderr) && !cleanAgyOutput(res.stdout)) return false;
    if (res.status !== 0) return false;
    return cleanAgyOutput(res.stdout).length > 0;
  } catch {
    return false;
  }
}
export { isGeminiAuthValid as isAgyAuthValid };

/**
 * Backward-compatible alias for the old JSON parser name.
 * @deprecated use parseAgyOutput
 */
export const parseGeminiOutput = parseAgyOutput;

/**
 * Execute a grounded search via agy headless mode (-p flag).
 * Uses --dangerously-skip-permissions to auto-approve tool calls (Google Search).
 * Output is captured as plain text (see module header for why).
 * @param {string} query - The search query.
 * @param {object} [opts]
 * @param {number} [opts.timeout=180000] - Timeout in ms (default 3 min).
 * @param {boolean} [opts.searchHint=true] - Prepend a hint to use Google Search.
 * @returns {Promise<{ok: boolean, output: string, error?: string, exitCode?: number, stats?: object}>}
 */
export async function agySearch(query, opts = {}) {
  const { timeout = 180_000, searchHint = true } = opts;

  const prompt = searchHint
    ? `Use Google Search to find up-to-date information. ${query}`
    : query;

  const res = runAgy(prompt, timeout);

  // Process could not be spawned, or was killed (timeout).
  if (res.error) {
    if (res.error.code === 'ETIMEDOUT' || res.signal) {
      return { ok: false, output: '', error: `Timeout after ${timeout / 1000}s` };
    }
    if (res.error.code === 'ENOENT') {
      return { ok: false, output: '', error: `Could not run "${AGY_BIN}". Is the Antigravity CLI installed and on PATH? Run /gemini:setup.` };
    }
    return { ok: false, output: '', error: `Failed to run agy: ${res.error.message}` };
  }
  if (res.signal) {
    return { ok: false, output: '', error: `Timeout after ${timeout / 1000}s` };
  }

  // The `script` wrapper failed to start agy — never treat its diagnostics as a response.
  if (res.pty && looksLikeScriptDiagnostic(res.stderr) && !cleanAgyOutput(res.stdout)) {
    return { ok: false, output: '', error: ptyWrapperFailureMessage() };
  }

  // Only stdout is ever promoted to a response — stderr is for diagnostics only.
  const cleanedOut = cleanAgyOutput(res.stdout);
  const { response, error, stats } = parseAgyOutput(cleanedOut);

  // A structured (JSON) error always wins, regardless of exit code.
  if (error) {
    return { ok: false, output: '', error, exitCode: res.status ?? undefined, stats };
  }

  // A non-zero exit means agy FAILED. Under the `script` PTY wrapper agy's own
  // stderr is merged into stdout, so `cleanedOut` here is agy's error/usage dump
  // — NOT a real answer. Surface it as an error and never promote it to ok:true.
  // (Both BSD `script` and util-linux `script -e` propagate agy's exit code via
  // spawnSync, and a successful agy run exits 0, so this never rejects a valid
  // answer. Exit-code-before-stdout ordering is the guard against the original
  // "diagnostic-promoted-to-success" silent failure.)
  if (res.status != null && res.status !== 0) {
    const detail = cleanedOut || cleanAgyOutput(res.stderr);
    return { ok: false, output: '', error: detail || `agy exited with code ${res.status}`, exitCode: res.status };
  }

  // Exit 0 (or unknown status on the direct/Windows path) with a usable answer.
  if (response && response.trim()) {
    return { ok: true, output: response, stats };
  }

  // Exit 0 but nothing usable — the non-TTY drop / auth / quota case.
  return { ok: false, output: '', error: emptyOutputMessage() };
}
export { agySearch as geminiSearch };

/**
 * Execute a deep research query (longer timeout, richer prompt).
 * @param {string} query
 * @param {object} [opts]
 * @param {number} [opts.timeout=600000] - Timeout in ms (default 10 min).
 * @returns {Promise<{ok: boolean, output: string, error?: string, exitCode?: number, stats?: object}>}
 */
export async function agyResearch(query, opts = {}) {
  const { timeout = 600_000 } = opts;

  const researchPrompt = [
    'You are a deep research assistant. Perform a thorough, multi-step investigation.',
    'Use Google Search multiple times if needed to cross-reference sources.',
    'Provide a comprehensive report with citations.',
    '',
    `Research topic: ${query}`,
  ].join('\n');

  return agySearch(researchPrompt, { timeout, searchHint: false });
}
export { agyResearch as geminiResearch };

/**
 * Fact-check a technical claim using grounded Google Search.
 * @param {string} claim - The claim to verify.
 * @param {object} [opts]
 * @param {number} [opts.timeout=180000]
 * @returns {Promise<{ok: boolean, output: string, error?: string, exitCode?: number, stats?: object}>}
 */
export async function agyFactCheck(claim, opts = {}) {
  const { timeout = 180_000 } = opts;

  const prompt = [
    'You are a technical fact-checker. Verify the following claim using Google Search.',
    'Search for authoritative sources (official docs, GitHub, RFCs, CVE databases).',
    '',
    'Structure your response as:',
    '## Verdict: [Confirmed / Partially True / Misleading / False / Unverifiable]',
    '## Evidence',
    '- List each piece of supporting or contradicting evidence with its source URL',
    '## Correct Information',
    '- If the claim is wrong or misleading, state the accurate information here',
    '',
    `Claim to verify: "${claim}"`,
  ].join('\n');

  return agySearch(prompt, { timeout, searchHint: false });
}
export { agyFactCheck as geminiFactCheck };

/**
 * Get latest changelog and release notes for a package.
 * @param {string} pkg - Package name, optionally with version (e.g., "react@19" or "express").
 * @param {object} [opts]
 * @param {number} [opts.timeout=180000]
 * @returns {Promise<{ok: boolean, output: string, error?: string, exitCode?: number, stats?: object}>}
 */
export async function agyChangelog(pkg, opts = {}) {
  const { timeout = 180_000 } = opts;

  const prompt = [
    `Search for the latest release notes and changelog for: ${pkg}`,
    '',
    'Search these sources in order of priority:',
    '1. Official GitHub releases page',
    '2. Package registry (npm, PyPI, crates.io, pkg.go.dev)',
    '3. Official documentation or blog announcements',
    '',
    'Structure your response as:',
    '## Latest Version',
    '- Version number and release date',
    '## Highlights',
    '- Key new features or improvements',
    '## Breaking Changes',
    '- Any breaking changes that require migration (or "None" if none)',
    '## Migration Notes',
    '- Steps needed to upgrade from the previous major version',
    '## Links',
    '- Direct URLs to the changelog and release notes',
  ].join('\n');

  return agySearch(prompt, { timeout, searchHint: false });
}
export { agyChangelog as geminiChangelog };

/**
 * Compare two technologies with real-time data.
 * @param {string} query - Comparison query (e.g., "Bun vs Deno").
 * @param {object} [opts]
 * @param {number} [opts.timeout=300000]
 * @returns {Promise<{ok: boolean, output: string, error?: string, exitCode?: number, stats?: object}>}
 */
export async function agyCompare(query, opts = {}) {
  const { timeout = 300_000 } = opts;

  const prompt = [
    `Compare the following technologies using current (2025-2026) data: ${query}`,
    '',
    'Search for recent benchmarks, adoption statistics, and community sentiment.',
    '',
    'Structure your response as:',
    '## Overview',
    '- Brief description of each technology',
    '## Comparison',
    '| Criteria | Option A | Option B |',
    '|----------|----------|----------|',
    '| Performance | ... | ... |',
    '| Ecosystem / Community | ... | ... |',
    '| Learning Curve | ... | ... |',
    '| Production Readiness | ... | ... |',
    '| Active Maintenance | ... | ... |',
    '## Concrete Metrics',
    '- GitHub stars, npm weekly downloads, benchmark numbers (cite sources)',
    '## When to Choose Each',
    '- Specific scenarios where each option excels',
    '## Recommendation',
    '- Context-dependent recommendation with reasoning',
  ].join('\n');

  return agySearch(prompt, { timeout, searchHint: false });
}
export { agyCompare as geminiCompare };

/**
 * Run a full health check on the Antigravity CLI (`agy`) installation.
 * Uses a real headless probe to verify auth (not just file existence).
 * @returns {{ installed: boolean, version: string|null, loggedIn: boolean }}
 */
export function healthCheck() {
  const installed = isGeminiInstalled();
  return {
    installed,
    version: installed ? getGeminiVersion() : null,
    loggedIn: installed ? isGeminiAuthValid() : false,
  };
}
