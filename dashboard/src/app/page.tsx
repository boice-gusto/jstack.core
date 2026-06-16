import Link from "next/link";

import { HomeAreaList, type AreaRow } from "@/components/home-area-list";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { readJstackConfig } from "@/lib/config-reader";
import { cn } from "@/lib/utils";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object";
}

function teamNameFromConfig(cfg: unknown): string | null {
  if (!isRecord(cfg)) return null;
  const team = cfg["team"];
  if (!isRecord(team)) return null;
  const name = team["name"];
  return typeof name === "string" ? name : null;
}

const areas: AreaRow[] = [
  {
    href: "/agent",
    label: "Agent",
    status: "live",
    detail:
      "Freeform messages + run; pick a skill, optional structured JSON, sparklines. Contrast with Wizard (fixed steps).",
  },
  {
    href: "/wizard",
    label: "Wizard",
    status: "live",
    detail:
      "Three guided steps (fixed prompts + optional per-step notes); not freeform chat — use Agent for that. Transcript carries across steps.",
  },
  {
    href: "/workspace",
    label: "Workspace",
    status: "live",
    detail: "BSA / TEAM / IC tabs: PRD, plan, sprint, and focus — Zod-validated JSON on the server.",
  },
  {
    href: "/reports",
    label: "Reports",
    status: "live",
    detail:
      "Renders jstack report JSON (markdown + optional charts) from the repo sample or a built-in example.",
  },
  {
    href: "/sprint",
    label: "Sprint",
    status: "stub",
    detail: "Placeholder; use jstack skills + Notion/Jira in the agent host.",
  },
  {
    href: "/recon",
    label: "Recon",
    status: "stub",
    detail: "Placeholder; recon skill runs in the CLI / agent.",
  },
  {
    href: "/incidents",
    label: "Incidents",
    status: "stub",
    detail: "Placeholder.",
  },
  {
    href: "/routines",
    label: "Routines",
    status: "stub",
    detail: "Placeholder; schedules live in jstack config + CLI.",
  },
  {
    href: "/metrics",
    label: "Metrics",
    status: "stub",
    detail: "Placeholder.",
  },
  {
    href: "/self",
    label: "Self",
    status: "stub",
    detail: "Placeholder.",
  },
  {
    href: "/jira",
    label: "Jira",
    status: "stub",
    detail: "Placeholder; Jira skills use MCP in Cursor / Claude Code.",
  },
  {
    href: "/notion",
    label: "Notion",
    status: "stub",
    detail: "Placeholder.",
  },
  {
    href: "/research",
    label: "Research",
    status: "stub",
    detail: "Placeholder.",
  },
  {
    href: "/meetings",
    label: "Meetings",
    status: "stub",
    detail: "Placeholder.",
  },
  {
    href: "/workflows",
    label: "Workflows",
    status: "stub",
    detail: "Placeholder; use jstack workflow in the terminal.",
  },
  {
    href: "/settings",
    label: "Settings",
    status: "stub",
    detail: "Placeholder; primary config is jstack.config.json at the core package root.",
  },
];

export default function Page() {
  const cfg = readJstackConfig(process.cwd());
  const team = teamNameFromConfig(cfg) ?? (cfg === null ? null : "not set");
  const configPath = "jstack.core/jstack.config.json (sibling of dashboard when run from this package)";

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section id="overview" className="scroll-mt-24 space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">jstack web preview</h1>
        <p className="text-pretty text-muted-foreground">
          This app is a small browser shell around the jstack workspace. Most work happens in the{" "}
          <strong className="font-medium text-foreground">CLI and agent skills</strong> (MCP,{" "}
          <code className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
            jstack
          </code>{" "}
          commands). Here you mainly get a{" "}
          <strong className="font-medium text-foreground">report payload preview</strong> so you can check layouts
          and charts before shipping HTML or JSON elsewhere.
        </p>
      </section>

      <section id="command-center" className="scroll-mt-24 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Command center</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-primary/25 bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Agent</CardTitle>
              <CardDescription>
                Freeform messages and runs; skills, optional JSON, tool timeline. Use Wizard for fixed steps.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/agent" className={cn(buttonVariants())}>
                Open Agent
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Wizard</CardTitle>
              <CardDescription>
                Three guided steps with optional per-step notes; not freeform chat. Context carries between steps.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/wizard" className={cn(buttonVariants({ variant: "outline" }))}>
                Open Wizard
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Workspace</CardTitle>
              <CardDescription>Product surfaces: plan/spec, sprint, personal focus.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/workspace" className={cn(buttonVariants({ variant: "outline" }))}>
                Open Workspace
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="start" className="scroll-mt-24">
        <Card className="border-primary/25 bg-card">
          <CardHeader>
            <CardTitle>Start here: report preview</CardTitle>
            <CardDescription>
              Live renderer for the v1 report schema (sections, links, optional Chart.js blocks).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/reports" className={cn(buttonVariants())}>
              Open Reports
            </Link>
          </CardContent>
        </Card>
      </section>

      <section id="workspace" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Workspace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <dl className="m-0 space-y-2">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-muted-foreground">Config</dt>
                <dd className="m-0 text-foreground">
                  {cfg === null
                    ? "Not found — run the dev server from jstack.core/dashboard"
                    : "Loaded"}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-muted-foreground">Expected file</dt>
                <dd className="m-0 font-mono text-xs text-muted-foreground">{configPath}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-muted-foreground">Team</dt>
                <dd className="m-0 text-foreground">{team ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>

      <section id="all-routes" className="scroll-mt-24 space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">All routes</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-primary">Live</span> = interactive preview.{" "}
            <span className="font-medium text-muted-foreground">Stub</span> = static placeholder until wire-up. Use
            the header filter on this page to narrow the list.
          </p>
        </div>
        <HomeAreaList areas={areas} />
      </section>
    </div>
  );
}
