/**
 * Serves the jstack.core package root over HTTP so the skills catalog and repo paths align.
 * - GET / and GET /index.html use docs/index.html when present (single-file output from `docs:build`);
 *   otherwise the root index.html (multi-file dev after `docs:generate`).
 * - All other paths resolve under the package root (README.md, skills/**, config/**, etc.).
 *
 * Usage: bun run docs:serve [--port 4173]
 * One-shot: bun run docs:preview  (build then serve)
 * Env: PORT, HOST (default 127.0.0.1)
 */
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DOCS_ROOT = resolve(REPO_ROOT, "docs");
const BAKED_INDEX = resolve(DOCS_ROOT, "index.html");
const DEV_INDEX = resolve(REPO_ROOT, "index.html");

function parsePort(): number {
  const idx = Bun.argv.indexOf("--port");
  if (idx !== -1) {
    const raw = Bun.argv[idx + 1];
    if (raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0 && n < 65536) {
        return Math.floor(n);
      }
    }
  }
  const env = process.env.PORT;
  if (env !== undefined && env !== "") {
    const n = Number(env);
    if (Number.isFinite(n) && n > 0 && n < 65536) {
      return Math.floor(n);
    }
  }
  return 4173;
}

function parseHost(): string {
  const idx = Bun.argv.indexOf("--host");
  if (idx !== -1) {
    const h = Bun.argv[idx + 1];
    if (h !== undefined && h.length > 0) {
      return h;
    }
  }
  const env = process.env.HOST;
  if (env !== undefined && env !== "") {
    return env;
  }
  return "127.0.0.1";
}

const port = parsePort();
const hostname = parseHost();

if (!existsSync(DEV_INDEX) && !existsSync(BAKED_INDEX)) {
  console.error(
    "Missing index — run: bun run docs:generate  (and optionally docs:build for single-file /)",
  );
  process.exit(1);
}

Bun.serve({
  port,
  hostname,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/" || pathname === "") {
      if (existsSync(BAKED_INDEX)) {
        const file = Bun.file(BAKED_INDEX);
        return new Response(file, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      pathname = "/index.html";
    }
    if (pathname === "/index.html" && existsSync(BAKED_INDEX)) {
      const file = Bun.file(BAKED_INDEX);
      return new Response(file, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    const rel = pathname.replace(/^\/+/, "");
    if (rel.includes("\0") || rel.includes("..")) {
      return new Response("Bad path", { status: 400 });
    }
    const candidate = resolve(REPO_ROOT, rel);
    const relToRoot = relative(REPO_ROOT, candidate);
    if (relToRoot.startsWith("..") || relToRoot === "..") {
      return new Response("Not found", { status: 404 });
    }
    const file = Bun.file(candidate);
    if (!(await file.exists())) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(file);
  },
});

console.log(`Serving ${REPO_ROOT} (package root; / → docs/index.html when built)`);
console.log(`Open http://${hostname}:${port}/`);
