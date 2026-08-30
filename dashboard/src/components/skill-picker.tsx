"use client";

import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import { cn } from "@/lib/utils";
import { useSkillCatalog } from "@/lib/use-skill-catalog";
import type { SkillCatalogEntry } from "@/lib/skills-catalog";

export type CatalogSkill = Pick<
  SkillCatalogEntry,
  "id" | "name" | "description" | "category" | "schemaPaths"
>;

const EMPTY_SKILLS: CatalogSkill[] = [];

export function SkillPicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (skillId: string) => void;
  id?: string;
}): ReactElement {
  const state = useSkillCatalog();
  const skills = state.status === "ok" ? state.skills : EMPTY_SKILLS;
  const loadError = state.status === "error" ? state.message : null;
  const [filter, setFilter] = useState("");

  const filteredSkills = useMemo(() => {
    const t = filter.trim().toLowerCase();
    if (t.length === 0) {
      return skills;
    }
    const matches = (s: CatalogSkill): boolean => {
      if (s.id.toLowerCase().includes(t)) {
        return true;
      }
      if (s.name !== undefined && s.name.toLowerCase().includes(t)) {
        return true;
      }
      if (s.description !== undefined && s.description.toLowerCase().includes(t)) {
        return true;
      }
      if (s.category !== undefined && s.category.toLowerCase().includes(t)) {
        return true;
      }
      return false;
    };
    const base = skills.filter(matches);
    const selected = skills.find((s) => s.id === value);
    if (selected !== undefined && !base.includes(selected)) {
      return [selected, ...base];
    }
    return base;
  }, [skills, filter, value]);

  return (
    <div className="space-y-2">
      <label htmlFor={id ?? "skill-picker"} className="text-xs font-medium text-muted-foreground">
        Skill (optional)
      </label>
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter catalog by id, name, description…"
        className={cn(
          "h-9 w-full max-w-md rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
        )}
        aria-label="Filter skills"
      />
      <select
        id={id ?? "skill-picker"}
        className={cn(
          "h-9 w-full max-w-md rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— None —</option>
        {filteredSkills.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name ?? s.id}
            {s.category !== undefined && s.category.length > 0 ? ` (${s.category})` : ""}
          </option>
        ))}
      </select>
      {state.status === "loading" ? (
        <p className="m-0 text-xs text-muted-foreground">Loading skill catalog…</p>
      ) : null}
      {loadError !== null ? (
        <p className="m-0 text-xs text-destructive">Catalog: {loadError}</p>
      ) : null}
      {value.trim().length > 0 ? (
        <p className="m-0 text-[0.7rem] text-muted-foreground">
          {(() => {
            const s = skills.find((x) => x.id === value);
            if (s === undefined) return null;
            return s.description ?? "";
          })()}
        </p>
      ) : null}
    </div>
  );
}
