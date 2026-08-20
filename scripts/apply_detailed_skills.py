#!/usr/bin/env python3
"""
Regenerate jstack **/SKILL.md bodies with longform operational detail.
Skips hand-maintained skills: advice, adr, recon, skill-creator, skill-creator/improve-claude-md, computer-use/cua, workflow-builder, knowledge/search, shortcuts/ceo-brainstorm, shortcuts/executive-research-brief, writing/humanizer.

Run (pick one):
- From the **repository root** (jstack/):  python3 scripts/apply_detailed_skills.py
- From **this directory** (jstack/scripts/): python3 apply_detailed_skills.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / "skills"
SKIP = {
    SKILLS / "crew" / "SKILL.md",  # hand-maintained operator skill
    SKILLS / "advice" / "SKILL.md",
    SKILLS / "adr" / "SKILL.md",
    SKILLS / "recon" / "SKILL.md",
    SKILLS / "skill-creator" / "SKILL.md",
    SKILLS / "skill-creator" / "improve-claude-md" / "SKILL.md",
    SKILLS / "computer-use" / "cua" / "SKILL.md",
    SKILLS / "workflow-builder" / "SKILL.md",
    SKILLS / "knowledge" / "search" / "SKILL.md",
    SKILLS / "setup" / "onboarding" / "SKILL.md",
    SKILLS / "setup" / "crew-onboarding" / "SKILL.md",  # drafts a crew agents add command
    SKILLS / "shortcuts" / "ceo-brainstorm" / "SKILL.md",
    SKILLS / "shortcuts" / "executive-research-brief" / "SKILL.md",
    SKILLS / "notion" / "setup" / "SKILL.md",
    SKILLS / "notion" / "one-on-one" / "SKILL.md",
    SKILLS / "meetings" / "one-on-one-transcript" / "SKILL.md",
    SKILLS / "meetings" / "transcripts-ingest" / "SKILL.md",
    # Hand-authored Step 3 (2026-08) after these 19 were found sharing a content-free
    # generator-fallback paragraph with no per-skill substance. Regenerating would silently
    # overwrite that fix, so they're pinned here until the generator has real data for them.
    SKILLS / "design" / "visual-single-page-html" / "SKILL.md",
    SKILLS / "design" / "figma-handoff" / "SKILL.md",
    SKILLS / "granola-daily-summary" / "SKILL.md",
    SKILLS / "plugin" / "create-plugin-pr" / "SKILL.md",
    SKILLS / "routines" / "morning-kickoff" / "SKILL.md",
    SKILLS / "knowledge" / "skill-finder" / "SKILL.md",
    SKILLS / "knowledge" / "ingest-all" / "SKILL.md",
    SKILLS / "self" / "impact-prep" / "SKILL.md",
    SKILLS / "self" / "brag" / "SKILL.md",
    # Needs a real AskUserQuestion wizard (venue/relationship/intent) and real domain rules
    # (evidence-based impact flags, distinct-variant requirement) — not generic scaffold.
    SKILLS / "self" / "draft-messages" / "SKILL.md",
    # Hand-authored (2026-08): needs real per-rule content (length ceiling, caveat-preservation
    # judgment call, standing "stay concise" rule across follow-ups) — no generic generator
    # template covers this; pinned to avoid a content-free overwrite.
    SKILLS / "self" / "tldr" / "SKILL.md",
    SKILLS / "review" / "code-review" / "SKILL.md",
    # Hand-authored (2026-08): six-lens parallel-dispatch orchestrator (security, compliance,
    # performance, code quality, QA, AI-slop) with a bespoke lens-routing table, an AI-slop
    # checklist, and a worked example — no generic generator template has per-key data for any
    # of this. Regenerating would silently overwrite it with the generic review-category fallback.
    SKILLS / "review" / "thermonuclear-review" / "SKILL.md",
    SKILLS / "incident" / "oncall-summary" / "SKILL.md",
    SKILLS / "incident" / "find-sme" / "SKILL.md",
    SKILLS / "scaffold" / "SKILL.md",
    SKILLS / "sprint" / "prep" / "SKILL.md",
    SKILLS / "sprint" / "refinement" / "SKILL.md",
    SKILLS / "engineering" / "health" / "SKILL.md",
    SKILLS / "engineering" / "silo-scan" / "SKILL.md",
    # Discovered during the 2026-08 skill-value audit follow-through: these 4 have hand-tuned,
    # skill-specific Domain rules / Step 2 / Step 4 text (e.g. jira/get correctly says read-only, no
    # confirmation gate; jira/intake and jira/notify correctly say they hand off rather than write)
    # that the generator has no per-key SAFE_PATH/VALIDATION/domain-rules data for — it falls back to
    # the generic `jira` category text, which is write/create-oriented and wrong for these three.
    # Pinned here to stop that silent downgrade until someone adds the matching per-key generator
    # data (mirroring the fix already made for `meetings/store-note`) and can safely unpin them.
    SKILLS / "jira" / "SKILL.md",
    SKILLS / "jira" / "get" / "SKILL.md",
    SKILLS / "jira" / "intake" / "SKILL.md",
    SKILLS / "jira" / "notify" / "SKILL.md",
    # Hand-authored (2026-08): a real, opinionated banned-pattern list (punctuation, structure
    # tells, filler words, empty transitions, hollow closers) with a worked weak-vs-sharp example.
    # The generator has no per-key data for this and would flatten it to generic "be clear" prose.
    SKILLS / "writing" / "humanizer" / "SKILL.md",
    # Hand-authored (2026-08): new `hygiene` category. Two-phase audit/fix design (forked
    # read-only Phase 1, main-session confirmation-gated Phase 2), a hand-tuned mechanical-gate
    # checklist naming this repo's actual `bun run` commands, and a worked weak-vs-sharp finding.
    # The generator has no per-key data for this category and would flatten it to generic prose.
    SKILLS / "hygiene" / "claude-code-hygiene" / "SKILL.md",
    # Hand-authored (2026-08): new `pe` sibling skill. Config-driven team/group scope, a
    # documented `PeSchema` gap (no group-level field yet), delegation-not-reimplementation of
    # recon's source routing, and a hand-tuned exec-summary-first HTML digest procedure. The
    # generator has no per-key data for any of this and would flatten it to generic write-skill
    # boilerplate.
    SKILLS / "pe" / "pe-recon" / "SKILL.md",
    # Hand-authored (2026-08): `pe` router updated with a real two-child disambiguation rule
    # (report-context vs pe-recon) now that it has a second real destination. The generator has
    # no per-key data for this routing distinction and would regenerate the old single-child text.
    SKILLS / "pe" / "SKILL.md",
    # Hand-authored (2026-08): new `review` siblings that shell out to the external `codex` CLI.
    # Real, tested command syntax (`codex exec` / `codex exec resume` / `codex exec fork` vs. the
    # interactive-only top-level `codex resume`/`fork`), a documented CLI limitation (resume can't
    # override --sandbox), and a scoped correction that `codex apply` targets Codex Cloud tasks
    # only. The generator has no per-key data for any of this and would flatten it to generic
    # write-skill boilerplate, silently erasing the safety discipline (never auto-apply a diff,
    # always show the prompt, round-cap disagreement at 3).
    SKILLS / "review" / "codex-bridge" / "SKILL.md",
    SKILLS / "review" / "codex-review" / "SKILL.md",
}

sys.path.insert(0, str(Path(__file__).resolve().parent))
from apply_detailed_skills_data import (
    CATEGORY_DEEP,
    safe_path_for,
    validation_for,
    CHAINS_TO,
    DESCRIPTIONS,
    FAILURE_EXTRAS,
    INTAKE_EXTRAS,
    MISSIONS,
    WHEN_TO_USE,
    chaining_example,
    path_extras,
)

# Skills with `references/deep-dive.md` — Step 1 adds !cat (expand set as you add files).
DEEP_DIVE_SKILLS = frozenset(
    {
        "prioritize",
        "sprint/planning",
        "research/competitive",
        "intake",
        "project",
    }
)


def read_front_matter(p: Path) -> dict:
    t = p.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n", t, re.DOTALL)
    if not m:
        raise SystemExit(f"No front matter: {p}")
    fm: dict = {}
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if ":" in line:
            k, v = line.split(":", 1)
            key_name, value = k.strip(), v.strip().strip('"')
            # This reader is line-based, so a YAML block scalar (`key: >-` with the text on the
            # following indented lines) arrives here as the bare indicator with its content already
            # dropped. Round-tripping that writes `when_to_use: ">-"` back into the file, where it
            # silently eats skill-listing budget and reads as real content. Treat it as empty and say
            # so, rather than persisting a two-character lie.
            if value in {">", ">-", ">+", "|", "|-", "|+"}:
                print(
                    f"warning: {p}: `{key_name}` is a YAML block scalar; this reader is line-based "
                    f"so its content was not read. Rewrite it as an inline scalar or move it into "
                    f"the generator data. Dropping the key.",
                    file=sys.stderr,
                )
                continue
            fm[key_name] = value
    return fm


def skill_key(p: Path) -> str:
    r = p.relative_to(SKILLS)
    return str(r.parent) if r.name == "SKILL.md" else str(r)


ORCHESTRATORS = {
    "jira", "notion", "meetings", "research", "reports", "self",
    "knowledge", "review", "session", "metrics", "routines", "workflows", "incident",
    "sop", "sprint", "computer-use", "design", "pe", "plugin", "shortcuts",
}
ORCH_CHILDREN = {
    "jira": "get, create, update, intake, transition, notify, append",
    "notion": "update, planning, sprint, project, report, adr, article, team-note, standup, team-report, performance, one-on-one, setup",
    "meetings": "prepare, transcribe, granola-highlights, action-items, post-slack, notion-highlights, store-note (team / personal), one-on-one-transcript, transcripts-ingest",
    "research": "technical, competitive, user, explain-codebase, spike",
    "reports": "team-report, engineer-report, manager-report, project-report, eval-report, report-design, share-html-publish",
    "self": "diary, lookback, focus, eval, remember, tasks, explain, brag, impact-prep, draft-messages, tldr",
    "knowledge": "intake, process, search, self-knowledge, team-knowledge, ingest-all, skill-finder",
    "review": "code-review, project-review, announcement-review, counsel-review, codex-bridge, codex-review, thermonuclear-review",
    "session": "init, end",
    "metrics": "my-metrics, team-metrics",
    "routines": "standup, weekly-digest, sprint-close, health-check, custom, morning-kickoff",
    "workflows": "builder, recorder, viewer, execute",
    "incident": "retro, find-sme, oncall-summary",
    "sop": "expectations, resources",
    "computer-use": "cua",
    "design": "figma-handoff, visual-single-page-html",
    "pe": "report-context, pe-recon",
    "plugin": "create-plugin-pr",
    "shortcuts": "ceo-brainstorm, executive-research-brief",
    "sprint": "prep, refinement, planning",
}


def build_description(key: str, fm: dict) -> str:
    if key in DESCRIPTIONS:
        return DESCRIPTIONS[key]
    return fm.get("description", "")


def build_body(key: str, fm: dict) -> str:
    name = fm.get("name", "jstack-skill")
    category = fm.get("category", "general")
    is_orch = key in ORCHESTRATORS

    # --- chain contract ---
    chain_target = CHAINS_TO.get(key, "")
    cc = "<!-- Chain Contract -->\n"
    cc += "<!-- inputs: user_request, jstack_config -->\n"
    cc += "<!-- outputs: structured_result -->"
    if chain_target:
        cc += f"\n<!-- chains-to: {chain_target} -->"

    # --- preamble (once) ---
    preamble = "Read the setup preamble first:\n!cat ${CLAUDE_PLUGIN_ROOT}/prompts/setup/preamble.md"
    preamble += policy_loads_for(key, category)

    # --- mission (unique per skill) ---
    desc = build_description(key, fm)
    mission_text = MISSIONS.get(key, "")
    if not mission_text:
        mission_text = MISSIONS.get(category, desc)
    scope_block = f"## What this skill is for\n{mission_text}"

    # --- domain detail: prefer skill-key block, else category (e.g. update-config vs setup) ---
    cat_detail = CATEGORY_DEEP.get(key, CATEGORY_DEEP.get(category, "")).strip()

    # --- path-specific addendum ---
    path_detail = path_extras(key).strip()

    # --- config references (no duplicate preamble) ---
    cfg = (
        "## Config and references\n"
        "- `jstack.config.json` — team ids, integrations, `skill_defaults`, `jira_rules`, `notion`, `gbrain`. Never hardcode.\n"
        "- Questions (open-ended, one at a time): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/question-patterns.md`\n"
        "- Discrete choices (when the host supports AskUserQuestion or equivalent): `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/ask-user-question-patterns.md`\n"
        "- Integrations: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/integration-guide.md`\n"
        "- Chaining: `${CLAUDE_PLUGIN_ROOT}/skills/_core/references/chaining-guide.md`"
    )

    # --- orchestrator index ---
    orch_idx = ""
    if is_orch and key in ORCH_CHILDREN:
        kids = ORCH_CHILDREN[key]
        orch_idx = (
            f"## Sub-skills (pick the most specific)\n"
            f"**Under `skills/{key}/`:** {kids}\n\n"
            f"If the user is vague, ask **one** question to disambiguate, then route to the child skill. "
            f"Do not execute every sub-skill in one turn unless the user asked for a chain."
        )

    # --- intake ---
    # Design/authoring skills need a real interview before they produce anything, but most skills
    # do not — a uniform "run the full interview" line across all 137 would be noise in the ~130
    # that just read config and act. INTAKE_EXTRAS is the per-key opt-in.
    intake = (
        "## Intake\n"
        "1. Parse `$ARGUMENTS` — note whether the user **pasted** data or is asking you to **query** a system.\n"
        "2. If a required id is missing, ask **one** focused question; otherwise use config defaults (label assumptions as `[assumption]`).\n"
        "3. If the request bundles multiple unrelated goals, handle the first and offer to continue."
    )
    intake_extra = INTAKE_EXTRAS.get(key, "").strip()
    if intake_extra:
        intake += f"\n\n{intake_extra}"

    # --- procedure with path detail as Step 3 ---
    if is_orch:
        step3_content = (
            f"Route to the most specific child skill under `skills/{key}/`. "
            "If the user's intent is clear, emit `suggested_next: <child-skill>` and stop. "
            "If ambiguous, ask one question to disambiguate before routing."
        )
    elif path_detail:
        step3_content = path_detail
    else:
        # Only cite a templates directory that actually exists. This fallback used to name
        # `templates/<category>/` unconditionally, so 20 skills across 13 categories instructed the
        # reader to consult a directory that was never created — only templates/{config,jira,notion,
        # reports,research} exist. An instruction pointing at a nonexistent path is worse than no
        # instruction: it implies content the author will go looking for and not find.
        if (SKILLS.parent / "templates" / category).is_dir():
            step3_content = (
                f"Apply the `{name}` workflow using config and any applicable templates under "
                f"`templates/{category}/`."
            )
        else:
            step3_content = (
                f"Apply the `{name}` workflow using values from `jstack.config.json`. There is no "
                f"`templates/{category}/` directory — derive the output shape from the Output shape "
                f"section below rather than looking for a template file."
            )
    step1 = (
        "### Step 1 — Load config\n"
        "Read relevant keys from `jstack.config.json`. If the integration is missing or unhealthy, "
        "say so and point to `jstack setup` / `jstack doctor` instead of faking data."
    )
    if key in DEEP_DIVE_SKILLS:
        step1 += (
            "\n\nFor methodology, examples, and templates for this skill, read:\n"
            "!cat ${CLAUDE_PLUGIN_ROOT}/skills/" + key + "/references/deep-dive.md"
        )
    procedure = (
        "## Procedure\n"
        f"{step1}\n\n"
        "### Step 2 — Plan the safe path\n"
        f"{safe_path_for(key, category)}\n\n"
        f"### Step 3 — Execute\n{step3_content}\n\n"
        "### Step 4 — Validate\n"
        f"{validation_for(key, category)}\n\n"
        "### Step 5 — Summarize and hand off\n"
        "State what changed, what to verify, and suggest **one** next jstack skill if the work naturally continues."
    )

    # --- output shape ---
    output = (
        "## Output shape\n"
        f"Use a domain-appropriate heading, then:\n"
        "- **Summary** (2–4 sentences)\n"
        "- **Details** (bullets, table, or structured fields)\n"
        "- **Next steps** with owner + timeline if known\n"
        "- **Limitations** (partial data, no write access, etc.)\n"
        "- For eval-gated skills, end with `result_ok: true` or `result_ok: false` + reason"
    )

    # --- failure modes (category-aware) ---
    extra_rows = FAILURE_EXTRAS.get(category, FAILURE_EXTRAS.get(key, ""))
    fail_table = (
        "## Failure modes\n\n"
        "| Symptom | Recovery |\n"
        "|---------|----------|\n"
        "| Missing config / integration | Point to `jstack setup` or `jstack doctor`; do not continue with invented ids. |\n"
        "| Auth / 403 / expired token | Stop; tell user to refresh credentials. Never print secrets. |\n"
        "| Ambiguous goal | One clarifying question; if still unclear, present options A/B. |"
    )
    if extra_rows:
        fail_table += "\n" + extra_rows

    # --- chaining ---
    if is_orch:
        chaining = (
            "## Chaining\n"
            f"This is a **domain orchestrator** — route to the most specific child skill. "
            "Do not inline every sub-flow. If the user's task maps to one child, say "
            "`suggested_next: <child-skill>` and stop."
        )
    else:
        example = chaining_example(category)
        example_clause = f" (e.g. {example})" if example else ""
        chaining = (
            "## Chaining\n"
            f"Complete the work here. If a natural follow-up exists{example_clause}, add one line: "
            "`suggested_next: <skill-name>` with a copy-paste handoff block. "
            "Do not auto-invoke without user intent or a defined chain in `prompts/chains/`."
        )

    # --- user request ---
    user_req = "## User request\n\n$ARGUMENTS"

    # --- assemble (single newlines between blocks, no double blanks) ---
    parts = [cc, preamble, scope_block]
    if cat_detail:
        parts.append(cat_detail)
    if orch_idx:
        parts.append(orch_idx)
    parts.append(cfg)
    parts.extend([intake, procedure, output, fail_table, chaining, user_req])
    return "\n\n".join(p.strip() for p in parts if p.strip())


def yaml_scalar(value: str) -> str:
    """Emit a frontmatter value that strict YAML can parse.

    27 of 137 SKILL.md files had frontmatter that `yaml.safe_load` rejected, because values were
    written raw. The usual culprit was a colon-space inside a description
    ("Summarize engineering health: CI status, ..."), which YAML reads as a nested mapping; another was
    `argument-hint: [PROJ-123] [Done|In Progress|etc]`, which looks like a flow sequence.

    This repo tolerated it internally — `read_front_matter()` is line-based and the depth checker has an
    explicit fallback — but every consumer that uses a real YAML parser silently saw an EMPTY mapping
    for those skills, so `name`, `effort`, and `disable-model-invocation` all read as absent. Quoting at
    the point of emission fixes it for every key at once instead of per-value in the data files.
    """
    v = str(value)
    needs_quotes = (
        v == ""
        or ": " in v
        or v.endswith(":")
        or " #" in v
        or v[0] in "[]{}&*!|>%@`\"'"
        or v != v.strip()
    )
    if not needs_quotes:
        return v
    # Double-quoted style: escape backslashes and double quotes, keep everything else literal.
    escaped = v.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


# Policy and tone files that a skill's domain must actually LOAD, not merely mention.
#
# `prompts/policies/review-policy.md` and `incident-policy.md` were read by nothing at runtime: the
# working mechanism is `!cat ${CLAUDE_PLUGIN_ROOT}/prompts/...`, used 141x for the setup preamble and a
# handful of times for personas and the executive tone, and ZERO times for any policy or chain file.
# Rewriting those policies for quality (as was done) changes no behaviour while nothing loads them.
#
# Keyed by category so every child skill in the domain inherits the load. Only files that exist are
# emitted — a `!cat` of a missing path is worse than no line at all.
POLICY_LOADS = {
    "review": ["prompts/policies/review-policy.md"],
    "incident": ["prompts/policies/incident-policy.md"],
    "sdlc": ["prompts/policies/sdlc-gates.md"],
    # Per-key entries win over the category, so counsel-review gets the personas its whole job depends
    # on. Four of the five persona files were loaded by nothing at runtime.
    "review/counsel-review": [
        "prompts/policies/review-policy.md",
        "prompts/personas/ceo.md",
        "prompts/personas/pm.md",
        "prompts/personas/engineer.md",
        "prompts/personas/qa.md",
        "prompts/personas/designer.md",
    ],
    # Chain DEFINITIONS, loaded by the routine/skill that executes them. `validate-chains` resolves
    # their steps, but nothing loaded the file itself, so the declared order was never in context for
    # the skill that was supposed to follow it.
    "routines/sprint-close": ["prompts/chains/sprint-close-chain.md"],
    "incident/retro": ["prompts/policies/incident-policy.md", "prompts/chains/incident-response-chain.md"],
    "intake": ["prompts/chains/intake-to-sprint-chain.md"],
    "team": ["prompts/setup/team-context.md"],
    # All three tones, because the skill's intake picks one — loading a single tone here would
    # hard-code the choice the AskUserQuestion selector is supposed to make.
    "announcements": [
        "prompts/policies/announcement-policy.md",
        "prompts/tones/internal.md",
        "prompts/tones/executive.md",
        "prompts/tones/formal.md",
    ],
}


def policy_loads_for(key: str, category: str) -> str:
    """Emit `!cat` lines for the policy files this skill's domain is supposed to obey."""
    paths = POLICY_LOADS.get(key) or POLICY_LOADS.get(category) or []
    existing = [p for p in paths if (SKILLS.parent / p).exists()]
    if not existing:
        return ""
    lines = ["", "Load the policy this domain is governed by (do not restate it from memory):"]
    lines += [f"!cat ${{CLAUDE_PLUGIN_ROOT}}/{p}" for p in existing]
    return "\n".join(lines)


