#!/usr/bin/env bun
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  CONFIG_DIR,
  DEFAULTS_FILE,
  ENCODING_UTF8,
  JSTACK_CONFIG_FILE,
} from "../constants/paths.js";

const root = process.cwd();
const cfgPath = join(root, JSTACK_CONFIG_FILE);
const defaultsPath = join(root, CONFIG_DIR, DEFAULTS_FILE);

if (!existsSync(cfgPath)) {
  console.error("Missing jstack.config.json (optional for CI — copy from config/templates)");
  process.exit(0);
}

const cfg = JSON.parse(readFileSync(cfgPath, ENCODING_UTF8));
const defaults = existsSync(defaultsPath)
  ? JSON.parse(readFileSync(defaultsPath, ENCODING_UTF8))
  : {};

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function merge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (isObject(v) && isObject(out[k] as unknown)) {
      out[k] = merge(out[k] as Record<string, unknown>, v);
    } else if (!(k in out)) {
      out[k] = v;
    }
  }
  return out;
}

const merged = merge(defaults as Record<string, unknown>, cfg as Record<string, unknown>);
console.log("OK keys:", Object.keys(merged).sort().join(", "));

const strictIntegrations = process.env.JSTACK_STRICT_INTEGRATIONS === "1";

const integrationChecks: Record<string, () => boolean> = {
  jira: () => {
    const j = (merged.integrations as Record<string, unknown> | undefined)?.jira as
      | Record<string, unknown>
      | undefined;
    return Boolean(j?.base_url && String(j.base_url).trim() !== "");
  },
  slack: () => {
    const s = (merged.integrations as Record<string, unknown> | undefined)?.slack as
      | Record<string, unknown>
      | undefined;
    const pub = s?.public_channel != null && String(s.public_channel).trim() !== "";
    const priv = s?.private_channel != null && String(s.private_channel).trim() !== "";
    const hook = s?.webhook_url != null && String(s.webhook_url).trim() !== "";
    return pub || priv || hook;
  },
  notion: () => {
    const n = (merged.integrations as Record<string, unknown> | undefined)?.notion as
      | Record<string, unknown>
      | undefined;
    return Boolean(n?.workspace_id && String(n.workspace_id).trim() !== "");
  },
  github: () => {
    const g = (merged.integrations as Record<string, unknown> | undefined)?.github as
      | Record<string, unknown>
      | undefined;
    const org = g?.org != null && String(g.org).trim() !== "";
    const repo = g?.default_repo != null && String(g.default_repo).trim() !== "";
    return org || repo;
  },
  gcal: () => {
    const c = (merged.integrations as Record<string, unknown> | undefined)?.gcal as
      | Record<string, unknown>
      | undefined;
    return Boolean(c?.primary_calendar_id && String(c.primary_calendar_id).trim() !== "");
  },
  sheets: () => {
    const sh = (merged.integrations as Record<string, unknown> | undefined)?.sheets as
      | Record<string, unknown>
      | undefined;
    return Boolean(sh?.default_spreadsheet_id && String(sh.default_spreadsheet_id).trim() !== "");
  },
  gbrain_team: () => {
    const t = (merged.gbrain as Record<string, unknown> | undefined)?.team as
      | Record<string, unknown>
      | undefined;
    return Boolean(t?.url && String(t.url).trim() !== "");
  },
  gbrain_personal: () => {
    const p = (merged.gbrain as Record<string, unknown> | undefined)?.personal as
      | Record<string, unknown>
      | undefined;
    return Boolean(p?.url && String(p.url).trim() !== "");
  },
};

const onboarding = merged.onboarding as Record<string, unknown> | undefined;
const required = onboarding?.required_integrations;
if (Array.isArray(required) && required.length > 0) {
  const unknown: string[] = [];
  const missing: string[] = [];
  for (const raw of required) {
    if (typeof raw !== "string" || raw.trim() === "") {
      continue;
    }
    const id = raw.trim();
    const check = integrationChecks[id];
    if (check === undefined) {
      unknown.push(id);
      continue;
    }
    if (!check()) {
      missing.push(id);
    }
  }
  for (const id of unknown) {
    console.warn(
      `onboarding.required_integrations: unknown id "${id}" — supported: ${Object.keys(integrationChecks).join(", ")}`,
    );
  }
  for (const id of missing) {
    const msg = `onboarding.required_integrations: "${id}" is listed but the corresponding config looks empty`;
    if (strictIntegrations) {
      console.error(msg);
    } else {
      console.warn(msg);
    }
  }
  if (strictIntegrations && missing.length > 0) {
    process.exit(1);
  }
}

const cross = merged.cross_plugins as Record<string, unknown> | undefined;
const gb = cross?.gbrain as Record<string, unknown> | undefined;
if (gb?.enabled === true) {
  const skills = gb.skills as unknown;
  if (!Array.isArray(skills) || skills.length === 0) {
    console.error("cross_plugins.gbrain.enabled is true but skills[] is empty — add expected skill ids or disable.");
    process.exit(1);
  }
  console.log(`OK cross_plugins.gbrain: ${skills.length} expected skill id(s)`);
}
