# Contributing to Gemini Search for Claude Code

First off, thank you for considering contributing to Gemini Search for Claude Code! It's people like you that make open source such a great community.

## Development Environment Setup

1. **Prerequisites:**
   - Node.js (18, 20, or 22)
   - npm or yarn
   - [Antigravity CLI (agy)](https://antigravity.google/docs/cli-using) installed and authenticated.

2. **Clone the repository:**
   ```bash
   git clone https://github.com/KingGyuSuh/gemini-search-cc.git
   cd gemini-search-cc
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Testing locally:**
   - Run the offline suite (lint + unit tests, no `agy`/auth required):
     ```bash
     npm test
     ```
   - Exercise the real plugin in Claude Code by pointing it at your working copy:
     ```bash
     claude --plugin-dir /path/to/gemini-search-cc/plugins/gemini
     ```

## Project Layout

The plugin lives under `plugins/gemini/`. Key entry points:

- `scripts/lib/gemini.mjs` — the `agy` detection + execution engine. **Every**
  Antigravity CLI invocation funnels through `agySearch()`.
- `scripts/gemini-companion.mjs` — CLI router that maps each subcommand to a
  query function.
- `scripts/lib/render.mjs` — Markdown report / error / health-check formatting.
- `skills/<name>/SKILL.md` — one slash command each; `hooks/` — the Auto-Search
  Guard and session-lifecycle hooks.

See [`CLAUDE.md`](CLAUDE.md) for the full architecture and the step-by-step recipe
for adding a new skill.

## Pull Request Process

1. Keep changes focused; describe the motivation in the PR description.
2. Update the README/docs if you change a user-facing command, flag, or behavior.
3. Add or update unit tests for your change — they must run **without** `agy` or
   network access (use a fake binary, as in `tests/exec.test.mjs`).
4. Ensure `npm test` (lint + unit tests) passes locally before opening the PR.
5. CI runs lint + unit tests on Node 18, 20, and 22; keep it green.
6. A maintainer will review; once approved, your PR is merged.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).
