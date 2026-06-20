# Gemini Search for Claude Code (gemini-search-cc)

[![CI](https://github.com/KingGyuSuh/gemini-search-cc/actions/workflows/ci.yml/badge.svg)](https://github.com/KingGyuSuh/gemini-search-cc/actions) [![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Bring **grounded Google Search** directly into [Claude Code](https://code.claude.com/docs). This plugin turns Claude Code into a search-augmented coding assistant — bridging Claude's knowledge cutoff with real-time, cited web information.

> ### ⚠️ v2.0 — now powered by the Antigravity CLI (`agy`)
> Google [sunset the Gemini CLI for individual users on 2026-06-18](https://antigravity.google/docs/gcli-migration) and replaced it with the **Antigravity CLI** (`agy`). This plugin's **v2.0.0 migrates the underlying engine from Gemini CLI to `agy`**. The slash commands are **unchanged** (`/gemini:*`) — only the engine changed. See [Migrating from v1](#migrating-from-v1-gemini-cli) and the [CHANGELOG](CHANGELOG.md).

---

## Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Migrating from v1 (Gemini CLI)](#migrating-from-v1-gemini-cli)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Skills (Slash Commands)

| Command | Description |
|---------|-------------|
| `/gemini:search <query>` | Quick grounded Google Search with citations |
| `/gemini:research <topic>` | Deep multi-step research with cross-referenced sources |
| `/gemini:audit <package>` | Security & dependency audit (CVEs, deprecations, breaking changes) |
| `/gemini:fact-check <claim>` | Verify technical claims against real-time sources |
| `/gemini:changelog <package>` | Latest release notes, breaking changes, migration guides |
| `/gemini:compare <a> vs <b>` | Head-to-head technology comparison with live data |
| `/gemini:setup` | Check Antigravity CLI (`agy`) installation and auth status |

### Subagent

- **`gemini:researcher`** — A dedicated research agent that performs iterative searches, synthesizes findings into structured Grounding Reports, and provides strategic advice (Proceed / Update / Pivot / Investigate).

### Auto-Search Guard (Hooks)

Automatically intercepts package manager commands (`npm install`, `pip install`, `cargo add`, etc.) and suggests running a `/gemini:audit` before proceeding.

### Session Lifecycle

The plugin checks Antigravity CLI (`agy`) availability at session start. Run `/gemini:setup` to verify authentication.

---

## How It Works

```
/gemini:search ──▶ SKILL.md ──▶ gemini-companion.mjs ──▶ lib/gemini.mjs ──▶ agy
                                       │                        │             │
                                  (routes the                (spawns agy    (grounded
                                   subcommand)              via a PTY)     Google Search)
                                       │                        │
                                       ▼                        ▼
                                  render.mjs ◀───── parse + clean (ANSI/banner strip)
                                       │
                                       ▼
                              Markdown report back to Claude
```

Three `agy` quirks shape the engine (`plugins/gemini/scripts/lib/gemini.mjs`):

1. **Non-TTY stdout drop** ([antigravity-cli #76](https://github.com/google-antigravity/antigravity-cli/issues/76)) — `agy -p` writes **zero bytes** when run from a pipe/subprocess. The companion allocates a pseudo-TTY via the Unix **`script`** utility so output is captured reliably.
2. **Synchronous spawn required** — under async `child_process`, BSD `script` (macOS) aborts with `tcgetattr: Operation not supported on socket`. Every `agy` call goes through `spawnSync`; only **stdout** is ever promoted to a response, never stderr/diagnostics.
3. **No stable structured output** — `--output-format json` isn't a defined flag yet, so output is parsed as **plain text** with ANSI/`script`-banner stripping. A JSON path is retained for forward-compatibility (opt in via `AGY_OUTPUT_FORMAT`).

See [Configuration](#configuration) for the environment knobs that tune this behavior.

---

## Repository Structure

```
gemini-search-cc/
├── .claude-plugin/
│   └── marketplace.json             # Marketplace definition
├── plugins/
│   └── gemini/                      # Plugin root
│       ├── .claude-plugin/
│       │   └── plugin.json          # Plugin manifest
│       ├── skills/
│       │   ├── search/SKILL.md
│       │   ├── research/SKILL.md
│       │   ├── audit/SKILL.md
│       │   ├── fact-check/SKILL.md
│       │   ├── changelog/SKILL.md
│       │   ├── compare/SKILL.md
│       │   ├── setup/SKILL.md
│       │   ├── search-result-handling/SKILL.md
│       │   └── gemini-prompting/SKILL.md
│       ├── agents/
│       │   └── researcher.md
│       ├── hooks/
│       │   ├── hooks.json
│       │   └── guard-filter.mjs
│       ├── scripts/
│       │   ├── gemini-companion.mjs
│       │   ├── session-lifecycle-hook.mjs
│       │   └── lib/
│       │       ├── gemini.mjs        # agy detection + execution engine
│       │       ├── render.mjs
│       │       └── workspace.mjs
│       └── settings.json
├── tests/
│   ├── parse.test.mjs               # output parsing/cleaning (ANSI, backspace, banner)
│   ├── render.test.mjs              # Markdown report + error rendering
│   ├── guard.test.mjs               # Auto-Search Guard hook
│   ├── companion.test.mjs           # subcommand routing + setup health check
│   └── exec.test.mjs                # agy execution path (fake-binary, no auth)
├── package.json
├── CHANGELOG.md
├── LICENSE
└── NOTICE
```

> **Note:** the plugin directory, namespace (`/gemini:*`), and internal script
> filenames keep the `gemini` name for backward compatibility with existing
> installs. The engine underneath is the Antigravity CLI (`agy`).

## Prerequisites

> **Platform**: macOS and Linux. Windows is not officially supported — the plugin
> works around an `agy` non-TTY output issue using the Unix `script` utility,
> which Windows lacks. Use WSL on Windows.

1. **Claude Code** — The `claude` CLI ([docs](https://code.claude.com/docs))
2. **Antigravity CLI (`agy`)** — Must be installed and authenticated ([docs](https://antigravity.google/docs/cli-using))
3. **Node.js** >= 18.0.0
4. The **`script`** utility (ships with macOS and most Linux distros via util-linux / bsdutils)

```bash
# Install the Antigravity CLI (macOS / Linux)
curl -fsSL https://antigravity.google/cli/install.sh | bash
# or, on macOS via Homebrew:
brew install --cask antigravity-cli

# Authenticate: run agy once to complete the browser sign-in (Google OAuth)
agy

# (Optional) import your old Gemini CLI config — skills, plugins, MCP servers
agy plugin import gemini
```

For headless / CI use, set `ANTIGRAVITY_API_KEY` (or `GEMINI_API_KEY`) instead of the interactive sign-in.

## Installation

### Via Marketplace (recommended)

1. Start Claude Code:
   ```bash
   claude
   ```

2. Inside the Claude Code session, run:
   ```
   /plugin marketplace add KingGyuSuh/gemini-search-cc
   /plugin install gemini@gemini-search
   ```

### Via --plugin-dir (development)

```bash
claude --plugin-dir ./plugins/gemini
```

## Usage

### Quick Search
```
/gemini:search "What are the latest breaking changes in React 19?"
```

### Deep Research
```
/gemini:research "Compare Bun vs Deno vs Node.js performance benchmarks 2026"
```

### Fact-Check
```
/gemini:fact-check "React 19 removed forwardRef"
```

### Changelog
```
/gemini:changelog "next@15"
```

### Compare
```
/gemini:compare "Bun vs Deno"
```

### Security Audit
```
/gemini:audit "lodash 4.17.21"
```

### Setup Check
```
/gemini:setup
```

The **Auto-Search Guard** activates automatically when you run package install commands:
```
> npm install some-package
# [Gemini JavaScript/TypeScript Guard] suggests running /gemini:audit first
```

---

## Migrating from v1 (Gemini CLI)

v2.0.0 is a **breaking change**: the engine moved from the (now sunset) Gemini CLI
to the Antigravity CLI (`agy`).

| | v1.x (Gemini CLI) | v2.0.0 (Antigravity CLI) |
|---|---|---|
| Binary | `gemini` | `agy` |
| Install | `npm install -g @google/gemini-cli` | `curl -fsSL https://antigravity.google/cli/install.sh \| bash` |
| Auth | `gemini login` | run `agy` once (browser OAuth) or set `ANTIGRAVITY_API_KEY` |
| Slash commands | `/gemini:*` | `/gemini:*` (**unchanged**) |

**What you need to do:** install `agy` and authenticate (see [Prerequisites](#prerequisites)).
Your existing Gemini CLI configuration can be imported with `agy plugin import gemini`.
No changes to how you invoke the plugin.

---

## Configuration

The plugin works out of the box, but a few environment variables let you adapt it
to `agy`'s fast-moving releases or to CI:

| Variable | Default | Purpose |
|---|---|---|
| `AGY_BIN` | `agy` | Path/name of the Antigravity CLI binary. |
| `AGY_NO_PTY` | _(unset)_ | Set to `1` to disable the `script` PTY workaround (e.g. once `agy` fixes the non-TTY stdout drop). |
| `AGY_OUTPUT_FORMAT` | _(unset)_ | Pass `--output-format <value>` to `agy` (e.g. `json`) once it ships stable structured output. |
| `ANTIGRAVITY_API_KEY` / `GEMINI_API_KEY` | _(unset)_ | Headless/CI auth instead of the interactive browser sign-in. |

---

## Troubleshooting

Run `/gemini:setup` first — it reports whether `agy` is installed, its version, and
whether you are signed in.

| Symptom | Likely cause | Fix |
|---|---|---|
| `Could not run "agy"` | binary not on `PATH` | Install `agy` (see [Prerequisites](#prerequisites)) or set `AGY_BIN` to its full path. |
| `agy produced no output` | not authenticated / quota hit, or the PTY workaround was bypassed | Run `agy` once to sign in (or set `ANTIGRAVITY_API_KEY`). If you set `AGY_NO_PTY=1`, unset it. |
| `script` PTY wrapper failed to launch agy | the `script` utility is missing | Install `util-linux` / `bsdutils`, or set `AGY_NO_PTY=1` to spawn `agy` directly. |
| Works in a terminal but not in CI | the non-TTY stdout drop ([#76](https://github.com/google-antigravity/antigravity-cli/issues/76)) | The `script` workaround handles this on macOS/Linux; on Windows use WSL. |

---

## Development

```bash
# Lint all scripts (node --check)
npm run lint

# Run unit tests — fast, no agy/auth required (fake-binary subprocess tests)
npm test

# Run integration tests — requires an authenticated Antigravity CLI
npm run test:integration
```

The unit suite (`tests/`) runs entirely offline: parsing/cleaning, rendering, the
guard hook, subcommand routing, and the `agy` execution path (driven against a
fake binary). All engine calls funnel through `agySearch()` in
`plugins/gemini/scripts/lib/gemini.mjs`.

**Adding a skill:** create `plugins/gemini/skills/<name>/SKILL.md`, add a query
function in `lib/gemini.mjs`, register the subcommand in `gemini-companion.mjs`,
and add the mode label in `render.mjs`. See [`CLAUDE.md`](CLAUDE.md) for the full
architecture and conventions.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for the
development setup, testing expectations, and pull-request process, and abide by
the [Code of Conduct](CODE_OF_CONDUCT.md). Then open a Pull Request.

## License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.

## Notice

This is an unofficial plugin and is not affiliated with Anthropic or Google. It requires the Antigravity CLI (`agy`) to be configured on your machine.
