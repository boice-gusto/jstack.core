"use client";

import { useMemo, useState, type ReactElement } from "react";

import { useSkillCatalog } from "@/lib/use-skill-catalog";

export default function SkillsPage(): ReactElement {
  const state = useSkillCatalog();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (state.status !== "ok") return [];
    const q = query.trim().toLowerCase();
    if (!q) return state.skills;
    return state.skills.filter(
      (s) =>
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        (s.category ?? "").toLowerCase().includes(q) ||
        (s.relPath ?? "").toLowerCase().includes(q),
    );
  }, [state, query]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-8">
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Skills</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real data from this repo&apos;s <code>skill-catalog.json</code> — not a mock.
          {state.status === "ok" && state.generatedAt
            ? ` Generated ${new Date(state.generatedAt).toLocaleString()}.`
            : ""}
        </p>
      </div>

      {state.status === "loading" && (
        <p className="text-sm text-muted-foreground">Loading real skill catalog…</p>
      )}

      {state.status === "error" && (
        <p className="text-sm text-destructive">Could not load skills: {state.message}</p>
      )}

      {state.status === "ok" && (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${state.skills.length} skills by name, category, or description…`}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills match &quot;{query}&quot;.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Skill</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{s.name ?? s.id}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                          {s.category ?? "uncategorized"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{s.description ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
