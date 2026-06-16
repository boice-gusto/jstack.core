"use client";

import { useEffect, useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";

type TabId = "bsa" | "team" | "ic";

export default function WorkspacePage(): ReactElement {
  const data = useWorkspaceStore((s) => s.data);
  const loaded = useWorkspaceStore((s) => s.loaded);
  const saving = useWorkspaceStore((s) => s.saving);
  const error = useWorkspaceStore((s) => s.error);
  const load = useWorkspaceStore((s) => s.load);
  const save = useWorkspaceStore((s) => s.save);
  const setBsa = useWorkspaceStore((s) => s.setBsa);
  const setTeam = useWorkspaceStore((s) => s.setTeam);
  const setIc = useWorkspaceStore((s) => s.setIc);

  const [tab, setTab] = useState<TabId>("bsa");

  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            BSA (plan/spec/PRD), team sprint notes, and IC focus — persisted as JSON under the server data directory.
          </p>
        </div>
        <Button type="button" disabled={saving || !loaded} onClick={() => void save()}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {error !== null ? <p className="m-0 text-sm text-destructive">{error}</p> : null}
      {!loaded ? <p className="m-0 text-sm text-muted-foreground">Loading workspace…</p> : null}

      <div className="flex gap-1 border-b border-border">
        {(
          [
            ["bsa", "BSA"],
            ["team", "Team"],
            ["ic", "IC"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "bsa" ? (
        <div className="space-y-4">
          <Field
            label="PRD"
            value={data.bsa.prd}
            onChange={(v) => setBsa("prd", v)}
            disabled={!loaded || saving}
          />
          <Field
            label="Plan"
            value={data.bsa.plan}
            onChange={(v) => setBsa("plan", v)}
            disabled={!loaded || saving}
          />
          <Field
            label="Spec"
            value={data.bsa.spec}
            onChange={(v) => setBsa("spec", v)}
            disabled={!loaded || saving}
          />
        </div>
      ) : null}

      {tab === "team" ? (
        <div className="space-y-4">
          <Field
            label="Sprint board / notes"
            value={data.team.sprint}
            onChange={(v) => setTeam("sprint", v)}
            disabled={!loaded || saving}
          />
        </div>
      ) : null}

      {tab === "ic" ? (
        <div className="space-y-4">
          <Field
            label="Personal focus"
            value={data.ic.focus}
            onChange={(v) => setIc("focus", v)}
            disabled={!loaded || saving}
          />
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}): ReactElement {
  const id = `ws-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <textarea
        id={id}
        rows={12}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
          "disabled:opacity-50",
        )}
      />
    </div>
  );
}
