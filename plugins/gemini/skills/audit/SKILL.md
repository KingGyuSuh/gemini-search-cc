---
description: Security & dependency audit using the Antigravity CLI's grounded Google Search.
argument-hint: '<package or technology>'
disable-model-invocation: true
allowed-tools: Bash AskUserQuestion Glob Read
---
Perform a security and dependency audit using the Antigravity CLI's grounded Google Search.

Use this to check packages, libraries, or technologies for vulnerabilities,
deprecations, and compatibility issues before adopting or upgrading them.

Raw slash-command arguments:
`$ARGUMENTS`

## Steps

1. If `$ARGUMENTS` is empty, use `AskUserQuestion` to ask what to audit.

2. **Gather context** (optional but recommended):
   - Use `Glob` and `Read` to check for `package.json`, `requirements.txt`, `Cargo.toml`,
     `go.mod`, or similar dependency manifests in the workspace.
   - If found, extract the relevant package version to enrich the audit query.

3. Run the companion script:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" audit "$ARGUMENTS"
   ```

4. If the command fails:
   - Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" setup` to diagnose.
   - Show the diagnosis to the user.

5. Return the output **verbatim**.

6. After the results, provide a **Audit Verdict**:
   - **Risk Level:** Critical / High / Medium / Low / Clear
   - **Action Required:** Yes / No
   - **Summary:** One-sentence recommendation (proceed, update, replace, or avoid)

## Constraints
- Do not paraphrase the search output.
- Always err on the side of caution — if uncertain, recommend the user investigate further.
- Do not auto-fix or auto-update any dependencies. Only advise.
