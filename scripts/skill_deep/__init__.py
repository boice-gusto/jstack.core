"""
Per-skill deep domain content, merged into CATEGORY_DEEP by the generator.

Why this exists: `CATEGORY_DEEP` in `apply_detailed_skills_data.py` is looked up
key-first then category, so a per-skill entry overrides the category default. That
lets a high-judgment skill (code review, competitive research, engineering health)
carry real domain depth — thresholds, named anti-patterns, worked examples — while
still being GENERATED, so it does not have to be added to `SKIP` and taken out of
the generator's control.

Each module here owns a disjoint set of skill keys and exports `DEEP: dict[str, str]`
mapping a skill key (e.g. "review/code-review") to a markdown section. Modules are
separate so they can be authored in parallel without write conflicts.

Depth is proportional to judgment load. A lookup skill (`jira/get`) legitimately
needs none of this; a skill that renders a verdict needs all of it.
"""
from __future__ import annotations

import importlib
import pkgutil

# Module names are discovered rather than listed, so adding a module needs no edit here.
_SKIP_MODULES = {"__init__"}


def load_deep() -> dict[str, str]:
    """Merge every sibling module's DEEP dict. Raises on a duplicate key."""
    merged: dict[str, str] = {}
    owners: dict[str, str] = {}
    for mod in pkgutil.iter_modules(__path__):
        if mod.name in _SKIP_MODULES:
            continue
        module = importlib.import_module(f"{__name__}.{mod.name}")
        deep = getattr(module, "DEEP", None)
        if not isinstance(deep, dict):
            continue
        for key, section in deep.items():
            if key in merged:
                raise SystemExit(
                    f"skill_deep: duplicate key {key!r} in {mod.name} "
                    f"(already provided by {owners[key]}) — each module must own disjoint keys"
                )
            merged[key] = section.strip()
            owners[key] = mod.name
    return merged
