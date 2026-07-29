"""Deep domain content for plugin-maintenance skills.

`plugin` has no `CATEGORY_DEEP` category entry, so this module supplies the per-key
content directly. See `scripts/skill_deep/__init__.py` for the merge mechanism.
"""
from __future__ import annotations

DEEP: dict[str, str] = {
    "plugin/create-plugin-pr": """## Domain rules — plugin PR

A plugin PR changes what every future session loads, so a defect here is not one bad run —
it is every run until someone notices. Review accordingly.

1. **One concern per PR.** A PR that touches a skill body, a config default, and a CI gate
   cannot be reverted cleanly when one of the three turns out to be wrong. Split it.
2. **Name the verification command in the PR body.** Not "tested locally" — the exact command a
   reviewer runs, and what a pass looks like. If the change is not verifiable by a command, say
   why and what was checked by hand.
3. **Never hand-edit a generated skill body.** `scripts/apply_detailed_skills.py` rewrites every
   `skills/**/SKILL.md` not in its `SKIP` set. A hand edit to a generated body is lost on the next
   regeneration, and the PR will look correct while the change silently disappears. Change the
   generator data, or add the skill to `SKIP` and take ownership of it.
4. **Regenerate derived artifacts in the same PR.** `skill-catalog.json`, `skills-data.js`, and the
   docs `index.html` are generated. A PR that adds a skill without regenerating them leaves the
   catalog disagreeing with the tree.
5. **A new skill ships with eval cases.** Coverage is gated; a skill with no evals cannot be shown
   to still work. Scaffolded cases that assert nothing (non-empty output, a word that would appear
   anyway) satisfy the count and prove nothing — they are a defect, not coverage.
6. **State the blast radius.** Which skills, agents, or gates does this touch? A reviewer cannot
   assess risk from a diff alone when the change is to shared generator data.
7. **Do not push to a default branch, and do not commit unless asked.** PRs only.

### Gate criteria before requesting review

| Criterion | Gate |
|-----------|------|
| Full gate run | `bun run check` exits 0 on the branch, not just the changed subset |
| Frontmatter round-trip | Any new frontmatter key uses an inline scalar — a YAML block list is silently dropped by the generator's line-based parser |
| Chain references | Every `jstack:<slug>` token resolves; `bun run validate-chains` passes |
| Generated artifacts | Regenerated and included, so the catalog matches the tree |
| Scope | One concern; unrelated cleanups moved to their own PR |
| Reviewer effort | Diff readable in one sitting; if it is not, split it rather than asking for a heroic review |

### Anti-patterns

| Anti-pattern | Why it's wrong | Instead |
|---|---|---|
| Hand-editing a generated skill body | The change vanishes on the next regeneration while the PR looks correct | Edit the generator data, or add the skill to `SKIP` |
| Bundling unrelated changes | Cannot revert one without reverting the others | One concern per PR |
| "Tested locally" with no command | A reviewer cannot reproduce it, so it is an assertion, not evidence | State the command and the expected result |
| Adding a skill without evals | Fails the coverage gate, and nothing proves the skill works | Author real cases that would fail if the skill regressed |
| Scaffolded evals left as-is | Green check, zero information | Replace with assertions tied to this skill's actual behavior |
| Omitting regenerated artifacts | Catalog and docs disagree with the tree | Regenerate in the same PR |
| Editing `config/schema.json` expecting enforcement | No code loads it; it is documentation | Change the Zod schema in `cli/src/types/config.ts` for enforcement |
| Silent behavior change to a shared template | Affects every generated skill at once | Call it out explicitly and state the count affected |

### Worked example

**Weak PR description**

> Improved the review skills and fixed some config stuff. Tested locally.

Unreviewable: which skills, what changed in config, what "improved" means, and no way to verify.

**Sharp PR description**

> Adds a `skill_deep` entry for `review/code-review` (thresholds + anti-patterns + worked example)
> and nothing else. Generated bodies regenerated, so `skills/review/code-review/SKILL.md` is in the
> diff as generator output, not a hand edit.
>
> Blast radius: one skill body. No config, no gates, no shared template.
>
> Verify: `python3 scripts/apply_detailed_skills.py && bun run check` (exits 0), then
> `bun scripts/skills-depth-check.ts` shows `review/code-review` with no findings.

### Out of scope

Merging, pushing to a default branch, or committing without being asked. Authoring the domain
content itself — this skill prepares the change for review; the content belongs to the skill or
agent being changed. Never widen a PR's scope to include an unrelated fix noticed along the way;
file it separately.
""",
}
