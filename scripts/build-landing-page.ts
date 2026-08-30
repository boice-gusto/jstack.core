/**
 * Emit a single self-contained docs/index.html for GitHub Pages (no extra assets, no fetch for SKILL.md).
 */
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import {
  buildInlineJsonMarkerBlock,
  buildSkillRecords,
  buildSkillsPayload,
  parseFrontmatter,
  walkAllMarkdownUnderSkills,
} from "./docs-data-shared.ts";
import {
  patchDocsIndexPngBranding,
  replaceBetweenMarkerPair,
} from "./docs-index-png-branding.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SKILLS_ROOT = join(REPO_ROOT, "skills");
const INDEX_FILE = join(REPO_ROOT, "index.html");
const CSS_FILE = join(REPO_ROOT, "docs.css");
const OUT_DIR = join(REPO_ROOT, "docs");
const OUT_FILE = join(OUT_DIR, "index.html");
const BUNDLE_ENTRY = join(REPO_ROOT, "docs-landing-entry.js");
const TEMP_BUNDLE = join(REPO_ROOT, ".docs-landing-bundle.js");

const INDEX_SKILLS_BEGIN = "<!-- jstack:generated-skills-data -->";
const INDEX_SKILLS_END = "<!-- /jstack:generated-skills-data -->";

marked.setOptions({ gfm: true, breaks: false });

function markdownToSafeHtml(markdown: string): string {
  const raw = marked.parse(markdown) as string;
  return DOMPurify.sanitize(raw);
}

function jsonForInlineScript(obj: unknown): string {
  return JSON.stringify(obj).replaceAll("<", "\\u003c");
}

async function main(): Promise<void> {
  // Read every markdown file under skills/ exactly once, keyed the same way
  // `buildSkillRecords`/`s.relPath` key it, so nothing downstream re-reads a file already in
  // memory. Previously each SKILL.md was read up to 3x per run: once here (then, before this
  // fix, again inside buildSkillRecords, and again in the skillHtml loop below).
  const mdByRelPath: Record<string, string> = {};
  const allMdAbs = await walkAllMarkdownUnderSkills(SKILLS_ROOT);
  for (const abs of allMdAbs.sort()) {
    const rel = relative(REPO_ROOT, abs).split("\\").join("/");
    mdByRelPath[rel] = await readFile(abs, "utf8");
  }
  const readCached = async (abs: string): Promise<string> => {
    const rel = relative(REPO_ROOT, abs).split("\\").join("/");
    return mdByRelPath[rel] ?? (await readFile(abs, "utf8"));
  };
  // Derived from the walk above instead of a second, near-identical tree walk inside
  // buildSkillRecords -- SKILL.md is exactly the .md files whose basename matches.
  const skillMdAbs = allMdAbs.filter((abs) => abs.endsWith("/SKILL.md"));

  const records = await buildSkillRecords(
    REPO_ROOT,
    SKILLS_ROOT,
    readCached,
    skillMdAbs,
  );
  const payload = buildSkillsPayload(records);

  const skillHtml: Record<string, string> = {};
  for (const s of records) {
    const raw = await readCached(join(REPO_ROOT, s.relPath));
    const { rest } = parseFrontmatter(raw);
    skillHtml[s.relPath] = markdownToSafeHtml(rest);
  }

  const markdownBundledAbs = join(REPO_ROOT, "markdown-render-bundled.js");
  await esbuild.build({
    absWorkingDir: REPO_ROOT,
    entryPoints: [BUNDLE_ENTRY],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2022"],
    outfile: TEMP_BUNDLE,
    plugins: [
      {
        name: "alias-markdown-render",
        setup(build) {
          build.onResolve({ filter: /^\.\/markdown-render\.js$/ }, () => ({
            path: markdownBundledAbs,
          }));
        },
      },
    ],
    logLevel: "warning",
  });

  const bundleJs = await readFile(TEMP_BUNDLE, "utf8");
  await unlink(TEMP_BUNDLE);

  const css = await readFile(CSS_FILE, "utf8");
  let indexHtml = await patchDocsIndexPngBranding(
    await readFile(INDEX_FILE, "utf8"),
    REPO_ROOT,
  );

  indexHtml = indexHtml.replace(
    /<link rel="stylesheet" href="\.\/docs\.css" \/>/,
    `<style>\n${css}\n    </style>`,
  );

  const innerBetweenMarkers =
    "\n" +
    buildInlineJsonMarkerBlock([
      {
        scriptId: "jstack-skills-payload",
        globalName: "__JSTACK_SKILLS__",
        varName: "payload",
        json: jsonForInlineScript(payload),
      },
      {
        scriptId: "jstack-skill-html",
        globalName: "__JSTACK_SKILL_HTML__",
        varName: "skillHtml",
        json: jsonForInlineScript(skillHtml),
      },
      {
        scriptId: "jstack-md-by-relpath",
        globalName: "__JSTACK_MD_BY_RELPATH__",
        varName: "mdMap",
        json: jsonForInlineScript(mdByRelPath),
      },
    ]) +
    "\n";
  const splicedHtml = replaceBetweenMarkerPair(
    indexHtml,
    INDEX_SKILLS_BEGIN,
    INDEX_SKILLS_END,
    innerBetweenMarkers,
  );
  // The single-file build inlines the bundled JS below instead of fetching docs.js/md-preview.js
  // as separate module scripts -- both module-script tags live after the marker pair (untouched
  // by the splice above), so removing them here is independent of it.
  const moduleScriptsRemoved = splicedHtml
    .replace(/\s*<script type="module" src="\.\/docs\.js"><\/script>\s*/, "\n")
    .replace(
      /\s*<script type="module" src="\.\/md-preview\.js"><\/script>\s*/,
      "\n",
    );

  const finalHtml = moduleScriptsRemoved.replace(
    "</body>",
    `    <script>\n${bundleJs}\n    </script>\n  </body>`,
  );

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, finalHtml, "utf8");
  console.log(
    `Wrote ${OUT_FILE} (${records.length} skills, ${Object.keys(mdByRelPath).length} markdown files inlined)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
