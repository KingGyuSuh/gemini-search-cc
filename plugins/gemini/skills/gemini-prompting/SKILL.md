---
description: Internal guidance for composing effective grounded search queries.
user-invocable: false
---
# Gemini Prompting Guide — Internal Skill

This skill helps you compose effective queries when using the Antigravity CLI's grounded
Google Search via any of the Gemini skills (`search`, `research`, `audit`, `fact-check`, `changelog`, `compare`).

## Query Composition Principles

### Be Specific
Bad: `"React updates"`
Good: `"React 19 breaking changes migration from React 18 2026"`

### Include Year Context
The Antigravity CLI's grounded search benefits from temporal markers.
Bad: `"best Node.js framework"`
Good: `"best Node.js framework 2026 comparison performance"`

### Use Technical Precision
Bad: `"Python package problem"`
Good: `"requests library Python CVE vulnerability 2026"`

### One Topic Per Query
Bad: `"React 19 changes and Next.js 15 and TypeScript 6 updates"`
Good: Run three separate searches, one per topic.

## Query Templates

### Version Check
```
"<package> latest stable version release date changelog"
```

### Security Audit
```
"<package> <version> CVE security vulnerability advisory 2026"
```

### Migration Guide
```
"<package> migration guide from <old_version> to <new_version> breaking changes"
```

### Comparison
```
"<tech_a> vs <tech_b> comparison benchmark performance 2026"
```

### Best Practices
```
"<technology> best practices production deployment 2026"
```

### Deprecation Check
```
"<technology> deprecated alternatives replacement 2026"
```

### Fact-Check
```
"<specific claim> site:github.com OR site:docs.* OR site:stackoverflow.com"
```

### Changelog
```
"<package> release notes changelog latest version breaking changes"
```

### Head-to-Head Comparison
```
"<tech_a> vs <tech_b> benchmark performance comparison 2025 2026"
```

## Skill Selection Guide

| User Need | Best Skill | Why |
|-----------|------------|-----|
| "Is X true?" | `/gemini:fact-check` | Structured verdict with evidence |
| "What changed in X?" | `/gemini:changelog` | Focused on release notes and migration |
| "X vs Y?" | `/gemini:compare` | Structured comparison with metrics |
| "Is X safe to use?" | `/gemini:audit` | CVE and deprecation focused |
| General question | `/gemini:search` | Broad, fast grounded search |
| Complex investigation | `/gemini:research` | Multi-step, cross-referenced (slow) |

## Anti-Patterns

- Do not include conversational filler: "Can you please search for..."
- Do not ask the search engine to generate code — it's optimized for search, not codegen
- Do not combine unrelated queries — run them separately
- Do not repeat failed queries verbatim — rephrase with different keywords
