"use client";

import { useEffect, useState } from "react";

import type { SkillCatalogEntry } from "@/lib/skills-catalog";

export type SkillCatalogFetchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; generatedAt: string; skills: SkillCatalogEntry[] };

/**
 * Shared `/api/skills/catalog` fetch, used by both the `/skills` page and `SkillPicker`.
 * They used to each implement this independently with two different state shapes:
 * `/skills` correctly modeled `{loading|error|ok}` as a union, while `SkillPicker` used two
 * independent fields (`skills` defaulting to `[]`, `loadError: string|null`) that couldn't
 * distinguish "still loading" from "loaded, catalog empty."
 */
export function useSkillCatalog(): SkillCatalogFetchState {
  const [state, setState] = useState<SkillCatalogFetchState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/skills/catalog", { credentials: "include" })
      .then(async (res) => {
        const body = (await res.json()) as {
          skills?: SkillCatalogEntry[];
          generatedAt?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !body.skills) {
          setState({ status: "error", message: body.error ?? `HTTP ${res.status}` });
          return;
        }
        setState({ status: "ok", generatedAt: body.generatedAt ?? "", skills: body.skills });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState({ status: "error", message: e instanceof Error ? e.message : "Network error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
