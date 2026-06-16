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
  buildSkillRecords,
  buildSkillsPayload,
  parseFrontmatter,
  walkAllMarkdownUnderSkills,
} from "./docs-data-shared.ts";
import { patchDocsIndexPngBranding } from "./docs-index-png-branding.ts";

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
  const records = await buildSkillRecords(REPO_ROOT, SKILLS_ROOT);
  const payload = buildSkillsPayload(records);

  const skillHtml: Record<string, string> = {};
  for (const s of records) {
    const abs = join(REPO_ROOT, s.relPath);
    const raw = await readFile(abs, "utf8");
    const { rest } = parseFrontmatter(raw);
    skillHtml[s.relPath] = markdownToSafeHtml(rest);
  }

  const mdByRelPath: Record<string, string> = {};
  const allMdAbs = await walkAllMarkdownUnderSkills(SKILLS_ROOT);
  for (const abs of allMdAbs.sort()) {
    const rel = relative(REPO_ROOT, abs).split("\\").join("/");
    const text = await readFile(abs, "utf8");
    mdByRelPath[rel] = text;
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
  let indexHtml = await patchDocsIndexPngBranding(await readFile(INDEX_FILE, "utf8"), REPO_ROOT);

  indexHtml = indexHtml.replace(
    /<link rel="stylesheet" href="\.\/docs\.css" \/>/,
    `<style>\n${css}\n    </style>`,
  );

  const embedPayload = jsonForInlineScript(payload);
  const embedSkillHtml = jsonForInlineScript(skillHtml);
  const embedMdMap = jsonForInlineScript(mdByRelPath);

  const bootstrapScript = [
    "(function () {",
    '  function parseJsonScript(id) {',
    "    var el = document.getElementById(id);",
    "    if (!el) return null;",
    "    try {",
    '      return JSON.parse(el.textContent || "null");',
    "    } catch (e) {",
    "      return null;",
    "    }",
    "  }",
    '  var payload = parseJsonScript("jstack-skills-payload");',
    "  if (payload) window.__JSTACK_SKILLS__ = payload;",
    '  var skillHtml = parseJsonScript("jstack-skill-html");',
    "  if (skillHtml) window.__JSTACK_SKILL_HTML__ = skillHtml;",
    '  var mdMap = parseJsonScript("jstack-md-by-relpath");',
    "  if (mdMap) window.__JSTACK_MD_BY_RELPATH__ = mdMap;",
    "})();",
  ].join("\n");
  const indentedBootstrap = bootstrapScript.split("\n").join("\n      ");

  const i0 = indexHtml.indexOf(INDEX_SKILLS_BEGIN);
  const i1 = indexHtml.indexOf(INDEX_SKILLS_END);
  if (i0 === -1 || i1 === -1 || i1 < i0) {
    throw new Error(`index.html must contain skills data markers.`);
  }
  const i1End = i1 + INDEX_SKILLS_END.length;
  const afterMarkers = indexHtml.slice(i1End);
  const moduleScriptsRemoved = afterMarkers
    .replace(/\s*<script type="module" src="\.\/docs\.js"><\/script>\s*/, "\n")
    .replace(/\s*<script type="module" src="\.\/md-preview\.js"><\/script>\s*/, "\n");

  const newBlock = [
    INDEX_SKILLS_BEGIN,
    `    <script type="application/json" id="jstack-skills-payload">${embedPayload}</script>`,
    `    <script type="application/json" id="jstack-skill-html">${embedSkillHtml}</script>`,
    `    <script type="application/json" id="jstack-md-by-relpath">${embedMdMap}</script>`,
    "    <script>",
    `      ${indentedBootstrap}`,
    "    </script>",
    INDEX_SKILLS_END,
  ].join("\n");

  const beforeMarkers = indexHtml.slice(0, i0);
  const mergedMiddle = beforeMarkers + newBlock + moduleScriptsRemoved;
  const finalHtml = mergedMiddle.replace(
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
