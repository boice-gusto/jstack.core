/**
 * `markdown-render.js` is a browser-only module (dynamic `import()` of ESM from a
 * CDN, `DocumentFragment` output) — it can't be exercised directly under `bun:test`
 * (no DOM). What IS testable, deterministically and offline, is the exact dependency
 * versions it pins.
 *
 * dompurify@3.1.7 (the version previously pinned here) is in the disclosed-vulnerable
 * range for GHSA-v2wj-7wpq-c8vv / CVE-2026-0540: DOMPurify 3.1.3 through 3.3.1 is
 * missing five rawtext elements (noscript, xmp, noembed, noframes, iframe) from its
 * `SAFE_FOR_XML` handling, so an attribute value like
 * `title="</noscript><img src=x onerror=alert(1)>"` survives `sanitize()` completely
 * unescaped instead of being neutralized. Verified directly against the real,
 * CDN-fetched dompurify@3.1.7 UMD bundle in a jsdom sandbox (see the PoC in the audit
 * notes) — the payload survived verbatim on 3.1.7 and was neutralized on 3.4.1.
 * Fixed upstream in dompurify 3.3.2. This test pins the floor at 3.3.2 so a future
 * edit can't silently reintroduce the vulnerable version.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(import.meta.dir, "markdown-render.js"), "utf8");

function parseSemver(v: string): [number, number, number] {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  if (!m) throw new Error(`not a semver: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function gte(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i]! > b[i]!) return true;
    if (a[i]! < b[i]!) return false;
  }
  return true;
}

describe("markdown-render.js — pinned CDN dependency versions", () => {
  test("pins a dompurify version fixed against CVE-2026-0540 (>= 3.3.2)", () => {
    const m = /dompurify@([\d.]+)\/\+esm/.exec(SRC);
    expect(m).not.toBeNull();
    const version = m![1]!;
    expect(gte(parseSemver(version), [3, 3, 2])).toBe(true);
  });

  test("does not pin the known-vulnerable dompurify@3.1.7", () => {
    expect(SRC).not.toContain("dompurify@3.1.7/+esm");
  });

  test("pins a marked version (sanity: CDN import string is well-formed)", () => {
    const m = /marked@([\d.]+)\/\+esm/.exec(SRC);
    expect(m).not.toBeNull();
  });
});
