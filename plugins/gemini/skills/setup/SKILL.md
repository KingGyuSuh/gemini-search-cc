---
description: Check Antigravity CLI (agy) installation and authentication status.
argument-hint: ''
disable-model-invocation: true
allowed-tools: Bash AskUserQuestion
---
Check whether the Antigravity CLI (`agy`) is installed and properly configured.

> **Note:** This plugin migrated from the Gemini CLI (sunset for individual users
> on 2026-06-18) to its successor, the **Antigravity CLI** (`agy`). The slash
> commands are unchanged (`/gemini:*`), but the underlying engine is now `agy`.

## Steps

1. Run the health check in JSON mode:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" setup --json
   ```

2. Parse the JSON output to determine status:
   - `installed`: whether the `agy` binary exists on PATH
   - `version`: the installed version string (`agy --version`)
   - `loggedIn`: whether a minimal headless probe succeeds (verifies active auth, not just file existence)

3. **If the Antigravity CLI is NOT installed:**
   - Use `AskUserQuestion` to ask how to install:
     > Antigravity CLI (agy) is not installed. How would you like to install it?
     > - Official installer (Recommended)
     > - Homebrew (macOS)
     > - Show manual instructions
   - If **Official installer**: run
     ```bash
     curl -fsSL https://antigravity.google/cli/install.sh | bash
     ```
     (On Windows PowerShell: `irm https://antigravity.google/cli/install.ps1 | iex`)
   - If **Homebrew**: run `brew install --cask antigravity-cli`
   - If **manual**: point the user to https://antigravity.google/docs/cli-using
   - After install, re-run the health check to confirm.

4. **If the Antigravity CLI is installed but NOT logged in:**
   - Instruct the user to run `agy` once in their terminal to complete the
     browser sign-in (Google OAuth). Credentials are stored in the system keyring.
   - For headless / CI environments, they can instead set `ANTIGRAVITY_API_KEY`
     (or `GEMINI_API_KEY`) in their environment.
   - Existing Gemini CLI configuration (skills, plugins, MCP servers) can be
     imported with `agy plugin import gemini`.
   - Explain: authentication is required for Google Search grounding to work.

5. **If everything is healthy**, confirm all available skills:
   - `/gemini:search` — Quick grounded Google Search
   - `/gemini:research` — Deep multi-step research (10 min timeout)
   - `/gemini:audit` — Security & dependency audit
   - `/gemini:fact-check` — Verify technical claims
   - `/gemini:changelog` — Latest release notes for a package
   - `/gemini:compare` — Compare technologies with real-time data

6. Run the human-readable health check for display:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" setup
   ```

## Troubleshooting

- **"agy produced no output"** — agy can drop stdout when run as a subprocess
  (antigravity-cli issue #76). This plugin works around it by allocating a PTY via
  the `script` utility on macOS/Linux. Ensure `script` is installed (it ships with
  macOS and most Linux distros via util-linux/bsdutils). Windows is not officially
  supported; use WSL.
- The PTY workaround can be disabled with `AGY_NO_PTY=1` (e.g. once agy fixes the
  non-TTY behavior). The binary can be overridden with `AGY_BIN`.
