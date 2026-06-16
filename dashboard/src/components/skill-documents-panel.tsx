"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { ChatMarkdown } from "@/components/chat-markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DocumentRow = {
  relPath: string;
  title: string;
  markdown: string;
};

export function SkillDocumentsPanel({
  skillId,
  className,
}: {
  skillId: string;
  className?: string;
}): ReactElement | null {
  const [documents, setDocuments] = useState<DocumentRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  function setAllDetailsOpen(open: boolean): void {
    const root = listRef.current;
    if (root === null) {
      return;
    }
    root.querySelectorAll("details").forEach((el) => {
      el.open = open;
    });
  }

  useEffect(() => {
    const trimmed = skillId.trim();
    if (trimmed.length === 0) {
      setDocuments(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/skills/${encodeURIComponent(trimmed)}/documents`, {
          credentials: "include",
        });
        const json = (await res.json()) as {
          documents?: DocumentRow[];
          error?: string;
        };
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setLoadError(json.error ?? res.statusText);
          setDocuments(null);
          return;
        }
        setLoadError(null);
        setDocuments(json.documents ?? []);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load skill docs");
          setDocuments(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [skillId]);

  if (skillId.trim().length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2 rounded-lg border border-border bg-muted/20 p-3", className)}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Skill documents
      </div>
      {loadError !== null ? (
        <p className="m-0 text-xs text-destructive">{loadError}</p>
      ) : documents === null ? (
        <div className="space-y-2" aria-busy="true">
          <div className="h-9 animate-pulse rounded-md bg-muted/60" />
          <div className="h-9 animate-pulse rounded-md bg-muted/40" />
          <div className="h-9 animate-pulse rounded-md bg-muted/30" />
          <p className="m-0 text-[0.65rem] text-muted-foreground">Loading skill markdown…</p>
        </div>
      ) : documents.length === 0 ? (
        <p className="m-0 text-xs text-muted-foreground">
          No markdown files found for this skill. Try another id or add SKILL.md under the skill folder.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setAllDetailsOpen(true)}>
              Expand all
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAllDetailsOpen(false)}>
              Collapse all
            </Button>
          </div>
          <div ref={listRef} className="space-y-2">
            {documents.map((doc, i) => (
              <details
                key={doc.relPath}
                className="rounded-md border border-border bg-card"
                open={i === 0}
              >
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-foreground">
                  {doc.title}
                </summary>
                <div className="border-t border-border px-3 py-2 text-sm">
                  <ChatMarkdown content={doc.markdown} />
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
