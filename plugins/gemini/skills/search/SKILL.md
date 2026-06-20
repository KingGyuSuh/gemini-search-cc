---
description: Perform a grounded Google Web Search using the Antigravity CLI (agy).
argument-hint: '<query>'
disable-model-invocation: true
allowed-tools: Bash AskUserQuestion
---
Perform a grounded Google Web Search using the Antigravity CLI (`agy`).

Raw slash-command arguments:
`$ARGUMENTS`

## Steps

1. If `$ARGUMENTS` is empty, use `AskUserQuestion` to ask the user what they want to search for.

2. Run the companion script:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" search "$ARGUMENTS"
   ```

3. If the command fails with a non-zero exit code:
   - Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" setup` to diagnose.
   - Show the diagnosis to the user and stop.

4. Return the command output **verbatim** to the user.

5. After providing results, briefly highlight at most 3 items:
   - **Version Check:** Current version vs. latest found in search
   - **Risk Alert:** Security or deprecation risks mentioned
   - **Modern Alternatives:** If any newer approaches were found

## Constraints
- Do not paraphrase or add commentary before the results.
- Do not wrap the output in additional markdown formatting — it is already formatted.
- Treat the returned results as authoritative context for subsequent conversation.
