#!/usr/bin/env python3
"""
Add modern Claude Code frontmatter fields to jstack skills.

Applies effort, disable-model-invocation, context/agent forks,
disallowed-tools, and argument-hint/arguments to the right skills.
Safe to re-run: never overwrites an already-present field.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent / "skills"

# -------------------------------------------------------------------
# Mapping: relative skill path → dict of fields to add (if absent)
# -------------------------------------------------------------------

ADDITIONS: dict[str, dict[str, str]] = {

    # ── Operational write skills ─────────────────────────────────────
    # User must explicitly trigger; never auto-invoked by Claude.

    "announcements": {
        "disable-model-invocation": "true",
    },
    "jira/create": {
        "disable-model-invocation": "true",
        "argument-hint": "[issue-summary or paste intake payload]",
    },
    "jira/transition": {
        "disable-model-invocation": "true",
        "arguments": "[ticket_id, status]",
        "argument-hint": "[PROJ-123] [Done|In Progress|etc]",
    },
    "jira/update": {
        "disable-model-invocation": "true",
        "arguments": "[ticket_id]",
        "argument-hint": "[PROJ-123]",
    },
    "jira/notify": {
        "disable-model-invocation": "true",
        "arguments": "[ticket_id]",
        "argument-hint": "[PROJ-123]",
    },
    "jira/append": {
        "disable-model-invocation": "true",
        "arguments": "[ticket_id]",
        "argument-hint": "[PROJ-123]",
    },
    "meetings/post-slack": {
        "disable-model-invocation": "true",
    },
    "routines/sprint-close": {
        "disable-model-invocation": "true",
    },
    "workflows/execute": {
        "disable-model-invocation": "true",
    },
    "workflows/recorder": {
        "disable-model-invocation": "true",
    },
    "plugin/create-plugin-pr": {
        "disable-model-invocation": "true",
    },
    # Notion write skills
    "notion/adr": {
        "disable-model-invocation": "true",
    },
    "notion/article": {
        "disable-model-invocation": "true",
    },
    "notion/one-on-one": {
        "disable-model-invocation": "true",
    },
    "notion/performance": {
        "disable-model-invocation": "true",
    },
    "notion/planning": {
        "disable-model-invocation": "true",
    },
    "notion/project": {
        "disable-model-invocation": "true",
    },
    "notion/report": {
        "disable-model-invocation": "true",
    },
    "notion/setup": {
        "disable-model-invocation": "true",
    },
    "notion/sprint": {
        "disable-model-invocation": "true",
    },
    "notion/team-note": {
        "disable-model-invocation": "true",
    },
    "notion/team-report": {
        "disable-model-invocation": "true",
    },
    "notion/update": {
        "disable-model-invocation": "true",
    },
    "notion/knowledge-base": {
        "disable-model-invocation": "true",
    },

    # ── Research / read-only leaf skills → forked Explore agent ──────
    # Isolates large grep/read sweeps from main context window.

    "recon": {
        "context": "fork",
        "agent": "Explore",
        "effort": "max",
    },
    "federated-search": {
        "context": "fork",
        "agent": "Explore",
        "effort": "high",
    },
    "knowledge/search": {
        "context": "fork",
        "agent": "Explore",
        "effort": "high",
    },
    "knowledge/skill-finder": {
        "context": "fork",
        "agent": "Explore",
        "effort": "medium",
    },
    "knowledge/self-knowledge": {
        "context": "fork",
        "agent": "Explore",
        "effort": "high",
    },
    "knowledge/team-knowledge": {
        "context": "fork",
        "agent": "Explore",
        "effort": "high",
    },
    "knowledge/process": {
        "context": "fork",
        "agent": "Explore",
        "effort": "medium",
    },
    "research/competitive": {
        "context": "fork",
        "agent": "Explore",
        "effort": "max",
    },
    "research/explain-codebase": {
        "context": "fork",
        "agent": "Explore",
        "effort": "high",
    },
    "research/spike": {
        "context": "fork",
        "agent": "Explore",
        "effort": "max",
    },
    "research/technical": {
        "context": "fork",
        "agent": "Explore",
        "effort": "high",
    },
    "research/user": {
        "context": "fork",
        "agent": "Explore",
        "effort": "high",
    },
    "engineering/health": {
        "context": "fork",
        "agent": "Explore",
        "effort": "high",
    },
    "engineering/silo-scan": {
        "context": "fork",
        "agent": "Explore",
        "effort": "high",
    },

    # ── Deep analysis (high effort, inline) ──────────────────────────

    "advice": {
        "effort": "high",
    },
    "adr": {
        "effort": "high",
    },
    "sdlc": {
        "effort": "high",
    },
    "review/announcement-review": {
        "effort": "high",
    },
    "review/counsel-review": {
        "effort": "high",
    },
    "review/project-review": {
        "effort": "high",
    },
    "review/code-review": {
        "effort": "high",
    },
    "sprint/planning": {
        "effort": "high",
    },
    "sprint/prep": {
        "effort": "high",
    },
    "sprint/refinement": {
        "effort": "high",
    },
    "reports/manager-report": {
        "effort": "high",
    },
    "reports/team-report": {
        "effort": "high",
    },
    "reports/engineer-report": {
        "effort": "high",
    },
    "self/eval": {
        "effort": "high",
    },
    "self/impact-prep": {
        "effort": "high",
    },
    "self/lookback": {
        "effort": "high",
    },
    "self/brag": {
        "effort": "high",
    },
    "metrics/team-metrics": {
        "effort": "max",
    },
    "shortcuts/ceo-brainstorm": {
        "effort": "high",
    },
    "shortcuts/executive-research-brief": {
        "effort": "high",
    },
    "meetings/prepare": {
        "effort": "high",
    },
    "incident/retro": {
        "effort": "high",
    },

    # ── Lightweight / automated (low effort) ─────────────────────────

    "routines/standup": {
        "effort": "low",
        "disallowed-tools": "AskUserQuestion",
    },
    "routines/morning-kickoff": {
        "effort": "low",
        "disallowed-tools": "AskUserQuestion",
    },
    "routines/health-check": {
        "effort": "low",
        "disallowed-tools": "AskUserQuestion",
    },
    "routines/weekly-digest": {
        "effort": "low",
        "disallowed-tools": "AskUserQuestion",
    },
    "routines/custom": {
        "effort": "low",
        "disallowed-tools": "AskUserQuestion",
    },
    "granola-daily-summary": {
        "effort": "low",
        "disallowed-tools": "AskUserQuestion",
    },
    "granola-daily-summary-6pm": {
        "effort": "low",
        "disallowed-tools": "AskUserQuestion",
    },
    "self/diary": {
        "effort": "low",
    },
    "self/tasks": {
        "effort": "low",
    },
    "self/remember": {
        "effort": "low",
    },
    "self/focus": {
        "effort": "low",
    },
    "session/end": {
        "effort": "low",
    },
    "session/init": {
        "effort": "low",
    },
    "meetings/store-note": {
        "effort": "low",
    },
    "meetings/store-note/personal": {
        "effort": "low",
    },
    "meetings/store-note/team": {
        "effort": "low",
    },
    "notion/standup": {
        "effort": "low",
        "disable-model-invocation": "true",
    },
    "reports/self-report": {
        "effort": "low",
    },
    "metrics/my-metrics": {
        "effort": "low",
    },

    # ── Argument hints ────────────────────────────────────────────────

    "jira/get": {
        "arguments": "[ticket_id]",
        "argument-hint": "[PROJ-123]",
    },
    "jira/intake": {
        "arguments": "[ticket_url]",
        "argument-hint": "[URL or PROJ-123]",
    },
    "meetings/one-on-one-transcript": {
        "arguments": "[person_name]",
        "argument-hint": "[person-name]",
    },
    "meetings/granola-highlights": {
        "effort": "low",
    },
    "meetings/transcribe": {
        "effort": "medium",
    },
    "meetings/transcripts-ingest": {
        "effort": "low",
        "disable-model-invocation": "true",
    },
    "meetings/action-items": {
        "effort": "medium",
    },
    "meetings/notion-highlights": {
        "effort": "low",
        "disable-model-invocation": "true",
    },
}


def parse_frontmatter(text: str) -> tuple[dict[str, str], str, str]:
    """
    Returns (fields_dict, raw_fm_block, rest_of_file).
    raw_fm_block includes the opening and closing ---.
    """
    if not text.startswith("---"):
        return {}, "", text

    end = text.find("\n---", 3)
    if end == -1:
        return {}, "", text

    fm_lines = text[3:end].strip().splitlines()
    fields: dict[str, str] = {}
    for line in fm_lines:
        m = re.match(r'^([^:]+):\s*(.*)', line)
        if m:
            fields[m.group(1).strip()] = m.group(2).strip()

    raw_fm = text[: end + 4]   # includes closing ---
    rest = text[end + 4:]
    return fields, raw_fm, rest


def inject_fields(raw_fm: str, new_fields: dict[str, str]) -> str:
    """
    Insert new_fields into the frontmatter block just before the closing ---.
    Preserves all existing content exactly.
    """
    # Find the closing ---
    close_idx = raw_fm.rfind("\n---")
    before = raw_fm[:close_idx]
    after = raw_fm[close_idx:]   # '\n---'
    additions = "".join(f"\n{k}: {v}" for k, v in new_fields.items())
    return before + additions + after


def process_skill(rel_path: str, to_add: dict[str, str], dry_run: bool = False) -> str:
    path = ROOT / rel_path / "SKILL.md"
    if not path.exists():
        return f"  SKIP  {rel_path}  (file not found)"

    text = path.read_text()
    existing, raw_fm, rest = parse_frontmatter(text)

    missing = {k: v for k, v in to_add.items() if k not in existing}
    if not missing:
        return f"  OK    {rel_path}  (already up-to-date)"

    new_fm = inject_fields(raw_fm, missing)
    if not dry_run:
        path.write_text(new_fm + rest)

    keys = ", ".join(missing.keys())
    verb = "WOULD ADD" if dry_run else "ADDED"
    return f"  {verb}  [{keys}]  →  {rel_path}"


def main():
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("DRY RUN — no files will be changed\n")

    results: list[str] = []
    for rel_path, fields in sorted(ADDITIONS.items()):
        result = process_skill(rel_path, fields, dry_run=dry_run)
        results.append(result)
        print(result)

    added = sum(1 for r in results if "ADDED" in r or "WOULD ADD" in r)
    skipped = sum(1 for r in results if "SKIP" in r)
    ok = sum(1 for r in results if "OK" in r)
    print(f"\nDone: {added} updated, {ok} already current, {skipped} not found")


if __name__ == "__main__":
    main()
