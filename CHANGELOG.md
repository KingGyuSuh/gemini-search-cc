# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-06-20

### Changed (BREAKING)

- **Engine migrated from Gemini CLI to the Antigravity CLI (`agy`).** Google
  sunset the Gemini CLI for individual users on 2026-06-18; the Antigravity CLI
  (`agy`) is its successor. All grounded search/research/audit/fact-check/changelog/
  compare commands now run on `agy`.
- **New prerequisite:** the `agy` binary must be installed and authenticated.
  Install via `curl -fsSL https://antigravity.google/cli/install.sh | bash` (or
  `brew install --cask antigravity-cli`), then run `agy` once to sign in (browser
  OAuth) or set `ANTIGRAVITY_API_KEY` / `GEMINI_API_KEY` for headless use. Existing
  Gemini CLI config can be imported with `agy plugin import gemini`.
- Health check (`/gemini:setup`) now probes `agy` instead of `gemini`.

### Added

- PTY workaround for the `agy` non-TTY stdout issue (antigravity-cli #76): the
  companion runs `agy` through the `script` utility on macOS/Linux so output is
  reliably captured from a subprocess.
- Plain-text output parsing with ANSI escape-code stripping (`agy` does not yet
  ship a stable `--output-format json`). A JSON path is retained for forward
  compatibility.
- Environment knobs: `AGY_BIN` (override binary), `AGY_NO_PTY=1` (disable the PTY
  wrapper), `AGY_OUTPUT_FORMAT` (opt into `--output-format`, e.g. `json`).
- `CHANGELOG.md` and a "Migrating from v1" guide in the README, plus "How It
  Works", "Configuration", and "Troubleshooting" sections.
- Subprocess-level regression tests that drive the engine against a fake `agy`
  binary (no auth/network needed), plus expanded parsing, rendering, and guard tests.

### Fixed

- **`agy` errors no longer surface as fake answers.** A non-zero `agy` exit is now
  detected before its stdout is promoted, so an error/usage dump (merged into
  stdout by the PTY wrapper) is reported as an error rather than a "successful"
  response.
- **Grounded answers that start with `{` or `[` are preserved.** Output is only
  treated as a structured JSON envelope when it is an object carrying a recognized
  field; otherwise the text is kept verbatim instead of being discarded.
- Backspace handling is surrogate-pair aware (no mojibake) and runs in a single
  linear pass; `stripAnsi` also strips 8-bit C1 escape sequences and control chars.
- The `script` banner is stripped language-independently (forced `LC_ALL=C`) and
  only when it is the real banner, so legitimate answer lines survive.
- The Auto-Search Guard hook fails open on empty/malformed stdin and matches
  package-manager keywords by whole token (no more substring false positives).
- `AGY_BIN` is shell-quoted on every code path; error reports are labeled by
  command mode and render a genuine exit code of `0`; the session-lifecycle hook
  degrades gracefully when it cannot write session env vars.

### Unchanged

- All slash commands keep the `/gemini:*` namespace; the plugin directory,
  manifest name, and script filenames are preserved for backward compatibility
  with existing installs.

## [1.0.0] - 2026

### Added

- Initial release: grounded Google Search, deep research, security audit,
  fact-check, changelog lookup, and technology comparison for Claude Code,
  powered by the Gemini CLI.
- Auto-Search Guard hook that suggests `/gemini:audit` on package installs.
- `gemini:researcher` subagent and session-lifecycle health checks.

[2.0.0]: https://github.com/KingGyuSuh/gemini-search-cc/releases/tag/v2.0.0
[1.0.0]: https://github.com/KingGyuSuh/gemini-search-cc/releases/tag/v1.0.0
