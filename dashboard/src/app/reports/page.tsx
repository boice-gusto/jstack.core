import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ReportViewer } from "@/components/reports/report-viewer";
import { Section } from "@/components/section";
import {
  type ReportPayload,
  safeParseReportPayload,
} from "@jstack/types/report-payload-v1";

const samplePayload: ReportPayload = {
  schema_version: 1,
  meta: {
    title: "Team weekly — Core platform",
    generated_at: "2026-04-27T12:00:00Z",
    team: "Core platform",
    report_kind: "team-weekly",
    subtitle: "Week of 2026-04-21",
  },
  sections: [
    {
      id: "highlights",
      title: "Highlights",
      body_markdown:
        "- Shipped **auth hardening** behind the feature flag; zero Sev1.\n- **On-call** was quiet; one P3 rolled to next week.",
    },
    {
      id: "risks",
      title: "Risks",
      body_markdown:
        "- **Dependency** X may ship a breaking API in June — owner tracking vendor RFC.\n- **Capacity:** two engineers OOO; net-new scope frozen through Friday.",
    },
    {
      id: "throughput",
      title: "Merge throughput",
      body_markdown: "Sustained increase after CI cache fix in week 2.",
      chart: {
        type: "bar",
        title: "Merged PRs per week",
        labels: ["W1", "W2", "W3", "W4"],
        datasets: [
          {
            label: "Merged",
            data: [12, 19, 15, 22],
            backgroundColor: "rgba(14, 165, 233, 0.45)",
          },
        ],
        options: { y_axis_begin_at_zero: true },
      },
    },
    {
      id: "next",
      title: "Next week focus",
      body_markdown:
        "1. Roll feature flag to 10% canary with kill switch verified.\n2. Pair on runbook for dependency migration (see Links).",
    },
  ],
  links: [{ label: "Sprint board", url: "https://example.com/board" }],
};

async function tryLoadExampleFromRepo(): Promise<ReportPayload> {
  try {
    const p = join(process.cwd(), "..", "templates", "reports", "examples", "sample-payload.json");
    const raw = await readFile(p, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const r = safeParseReportPayload(parsed);
    if (r.success) {
      return r.data;
    }
  } catch {
    // Dev server CWD or missing file — use inline sample
  }
  return samplePayload;
}

export default async function ReportsPage() {
  const data = await tryLoadExampleFromRepo();

  return (
    <Section title="Reports">
      <p className="mb-6 max-w-2xl text-slate-400">
        Rich preview uses the shared{" "}
        <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">
          ReportPayload
        </code>{" "}
        type (Zod) and shadcn-style cards. Run{" "}
        <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">
          jstack report render
        </code>{" "}
        for a static HTML artifact; see <span className="text-slate-200">templates/reports/AUTHORING.md</span>{" "}
        for writing markdown sections.
      </p>
      <div className="rounded-xl border border-slate-800 bg-[var(--card)] p-6">
        <ReportViewer data={data} />
      </div>
    </Section>
  );
}
