<p align="center">
  <img src="../../../assets/logo-placeholder.png" alt="jstack" width="240" height="240" />
</p>

# Org context templates

Copy each `*.md.example` into your org markdown directory (e.g. `config/org/`), remove `.example`, then wire them in **`jstack.config.json`**:

1. Set **`org_context.local.base_path`** to that directory (relative to workspace root or absolute).
2. Set **`org_context.local.files`** so each **slice id** (left column below) maps to the **filename** you chose (right column is a suggested default name).

| Slice id | Suggested filename (after copy) |
|----------|----------------------------------|
| `org_structure` | `org-structure.md` |
| `ethics` | `ethics.md` |
| `engineering_handbook` | `engineering-handbook.md` |
| `hr_public` | `hr-public.md` |
| `coaching` | `coaching.md` |
| `self_review_rubric` | `self-review-rubric.md` |
| `critical_review_rubric` | `critical-review-rubric.md` |

3. Optionally set **`levels_and_expectations.markdown_path`** and add **`levels`** to **`skill_defaults.<skill>.org_context_slices`** where the skill should load the ladder.
4. Merge the snippet in **`org-context.merge.example.json`** into your full config (do not replace your entire `jstack.config.json`).

**Canonical contract:** `skills/_core/references/org-context.md`  
**Levels example (separate file):** `templates/config/levels-expectations.example.md`
