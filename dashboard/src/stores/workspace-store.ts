import { create } from "zustand";

import type { WorkspaceData } from "@/lib/workspace-data";
import { defaultWorkspaceData } from "@/lib/workspace-data";

type WorkspaceState = {
  data: WorkspaceData;
  loaded: boolean;
  saving: boolean;
  error: string | null;
  load: () => Promise<void>;
  save: () => Promise<void>;
  patch: (partial: Partial<WorkspaceData>) => void;
  setBsa: (field: keyof WorkspaceData["bsa"], value: string) => void;
  setTeam: (field: keyof WorkspaceData["team"], value: string) => void;
  setIc: (field: keyof WorkspaceData["ic"], value: string) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  data: defaultWorkspaceData(),
  loaded: false,
  saving: false,
  error: null,

  load: async () => {
    set({ error: null });
    try {
      const res = await fetch("/api/workspace", { credentials: "include" });
      if (!res.ok) {
        const t = await res.text();
        set({ error: `Load failed: ${t.slice(0, 200)}` });
        return;
      }
      const json = (await res.json()) as WorkspaceData;
      set({ data: json, loaded: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Load error";
      set({ error: msg });
    }
  },

  save: async () => {
    set({ saving: true, error: null });
    try {
      const res = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(get().data),
      });
      if (!res.ok) {
        const t = await res.text();
        set({ saving: false, error: `Save failed: ${t.slice(0, 200)}` });
        return;
      }
      set({ saving: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save error";
      set({ saving: false, error: msg });
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
