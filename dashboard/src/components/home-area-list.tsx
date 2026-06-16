"use client";

import Link from "next/link";

import { useRouteFilter } from "@/components/route-filter-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AreaRow = {
  href: string;
  label: string;
  status: "live" | "stub";
  detail: string;
};

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

export function HomeAreaList({ areas }: { areas: AreaRow[] }) {
  const { query } = useRouteFilter();
  const q = normalize(query);
  const filtered =
    q === ""
      ? areas
      : areas.filter(
          (a) =>
            normalize(a.label).includes(q) ||
            normalize(a.href).includes(q) ||
            normalize(a.detail).includes(q),
        );

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {filtered.map((row) => (
        <li key={row.href}>
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base">
                  <Link
                    href={row.href}
                    className="text-primary no-underline hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {row.label}
                  </Link>
                </CardTitle>
                <CardDescription className="text-pretty">{row.detail}</CardDescription>
              </div>
              <Badge
                variant={row.status === "live" ? "default" : "secondary"}
                className={cn(
                  "shrink-0",
                  row.status === "live" && "border-transparent bg-primary/15 text-primary",
                  row.status === "stub" && "border-border bg-muted text-muted-foreground",
                )}
              >
                {row.status === "live" ? "Live" : "Stub"}
              </Badge>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="font-mono text-xs text-muted-foreground">{row.href}</p>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
