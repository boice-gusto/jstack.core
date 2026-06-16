#!/usr/bin/env python3
"""
Regenerate jstack **/SKILL.md bodies with longform operational detail.
Skips hand-maintained skills: advice, adr, recon, skill-creator, skill-creator/improve-claude-md, computer-use/cua, workflow-builder, knowledge/search, shortcuts/ceo-brainstorm, shortcuts/executive-research-brief.

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
    SKILLS / "advice" / "SKILL.md",
    SKILLS / "adr" / "SKILL.md",
    SKILLS / "recon" / "SKILL.md",
    SKILLS / "skill-creator" / "SKILL.md",
    SKILLS / "skill-creator" / "improve-claude-md" / "SKILL.md",
    SKILLS / "computer-use" / "cua" / "SKILL.md",
    SKILLS / "workflow-builder" / "SKILL.md",
    SKILLS / "knowledge" / "search" / "SKILL.md",
    SKILLS / "shortcuts" / "ceo-brainstorm" / "SKILL.md",
    SKILLS / "shortcuts" / "executive-research-brief" / "SKILL.md",
}

sys.path.insert(0, str(Path(__file__).resolve().parent))
from apply_detailed_skills_data import (
    CATEGORY_DEEP,
    CHAINS_TO,
    DESCRIPTIONS,
    FAILURE_EXTRAS,
    MISSIONS,
    WHEN_TO_USE,
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
            fm[k.strip()] = v.strip().strip('"')
    return fm


def skill_key(p: Path) -> str:
    r = p.relative_to(SKILLS)
    return str(r.parent) if r.name == "SKILL.md" else str(r)


ORCHESTRATORS = {
    "jira", "notion", "meetings", "research", "reports", "self",
    "knowledge", "review", "session", "metrics", "routines", "workflows", "incident",
    "sop", "sprint",
}
ORCH_CHILDREN = {
    "jira": "get, create, update, intake, transition, notify, append",
    "notion": "update, planning, sprint, project, report, adr, article, knowledge-base, team-note",
    "meetings": "prepare, transcribe, granola-highlights, action-items, post-slack, notion-highlights, store-note (team / personal)",
    "research": "technical, competitive, user, explain-codebase, spike",
    "reports": "team-report, engineer-report, manager-report, project-report, self-report, eval-report",
    "self": "diary, lookback, focus, eval, remember, tasks, explain",
    "knowledge": "intake, process, search, self-knowledge, team-knowledge, shortcuts",
    "review": "project-review, announcement-review, counsel-review",
    "session": "init, end",
    "metrics": "my-metrics, team-metrics",
    "routines": "standup, weekly-digest, sprint-close, health-check, custom",
    "workflows": "builder, runner, recorder, viewer",
    "incident": "retro",
    "sop": "expectations, resources",
    "sprint": "planning",
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
    intake = (
        "## Intake\n"
        "1. Parse `$ARGUMENTS` — note whether the user **pasted** data or is asking you to **query** a system.\n"
        "2. If a required id is missing, ask **one** focused question; otherwise use config defaults (label assumptions as `[assumption]`).\n"
        "3. If the request bundles multiple unrelated goals, handle the first and offer to continue."
    )

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
        step3_content = (
            f"Apply the `{name}` workflow using config and any applicable templates under `templates/{category}/`."
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
        "Prefer read-only first, then idempotent updates, then irreversible changes — each gated by org norms.\n\n"
        f"### Step 3 — Execute\n{step3_content}\n\n"
        "### Step 4 — Validate\n"
        "Correct surface, no stray side effects, tone matches `prompts/tones/` if publishing text.\n\n"
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
        chaining = (
            "## Chaining\n"
            "Complete the work here. If a natural follow-up exists "
            "(e.g. `jstack:jira-intake` then `jstack:jira-create`), add one line: "
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
    if key == "knowledge/shortcuts":
        parts.append(
            "## Composites\n"
            "Named aliases (`jstack:ceo-brainstorm`, `jstack:executive-research-brief`, …) combine `!cat` of persona + tone with gstack or superpowers targets. Read "
            "`${CLAUDE_PLUGIN_ROOT}/prompts/shortcuts/composites.md`. Thin wrappers: `skills/shortcuts/*`."
        )
    parts.extend([intake, procedure, output, fail_table, chaining, user_req])
    return "\n\n".join(p.strip() for p in parts if p.strip())


def build_frontmatter(key: str, fm: dict, desc: str) -> str:
    """Emit YAML frontmatter; preserve keys not regenerated (e.g. gbrain_destination)."""
    name = fm.get("name", "jstack-skill")
    category = fm.get("category", "general")
    if key in WHEN_TO_USE:
        when_line = WHEN_TO_USE[key]
    else:
        when_line = fm.get("when_to_use", "")
    lines = ["---", f"name: {name}", f"description: {desc}"]
    if when_line:
        lines.append(f"when_to_use: {when_line}")
    lines.append(f"category: {category}")
    reserved = {"name", "description", "category", "when_to_use"}
    for k, v in sorted(fm.items()):
        if k in reserved:
            continue
        lines.append(f"{k}: {v}")
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
