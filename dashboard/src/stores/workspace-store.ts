import { create } from "zustand";

import type { WorkspaceData } from "@/lib/workspace-data";
import { defaultWorkspaceData } from "@/lib/workspace-data";

/** A load failure and a load-in-progress used to be two independent booleans plus a
 * nullable error string, which let the UI render "Loading…" and an error message at
 * the same time (a failed load leaves `loaded=false` forever, with no in-flight state
 * to distinguish "still loading" from "already failed"). This union makes that
 * combination unrepresentable. */
export type WorkspaceStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "load-error"; message: string }
  | { kind: "saving" }
  | { kind: "save-error"; message: string };

type WorkspaceState = {
  data: WorkspaceData;
  status: WorkspaceStatus;
  load: () => Promise<void>;
  save: () => Promise<void>;
  patch: (partial: Partial<WorkspaceData>) => void;
  setBsa: (field: keyof WorkspaceData["bsa"], value: string) => void;
  setTeam: (field: keyof WorkspaceData["team"], value: string) => void;
  setIc: (field: keyof WorkspaceData["ic"], value: string) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  data: defaultWorkspaceData(),
  status: { kind: "idle" },

  load: async () => {
    set({ status: { kind: "loading" } });
    try {
      const res = await fetch("/api/workspace", { credentials: "include" });
      if (!res.ok) {
        const t = await res.text();
        set({ status: { kind: "load-error", message: `Load failed: ${t.slice(0, 200)}` } });
        return;
      }
      const json = (await res.json()) as WorkspaceData;
      set({ data: json, status: { kind: "ready" } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Load error";
      set({ status: { kind: "load-error", message: msg } });
    }
  },

  save: async () => {
    set({ status: { kind: "saving" } });
    try {
      const res = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(get().data),
      });
      if (!res.ok) {
        const t = await res.text();
        set({ status: { kind: "save-error", message: `Save failed: ${t.slice(0, 200)}` } });
        return;
      }
      set({ status: { kind: "ready" } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save error";
      set({ status: { kind: "save-error", message: msg } });
    }
  },

  patch: (partial: Partial<WorkspaceData>) => {
    set((s) => ({ data: { ...s.data, ...partial } as WorkspaceData }));
  },

  setBsa: (field, value) => {
    set((s) => ({
      data: {
        ...s.data,
        bsa: { ...s.data.bsa, [field]: value },
      },
    }));
  },

  setTeam: (field, value) => {
    set((s) => ({
      data: {
        ...s.data,
        team: { ...s.data.team, [field]: value },
      },
    }));
  },

  setIc: (field, value) => {
    set((s) => ({
      data: {
        ...s.data,
        ic: { ...s.data.ic, [field]: value },
      },
    }));
  },
}));