def build_frontmatter(key: str, fm: dict, desc: str) -> str:
    """Emit YAML frontmatter; preserve keys not regenerated (e.g. gbrain_destination)."""
    name = fm.get("name", "jstack-skill")
    category = fm.get("category", "general")
    if key in WHEN_TO_USE:
        when_line = WHEN_TO_USE[key]
    else:
        when_line = fm.get("when_to_use", "")
    lines = ["---", f"name: {yaml_scalar(name)}", f"description: {yaml_scalar(desc)}"]
    if when_line:
        lines.append(f"when_to_use: {yaml_scalar(when_line)}")
    lines.append(f"category: {yaml_scalar(category)}")
    reserved = {"name", "description", "category", "when_to_use"}
    for k, v in sorted(fm.items()):
        if k in reserved:
            continue
        lines.append(f"{k}: {yaml_scalar(v)}")
    lines.append("---")
    return "\n".join(lines) + "\n"


def write_skill(path: Path) -> None:
    fm = read_front_matter(path)
    key = skill_key(path)
    desc = build_description(key, fm)
    body = build_body(key, fm)
    hdr = build_frontmatter(key, fm, desc)
    path.write_text(hdr + "\n" + body + "\n", encoding="utf-8")


def main() -> None:
    n = 0
    for p in sorted(SKILLS.rglob("SKILL.md")):
        if p in SKIP:
            continue
        write_skill(p)
        n += 1
    print(f"Wrote {n} skills. Skipped {len(SKIP)} hand-maintained.")


if __name__ == "__main__":
    main()
