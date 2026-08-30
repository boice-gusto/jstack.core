import { NextResponse } from "next/server";

import { loadSkillDocumentsById } from "@/lib/skills-catalog";

export const runtime = "nodejs";

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,190}$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const decoded = decodeURIComponent(id);
  if (!SAFE_ID.test(decoded)) {
    return NextResponse.json({ error: "Invalid skill id" }, { status: 400 });
  }
  try {
    const documents = loadSkillDocumentsById(decoded);
    if (documents === null) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }
    return NextResponse.json({ skillId: decoded, documents });
  } catch (e) {
    console.error(`GET /api/skills/${decoded}/documents failed:`, e);
    return NextResponse.json({ error: "Failed to load skill documents" }, { status: 500 });
  }
}
