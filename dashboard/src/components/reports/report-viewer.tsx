import { Calendar, ExternalLink, FileText } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { REPORT_KINDS, type ReportKind, type ReportPayload } from "@jstack/types/report-payload-v1";

import { ReportChartBlock } from "./report-chart-block";
import { ReportMarkdown } from "./report-markdown";

function kindLabel(kind: ReportKind | undefined): string {
  if (!kind) {
    return "Report";
  }
  const map: Record<ReportKind, string> = {
    "team-weekly": "Team weekly",
    "engineer-weekly": "Engineer weekly",
    "manager-rollup": "Manager rollup",
    "project-status": "Project status",
    "sprint-summary": "Sprint summary",
    "incident-retro": "Incident retro",
    "eval-report": "Evaluation",
    "self-report": "Self report",
    generic: "Report",
  };
  return map[kind] ?? "Report";
}

export function ReportViewer({ data }: { data: ReportPayload }): ReactNode {
  const { meta, sections, links } = data;
  const kind = (meta as { report_kind?: ReportKind }).report_kind;
  const subtitle = (meta as { subtitle?: string }).subtitle;
  const team = (meta as { team?: string }).team;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {kind && REPORT_KINDS.includes(kind) ? (
            <Badge variant="secondary" className="font-medium">
              {kindLabel(kind)}
            </Badge>
          ) : null}
          {team ? (
            <span className="text-sm text-muted-foreground"> · {team}</span>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{meta.title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="size-3.5 shrink-0" aria-hidden />
          <time dateTime={meta.generated_at}>{meta.generated_at}</time>
        </div>
        <Separator />
      </header>

      <div className="space-y-4">
        {(sections ?? []).map((s, i) => (
          <Card key={s.id ?? `section-${i}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="size-4 shrink-0" aria-hidden />
                <CardTitle>{s.title || s.id || "Section"}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {s.chart != null ? <ReportChartBlock chart={s.chart} /> : null}
              {s.body_markdown != null && s.body_markdown.trim().length > 0 ? (
                <ReportMarkdown>{s.body_markdown.trim()}</ReportMarkdown>
              ) : s.chart == null ? (
                <ReportMarkdown>_No content._</ReportMarkdown>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {links && links.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Links</CardTitle>
            <CardDescription>Reference URLs included with this report.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {links.map((l, i) => (
                <li key={`${l.url}-${i}`} className="flex items-center gap-2 text-sm">
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <a
                    href={l.url ?? "#"}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {l.label?.trim() || l.url}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <footer className="border-t pt-6 text-center text-sm text-muted-foreground">
        This report is confidential and for the named engineer only
      </footer>
    </div>
  );
}
