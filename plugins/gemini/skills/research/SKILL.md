---
description: Deep multi-step research using the Antigravity CLI's grounded Google Search.
argument-hint: '<topic>'
disable-model-invocation: true
allowed-tools: Bash AskUserQuestion
---
Perform a deep, multi-step research investigation using the Antigravity CLI (`agy`).

This is the **deep research** mode — slower but more thorough than `/gemini:search`.
Use this when you need comprehensive analysis with cross-referenced sources.

Raw slash-command arguments:
`$ARGUMENTS`

## Steps

1. If `$ARGUMENTS` is empty, use `AskUserQuestion` to ask what topic to research.

2. Run the companion script with a 10-minute timeout:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" research "$ARGUMENTS"
   ```

3. If the command fails:
   - Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" setup` to diagnose.
   - Suggest the user try `/gemini:search` for a faster but shallower lookup.

4. Return the output **verbatim**.

5. After the results, provide a **Research Summary**:
   - **Key Findings:** Top 3 discoveries
   - **Confidence Level:** High / Medium / Low (based on source agreement)
   - **Recommended Next Steps:** What the user should do with this information

## Constraints
- Do not paraphrase the search output.
- Do not fabricate citations — only cite what the search returned.
- This command has a longer timeout (10 min). Warn the user if it might take a moment.
