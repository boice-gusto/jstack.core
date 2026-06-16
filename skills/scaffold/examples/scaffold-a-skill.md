# Example: scaffolding a skill in an existing plugin

## User request

> Add a new skill called "composite-api-patterns" to the scaffold-plugin (example: any plugin name the user chooses).

## What the skill creates

### Directory structure

```
plugins/scaffold-plugin/skills/composite-api-patterns/
├── SKILL.md
├── references/
│   └── .gitkeep
└── examples/
    └── .gitkeep
```

### SKILL.md

```markdown
---
name: composite-api-patterns
description: "Patterns for Salesforce Composite API requests, subrequest ordering, rollbacks, and governor-limit-aware batching. Use when engineers ask about composite graphs, allOrNone, reference IDs in a single transaction, or reducing round trips from middleware."
argument-hint: "[composite API topic or question]"
allowed-tools: Read, Grep, Glob, WebFetch
---

# Composite API patterns

Guide for designing reliable Composite API usage from application services into Salesforce.

## Instructions

1. Read the reference docs in `references/` for request shapes and limits
2. Answer using those patterns; use WebFetch for Salesforce docs when limits or behaviors changed
3. Call out test coverage expectations (Apex, integration tests) when suggesting server-side changes

## References

Read the reference docs in `references/` for domain-specific data:

- (Add reference docs here)

## Examples

See `examples/` for worked scenarios:

- (Add worked examples here)
```

## Post-scaffold output

```
## Scaffold complete: skill "composite-api-patterns" in scaffold-plugin

Files created:
- plugins/scaffold-plugin/skills/composite-api-patterns/SKILL.md
- plugins/scaffold-plugin/skills/composite-api-patterns/references/.gitkeep
- plugins/scaffold-plugin/skills/composite-api-patterns/examples/.gitkeep

Next steps:
- [ ] Fill in the SKILL.md body with detailed instructions
- [ ] Add reference docs to references/
- [ ] Add at least one worked example to examples/
- [ ] Run `claude plugin validate .` from the repo root
- [ ] Test with `claude --plugin-dir ./plugins/scaffold-plugin`
```
