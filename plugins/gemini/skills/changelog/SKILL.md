---
description: Get latest changelog, release notes, and breaking changes for a package.
argument-hint: '<package[@version]>'
disable-model-invocation: true
allowed-tools: Bash AskUserQuestion Glob Read
---
Fetch the latest release notes, changelog, and breaking changes for a specific package
or technology using the Antigravity CLI's grounded Google Search.

Use this before upgrading dependencies, adopting new versions, or investigating
what changed between releases.

Raw slash-command arguments:
`$ARGUMENTS`

## Steps

1. If `$ARGUMENTS` is empty, use `AskUserQuestion` to ask which package to check.

2. **Gather local context** (optional but recommended):
   - Use `Glob` and `Read` to check dependency manifests (`package.json`, `requirements.txt`,
     `Cargo.toml`, `go.mod`, etc.) for the current installed version of the package.
   - If found, include the current version in the query for more targeted results.

3. Run the companion script:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" changelog "$ARGUMENTS"
   ```

4. If the command fails:
   - Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" setup` to diagnose.
   - Show the diagnosis to the user.

5. Return the output **verbatim**.

6. After the results, provide a **Changelog Summary**:
   - **Latest Version:** version number and release date
   - **Breaking Changes:** list any breaking changes (if upgrading)
   - **Migration Required:** Yes / No — with brief description if yes
   - **Recommendation:** Safe to upgrade / Review changes first / Wait for patch

## Constraints
- Do not paraphrase the search output.
- Be precise about version numbers — say "v4.2.1" not "a recent version."
- If the search returns changelogs for a different version than requested, note the discrepancy.
- Do not auto-update any dependencies. Only advise.
- Prefer official sources (GitHub releases, npm, PyPI) over third-party summaries.
