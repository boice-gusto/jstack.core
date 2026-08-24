import { NextResponse } from "next/server";

import { loadSkillCatalogRaw } from "@/lib/skills-catalog";
import { getJstackCoreRoot } from "@/server/env";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const { generatedAt, count, skills } = loadSkillCatalogRaw();
    const root = getJstackCoreRoot();
    const rootPrefix = root.endsWith("/") ? root : `${root}/`;
    const payload = skills.map((s) => ({
      id: s.id,
      name: s.name,
      path: s.path,
      relPath: s.relPath,
      gateId: s.gateId,
      description: s.description,
      whenToUse: s.whenToUse,
      category: s.category,
      categoryKey: s.categoryKey,
      schemaPaths: s.schemaPaths.map((p) => (p.startsWith(rootPrefix) ? p.slice(rootPrefix.length) : p)),
    }));
    return NextResponse.json({ generatedAt, count, skills: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load catalog";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
