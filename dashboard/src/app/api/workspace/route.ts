import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  defaultWorkspaceData,
  WorkspaceDataSchema,
} from "@/lib/workspace-data";
import { getDashboardDataDirectory } from "@/server/env";

const FILE = "workspace.json";

export const runtime = "nodejs";

async function readWorkspace(): Promise<ReturnType<typeof defaultWorkspaceData>> {
  const dir = getDashboardDataDirectory();
  const path = join(dir, FILE);
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const result = WorkspaceDataSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  } catch {
    // missing or invalid
  }
  return defaultWorkspaceData();
}

export async function GET(): Promise<Response> {
  const data = await readWorkspace();
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = WorkspaceDataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workspace payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const dir = getDashboardDataDirectory();
  await mkdir(dir, { recursive: true });
  const path = join(dir, FILE);
  await writeFile(path, `${JSON.stringify(parsed.data, null, 2)}\n`, "utf8");
  return NextResponse.json({ ok: true });
}
