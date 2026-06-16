import { NextResponse } from "next/server";

import { loadSkillCatalog } from "@/lib/skills-catalog";
import { getJstackCoreRoot } from "@/server/env";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const skills = loadSkillCatalog();
    const root = getJstackCoreRoot();
    const rootPrefix = root.endsWith("/") ? root : `${root}/`;
    const payload = skills.map((s) => ({
      id: s.id,
      name: s.name,
      path: s.path,
      relPath: s.relPath,
      gateId: s.gateId,
      description: s.description,
      category: s.category,
      schemaPaths: s.schemaPaths.map((p) => (p.startsWith(rootPrefix) ? p.slice(rootPrefix.length) : p)),
    }));
    return NextResponse.json({ skills: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load catalog";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
