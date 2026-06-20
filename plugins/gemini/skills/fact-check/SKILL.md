---
description: Fact-check a technical claim using the Antigravity CLI's grounded Google Search.
argument-hint: '<claim to verify>'
disable-model-invocation: true
allowed-tools: Bash AskUserQuestion
---
Verify a technical claim, assumption, or statement using the Antigravity CLI's real-time grounded Google Search.

Use this when you encounter claims in code comments, documentation, Stack Overflow answers,
or conversation that need verification against current, authoritative sources.

Raw slash-command arguments:
`$ARGUMENTS`

## Steps

1. If `$ARGUMENTS` is empty, use `AskUserQuestion` to ask what claim to verify.

2. Run the companion script:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" factcheck "$ARGUMENTS"
   ```

3. If the command fails with a non-zero exit code:
   - Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" setup` to diagnose.
   - Show the diagnosis to the user and stop.

4. Return the command output **verbatim** to the user.

5. After the results, provide a **Fact-Check Verdict**:
   - **Verdict:** Confirmed / Partially True / Misleading / False / Unverifiable
   - **Confidence:** High / Medium / Low (based on source agreement)
   - **Key Correction:** If the claim was wrong, state the correct information with source

## Constraints
- Do not paraphrase the search output.
- Do not speculate beyond what the search results show.
- If sources disagree, present both sides and note the disagreement.
- Always cite the sources that support or refute the claim.
- If the claim cannot be verified through search, say so explicitly — do not guess.
- Distinguish between "no evidence found" and "evidence contradicts the claim."
