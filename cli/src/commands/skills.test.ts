/**
 * Tests for `collectSkills` — the skill-catalog scanner behind `skills index/browse/pick/show`.
 *
 * This is the logic-bearing seam in the skills command: it walks a tree, parses each SKILL.md's
 * frontmatter with its OWN line-based parser, merges an optional org overlay, and sorts. The output
 * feeds the catalog, the docs site, and the interactive pickers, so a parsing quirk here shows up as
 * a skill that is silently unnamed or undescribed in every one of them.
 *
 * Worth knowing: this is the THIRD independent frontmatter parser in the repo, and they do not agree.
 * `scripts/apply_detailed_skills.py` keeps only lines containing `:` and therefore silently drops a
 * YAML block list; this one additionally understands `|` and `>-` block scalars for `description`.
 * These tests pin what THIS parser actually does, so a future consolidation has a specification to
 * work against rather than a guess.
 *
 * Fixtures are synthetic temp trees — never the real `skills/` directory, which has 136 entries and
 * would make every assertion a moving target.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { collectSkills } from "./skills.js";

let root: string;

/** Write a SKILL.md at `skills/<rel>/SKILL.md` under `base`. */
function skill(base: string, rel: string, body: string): void {
  const p = join(base, "skills", rel, "SKILL.md");
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body, "utf8");
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jstack-skills-"));
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("discovery", () => {
  test("finds a nested SKILL.md and reports its relative path", () => {
    skill(root, "jira/create", "---\nname: jstack-jira-create\ndescription: Make a ticket.\n---\nbody\n");
    const found = collectSkills(root);
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe("jstack-jira-create");
    expect(found[0].description).toBe("Make a ticket.");
    expect(found[0].rel).toContain("jira/create");
  });

  test("returns an empty list when there is no skills/ directory", () => {
    expect(collectSkills(root)).toEqual([]);
  });

  test("ignores directories that contain no SKILL.md", () => {
    mkdirSync(join(root, "skills", "references"), { recursive: true });
    writeFileSync(join(root, "skills", "references", "notes.md"), "# notes\n");
    expect(collectSkills(root)).toEqual([]);
  });

  test("sorts by name, not by discovery order", () => {
    skill(root, "z-dir", "---\nname: aaa\ndescription: d\n---\n");
    skill(root, "a-dir", "---\nname: zzz\ndescription: d\n---\n");
    expect(collectSkills(root).map((e) => e.name)).toEqual(["aaa", "zzz"]);
  });
});

describe("frontmatter parsing", () => {
  test("strips surrounding quotes from name and description", () => {
    skill(root, "s", `---\nname: "quoted-name"\ndescription: 'single quoted'\n---\n`);
    const [e] = collectSkills(root);
    expect(e.name).toBe("quoted-name");
    expect(e.description).toBe("single quoted");
  });

  test("joins a `>-` folded description into one line", () => {
    skill(
      root,
      "s",
      "---\nname: folded\ndescription: >-\n  first part\n  second part\n---\nbody\n",
    );
    const [e] = collectSkills(root);
    expect(e.description).toBe("first part second part");
  });

  test("joins a `|` literal description into one line", () => {
    skill(root, "s", "---\nname: literal\ndescription: |\n  line one\n  line two\n---\n");
    const [e] = collectSkills(root);
    expect(e.description).toBe("line one line two");
  });

  test("falls back to the relative path when name is absent", () => {
    skill(root, "nameless/skill", "---\ndescription: no name here\n---\n");
    const [e] = collectSkills(root);
    // The fallback is the rel path, so the entry is still identifiable in a picker.
    expect(e.name).toContain("nameless/skill");
  });

  test("yields an empty description rather than throwing when it is absent", () => {
    skill(root, "s", "---\nname: only-name\n---\n");
    const [e] = collectSkills(root);
    expect(e.name).toBe("only-name");
    expect(e.description).toBe("");
  });

  test("does not read name/description from the body after frontmatter closes", () => {
    skill(
      root,
      "s",
      "---\nname: real-name\ndescription: real desc\n---\nname: body-name\ndescription: body desc\n",
    );
    const [e] = collectSkills(root);
    expect(e.name).toBe("real-name");
    expect(e.description).toBe("real desc");
  });
});

describe("overlay merging", () => {
  test("prefixes overlay entries so their origin is visible", () => {
    skill(root, "core-skill", "---\nname: core-one\ndescription: c\n---\n");
    const overlay = mkdtempSync(join(tmpdir(), "jstack-overlay-"));
    try {
      skill(overlay, "org-skill", "---\nname: org-one\ndescription: o\n---\n");
      const found = collectSkills(root, overlay);
      expect(found).toHaveLength(2);
      const org = found.find((e) => e.name === "org-one");
      expect(org?.rel).toStartWith("[overlay] ");
      const core = found.find((e) => e.name === "core-one");
      expect(core?.rel).not.toContain("[overlay]");
    } finally {
      rmSync(overlay, { recursive: true, force: true });
    }
  });

  test("a nonexistent overlay path is ignored rather than fatal", () => {
    skill(root, "core-skill", "---\nname: core-one\ndescription: c\n---\n");
    const found = collectSkills(root, join(root, "no-such-overlay"));
    expect(found).toHaveLength(1);
  });

  test("an overlay may shadow a core skill name; both are returned for the caller to resolve", () => {
    skill(root, "dup", "---\nname: same-name\ndescription: from core\n---\n");
    const overlay = mkdtempSync(join(tmpdir(), "jstack-overlay-"));
    try {
      skill(overlay, "dup", "---\nname: same-name\ndescription: from overlay\n---\n");
      const found = collectSkills(root, overlay);
      // Documented behavior: collectSkills does NOT dedupe. Callers see both, distinguished by rel.
      expect(found).toHaveLength(2);
      expect(found.filter((e) => e.name === "same-name")).toHaveLength(2);
      expect(found.some((e) => e.rel.startsWith("[overlay] "))).toBe(true);
    } finally {
      rmSync(overlay, { recursive: true, force: true });
    }
  });
});

describe("against the real catalog", () => {
  // One integration-shaped check: the scanner must actually work on this repo's own skills tree.
  test("collects the repo's skills and every entry has a name", () => {
    const repoRoot = join(import.meta.dir, "..", "..", "..");
    const found = collectSkills(repoRoot);
    expect(found.length).toBeGreaterThan(100);
    expect(found.filter((e) => !e.name || e.name.trim() === "")).toEqual([]);
    expect(found.filter((e) => !e.path.endsWith("SKILL.md"))).toEqual([]);
  });
});
