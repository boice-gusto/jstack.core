#!/usr/bin/env bun
/**
 * Every cross-origin `<script src>` in a tracked HTML artifact must be subresource-integrity pinned.
 *
 * A version pin alone still trusts whatever bytes the CDN returns for that path; `integrity` makes
 * the browser refuse a substituted file. These reports render team and incident data, and are shared
 * via `share_html`, so a compromised CDN script reads whatever the viewer can see.
 *
 * This gate also enforces a minimum DOMPurify version. `templates/reports/shells/default.html`
 * shipped `dompurify@3.1.6` — affected by the mXSS issue fixed in 3.2.4 — long after `package.json`
 * had been bumped to `^3.2.4`, because nothing connected the two. DOMPurify is the sanitizer between
 * report markdown and the DOM, so a stale copy is the dependency here that matters most.
 *
 * Deliberately allowed: `cdn.tailwindcss.com`, a versionless JIT compiler with no stable artifact to
 * hash. It is a dev/preview convenience; published reports use the bundled asset path. Allowing it
 * silently would hide a real exposure, so it is listed explicitly and reported as an advisory.
 *
 * Usage: bun run scripts/check-sri.ts [--strict]
 *   --strict also fails on advisories (unpinnable hosts present at all).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict");

/** Hosts with no hashable stable artifact. Each needs a reason, not just an entry. */
const UNPINNABLE: Record<string, string> = {
  "cdn.tailwindcss.com":
    "versionless JIT compiler; no stable artifact to hash (dev/preview only)",
};

/** Minimum versions for security-relevant libraries, keyed by npm package name. */
const MIN_VERSIONS: Record<string, { min: string; why: string }> = {
  dompurify: { min: "3.2.4", why: "mXSS fixed in 3.2.4 (CVE-2025-26791)" },
};

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".reports",
  "dist",
  "build",
  ".next",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".html")) out.push(p);
  }
  return out;
}

function cmpVersion(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const errors: string[] = [];
const advisories: string[] = [];
let pinned = 0;
let scanned = 0;

for (const file of walk(root)) {
  const rel = relative(root, file);
  const html = readFileSync(file, "utf8");
  scanned++;

  // Match a whole <script ...> open tag so attributes on following lines are captured.
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = m[1];
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch) continue; // inline script
    const src = srcMatch[1];
    if (!/^https?:\/\//i.test(src)) continue; // same-origin / relative

    const host = new URL(src).host;
    const line = html.slice(0, m.index).split("\n").length;

    if (host in UNPINNABLE) {
      advisories.push(`${rel}:${line} ${host} — ${UNPINNABLE[host]}`);
      continue;
    }

    if (!/\bintegrity\s*=\s*["']sha(?:256|384|512)-/i.test(attrs)) {
      errors.push(`${rel}:${line} missing integrity= on ${src}`);
      continue;
    }
    // SRI is not enforced on a cross-origin request without CORS.
    if (!/\bcrossorigin\s*=/i.test(attrs)) {
      errors.push(
        `${rel}:${line} has integrity= but no crossorigin= (SRI is not enforced) on ${src}`,
      );
      continue;
    }
    pinned++;

    const pkg = src.match(/\/npm\/((?:@[^/]+\/)?[^@/]+)@([0-9][^/]*)\//);
    if (pkg) {
      const rule = MIN_VERSIONS[pkg[1]];
      if (rule && cmpVersion(pkg[2], rule.min) < 0) {
        errors.push(
          `${rel}:${line} ${pkg[1]}@${pkg[2]} is below the required ${rule.min} — ${rule.why}`,
        );
      }
    }
  }
}

for (const a of advisories) console.log(`  advisory: ${a}`);
if (errors.length) {
  console.error(`\ncheck-sri FAILED — ${errors.length} issue(s):`);
  for (const e of errors) console.error(`  ${e}`);
  console.error(
    "\nRegenerate a hash with:\n  curl -sS <url> | openssl dgst -sha384 -binary | openssl base64 -A",
  );
  process.exit(1);
}
if (strict && advisories.length) {
  console.error(
    `\ncheck-sri --strict: ${advisories.length} unpinnable script(s) present.`,
  );
  process.exit(1);
}
console.log(
  `check-sri OK (${scanned} HTML file(s), ${pinned} SRI-pinned script(s), ${advisories.length} advisory)`,
);
