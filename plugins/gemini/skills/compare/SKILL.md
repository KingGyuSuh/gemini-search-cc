---
description: Compare two technologies with real-time benchmarks and community data.
argument-hint: '<tech-a> vs <tech-b>'
disable-model-invocation: true
allowed-tools: Bash AskUserQuestion
---
Compare two technologies, frameworks, libraries, or tools using the Antigravity CLI's real-time
grounded Google Search to provide current benchmarks, community sentiment, and recommendations.

Raw slash-command arguments:
`$ARGUMENTS`

## Steps

1. If `$ARGUMENTS` is empty or does not contain two items to compare,
   use `AskUserQuestion` to ask what technologies to compare.

2. Run the companion script:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" compare "$ARGUMENTS"
   ```

3. If the command fails:
   - Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" setup` to diagnose.
   - Suggest the user try `/gemini:search` for a broader lookup.

4. Return the output **verbatim**.

5. After the results, provide a **Comparison Verdict**:
   - **Winner (for this use case):** Technology A / Technology B / Depends on context
   - **Key Differentiator:** The single most important distinction
   - **Recommendation:** One sentence tailored to the user's current project context

## Constraints
- Do not paraphrase the search output.
- Present both options fairly — do not show bias toward either technology.
- Focus on current data (2025-2026), not historical reputation.
- Include concrete metrics where available (bundle size, benchmark numbers, GitHub stars, npm downloads).
- Acknowledge when the comparison is context-dependent and no universal winner exists.
- Do not recommend based on personal preference — only on evidence from search results.
