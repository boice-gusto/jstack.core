/**
 * Single source of truth for the dashboard's route list. `app-sidebar.tsx`'s nav and
 * `page.tsx`'s home area cards used to each maintain their own copy of this same route set,
 * with different shapes (`stub?: boolean` vs `status: "live" | "stub"`) -- they had already
 * drifted (`/jira` was labeled "JIRA" in one and "Jira" in the other).
 */
export interface RouteEntry {
  href: string;
  label: string;
  status: "live" | "stub";
  /** Shown on the home page's route cards; unused by the sidebar. */
  detail: string;
}

export const ROUTES: RouteEntry[] = [
  {
    href: "/",
    label: "Home",
    status: "live",
    detail: "Dashboard overview and route index.",
  },
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
  { href: "/incidents", label: "Incidents", status: "stub", detail: "Placeholder." },
  {
    href: "/routines",
    label: "Routines",
    status: "stub",
    detail: "Placeholder; schedules live in jstack config + CLI.",
  },
  { href: "/metrics", label: "Metrics", status: "stub", detail: "Placeholder." },
  { href: "/self", label: "Self", status: "stub", detail: "Placeholder." },
  {
    href: "/jira",
    label: "Jira",
    status: "stub",
    detail: "Placeholder; Jira skills use MCP in Cursor / Claude Code.",
  },
  { href: "/notion", label: "Notion", status: "stub", detail: "Placeholder." },
  { href: "/research", label: "Research", status: "stub", detail: "Placeholder." },
  { href: "/meetings", label: "Meetings", status: "stub", detail: "Placeholder." },
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
