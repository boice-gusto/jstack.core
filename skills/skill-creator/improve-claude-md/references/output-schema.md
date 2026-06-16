# `--output=json` Schema

`$id: https://jstack.dev/schema/claude-md-improver-output.json`

```jsonc
{
  "$schema": "https://jstack.dev/schema/claude-md-improver-output.json",
  "meta": {
    "project_root": "string (absolute path)",
    "generated_at": "ISO 8601 string",
    "notes": "string[]"
  },
  "issues": "ScoredIssue[]"  // see cli/src/lib/claude-md-improver.ts type ScoredIssue
}
```

After the SKILL.md runs stage 3 (LLM proposes edits) and stage 4 (persona review), the final shape adds `recommendations: ProposedEdit[]` and `filtered_out: ProposedEdit[]` keys for use by the routine in PR-4.
